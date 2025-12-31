// NEXUS Guardian - Crypto Module
// IndexedDB + AES-256-GCM Encryption Engine

window.NexusCrypto = (() => {
    const DB_NAME = 'NexusGuardianDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'encrypted_data';
    
    let db = null;
    let masterKey = null;
    let sessionUnlocked = false;

    // Initialize IndexedDB
    async function initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                db = request.result;
                resolve(db);
            };
            
            request.onupgradeneeded = (event) => {
                const database = event.target.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    database.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
        });
    }

    // Derive encryption key from password
    async function deriveKey(password, salt) {
        const encoder = new TextEncoder();
        const passwordBuffer = encoder.encode(password);
        
        const importedKey = await crypto.subtle.importKey(
            'raw',
            passwordBuffer,
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
        );
        
        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            importedKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    // Encrypt data with AES-256-GCM
    async function encryptData(data, key) {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(JSON.stringify(data));
        
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        const encryptedBuffer = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            dataBuffer
        );
        
        return {
            iv: Array.from(iv),
            data: Array.from(new Uint8Array(encryptedBuffer))
        };
    }

    // Decrypt data with AES-256-GCM
    async function decryptData(encryptedObj, key) {
        const iv = new Uint8Array(encryptedObj.iv);
        const data = new Uint8Array(encryptedObj.data);
        
        const decryptedBuffer = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            data
        );
        
        const decoder = new TextDecoder();
        return JSON.parse(decoder.decode(decryptedBuffer));
    }

    // Store encrypted data in IndexedDB
    async function storeEncrypted(id, encryptedData) {
        if (!db) await initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            const request = store.put({ id, ...encryptedData });
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // Retrieve encrypted data from IndexedDB
    async function retrieveEncrypted(id) {
        if (!db) await initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Public API
    return {
        async isSetup() {
            await initDB();
            const masterConfig = await retrieveEncrypted('_master_config');
            return !!masterConfig;
        },

        async setupMasterPassword(password) {
            await initDB();
            
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const key = await deriveKey(password, salt);
            
            const testData = { setup: true, timestamp: Date.now() };
            const encrypted = await encryptData(testData, key);
            
            await storeEncrypted('_master_config', {
                salt: Array.from(salt),
                testData: encrypted
            });
            
            masterKey = key;
            sessionUnlocked = true;
            
            return true;
        },

        async unlockWithPassword(password) {
            await initDB();
            
            const masterConfig = await retrieveEncrypted('_master_config');
            if (!masterConfig) throw new Error('Master password not setup');
            
            const salt = new Uint8Array(masterConfig.salt);
            const key = await deriveKey(password, salt);
            
            try {
                await decryptData(masterConfig.testData, key);
                masterKey = key;
                sessionUnlocked = true;
                return true;
            } catch (e) {
                return false;
            }
        },

        isUnlocked() {
            return sessionUnlocked;
        },

        async setEncryptedData(id, data) {
            if (!sessionUnlocked || !masterKey) {
                throw new Error('Session not unlocked');
            }
            
            const encrypted = await encryptData(data, masterKey);
            await storeEncrypted(id, encrypted);
            return true;
        },

        async getDecryptedData(id) {
            if (!sessionUnlocked || !masterKey) {
                throw new Error('Session not unlocked');
            }
            
            const stored = await retrieveEncrypted(id);
            if (!stored) return null;
            
            try {
                return await decryptData(stored, masterKey);
            } catch (e) {
                console.error('Decryption error:', e);
                return null;
            }
        },

        async deleteData(id) {
            if (!db) await initDB();
            
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                
                const request = store.delete(id);
                
                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(request.error);
            });
        },

        async listKeys() {
            if (!db) await initDB();
            
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                
                const request = store.getAllKeys();
                
                request.onsuccess = () => resolve(request.result.filter(k => k !== '_master_config'));
                request.onerror = () => reject(request.error);
            });
        },

        lock() {
            masterKey = null;
            sessionUnlocked = false;
        }
    };
})();

// Auto-lock after 30 minutes of inactivity
let inactivityTimer = null;

function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    
    inactivityTimer = setTimeout(() => {
        if (window.NexusCrypto.isUnlocked()) {
            window.NexusCrypto.lock();
            window.location.href = './login.html';
        }
    }, 30 * 60 * 1000); // 30 minutes
}

if (typeof window !== 'undefined') {
    ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
        document.addEventListener(event, resetInactivityTimer, true);
    });
    
    resetInactivityTimer();
}