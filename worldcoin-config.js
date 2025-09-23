// worldcoin-config.js - VERSIÓN CORREGIDA para tu app

// Configuración que SÍ funciona para tu proyecto
const WORLDCOIN_CONFIG = {
    app_id: 'app_33bb8068826b85d4cd56d2ec2caba7cc',
    action: 'rainbow-gold-tap',
    signal: 'user_login_' + Date.now(), // Signal único
    
    // OIDC Configuration (corregido)
    client_id: 'app_33bb8068826b85d4cd56d2ec2caba7cc',
    redirect_uri: window.location.origin + '/callback.html', // ← CLAVE: debe ser exacta
    response_type: 'code',
    scope: 'openid profile',
    nonce: generateNonce(),
    state: generateState()
};

// Dirección de destino para pagos (tu wallet real)
const PAYMENT_ADDRESS = '0x91bf252c335f2540871d0d2ef1476ae193a5bc8a';

// URL base de Worldcoin (corregida)
const WORLDCOIN_BASE_URL = 'https://id.worldcoin.org';

// Generar nonce aleatorio (mejorado)
function generateNonce() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Generar state aleatorio (mejorado)
function generateState() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// 🔥 VERIFICACIÓN DE CONFIGURACIÓN EN CONSOLA
console.log('🔧 Worldcoin Config:', {
    app_id: WORLDCOIN_CONFIG.app_id,
    redirect_uri: WORLDCOIN_CONFIG.redirect_uri,
    origin: window.location.origin,
    full_url: `${WORLDCOIN_BASE_URL}/authorize?client_id=${WORLDCOIN_CONFIG.client_id}&redirect_uri=${encodeURIComponent(WORLDCOIN_CONFIG.redirect_uri)}&response_type=${WORLDCOIN_CONFIG.response_type}&scope=${encodeURIComponent(WORLDCOIN_CONFIG.scope)}`
});

// 🚨 VERIFICAR QUE TODO ESTÉ BIEN CONFIGURADO
if (typeof window !== 'undefined') {
    // Solo ejecutar en browser
    console.log('✅ Checking Worldcoin setup...');
    
    // Verificar que los elementos existan
    const requiredElements = ['wldSignIn', 'splash'];
    requiredElements.forEach(id => {
        const el = document.getElementById(id);
        if (!el) {
            console.warn(`⚠️ Element #${id} not found`);
        } else {
            console.log(`✅ Element #${id} found`);
        }
    });
    
    // Verificar configuración
    if (!WORLDCOIN_CONFIG.app_id.startsWith('app_')) {
        console.error('❌ Invalid app_id format');
    }
    
    if (!WORLDCOIN_CONFIG.redirect_uri.startsWith('http')) {
        console.error('❌ Invalid redirect_uri format');
    }
}

// 🔧 Helper para debuggear en desarrollo
window.__worldcoin_debug = {
    config: WORLDCOIN_CONFIG,
    payment_address: PAYMENT_ADDRESS,
    test_auth_url: function() {
        const params = new URLSearchParams({
            client_id: WORLDCOIN_CONFIG.client_id,
            redirect_uri: WORLDCOIN_CONFIG.redirect_uri,
            response_type: WORLDCOIN_CONFIG.response_type,
            scope: WORLDCOIN_CONFIG.scope,
            nonce: WORLDCOIN_CONFIG.nonce,
            state: WORLDCOIN_CONFIG.state
        });
        const url = `${WORLDCOIN_BASE_URL}/authorize?${params.toString()}`;
        console.log('🔗 Auth URL:', url);
        return url;
    }
};