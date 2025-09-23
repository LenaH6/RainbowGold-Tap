// Sistema de persistencia de usuario para RainbowGold
// Maneja la sincronización automática del progreso del usuario

class UserPersistence {
    constructor() {
        this.syncInterval = null;
        this.lastSyncTime = 0;
        this.syncFrequency = 10000; // 10 segundos
        this.isOnline = navigator.onLine;
        
        this.initializeListeners();
    }

    // Inicializar event listeners
    initializeListeners() {
        // Detectar cambios de conexión
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.syncIfNeeded();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
        
        // Auto-sync periódico
        this.startPeriodicSync();
        
        // Sync antes de cerrar la ventana
        window.addEventListener('beforeunload', () => {
            this.forceSyncNow();
        });
        
        // Sync cuando la página vuelve a estar visible
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && worldcoinAuth.isAuthenticated) {
                this.syncIfNeeded();
            }
        });
    }

    // Iniciar sincronización periódica
    startPeriodicSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        this.syncInterval = setInterval(() => {
            this.syncIfNeeded();
        }, this.syncFrequency);
    }

    // Sincronizar si es necesario
    async syncIfNeeded() {
        if (!worldcoinAuth.isAuthenticated || !worldcoinAuth.walletAddress) {
            return;
        }
        
        const now = Date.now();
        if (now - this.lastSyncTime < this.syncFrequency) {
            return; // Muy pronto para sincronizar
        }
        
        await this.syncUserProgress();
    }

    // Forzar sincronización inmediata
    async forceSyncNow() {
        if (!worldcoinAuth.isAuthenticated || !worldcoinAuth.walletAddress) {
            return;
        }
        
        await this.syncUserProgress();
    }

    // Sincronizar progreso del usuario
    async syncUserProgress() {
        try {
            const progress = this.gatherCurrentProgress();
            worldcoinAuth.saveUserProgress(worldcoinAuth.walletAddress, progress);
            
            this.lastSyncTime = Date.now();
            
            // En producción, aquí enviarías al backend
            // await this.syncToBackend(progress);
            
            console.log('🔄 Progreso sincronizado:', new Date().toLocaleTimeString());
            
        } catch (error) {
            console.error('Error sincronizando progreso:', error);
        }
    }

    // Recopilar progreso actual del juego
    gatherCurrentProgress() {
        return {
            // Datos básicos del juego
            rbgp: (typeof window.rbgp !== 'undefined') ? window.rbgp : 0,
            energy: (typeof window.energy !== 'undefined') ? window.energy : 100,
            wld: (typeof window.wld !== 'undefined') ? window.wld : 0,
            
            // Estado del juego
            gameState: this.getGameState(),
            
            // Combo y progreso
            comboLevel: (typeof window.combo !== 'undefined') ? window.combo.level : 0,
            comboProgress: (typeof window.combo !== 'undefined') ? window.combo.progress : {},
            
            // Boosters comprados
            boosters: this.getBoosters(),
            
            // Logros desbloqueados
            achievements: this.getAchievements(),
            
            // Estadísticas del jugador
            stats: this.getDetailedStats(),
            
            // Configuraciones del usuario
            settings: this.getUserSettings(),
            
            // Ideas desbloqueadas
            ideasUnlocked: this.getIdeasProgress(),
            
            // Timestamp de última actualización
            lastUpdated: Date.now(),
            walletAddress: worldcoinAuth.walletAddress?.toLowerCase()
        };
    }

    // Obtener estado completo del juego
    getGameState() {
        try {
            const saved = localStorage.getItem('gameState');
            return saved ? JSON.parse(saved) : {
                capacity: 100,
                coins: 0,
                level: 1
            };
        } catch (e) {
            return { capacity: 100, coins: 0, level: 1 };
        }
    }

    // Obtener boosters del usuario
    getBoosters() {
        try {
            const boosters = localStorage.getItem('user_boosters');
            return boosters ? JSON.parse(boosters) : [];
        } catch (e) {
            return [];
        }
    }

    // Obtener logros desbloqueados
    getAchievements() {
        try {
            const achievements = localStorage.getItem('user_achievements');
            return achievements ? JSON.parse(achievements) : [];
        } catch (e) {
            return [];
        }
    }

    // Obtener estadísticas detalladas
    getDetailedStats() {
        try {
            const saved = localStorage.getItem('user_stats');
            const baseStats = saved ? JSON.parse(saved) : {};
            
            return {
                totalTaps: baseStats.totalTaps || 0,
                totalEarned: baseStats.totalEarned || 0,
                totalSpent: baseStats.totalSpent || 0,
                ideasPurchased: baseStats.ideasPurchased || 0,
                maxComboReached: baseStats.maxComboReached || 0,
                sessionsPlayed: baseStats.sessionsPlayed || 0,
                joinedAt: baseStats.joinedAt || Date.now(),
                lastSeen: Date.now(),
                playTimeTotal: baseStats.playTimeTotal || 0,
                ...baseStats
            };
        } catch (e) {
            return {
                totalTaps: 0,
                totalEarned: 0,
                totalSpent: 0,
                ideasPurchased: 0,
                maxComboReached: 0,
                sessionsPlayed: 0,
                joinedAt: Date.now(),
                lastSeen: Date.now(),
                playTimeTotal: 0
            };
        }
    }

    // Obtener configuraciones del usuario
    getUserSettings() {
        try {
            return {
                username: localStorage.getItem('username') || '',
                language: localStorage.getItem('language') || 'es',
                soundEnabled: localStorage.getItem('soundEnabled') !== 'false',
                notifications: localStorage.getItem('notifications') !== 'false',
                theme: localStorage.getItem('theme') || 'default'
            };
        } catch (e) {
            return {
                username: '',
                language: 'es',
                soundEnabled: true,
                notifications: true,
                theme: 'default'
            };
        }
    }

    // Obtener progreso de ideas
    getIdeasProgress() {
        try {
            const gameState = this.getGameState();
            return {
                unlocked: gameState.ideasUnlocked || 0,
                ticketActive: (typeof window.ideasTicketActive !== 'undefined') ? window.ideasTicketActive : false,
                votes: JSON.parse(localStorage.getItem('wg_votes') || '{"A":0,"B":0,"C":0}')
            };
        } catch (e) {
            return {
                unlocked: 0,
                ticketActive: false,
                votes: {"A":0,"B":0,"C":0}
            };
        }
    }

    // Restaurar progreso completo del usuario
    async restoreUserProgress(progress) {
        try {
            console.log('🔄 Restaurando progreso del usuario...');
            
            // Restaurar variables globales del juego
            if (typeof window.rbgp !== 'undefined' && progress.rbgp !== undefined) {
                window.rbgp = progress.rbgp;
                localStorage.setItem('rbgp', String(progress.rbgp));
            }
            
            if (typeof window.energy !== 'undefined' && progress.energy !== undefined) {
                window.energy = progress.energy;
                localStorage.setItem('energy', String(progress.energy));
            }
            
            if (typeof window.wld !== 'undefined' && progress.wld !== undefined) {
                window.wld = progress.wld;
                localStorage.setItem('wld', String(progress.wld));
            }

            // Restaurar estado del juego
            if (progress.gameState) {
                localStorage.setItem('gameState', JSON.stringify(progress.gameState));
            }

            // Restaurar combo
            if (progress.comboLevel !== undefined && typeof window.combo !== 'undefined') {
                window.combo.level = progress.comboLevel;
                window.combo.progress = progress.comboProgress || {};
            }

            // Restaurar boosters
            if (progress.boosters) {
                localStorage.setItem('user_boosters', JSON.stringify(progress.boosters));
            }

            // Restaurar logros
            if (progress.achievements) {
                localStorage.setItem('user_achievements', JSON.stringify(progress.achievements));
            }

            // Restaurar estadísticas
            if (progress.stats) {
                localStorage.setItem('user_stats', JSON.stringify(progress.stats));
            }

            // Restaurar configuraciones
            if (progress.settings) {
                if (progress.settings.username) {
                    localStorage.setItem('username', progress.settings.username);
                }
                if (progress.settings.language) {
                    localStorage.setItem('language', progress.settings.language);
                }
                localStorage.setItem('soundEnabled', String(progress.settings.soundEnabled));
                localStorage.setItem('notifications', String(progress.settings.notifications));
                if (progress.settings.theme) {
                    localStorage.setItem('theme', progress.settings.theme);
                }
            }

            // Restaurar progreso de ideas
            if (progress.ideasUnlocked) {
                if (typeof window.ideasTicketActive !== 'undefined') {
                    window.ideasTicketActive = progress.ideasUnlocked.ticketActive;
                }
                if (progress.ideasUnlocked.votes) {
                    localStorage.setItem('wg_votes', JSON.stringify(progress.ideasUnlocked.votes));
                }
            }

            // Actualizar UI si hay funciones disponibles
            this.updateGameUI();
            
            console.log('✅ Progreso restaurado exitosamente');
            
        } catch (error) {
            console.error('Error restaurando progreso:', error);
        }
    }

    // Actualizar UI del juego después de restaurar
    updateGameUI() {
        try {
            // Actualizar displays de RBGp
            const balRBGp = document.getElementById('balRBGp');
            if (balRBGp && typeof window.rbgp !== 'undefined') {
                balRBGp.textContent = window.rbgp.toFixed(3);
            }

            // Actualizar energía
            if (typeof paymentHandler !== 'undefined' && paymentHandler.updateEnergyDisplay) {
                paymentHandler.updateEnergyDisplay();
            }

            // Actualizar balance WLD
            const balWLD = document.getElementById('balWLD');
            if (balWLD && typeof window.wld !== 'undefined') {
                balWLD.textContent = window.wld.toFixed(2);
            }

            // Actualizar badge de combo si existe
            if (typeof updateBadge === 'function') {
                updateBadge();
            }

            // Actualizar username en perfil
            const usernameInput = document.getElementById('usernameInput');
            if (usernameInput) {
                const savedUsername = localStorage.getItem('username');
                if (savedUsername) {
                    usernameInput.value = savedUsername;
                }
            }

        } catch (error) {
            console.error('Error actualizando UI:', error);
        }
    }

    // Método para hacer backup en backend (futuro)
    async syncToBackend(progress) {
        // En producción, este método enviaría los datos al backend
        // Por ahora solo lo documentamos para implementación futura
        
        /*
        const response = await fetch('/api/user/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${worldcoinAuth.accessToken}`
            },
            body: JSON.stringify({
                walletAddress: worldcoinAuth.walletAddress,
                progress: progress,
                signature: progress.siweSignature
            })
        });
        
        if (!response.ok) {
            throw new Error('Error sincronizando con servidor');
        }
        
        const result = await response.json();
        return result;
        */
        
        console.log('📡 Sincronización con backend (pendiente implementación)');
        return true;
    }
}

// Crear instancia global
const userPersistence = new UserPersistence();