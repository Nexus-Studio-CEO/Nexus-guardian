// NEXUS Guardian - GitHub API Module
// All GitHub interactions

window.GitHubAPI = (() => {
    
    async function getConfig() {
        const config = await window.NexusCrypto.getDecryptedData('nexus_config');
        if (!config?.github?.token || !config?.github?.username) {
            throw new Error('GitHub configuration missing. Please configure in Settings.');
        }
        return config.github;
    }

    async function fetchUserRepos() {
        const { token, username } = await getConfig();
        
        const response = await fetch(
            `https://api.github.com/users/${username}/repos?per_page=100&sort=updated`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );
        
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }
        
        return await response.json();
    }

    async function fetchRepoContent(owner, repo, branch, depth = 'full') {
        const { token } = await getConfig();
        
        const treeRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );
        
        if (!treeRes.ok) {
            throw new Error(`Failed to fetch repo tree: ${treeRes.status}`);
        }
        
        const treeData = await treeRes.json();
        const files = treeData.tree.filter(f => f.type === 'blob');
        
        if (depth === 'skeleton') {
            return files.slice(0, 20).map(f => f.path);
        }
        
        const fileContents = [];
        for (const file of files.slice(0, 50)) {
            try {
                const contentRes = await fetch(file.url, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/vnd.github.v3.raw'
                    }
                });
                
                if (contentRes.ok) {
                    const content = await contentRes.text();
                    fileContents.push({ path: file.path, content });
                }
            } catch (e) {
                console.warn(`Failed to fetch ${file.path}:`, e);
            }
        }
        
        return fileContents;
    }

    async function createBranch(owner, repo, baseBranch, newBranch) {
        const { token } = await getConfig();
        
        const refRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${baseBranch}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );
        
        const refData = await refRes.json();
        const sha = refData.object.sha;
        
        const createRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/git/refs`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ref: `refs/heads/${newBranch}`,
                    sha: sha
                })
            }
        );
        
        return createRes.ok;
    }

    async function createPullRequest(owner, repo, baseBranch, headBranch, title, body) {
        const { token } = await getConfig();
        
        const prRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/pulls`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title,
                    body,
                    head: headBranch,
                    base: baseBranch
                })
            }
        );
        
        if (!prRes.ok) {
            const error = await prRes.text();
            throw new Error(`Failed to create PR: ${error}`);
        }
        
        const prData = await prRes.json();
        return prData.html_url;
    }

    async function createRepository(repoName, description = '', isPrivate = false) {
        const { token } = await getConfig();
        
        const createRes = await fetch(
            'https://api.github.com/user/repos',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: repoName,
                    description,
                    private: isPrivate,
                    auto_init: true
                })
            }
        );
        
        if (!createRes.ok) {
            const error = await createRes.text();
            throw new Error(`Failed to create repo: ${error}`);
        }
        
        const repoData = await createRes.json();
        return repoData;
    }

    async function uploadFile(owner, repo, filePath, content, commitMessage) {
        const { token } = await getConfig();
        
        const base64Content = btoa(unescape(encodeURIComponent(content)));
        
        const uploadRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: commitMessage,
                    content: base64Content
                })
            }
        );
        
        return uploadRes.ok;
    }

    async function learnProjectPatterns(owner, repo) {
        const { token } = await getConfig();
        
        const prsRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/pulls?state=closed&sort=updated&per_page=10`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );
        
        const allPRs = await prsRes.json();
        const mergedPRs = allPRs.filter(pr => pr.merged_at).slice(0, 3);
        
        const commitPatterns = [];
        for (const pr of mergedPRs) {
            const commitsRes = await fetch(pr.commits_url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            const commits = await commitsRes.json();
            commits.forEach(c => commitPatterns.push(c.commit.message));
        }
        
        const hasConventionalCommits = commitPatterns.some(msg =>
            /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?:/.test(msg)
        );
        
        const commitStyle = hasConventionalCommits ? 'conventional' : 'standard';
        
        const branchPatterns = mergedPRs.map(pr => pr.head.ref);
        const branchPrefixes = branchPatterns
            .map(b => b.split('/')[0])
            .filter(Boolean);
        
        const commonPrefix = branchPrefixes.length > 0
            ? branchPrefixes.sort((a, b) =>
                branchPrefixes.filter(v => v === b).length - branchPrefixes.filter(v => v === a).length
            )[0]
            : 'feature';
        
        const prBodies = mergedPRs.map(pr => pr.body);
        const hasChecklist = prBodies.some(body => body && body.includes('- ['));
        const hasTestsSection = prBodies.some(body => body && /## Tests?/i.test(body));
        
        return {
            commitStyle,
            branchPrefix: commonPrefix,
            prTemplate: {
                hasChecklist,
                hasTestsSection
            },
            testFramework: 'unknown',
            examples: {
                commits: commitPatterns.slice(0, 3),
                branches: branchPatterns.slice(0, 3)
            }
        };
    }

    async function findGoodFirstIssues(owner, repo) {
        const { token } = await getConfig();
        
        const issuesRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/issues?labels=good-first-issue,help-wanted&state=open&per_page=10`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );
        
        if (!issuesRes.ok) {
            return [];
        }
        
        return await issuesRes.json();
    }

    async function analyzeTopSimilarRepos(topic) {
        const { token } = await getConfig();
        
        const searchRes = await fetch(
            `https://api.github.com/search/repositories?q=topic:${topic}&sort=stars&per_page=10`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );
        
        const topRepos = await searchRes.json();
        
        let totalStars = 0;
        const topics = {};
        
        for (const repo of topRepos.items || []) {
            totalStars += repo.stargazers_count;
            (repo.topics || []).forEach(t => {
                topics[t] = (topics[t] || 0) + 1;
            });
        }
        
        const avgStars = topRepos.items ? Math.round(totalStars / topRepos.items.length) : 0;
        
        const sortedTopics = Object.entries(topics)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([topic]) => topic);
        
        return {
            avgStars,
            recommendedTopics: sortedTopics,
            readmePatterns: {
                hasBadges: 80,
                hasScreenshots: 60,
                hasQuickStart: 90
            }
        };
    }

    return {
        fetchUserRepos,
        fetchRepoContent,
        createBranch,
        createPullRequest,
        createRepository,
        uploadFile,
        learnProjectPatterns,
        findGoodFirstIssues,
        analyzeTopSimilarRepos
    };
})();