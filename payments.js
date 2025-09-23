// Sistema de pagos para RainbowGold Tap
class PaymentHandler {
    constructor() {
        this.paymentAddress = PAYMENT_ADDRESS;
        this.web3Provider = null;
        this.userAccount = null;
    }

    // Inicializar Web3 y conectar wallet
    async initializeWeb3() {
        if (typeof window.ethereum !== 'undefined') {
            this.web3Provider = window.ethereum;
            
            try {
                // Solicitar acceso a la wallet
                const accounts = await window.ethereum.request({
                    method: 'eth_requestAccounts'
                });
                
                this.userAccount = accounts[0];
                return true;
            } catch (error) {
                console.error('Error conectando wallet:', error);
                throw new Error('No se pudo conectar la wallet');
            }
        } else {
            throw new Error('MetaMask o wallet compatible no detectada');
        }
    }

    // Calcular refill basado en 0.1% de capacidad
    calculateRefillAmount() {
        const gameState = JSON.parse(localStorage.getItem('gameState')) || {};
        const currentCapacity = gameState.capacity || 100;
        const refillPercentage = 0.001; // 0.1%
        
        // En WLD (asumiendo 1 WLD = 1 unidad de juego por simplicidad)
        return (currentCapacity * refillPercentage).toFixed(6);
    }

    // Realizar pago de refill
    async processRefillPayment() {
        try {
            if (!this.web3Provider) {
                await this.initializeWeb3();
            }

            const amount = this.calculateRefillAmount();
            const amountWei = this.toWei(amount);

            const transactionParams = {
                to: this.paymentAddress,
                from: this.userAccount,
                value: amountWei,
                data: '0x' + this.stringToHex('refill_payment')
            };

            const txHash = await window.ethereum.request({
                method: 'eth_sendTransaction',
                params: [transactionParams]
            });

            // Esperar confirmación
            const receipt = await this.waitForTransaction(txHash);
            
            if (receipt.status === '0x1') {
                this.handleSuccessfulRefill();
                return { success: true, txHash, amount };
            } else {
                throw new Error('Transacción falló');
            }
        } catch (error) {
            console.error('Error en pago de refill:', error);
            throw error;
        }
    }

    // Realizar pago de idea (1 WLD)
    async processIdeaPayment() {
        try {
            if (!this.web3Provider) {
                await this.initializeWeb3();
            }

            const amount = '1'; // 1 WLD
            const amountWei = this.toWei(amount);

            const transactionParams = {
                to: this.paymentAddress,
                from: this.userAccount,
                value: amountWei,
                data: '0x' + this.stringToHex('idea_payment')
            };

            const txHash = await window.ethereum.request({
                method: 'eth_sendTransaction',
                params: [transactionParams]
            });

            // Esperar confirmación
            const receipt = await this.waitForTransaction(txHash);
            
            if (receipt.status === '0x1') {
                this.handleSuccessfulIdeaPayment();
                return { success: true, txHash, amount };
            } else {
                throw new Error('Transacción falló');
            }
        } catch (error) {
            console.error('Error en pago de idea:', error);
            throw error;
        }
    }

    // Manejar refill exitoso
    handleSuccessfulRefill() {
        const gameState = JSON.parse(localStorage.getItem('gameState')) || {};
        const refillAmount = Math.floor(gameState.capacity * 0.001); // 0.1%
        
        gameState.coins = (gameState.coins || 0) + refillAmount;
        localStorage.setItem('gameState', JSON.stringify(gameState));
        
        // Actualizar UI
        this.updateCoinsDisplay();
        
        // Mostrar notificación
        this.showNotification(`¡Refill exitoso! +${refillAmount} coins`, 'success');
    }

    // Manejar pago de idea exitoso
    handleSuccessfulIdeaPayment() {
        // Lógica específica para idea pagada
        const gameState = JSON.parse(localStorage.getItem('gameState')) || {};
        gameState.ideasUnlocked = (gameState.ideasUnlocked || 0) + 1;
        localStorage.setItem('gameState', JSON.stringify(gameState));
        
        // Mostrar notificación
        this.showNotification('¡Idea desbloqueada! Gracias por tu contribución', 'success');
        
        // Aquí puedes agregar lógica adicional para desbloquear contenido
    }

    // Convertir a Wei
    toWei(amount) {
        const weiAmount = Math.floor(parseFloat(amount) * Math.pow(10, 18));
        return '0x' + weiAmount.toString(16);
    }

    // Convertir string a hex
    stringToHex(str) {
        return str.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    }

    // Esperar confirmación de transacción
    async waitForTransaction(txHash) {
        return new Promise((resolve, reject) => {
            const checkTransaction = async () => {
                try {
                    const receipt = await window.ethereum.request({
                        method: 'eth_getTransactionReceipt',
                        params: [txHash]
                    });
                    
                    if (receipt) {
                        resolve(receipt);
                    } else {
                        setTimeout(checkTransaction, 2000);
                    }
                } catch (error) {
                    reject(error);
                }
            };
            
            checkTransaction();
        });
    }

    // Actualizar display de coins
    updateCoinsDisplay() {
        const gameState = JSON.parse(localStorage.getItem('gameState')) || {};
        const coinsElement = document.getElementById('coins');
        if (coinsElement) {
            coinsElement.textContent = gameState.coins || 0;
        }
    }

    // Mostrar notificación
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification--${type}`;
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#4CAF50' : '#2196F3'};
            color: white;
            border-radius: 5px;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Crear instancia global
const paymentHandler = new PaymentHandler();

// Agregar estilos para notificaciones
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(notificationStyles);