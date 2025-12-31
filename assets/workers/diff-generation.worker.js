// NEXUS Guardian - Diff Generation Worker
// Generate unified diffs for code changes

self.addEventListener('message', async (event) => {
    const { action, data } = event.data;

    try {
        switch (action) {
            case 'generateDiff':
                const diff = generateUnifiedDiff(data.original, data.modified, data.filename);
                self.postMessage({ success: true, diff });
                break;

            case 'applyPatch':
                const patched = applyPatch(data.original, data.patch);
                self.postMessage({ success: true, patched });
                break;

            case 'parseDiff':
                const parsed = parseDiff(data.diffText);
                self.postMessage({ success: true, parsed });
                break;

            default:
                self.postMessage({ success: false, error: 'Unknown action' });
        }
    } catch (error) {
        self.postMessage({ success: false, error: error.message });
    }
});

function generateUnifiedDiff(originalText, modifiedText, filename = 'file') {
    const originalLines = originalText.split('\n');
    const modifiedLines = modifiedText.split('\n');
    
    const diff = computeDiff(originalLines, modifiedLines);
    
    return formatUnifiedDiff(diff, filename, originalLines, modifiedLines);
}

function computeDiff(original, modified) {
    const n = original.length;
    const m = modified.length;
    
    const lcs = computeLCS(original, modified);
    
    const changes = [];
    let i = 0, j = 0, lcsIndex = 0;
    
    while (i < n || j < m) {
        if (lcsIndex < lcs.length && i < n && original[i] === lcs[lcsIndex]) {
            changes.push({ type: 'equal', line: original[i], oldLine: i, newLine: j });
            i++;
            j++;
            lcsIndex++;
        } else if (j < m && (lcsIndex >= lcs.length || modified[j] !== lcs[lcsIndex])) {
            changes.push({ type: 'add', line: modified[j], oldLine: i, newLine: j });
            j++;
        } else if (i < n) {
            changes.push({ type: 'delete', line: original[i], oldLine: i, newLine: j });
            i++;
        }
    }
    
    return changes;
}

function computeLCS(arr1, arr2) {
    const n = arr1.length;
    const m = arr2.length;
    const dp = Array(n + 1).fill(null).map(() => Array(m + 1).fill(0));
    
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            if (arr1[i - 1] === arr2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    
    const lcs = [];
    let i = n, j = m;
    
    while (i > 0 && j > 0) {
        if (arr1[i - 1] === arr2[j - 1]) {
            lcs.unshift(arr1[i - 1]);
            i--;
            j--;
        } else if (dp[i - 1][j] > dp[i][j - 1]) {
            i--;
        } else {
            j--;
        }
    }
    
    return lcs;
}

function formatUnifiedDiff(changes, filename, originalLines, modifiedLines) {
    let output = `--- a/${filename}\n`;
    output += `+++ b/${filename}\n`;
    
    const hunks = groupIntoHunks(changes);
    
    hunks.forEach(hunk => {
        const header = `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@\n`;
        output += header;
        
        hunk.lines.forEach(change => {
            if (change.type === 'delete') {
                output += `-${change.line}\n`;
            } else if (change.type === 'add') {
                output += `+${change.line}\n`;
            } else {
                output += ` ${change.line}\n`;
            }
        });
    });
    
    return output;
}

function groupIntoHunks(changes, context = 3) {
    const hunks = [];
    let currentHunk = null;
    let contextBuffer = [];
    
    changes.forEach((change, index) => {
        if (change.type !== 'equal') {
            if (!currentHunk) {
                currentHunk = {
                    oldStart: Math.max(1, change.oldLine - context + 1),
                    newStart: Math.max(1, change.newLine - context + 1),
                    oldCount: 0,
                    newCount: 0,
                    lines: [...contextBuffer]
                };
            }
            
            currentHunk.lines.push(change);
            
            if (change.type === 'delete') {
                currentHunk.oldCount++;
            } else if (change.type === 'add') {
                currentHunk.newCount++;
            }
            
            contextBuffer = [];
        } else {
            if (currentHunk) {
                contextBuffer.push(change);
                
                if (contextBuffer.length > context * 2) {
                    currentHunk.lines.push(...contextBuffer.slice(0, context));
                    currentHunk.oldCount += context;
                    currentHunk.newCount += context;
                    
                    hunks.push(currentHunk);
                    currentHunk = null;
                    contextBuffer = contextBuffer.slice(-context);
                }
            } else {
                contextBuffer.push(change);
                if (contextBuffer.length > context) {
                    contextBuffer.shift();
                }
            }
        }
    });
    
    if (currentHunk) {
        currentHunk.lines.push(...contextBuffer);
        currentHunk.oldCount += contextBuffer.length;
        currentHunk.newCount += contextBuffer.length;
        hunks.push(currentHunk);
    }
    
    return hunks;
}

function applyPatch(originalText, patchText) {
    const originalLines = originalText.split('\n');
    const patches = parseDiff(patchText);
    
    let result = [...originalLines];
    let offset = 0;
    
    patches.forEach(patch => {
        patch.hunks.forEach(hunk => {
            const startLine = hunk.oldStart - 1 + offset;
            let deleteCount = 0;
            let insertLines = [];
            
            hunk.lines.forEach(line => {
                if (line.type === 'delete') {
                    deleteCount++;
                } else if (line.type === 'add') {
                    insertLines.push(line.content);
                }
            });
            
            result.splice(startLine, deleteCount, ...insertLines);
            offset += insertLines.length - deleteCount;
        });
    });
    
    return result.join('\n');
}

function parseDiff(diffText) {
    const lines = diffText.split('\n');
    const patches = [];
    let currentPatch = null;
    let currentHunk = null;
    
    lines.forEach(line => {
        if (line.startsWith('---')) {
            if (currentPatch) {
                patches.push(currentPatch);
            }
            currentPatch = {
                oldFile: line.substring(4).trim(),
                newFile: null,
                hunks: []
            };
        } else if (line.startsWith('+++')) {
            if (currentPatch) {
                currentPatch.newFile = line.substring(4).trim();
            }
        } else if (line.startsWith('@@')) {
            const match = line.match(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
            if (match) {
                currentHunk = {
                    oldStart: parseInt(match[1]),
                    oldCount: parseInt(match[2]),
                    newStart: parseInt(match[3]),
                    newCount: parseInt(match[4]),
                    lines: []
                };
                if (currentPatch) {
                    currentPatch.hunks.push(currentHunk);
                }
            }
        } else if (currentHunk) {
            if (line.startsWith('-')) {
                currentHunk.lines.push({
                    type: 'delete',
                    content: line.substring(1)
                });
            } else if (line.startsWith('+')) {
                currentHunk.lines.push({
                    type: 'add',
                    content: line.substring(1)
                });
            } else if (line.startsWith(' ')) {
                currentHunk.lines.push({
                    type: 'equal',
                    content: line.substring(1)
                });
            }
        }
    });
    
    if (currentPatch) {
        patches.push(currentPatch);
    }
    
    return patches;
}

function generatePatchStats(changes) {
    const stats = {
        additions: 0,
        deletions: 0,
        modifications: 0,
        files: new Set()
    };
    
    changes.forEach(change => {
        if (change.type === 'add') {
            stats.additions++;
        } else if (change.type === 'delete') {
            stats.deletions++;
        }
    });
    
    return stats;
}

self.postMessage({ ready: true });