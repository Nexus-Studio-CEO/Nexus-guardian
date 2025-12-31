// NEXUS Guardian - Code Analysis Worker
// Heavy code analysis offloaded to Web Worker

self.addEventListener('message', async (event) => {
    const { action, data } = event.data;

    try {
        switch (action) {
            case 'analyze':
                const result = await analyzeCode(data.code, data.options);
                self.postMessage({ success: true, result });
                break;

            case 'calculateMetrics':
                const metrics = calculateComplexityMetrics(data.code);
                self.postMessage({ success: true, metrics });
                break;

            case 'findPatterns':
                const patterns = findCodePatterns(data.code, data.patterns);
                self.postMessage({ success: true, patterns });
                break;

            default:
                self.postMessage({ success: false, error: 'Unknown action' });
        }
    } catch (error) {
        self.postMessage({ success: false, error: error.message });
    }
});

async function analyzeCode(code, options = {}) {
    const startTime = performance.now();
    
    const analysis = {
        linesOfCode: countLines(code),
        complexity: calculateComplexityMetrics(code),
        issues: findPotentialIssues(code),
        dependencies: extractDependencies(code),
        functions: extractFunctions(code),
        classes: extractClasses(code),
        comments: analyzeComments(code),
        depth: options.depth || 'full'
    };

    analysis.processingTime = performance.now() - startTime;
    
    return analysis;
}

function countLines(code) {
    const lines = code.split('\n');
    const nonEmpty = lines.filter(line => line.trim().length > 0).length;
    const comments = lines.filter(line => {
        const trimmed = line.trim();
        return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
    }).length;
    
    return {
        total: lines.length,
        code: nonEmpty - comments,
        comments: comments,
        blank: lines.length - nonEmpty
    };
}

function calculateComplexityMetrics(code) {
    const cyclomaticComplexity = calculateCyclomaticComplexity(code);
    const cognitiveComplexity = calculateCognitiveComplexity(code);
    const halsteadMetrics = calculateHalsteadMetrics(code);
    
    return {
        cyclomatic: cyclomaticComplexity,
        cognitive: cognitiveComplexity,
        halstead: halsteadMetrics,
        maintainability: calculateMaintainabilityIndex(cyclomaticComplexity, halsteadMetrics)
    };
}

function calculateCyclomaticComplexity(code) {
    const controlFlowKeywords = [
        /\bif\b/g,
        /\belse\b/g,
        /\bfor\b/g,
        /\bwhile\b/g,
        /\bcase\b/g,
        /\bcatch\b/g,
        /\b&&\b/g,
        /\b\|\|\b/g,
        /\?\s*.*\s*:/g
    ];
    
    let complexity = 1;
    
    controlFlowKeywords.forEach(pattern => {
        const matches = code.match(pattern);
        if (matches) {
            complexity += matches.length;
        }
    });
    
    return complexity;
}

function calculateCognitiveComplexity(code) {
    let complexity = 0;
    let nestingLevel = 0;
    
    const lines = code.split('\n');
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        if (/\bif\b|\bfor\b|\bwhile\b|\bswitch\b/.test(trimmed)) {
            complexity += (1 + nestingLevel);
        }
        
        if (/\{/.test(trimmed)) {
            nestingLevel++;
        }
        if (/\}/.test(trimmed)) {
            nestingLevel = Math.max(0, nestingLevel - 1);
        }
        
        if (/\b&&\b|\b\|\|\b/.test(trimmed)) {
            complexity += 1;
        }
    }
    
    return complexity;
}

function calculateHalsteadMetrics(code) {
    const operators = code.match(/[+\-*/%=<>!&|^~?:]/g) || [];
    const operands = code.match(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g) || [];
    
    const uniqueOperators = [...new Set(operators)];
    const uniqueOperands = [...new Set(operands)];
    
    const n1 = uniqueOperators.length;
    const n2 = uniqueOperands.length;
    const N1 = operators.length;
    const N2 = operands.length;
    
    const vocabulary = n1 + n2;
    const length = N1 + N2;
    const volume = length * Math.log2(vocabulary || 1);
    const difficulty = (n1 / 2) * (N2 / (n2 || 1));
    const effort = volume * difficulty;
    
    return {
        vocabulary,
        length,
        volume: Math.round(volume),
        difficulty: Math.round(difficulty * 100) / 100,
        effort: Math.round(effort)
    };
}

function calculateMaintainabilityIndex(cyclomaticComplexity, halsteadMetrics) {
    const linesOfCode = 100;
    const volume = halsteadMetrics.volume || 1;
    
    const mi = Math.max(0,
        (171 - 5.2 * Math.log(volume) - 0.23 * cyclomaticComplexity - 16.2 * Math.log(linesOfCode)) * 100 / 171
    );
    
    return Math.round(mi);
}

function findPotentialIssues(code) {
    const issues = [];
    
    const patterns = [
        {
            regex: /eval\(/g,
            type: 'security',
            severity: 'critical',
            message: 'Usage de eval() détecté (risque de sécurité)'
        },
        {
            regex: /innerHTML\s*=/g,
            type: 'security',
            severity: 'high',
            message: 'Usage de innerHTML (risque XSS)'
        },
        {
            regex: /console\.(log|warn|error)/g,
            type: 'quality',
            severity: 'low',
            message: 'Console statements en production'
        },
        {
            regex: /var\s+/g,
            type: 'quality',
            severity: 'medium',
            message: 'Usage de var (préférer let/const)'
        },
        {
            regex: /==(?!=)/g,
            type: 'quality',
            severity: 'medium',
            message: 'Usage de == (préférer ===)'
        },
        {
            regex: /setTimeout\([^,]+,\s*0\)/g,
            type: 'performance',
            severity: 'low',
            message: 'setTimeout avec délai 0 (anti-pattern)'
        }
    ];
    
    const lines = code.split('\n');
    
    patterns.forEach(pattern => {
        lines.forEach((line, index) => {
            if (pattern.regex.test(line)) {
                issues.push({
                    line: index + 1,
                    type: pattern.type,
                    severity: pattern.severity,
                    message: pattern.message,
                    code: line.trim()
                });
            }
        });
    });
    
    return issues;
}

function extractDependencies(code) {
    const dependencies = [];
    
    const importRegex = /import\s+.*\s+from\s+['"](.+)['"]/g;
    const requireRegex = /require\(['"](.+)['"]\)/g;
    
    let match;
    
    while ((match = importRegex.exec(code)) !== null) {
        dependencies.push({
            type: 'import',
            module: match[1]
        });
    }
    
    while ((match = requireRegex.exec(code)) !== null) {
        dependencies.push({
            type: 'require',
            module: match[1]
        });
    }
    
    return dependencies;
}

function extractFunctions(code) {
    const functions = [];
    
    const functionRegex = /(?:function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))/g;
    
    let match;
    while ((match = functionRegex.exec(code)) !== null) {
        const name = match[1] || match[2];
        if (name) {
            functions.push({
                name,
                line: code.substring(0, match.index).split('\n').length
            });
        }
    }
    
    return functions;
}

function extractClasses(code) {
    const classes = [];
    
    const classRegex = /class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    
    let match;
    while ((match = classRegex.exec(code)) !== null) {
        classes.push({
            name: match[1],
            line: code.substring(0, match.index).split('\n').length
        });
    }
    
    return classes;
}

function analyzeComments(code) {
    const lines = code.split('\n');
    
    let singleLine = 0;
    let multiLine = 0;
    let docComments = 0;
    
    let inMultiLine = false;
    
    lines.forEach(line => {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('/**')) {
            docComments++;
            inMultiLine = true;
        } else if (trimmed.startsWith('/*')) {
            multiLine++;
            inMultiLine = true;
        } else if (trimmed.startsWith('//')) {
            singleLine++;
        } else if (trimmed.endsWith('*/')) {
            inMultiLine = false;
        }
    });
    
    return {
        singleLine,
        multiLine,
        docComments,
        total: singleLine + multiLine + docComments
    };
}

function findCodePatterns(code, patterns) {
    const found = [];
    
    patterns.forEach(pattern => {
        const regex = new RegExp(pattern.regex, 'g');
        const matches = code.match(regex);
        
        if (matches) {
            found.push({
                pattern: pattern.name,
                count: matches.length,
                examples: matches.slice(0, 3)
            });
        }
    });
    
    return found;
}

self.postMessage({ ready: true });