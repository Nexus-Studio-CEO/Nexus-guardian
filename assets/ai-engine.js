// NEXUS Guardian - AI Engine Module
// Multi-provider AI with Self-Reflection

window.AIEngine = (() => {
    
    const PROVIDERS = {
        anthropic: {
            name: 'Anthropic Claude',
            endpoint: 'https://api.anthropic.com/v1/messages',
            defaultModels: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514']
        },
        openai: {
            name: 'OpenAI GPT',
            endpoint: 'https://api.openai.com/v1/chat/completions',
            modelsEndpoint: 'https://api.openai.com/v1/models'
        },
        google: {
            name: 'Google Gemini',
            endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
            modelsEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models'
        },
        groq: {
            name: 'Groq',
            endpoint: 'https://api.groq.com/openai/v1/chat/completions',
            modelsEndpoint: 'https://api.groq.com/openai/v1/models'
        },
        openrouter: {
            name: 'OpenRouter',
            endpoint: 'https://openrouter.ai/api/v1/chat/completions',
            modelsEndpoint: 'https://openrouter.ai/api/v1/models'
        }
    };

    const PERSONAS = {
        architect: {
            name: 'Lead Architecte',
            prompt: 'Tu es un architecte logiciel senior. Analyse ce code avec une vision holistique : architecture globale, patterns de design, scalabilité, maintenabilité.'
        },
        security: {
            name: 'Expert Sécurité',
            prompt: 'Tu es un expert en cybersécurité paranoïaque. Cherche toutes les vulnérabilités potentielles : injections SQL, XSS, CSRF, fuites de données.'
        },
        mentor: {
            name: 'Mentor Dev',
            prompt: 'Tu es un mentor pédagogique bienveillant. Explique chaque problème trouvé de manière claire et éducative, avec des exemples de bonnes pratiques.'
        }
    };

    async function getLeadProvider() {
        const leadKey = await window.NexusCrypto.getDecryptedData('nexus_lead_provider');
        if (!leadKey) {
            throw new Error('No Lead provider configured. Please configure a Lead provider in Settings.');
        }
        
        const config = await window.NexusCrypto.getDecryptedData(`nexus_provider_${leadKey}`);
        if (!config?.apiKey || !config?.selectedModel) {
            throw new Error('Lead provider not properly configured.');
        }
        
        return { providerKey: leadKey, config };
    }

    async function callAI(providerKey, config, prompt) {
        const provider = PROVIDERS[providerKey];
        const { apiKey, selectedModel } = config;
        
        let url = provider.endpoint;
        let headers = { 'Content-Type': 'application/json' };
        let body = {};
        
        if (providerKey === 'anthropic') {
            headers['x-api-key'] = apiKey;
            headers['anthropic-version'] = '2023-06-01';
            body = {
                model: selectedModel,
                max_tokens: 4096,
                messages: [{ role: 'user', content: prompt }]
            };
        } else if (providerKey === 'groq' || providerKey === 'openai' || providerKey === 'openrouter') {
            headers['Authorization'] = `Bearer ${apiKey}`;
            if (providerKey === 'openrouter') {
                headers['HTTP-Referer'] = window.location.href;
                headers['X-Title'] = 'NEXUS Guardian';
            }
            body = {
                model: selectedModel,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 4096
            };
        } else if (providerKey === 'google') {
            url = `${provider.endpoint}/${selectedModel}:generateContent?key=${apiKey}`;
            body = {
                contents: [{ parts: [{ text: prompt }] }]
            };
        }
        
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`AI API Error ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        
        if (providerKey === 'anthropic') {
            return data.content[0].text;
        } else if (providerKey === 'groq' || providerKey === 'openai' || providerKey === 'openrouter') {
            return data.choices[0].message.content;
        } else if (providerKey === 'google') {
            return data.candidates[0].content.parts[0].text;
        }
        
        return '';
    }

    async function callAIWithSelfReflection(providerKey, config, userPrompt) {
        const enhancedPrompt = `${userPrompt}

INSTRUCTIONS CRITIQUES:
1. Génère le contenu demandé
2. ENSUITE, dans ta propre réponse, inclus une section <self-check>
3. Dans <self-check>, analyse ton propre contenu selon ces critères:
   - Répond-il EXACTEMENT à l'objectif ?
   - Y a-t-il des bugs évidents ?
   - Edge cases couverts ?
   - Sécurité OK ?
   - Performance acceptable ?
4. Si tu détectes un problème, CORRIGE directement dans ta réponse
5. Mets la version FINALE après </self-check>

FORMAT RÉPONSE:
[ton contenu initial]

<self-check>
✓ Objectif atteint: OUI/NON
✓ Bugs détectés: [liste ou "aucun"]
✓ Corrections nécessaires: [liste ou "aucun"]
</self-check>

[contenu corrigé si nécessaire, sinon identique]`;

        const response = await callAI(providerKey, config, enhancedPrompt);
        
        const selfCheckMatch = response.match(/<self-check>([\s\S]*?)<\/self-check>/);
        if (selfCheckMatch) {
            const selfCheck = selfCheckMatch[1];
            const needsCorrection = selfCheck.includes('NON') || 
                                  !selfCheck.includes('aucun');
            
            if (needsCorrection) {
                await window.NexusApp.log('warning', 'Self-reflection detected issues, applying corrections', { workflow: 'ai_reflection' });
            }
            
            const finalContent = response.split('</self-check>')[1]?.trim() || response;
            return finalContent;
        }
        
        return response;
    }

    async function fetchProviderModels(providerKey, apiKey) {
        const provider = PROVIDERS[providerKey];
        
        if (provider.defaultModels) {
            return provider.defaultModels;
        }
        
        if (!provider.modelsEndpoint) {
            throw new Error('This provider does not support model fetching');
        }
        
        let url = provider.modelsEndpoint;
        let headers = { 'Content-Type': 'application/json' };
        
        if (providerKey === 'anthropic') {
            headers['x-api-key'] = apiKey;
            headers['anthropic-version'] = '2023-06-01';
        } else if (providerKey === 'google') {
            url = `${url}?key=${apiKey}`;
        } else {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        
        if (providerKey === 'openrouter') {
            headers['HTTP-Referer'] = window.location.href;
            headers['X-Title'] = 'NEXUS Guardian';
        }
        
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (providerKey === 'groq' || providerKey === 'openai') {
            return data.data.map(m => m.id);
        } else if (providerKey === 'openrouter') {
            return data.data.map(m => m.id);
        } else if (providerKey === 'google') {
            return data.models.filter(m => m.name.includes('gemini')).map(m => m.name);
        }
        
        return [];
    }

    async function runAuditWithSelfReflection(repoInfo, persona, depth, statusCallback) {
        const { providerKey, config } = await getLeadProvider();
        
        statusCallback({ message: 'Récupération du repository...', sub: 'GitHub API' });
        const repoContent = await window.GitHubAPI.fetchRepoContent(repoInfo.owner, repoInfo.name, repoInfo.branch, depth);
        
        statusCallback({ message: `Analyse ${depth === 'skeleton' ? 'squelette' : 'intégrale'}...`, sub: `${Array.isArray(repoContent) ? repoContent.length : 'N'} fichiers` });
        
        const filesList = Array.isArray(repoContent)
            ? repoContent.map(f => typeof f === 'string' ? f : f.path).join('\n')
            : repoContent.join('\n');
        
        const auditPrompt = `${PERSONAS[persona].prompt}

Repository: ${repoInfo.owner}/${repoInfo.name}
Branche: ${repoInfo.branch}
Profondeur: ${depth === 'skeleton' ? 'Architecture uniquement' : 'Analyse complète'}
Fichiers:
${filesList}

Fournis un rapport d'audit complet au format Markdown avec:
1. Résumé de santé (complexité, sécurité, dette technique)
2. Problèmes critiques identifiés avec fichiers et lignes
3. Recommandations d'amélioration concrètes
4. Plan d'action avec code de correction si nécessaire`;

        statusCallback({ message: `Consultation ${PERSONAS[persona].name}...`, sub: 'Génération rapport' });
        const report = await callAIWithSelfReflection(providerKey, config, auditPrompt);
        
        statusCallback({ message: 'Création de la Pull Request...', sub: 'GitHub' });
        const newBranch = `nexus-audit-${Date.now()}`;
        await window.GitHubAPI.createBranch(repoInfo.owner, repoInfo.name, repoInfo.branch, newBranch);
        
        const prUrl = await window.GitHubAPI.createPullRequest(
            repoInfo.owner,
            repoInfo.name,
            repoInfo.branch,
            newBranch,
            '🔧 NEXUS Guardian - Audit & Corrections',
            `## Rapport d'Audit NEXUS Guardian\n\n${report}\n\n---\n*Généré automatiquement par NEXUS Guardian*`
        );
        
        return { report, prUrl };
    }

    async function runVibeGenerationWithSelfReflection(projectInfo, statusCallback) {
        const { providerKey, config } = await getLeadProvider();
        
        statusCallback({ message: "Structuration de l'architecture...", sub: 'Conception arborescence' });
        
        const vibePrompt = `Tu es un architecte génératif expert. Génère un projet COMPLET et PROFESSIONNEL.

Vision: ${projectInfo.prompt}
Stack: ${projectInfo.stack}
DevOps: ${projectInfo.devops}
Style: ${projectInfo.style}

Fournis au format Markdown avec CETTE STRUCTURE EXACTE:

# Projet: ${projectInfo.repoName}

## Arborescence
\`\`\`
[arborescence complète]
\`\`\`

## Fichiers

### README.md
\`\`\`markdown
[README professionnel avec hero, badges, features, quick start]
\`\`\`

### package.json
\`\`\`json
[configuration complète]
\`\`\`

${projectInfo.devops !== 'none' ? '### .github/workflows/ci.yml\n```yaml\n[workflow GitHub Actions complet]\n```\n\n' : ''}

### src/index.js
\`\`\`javascript
[code principal avec JSDoc complet]
\`\`\`

[autres fichiers clés avec contenu complet]

Sois exhaustif, professionnel et prêt pour production.`;

        statusCallback({ message: 'Génération du code source...', sub: 'Écriture composants' });
        const generatedContent = await callAIWithSelfReflection(providerKey, config, vibePrompt);
        
        statusCallback({ message: 'Création du repository GitHub...', sub: 'Initialisation' });
        const repoData = await window.GitHubAPI.createRepository(projectInfo.repoName, `Generated by NEXUS Guardian - ${projectInfo.prompt.slice(0, 100)}`);
        
        statusCallback({ message: 'Upload des fichiers...', sub: 'Push vers GitHub' });
        await new Promise(r => setTimeout(r, 2000));
        
        const files = parseGeneratedFiles(generatedContent);
        for (const file of files) {
            await window.GitHubAPI.uploadFile(repoData.owner.login, projectInfo.repoName, file.path, file.content, `Add ${file.path}`);
        }
        
        return {
            content: generatedContent,
            repoUrl: repoData.html_url
        };
    }

    async function runContributorWithSelfReflection(repoInfo, issueUrl, patterns, statusCallback) {
        const { providerKey, config } = await getLeadProvider();
        
        statusCallback({ message: 'Analyse de l\'issue...', sub: 'Extraction contexte' });
        
        const contributionPrompt = `Tu dois contribuer au projet: ${repoInfo.owner}/${repoInfo.repo}

Patterns du projet (OBLIGATOIRE à respecter):
- Style commits: ${patterns.commitStyle}
  Exemples: ${patterns.examples.commits.join(', ')}
  
- Naming branches: Préfixe "${patterns.branchPrefix}/"
  Exemples: ${patterns.examples.branches.join(', ')}
  
- PR Template:
  ${patterns.prTemplate.hasChecklist ? '- Inclure checklist [ ]' : ''}
  ${patterns.prTemplate.hasTestsSection ? '- Inclure section ## Tests' : ''}
  
Issue à résoudre: ${issueUrl}

Génère:
1. Nom de branche (suivant convention)
2. Code correction
3. Message commit (style ${patterns.commitStyle})
4. Description PR (suivant template projet)

Format Markdown avec sections claires.`;

        statusCallback({ message: 'Génération de la contribution...', sub: 'Code + PR description' });
        const contribution = await callAIWithSelfReflection(providerKey, config, contributionPrompt);
        
        statusCallback({ message: 'Création fork + branche...', sub: 'GitHub' });
        const newBranch = `${patterns.branchPrefix}/nexus-contrib-${Date.now()}`;
        await window.GitHubAPI.createBranch(repoInfo.owner, repoInfo.repo, 'main', newBranch);
        
        const prUrl = await window.GitHubAPI.createPullRequest(
            repoInfo.owner,
            repoInfo.repo,
            'main',
            newBranch,
            '✨ Contribution via NEXUS Guardian',
            contribution
        );
        
        return { contribution, prUrl };
    }

    function parseGeneratedFiles(markdown) {
        const files = [];
        const codeBlockRegex = /###\s+(.+?)\n```(?:\w+)?\n([\s\S]+?)\n```/g;
        let match;
        
        while ((match = codeBlockRegex.exec(markdown)) !== null) {
            const path = match[1].trim();
            const content = match[2].trim();
            files.push({ path, content });
        }
        
        if (files.length === 0) {
            files.push({
                path: 'README.md',
                content: markdown
            });
        }
        
        return files;
    }

    return {
        fetchProviderModels,
        runAuditWithSelfReflection,
        runVibeGenerationWithSelfReflection,
        runContributorWithSelfReflection
    };
})();