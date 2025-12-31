// NEXUS Guardian - Metrics Calculator Worker
// Calculate visibility and growth metrics

self.addEventListener('message', async (event) => {
    const { action, data } = event.data;

    try {
        switch (action) {
            case 'calculateGrowthMetrics':
                const growth = calculateGrowthMetrics(data.history);
                self.postMessage({ success: true, growth });
                break;

            case 'predictTrend':
                const prediction = predictTrend(data.dataPoints, data.days);
                self.postMessage({ success: true, prediction });
                break;

            case 'analyzeEngagement':
                const engagement = analyzeEngagement(data.metrics);
                self.postMessage({ success: true, engagement });
                break;

            case 'calculateScore':
                const score = calculateVisibilityScore(data.repo);
                self.postMessage({ success: true, score });
                break;

            default:
                self.postMessage({ success: false, error: 'Unknown action' });
        }
    } catch (error) {
        self.postMessage({ success: false, error: error.message });
    }
});

function calculateGrowthMetrics(history) {
    if (!history || history.length < 2) {
        return {
            totalGrowth: 0,
            percentageGrowth: 0,
            avgDailyGrowth: 0,
            trend: 'stable'
        };
    }
    
    const sorted = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const initial = sorted[0].value;
    const final = sorted[sorted.length - 1].value;
    const totalGrowth = final - initial;
    const percentageGrowth = initial > 0 ? ((totalGrowth / initial) * 100) : 0;
    
    const days = (new Date(sorted[sorted.length - 1].date) - new Date(sorted[0].date)) / (1000 * 60 * 60 * 24);
    const avgDailyGrowth = days > 0 ? totalGrowth / days : 0;
    
    const recentGrowth = sorted.slice(-7).reduce((sum, point, index, arr) => {
        if (index === 0) return 0;
        return sum + (point.value - arr[index - 1].value);
    }, 0) / 7;
    
    let trend = 'stable';
    if (recentGrowth > avgDailyGrowth * 1.2) {
        trend = 'accelerating';
    } else if (recentGrowth < avgDailyGrowth * 0.8) {
        trend = 'decelerating';
    } else if (avgDailyGrowth > 0) {
        trend = 'growing';
    } else if (avgDailyGrowth < 0) {
        trend = 'declining';
    }
    
    return {
        totalGrowth,
        percentageGrowth: Math.round(percentageGrowth * 100) / 100,
        avgDailyGrowth: Math.round(avgDailyGrowth * 100) / 100,
        trend,
        dataPoints: sorted.length
    };
}

function predictTrend(dataPoints, futureDays) {
    if (!dataPoints || dataPoints.length < 3) {
        return {
            predictions: [],
            confidence: 0,
            method: 'insufficient_data'
        };
    }
    
    const sorted = [...dataPoints].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const x = sorted.map((_, i) => i);
    const y = sorted.map(p => p.value);
    
    const { slope, intercept, r2 } = linearRegression(x, y);
    
    const lastIndex = sorted.length - 1;
    const predictions = [];
    
    for (let i = 1; i <= futureDays; i++) {
        const futureIndex = lastIndex + i;
        const predictedValue = slope * futureIndex + intercept;
        
        const futureDate = new Date(sorted[lastIndex].date);
        futureDate.setDate(futureDate.getDate() + i);
        
        predictions.push({
            date: futureDate.toISOString().split('T')[0],
            value: Math.max(0, Math.round(predictedValue)),
            confidence: Math.round(r2 * 100)
        });
    }
    
    return {
        predictions,
        confidence: Math.round(r2 * 100),
        method: 'linear_regression',
        trend: slope > 0 ? 'upward' : slope < 0 ? 'downward' : 'flat'
    };
}

function linearRegression(x, y) {
    const n = x.length;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    const yMean = sumY / n;
    const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const ssRes = y.reduce((sum, yi, i) => {
        const predicted = slope * x[i] + intercept;
        return sum + Math.pow(yi - predicted, 2);
    }, 0);
    
    const r2 = 1 - (ssRes / ssTot);
    
    return { slope, intercept, r2 };
}

function analyzeEngagement(metrics) {
    const {
        stars = 0,
        forks = 0,
        watchers = 0,
        openIssues = 0,
        closedIssues = 0,
        pullRequests = 0,
        contributors = 0,
        commits = 0
    } = metrics;
    
    const forkRatio = stars > 0 ? (forks / stars) : 0;
    const issueResolutionRate = (openIssues + closedIssues) > 0 
        ? (closedIssues / (openIssues + closedIssues)) 
        : 0;
    
    const engagementScore = calculateEngagementScore({
        stars,
        forks,
        watchers,
        contributors,
        forkRatio,
        issueResolutionRate
    });
    
    const health = determineHealthStatus(engagementScore);
    
    return {
        score: Math.round(engagementScore),
        health,
        metrics: {
            forkRatio: Math.round(forkRatio * 100) / 100,
            issueResolutionRate: Math.round(issueResolutionRate * 100),
            commitsPerContributor: contributors > 0 ? Math.round(commits / contributors) : 0
        },
        insights: generateInsights(metrics, engagementScore)
    };
}

function calculateEngagementScore(data) {
    let score = 0;
    
    score += Math.min(data.stars * 0.5, 40);
    score += Math.min(data.forks * 2, 20);
    score += Math.min(data.watchers * 1, 10);
    score += Math.min(data.contributors * 3, 15);
    
    if (data.forkRatio > 0.1 && data.forkRatio < 0.3) {
        score += 10;
    }
    
    if (data.issueResolutionRate > 0.7) {
        score += 5;
    }
    
    return Math.min(score, 100);
}

function determineHealthStatus(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    if (score >= 20) return 'poor';
    return 'critical';
}

function generateInsights(metrics, score) {
    const insights = [];
    
    if (metrics.stars < 10) {
        insights.push({
            type: 'warning',
            message: 'Visibilité faible. Considérez améliorer le README et partager sur les réseaux sociaux.'
        });
    }
    
    if (metrics.forks === 0 && metrics.stars > 5) {
        insights.push({
            type: 'info',
            message: 'Aucun fork malgré des stars. Ajoutez des guides de contribution pour encourager l\'engagement.'
        });
    }
    
    if (metrics.contributors <= 1 && metrics.stars > 20) {
        insights.push({
            type: 'opportunity',
            message: 'Fort potentiel de collaboration. Créez des "good first issues" pour attirer des contributeurs.'
        });
    }
    
    const issueTotal = metrics.openIssues + metrics.closedIssues;
    if (issueTotal > 0 && metrics.openIssues / issueTotal > 0.5) {
        insights.push({
            type: 'warning',
            message: 'Beaucoup d\'issues ouvertes. Priorisez la résolution pour améliorer la perception du projet.'
        });
    }
    
    return insights;
}

function calculateVisibilityScore(repoData) {
    const components = {
        content: calculateContentScore(repoData),
        community: calculateCommunityScore(repoData),
        activity: calculateActivityScore(repoData),
        documentation: calculateDocumentationScore(repoData)
    };
    
    const weights = {
        content: 0.3,
        community: 0.25,
        activity: 0.25,
        documentation: 0.2
    };
    
    const totalScore = Object.entries(components).reduce((sum, [key, score]) => {
        return sum + (score * weights[key]);
    }, 0);
    
    return {
        total: Math.round(totalScore),
        components,
        recommendations: generateRecommendations(components)
    };
}

function calculateContentScore(repo) {
    let score = 0;
    
    if (repo.description && repo.description.length > 20) score += 20;
    if (repo.topics && repo.topics.length >= 5) score += 20;
    if (repo.homepage) score += 10;
    if (repo.hasReadme) score += 30;
    if (repo.hasLicense) score += 10;
    if (repo.hasWiki) score += 10;
    
    return score;
}

function calculateCommunityScore(repo) {
    let score = 0;
    
    if (repo.hasContributing) score += 25;
    if (repo.hasCodeOfConduct) score += 25;
    if (repo.hasIssueTemplates) score += 20;
    if (repo.hasPullRequestTemplate) score += 15;
    if (repo.hasDiscussions) score += 15;
    
    return score;
}

function calculateActivityScore(repo) {
    let score = 0;
    
    const daysSinceUpdate = repo.daysSinceLastUpdate || Infinity;
    if (daysSinceUpdate < 7) score += 40;
    else if (daysSinceUpdate < 30) score += 30;
    else if (daysSinceUpdate < 90) score += 20;
    else if (daysSinceUpdate < 180) score += 10;
    
    if (repo.hasRecentCommits) score += 30;
    if (repo.hasRecentReleases) score += 30;
    
    return score;
}

function calculateDocumentationScore(repo) {
    let score = 0;
    
    if (repo.hasReadmeWithBadges) score += 30;
    if (repo.hasReadmeWithScreenshots) score += 20;
    if (repo.hasReadmeWithQuickStart) score += 25;
    if (repo.hasApiDocs) score += 15;
    if (repo.hasExamples) score += 10;
    
    return score;
}

function generateRecommendations(components) {
    const recommendations = [];
    
    if (components.content < 70) {
        recommendations.push({
            priority: 'high',
            category: 'content',
            action: 'Améliorer le README avec badges, description claire et screenshots'
        });
    }
    
    if (components.community < 50) {
        recommendations.push({
            priority: 'high',
            category: 'community',
            action: 'Ajouter CONTRIBUTING.md et CODE_OF_CONDUCT.md'
        });
    }
    
    if (components.activity < 40) {
        recommendations.push({
            priority: 'medium',
            category: 'activity',
            action: 'Augmenter la fréquence des commits et releases'
        });
    }
    
    if (components.documentation < 60) {
        recommendations.push({
            priority: 'medium',
            category: 'documentation',
            action: 'Créer des exemples d\'usage et documentation API'
        });
    }
    
    return recommendations;
}

self.postMessage({ ready: true });