// Funciones de autenticación con Worldcoin OIDC
class WorldcoinAuth {
    constructor() {
        this.isAuthenticated = false;
        this.userProfile = null;
        this.walletAddress = null;
    }

    // Iniciar proceso de autenticación OIDC
    async startOIDCLogin() {
        try {
            const authUrl = this.buildAuthURL();
            
            // Abrir ventana popup para autenticación
            const popup = window.open(
                authUrl,
                'worldcoin-auth',
                'width=500,height=700,scrollbars=yes,resizable=yes'
            );

            return new Promise((resolve, reject) => {
                const checkClosed = setInterval(() => {
                    if (popup.closed) {
                        clearInterval(checkClosed);
                        reject(new Error('Ventana cerrada por el usuario'));
                    }
                }, 1000);

                // Escuchar mensaje de callback
                window.addEventListener('message', async (event) => {
                    if (event.origin !== window.location.origin) return;
                    
                    if (event.data.type === 'WORLDCOIN_AUTH_SUCCESS') {
                        clearInterval(checkClosed);
                        popup.close();
                        
                        try {
                            await this.handleAuthCallback(event.data.code);
                            resolve(true);
                        } catch (error) {
                            reject(error);
                        }
                    }
                }, { once: true });
            });
        } catch (error) {
            console.error('Error en OIDC login:', error);
            throw error;
        }
    }

    // Construir URL de autenticación
    buildAuthURL() {
        const params = new URLSearchParams({
            client_id: WORLDCOIN_CONFIG.client_id,
            redirect_uri: WORLDCOIN_CONFIG.redirect_uri,
            response_type: WORLDCOIN_CONFIG.response_type,
            scope: WORLDCOIN_CONFIG.scope,
            nonce: WORLDCOIN_CONFIG.nonce,
            state: WORLDCOIN_CONFIG.state
        });

        return `${WORLDCOIN_BASE_URL}/authorize?${params.toString()}`;
    }

    // Manejar callback de autenticación
    async handleAuthCallback(code) {
        try {
            // Intercambiar código por token
            const tokenResponse = await this.exchangeCodeForToken(code);
            
            if (tokenResponse.access_token) {
                // Obtener perfil del usuario
                const userProfile = await this.getUserProfile(tokenResponse.access_token);
                
                this.isAuthenticated = true;
                this.userProfile = userProfile;
                this.walletAddress = userProfile.wallet_address || userProfile.sub;
                
                // Actualizar UI
                this.updateUserInterface();
                
                return true;
            }
        } catch (error) {
            console.error('Error en callback:', error);
            throw error;
        }
    }

    // Intercambiar código por token (simulado - en producción necesitas backend)
    async exchangeCodeForToken(code) {
        // En un entorno real, esto debe hacerse en el backend por seguridad
        // Por ahora simularemos una respuesta exitosa
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    access_token: 'mock_access_token_' + Date.now(),
                    token_type: 'Bearer',
                    expires_in: 3600
                });
            }, 1000);
        });
    }

    // Obtener perfil del usuario (simulado)
    async getUserProfile(accessToken) {
        // En producción, esto llamaría al endpoint de userinfo de Worldcoin
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    sub: '0x' + Math.random().toString(16).substring(2, 42),
                    name: 'Usuario Verificado',
                    wallet_address: '0x' + Math.random().toString(16).substring(2, 42),
                    verified: true,
                    verification_level: 'orb'
                });
            }, 500);
        });
    }

    // Actualizar interfaz de usuario
    updateUserInterface() {
        // Ocultar splash screen
        const splash = document.getElementById('splash');
        if (splash) {
            splash.classList.add('splash--hide');
        }

        // Actualizar botón de perfil
        const profileButton = document.querySelector('.profile-button');
        if (profileButton && this.userProfile) {
            const userName = profileButton.querySelector('.user-name');
            if (userName) {
                userName.textContent = this.userProfile.name || 'Usuario';
            }
        }

        // Actualizar display de wallet
        this.updateWalletDisplay();
        
        console.log('Usuario autenticado:', this.userProfile);
    }

    // Actualizar display de wallet
    updateWalletDisplay() {
        if (this.walletAddress) {
            const walletElements = document.querySelectorAll('.wallet-address');
            walletElements.forEach(element => {
                element.textContent = this.formatAddress(this.walletAddress);
            });
        }
    }

    // Formatear dirección de wallet
    formatAddress(address) {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }

    // Verificar si el usuario está autenticado
    isUserAuthenticated() {
        return this.isAuthenticated;
    }

    // Obtener información del usuario
    getUserInfo() {
        return {
            profile: this.userProfile,
            wallet: this.walletAddress,
            authenticated: this.isAuthenticated
        };
    }
}

// Crear instancia global
const worldcoinAuth = new WorldcoinAuth();