// NEXUS Guardian - Shared Core Module
// Navigation, Logging, Stats, Utilities

window.NexusApp = (() => {
    const MAX_LOGS = 1000;

    // Logging System
    async function log(type, message, data = {}) {
        const logEntry = {
            id: Date.now() + Math.random(),
            timestamp: new Date().toISOString(),
            type,
            message,
            data,
            workflow: data.workflow || 'general'
        };

        try {
            let logs = await window.NexusCrypto.getDecryptedData('nexus_logs') || [];
            logs.unshift(logEntry);
            
            if (logs.length > MAX_LOGS) {
                logs = logs.slice(0, MAX_LOGS);
            }
            
            await window.NexusCrypto.setEncryptedData('nexus_logs', logs);
        } catch (e) {
            console.error('Log save error:', e);
        }
        
        console.log(`[${type.toUpperCase()}]`, message, data);
    }

    // Get all logs
    async function getLogs() {
        try {
            return await window.NexusCrypto.getDecryptedData('nexus_logs') || [];
        } catch (e) {
            console.error('Error fetching logs:', e);
            return [];
        }
    }

    // Clear all logs
    async function clearLogs() {
        try {
            await window.NexusCrypto.setEncryptedData('nexus_logs', []);
            return true;
        } catch (e) {
            console.error('Error clearing logs:', e);
            return false;
        }
    }

    // Update dashboard stats
    async function updateStats() {
        try {
            const keys = await window.NexusCrypto.listKeys();
            
            const projectKeys = keys.filter(k => k.startsWith('nexus_project_'));
            const providerKeys = keys.filter(k => k.startsWith('nexus_provider_'));
            const logs = await getLogs();
            
            let enabledProviders = 0;
            for (const key of providerKeys) {
                const provider = await window.NexusCrypto.getDecryptedData(key);
                if (provider?.enabled) enabledProviders++;
            }
            
            const statsElements = {
                'stat-projects': projectKeys.length,
                'stat-analyses': projectKeys.length,
                'stat-providers': enabledProviders,
                'stat-logs': logs.length
            };
            
            Object.entries(statsElements).forEach(([id, value]) => {
                const el = document.getElementById(id);
                if (el) el.textContent = value;
            });
        } catch (e) {
            console.error('Error updating stats:', e);
        }
    }

    // Toast notification
    function toast(message, type = 'success') {
        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
            info: 'bg-blue-500'
        };
        
        const toast = document.createElement('div');
        toast.className = `${colors[type]} text-white px-6 py-3 rounded-xl shadow-lg font-bold text-sm fixed top-4 right-4 z-50 animate-slide-in`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(400px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Parse URL parameters
    function getUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const result = {};
        for (const [key, value] of params) {
            result[key] = value;
        }
        return result;
    }

    // Format date
    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Copy to clipboard
    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            toast('Copié dans le presse-papier', 'success');
            return true;
        } catch (e) {
            toast('Erreur de copie', 'error');
            return false;
        }
    }

    // Public API
    return {
        log,
        getLogs,
        clearLogs,
        updateStats,
        toast,
        getUrlParams,
        formatDate,
        copyToClipboard
    };
})();

// Add CSS for animations
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slide-in {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        .animate-slide-in {
            animation: slide-in 0.3s ease-out;
            transition: all 0.3s ease-out;
        }
    `;
    document.head.appendChild(style);
}