// NEXUS Guardian - Central Router
// Manages navigation, authentication, and module initialization

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        pages: {
            public: ['login.html', 'index.html'],
            protected: [
                'dashboard.html',
                'audit.html',
                'vibe.html',
                'contributor.html',
                'growth.html',
                'repos.html',
                'config.html',
                'logs.html'
            ]
        },
        timeout: 30 * 60 * 1000, // 30 minutes
        storageKey: 'nexus_session'
    };

    // Session Manager
    const SessionManager = {
        isActive: false,
        lastActivity: null,
        timer: null,

        init() {
            const stored = sessionStorage.getItem(CONFIG.storageKey);
            if (stored) {
                try {
                    const session = JSON.parse(stored);
                    this.isActive = session.active && Date.now() - session.timestamp < CONFIG.timeout;
                    this.lastActivity = session.timestamp;
                } catch (e) {
                    this.clear();
                }
            }
            this.setupActivityListeners();
        },

        activate() {
            this.isActive = true;
            this.lastActivity = Date.now();
            this.save();
            this.startTimer();
        },

        clear() {
            this.isActive = false;
            this.lastActivity = null;
            sessionStorage.removeItem(CONFIG.storageKey);
            if (this.timer) clearTimeout(this.timer);
        },

        save() {
            sessionStorage.setItem(CONFIG.storageKey, JSON.stringify({
                active: this.isActive,
                timestamp: this.lastActivity
            }));
        },

        refresh() {
            if (this.isActive) {
                this.lastActivity = Date.now();
                this.save();
                this.startTimer();
            }
        },

        startTimer() {
            if (this.timer) clearTimeout(this.timer);
            this.timer = setTimeout(() => {
                this.clear();
                NexusRouter.redirectToLogin();
            }, CONFIG.timeout);
        },

        setupActivityListeners() {
            ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
                document.addEventListener(event, () => this.refresh(), true);
            });
        }
    };

    // Main Router
    window.NexusRouter = {
        currentPage: null,
        modules: {},
        initialized: false,

        async init() {
            if (this.initialized) return;
            
            console.log('[NexusRouter] Initializing...');
            
            // Initialize session
            SessionManager.init();
            
            // Get current page
            this.currentPage = this.getCurrentPage();
            console.log('[NexusRouter] Current page:', this.currentPage);
            
            // Load crypto module first
            await this.waitForModule('NexusCrypto');
            
            // Check authentication
            const requiresAuth = this.pageRequiresAuth(this.currentPage);
            console.log('[NexusRouter] Requires auth:', requiresAuth);
            
            if (requiresAuth) {
                const isAuthenticated = await this.checkAuthentication();
                console.log('[NexusRouter] Is authenticated:', isAuthenticated);
                
                if (!isAuthenticated) {
                    console.log('[NexusRouter] Not authenticated, redirecting to login...');
                    this.redirectToLogin();
                    return;
                }
            }
            
            // Initialize page-specific modules
            await this.initPageModules();
            
            this.initialized = true;
            console.log('[NexusRouter] Initialization complete');
        },

        getCurrentPage() {
            const path = window.location.pathname;
            const page = path.split('/').pop() || 'index.html';
            return page;
        },

        pageRequiresAuth(page) {
            return CONFIG.pages.protected.includes(page);
        },

        async checkAuthentication() {
            // Wait for crypto module
            if (!window.NexusCrypto) {
                console.log('[NexusRouter] Waiting for NexusCrypto...');
                await this.waitForModule('NexusCrypto');
            }

            // Check if DB is setup
            const isSetup = await window.NexusCrypto.isSetup();
            if (!isSetup) {
                console.log('[NexusRouter] DB not setup');
                return false;
            }

            // Check session
            const hasSession = SessionManager.isActive;
            console.log('[NexusRouter] Has active session:', hasSession);

            return hasSession;
        },

        async waitForModule(moduleName, timeout = 5000) {
            const startTime = Date.now();
            while (!window[moduleName]) {
                if (Date.now() - startTime > timeout) {
                    throw new Error(`Timeout waiting for ${moduleName}`);
                }
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            console.log(`[NexusRouter] Module ${moduleName} loaded`);
        },

        async initPageModules() {
            const page = this.currentPage;
            console.log('[NexusRouter] Initializing modules for:', page);

            // Load shared module
            if (window.NexusApp) {
                console.log('[NexusRouter] NexusApp available');
            }

            // Load page-specific modules
            switch (page) {
                case 'dashboard.html':
                    if (window.NexusApp) {
                        await window.NexusApp.updateStats();
                    }
                    break;

                case 'audit.html':
                case 'vibe.html':
                case 'contributor.html':
                    await this.waitForModule('AIEngine');
                    await this.waitForModule('GitHubAPI');
                    break;

                case 'growth.html':
                case 'repos.html':
                    await this.waitForModule('GitHubAPI');
                    break;

                case 'config.html':
                    await this.waitForModule('AIEngine');
                    break;

                case 'logs.html':
                    // No special modules needed
                    break;
            }

            console.log('[NexusRouter] Page modules initialized');
        },

        redirectToLogin() {
            SessionManager.clear();
            if (window.NexusCrypto) {
                window.NexusCrypto.lock();
            }
            if (this.currentPage !== 'login.html') {
                console.log('[NexusRouter] Redirecting to login...');
                window.location.href = './login.html';
            }
        },

        async handleLogin(password, isSetup = false) {
            try {
                console.log('[NexusRouter] Handling login...');
                
                let success;
                if (isSetup) {
                    success = await window.NexusCrypto.setupMasterPassword(password);
                } else {
                    success = await window.NexusCrypto.unlockWithPassword(password);
                }

                if (success) {
                    console.log('[NexusRouter] Login successful');
                    SessionManager.activate();
                    this.navigateTo('dashboard.html');
                    return true;
                } else {
                    console.log('[NexusRouter] Login failed');
                    return false;
                }
            } catch (error) {
                console.error('[NexusRouter] Login error:', error);
                return false;
            }
        },

        handleLogout() {
            console.log('[NexusRouter] Logging out...');
            SessionManager.clear();
            if (window.NexusCrypto) {
                window.NexusCrypto.lock();
            }
            this.navigateTo('login.html');
        },

        navigateTo(page) {
            console.log('[NexusRouter] Navigating to:', page);
            window.location.href = `./${page}`;
        },

        // Helper to check if user is authenticated (for use in pages)
        isAuthenticated() {
            return SessionManager.isActive;
        }
    };

    // Auto-initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.NexusRouter.init().catch(err => {
                console.error('[NexusRouter] Init error:', err);
            });
        });
    } else {
        window.NexusRouter.init().catch(err => {
            console.error('[NexusRouter] Init error:', err);
        });
    }

})();