// Funciones para integración con Worldcoin y pagos
// Este archivo complementa el juego con la funcionalidad de Worldcoin

// Variable global para modo tick
window.__tickUseMp3 = false;

function setTickModeMp3(enabled) {
    window.__tickUseMp3 = !!enabled;
}

// Manejar login con Worldcoin
async function handleWorldcoinLogin() {
    const loginBtn = document.getElementById('worldcoin-login-btn');
    const originalText = loginBtn.innerHTML;
    
    try {
        // Cambiar texto del botón
        loginBtn.innerHTML = '<span>Conectando...</span>';
        loginBtn.disabled = true;
        
        // Iniciar proceso OIDC
        await worldcoinAuth.startOIDCLogin();
        
        // Si llegamos aquí, el login fue exitoso
        showNotification('¡Autenticación exitosa!', '#4CAF50');
        
    } catch (error) {
        console.error('Error en Worldcoin login:', error);
        showNotification('Error en autenticación: ' + error.message, '#f44336');
        
        // Restaurar botón
        loginBtn.innerHTML = originalText;
        loginBtn.disabled = false;
    }
}

// Manejar pago de refill
async function handleRefillPayment() {
    if (!worldcoinAuth.isUserAuthenticated()) {
        showNotification('Debes iniciar sesión primero', '#ff9800');
        return;
    }
    
    try {
        showNotification('Procesando pago de refill...', '#2196F3');
        
        const result = await paymentHandler.processRefillPayment();
        
        if (result.success) {
            showNotification(`¡Refill exitoso! Pagaste ${result.amount} WLD`, '#4CAF50');
            
            // Actualizar el juego
            updateGameAfterRefill();
        }
    } catch (error) {
        console.error('Error en refill payment:', error);
        showNotification('Error en pago: ' + error.message, '#f44336');
    }
}

// Manejar pago de idea
async function handleIdeaPayment() {
    if (!worldcoinAuth.isUserAuthenticated()) {
        showNotification('Debes iniciar sesión primero', '#ff9800');
        return;
    }
    
    try {
        showNotification('Procesando pago de idea...', '#2196F3');
        
        const result = await paymentHandler.processIdeaPayment();
        
        if (result.success) {
            showNotification('¡Idea desbloqueada! Pagaste 1 WLD', '#4CAF50');
            
            // Actualizar el juego
            updateGameAfterIdeaPayment();
        }
    } catch (error) {
        console.error('Error en idea payment:', error);
        showNotification('Error en pago: ' + error.message, '#f44336');
    }
}

// Actualizar juego después del refill
function updateGameAfterRefill() {
    const gameState = JSON.parse(localStorage.getItem('gameState')) || {};
    const refillAmount = Math.floor((gameState.capacity || 100) * 0.001);
    
    // Agregar coins
    gameState.coins = (gameState.coins || 0) + refillAmount;
    localStorage.setItem('gameState', JSON.stringify(gameState));
    
    // Actualizar display si existe la función en script.js
    if (typeof updateStats === 'function') {
        updateStats();
    }
    
    // Efecto visual
    createCoinEffect(refillAmount);
}

// Actualizar juego después del pago de idea
function updateGameAfterIdeaPayment() {
    const gameState = JSON.parse(localStorage.getItem('gameState')) || {};
    gameState.ideasUnlocked = (gameState.ideasUnlocked || 0) + 1;
    localStorage.setItem('gameState', JSON.stringify(gameState));
    
    // Mostrar contenido desbloqueado
    showUnlockedContent();
}

// Mostrar contenido desbloqueado
function showUnlockedContent() {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; text-align: center; max-width: 300px;">
            <h3 style="color: #333; margin-bottom: 15px;">🎉 ¡Idea Desbloqueada!</h3>
            <p style="color: #666; margin-bottom: 20px;">Gracias por tu contribución. Has desbloqueado nueva funcionalidad.</p>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                Continuar
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Crear efecto visual de coins
function createCoinEffect(amount) {
    for (let i = 0; i < Math.min(amount, 10); i++) {
        setTimeout(() => {
            const coin = document.createElement('div');
            coin.textContent = '🪙';
            coin.style.cssText = `
                position: fixed;
                font-size: 24px;
                pointer-events: none;
                z-index: 1000;
                left: 50%;
                top: 50%;
                animation: coinFly${i} 1s ease-out forwards;
            `;
            
            const style = document.createElement('style');
            style.textContent = `
                @keyframes coinFly${i} {
                    0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
                    50% { transform: translate(${Math.random() * 200 - 100}px, ${Math.random() * 200 - 100}px) scale(1); opacity: 1; }
                    100% { transform: translate(${Math.random() * 400 - 200}px, ${Math.random() * 400 - 200}px) scale(0); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
            
            document.body.appendChild(coin);
            
            setTimeout(() => {
                if (coin.parentNode) coin.parentNode.removeChild(coin);
                if (style.parentNode) style.parentNode.removeChild(style);
            }, 1000);
        }, i * 100);
    }
}

// Verificar autenticación al cargar
document.addEventListener('DOMContentLoaded', function() {
    // Si hay parámetros de callback en la URL, manejarlos
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('code')) {
        // Esto indica que venimos del callback de Worldcoin
        // El manejo real se hace en callback.html
        return;
    }
    
    // Verificar si ya hay una sesión activa
    const savedAuth = localStorage.getItem('worldcoin_auth');
    if (savedAuth) {
        try {
            const authData = JSON.parse(savedAuth);
            if (authData.authenticated && authData.expires > Date.now()) {
                worldcoinAuth.isAuthenticated = true;
                worldcoinAuth.userProfile = authData.profile;
                worldcoinAuth.walletAddress = authData.wallet;
                worldcoinAuth.updateUserInterface();
            }
        } catch (e) {
            localStorage.removeItem('worldcoin_auth');
        }
    }
});

// Guardar estado de autenticación
function saveAuthState() {
    if (worldcoinAuth.isAuthenticated) {
        const authData = {
            authenticated: true,
            profile: worldcoinAuth.userProfile,
            wallet: worldcoinAuth.walletAddress,
            expires: Date.now() + (24 * 60 * 60 * 1000) // 24 horas
        };
        localStorage.setItem('worldcoin_auth', JSON.stringify(authData));
    }
}

// Extender la funcionalidad de actualización de UI
if (typeof worldcoinAuth !== 'undefined') {
    const originalUpdateUI = worldcoinAuth.updateUserInterface;
    worldcoinAuth.updateUserInterface = function() {
        originalUpdateUI.call(this);
        saveAuthState();
    };
}