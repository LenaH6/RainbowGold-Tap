// worldcoin-config.js - VERSIÓN CORREGIDA
// Usa variables de entorno de Vercel cuando están disponibles

// Función para obtener variables de entorno (compatible browser/server)
function getEnvVar(name, fallback) {
    // En Vercel, las variables NEXT_PUBLIC_ están disponibles en el browser
    if (typeof window !== 'undefined') {
        // Browser: usar window.__env si está definido (opcional)
        if (window.__env && window.__env[name]) {
            return window.__env[name];
        }
    }
    
    // Fallback a variables hardcodeadas si no hay env vars
    return fallback;
}

// Tu App ID real del Developer Portal
const APP_ID = getEnvVar('NEXT_PUBLIC_APP_ID', 'app_33bb8068826b85d4cd56d2ec2caba7cc');

// Configuración principal de Worldcoin
const WORLDCOIN_CONFIG = {
    app_id: APP_ID,
    action: getEnvVar('NEXT_PUBLIC_ACTION_NAME', 'rainbow-gold-tap'),
    signal: '', // Vacío está bien para login básico
    
    // OIDC Configuration - CORREGIDA
    client_id: APP_ID, // Mismo que app_id
    redirect_uri: window.location.origin + '/callback.html', // SIN /api/auth/
    response_type: 'code',
    scope: 'openid profile',
    nonce: generateNonce(),
    state: generateState()
};

// Tu dirección de pago
const PAYMENT_ADDRESS = getEnvVar('NEXT_PUBLIC_PAYMENT_ADDRESS', '0x91bf252c335f2540871d0d2ef1476ae193a5bc8a');

// URL base de Worldcoin
const WORLDCOIN_BASE_URL = getEnvVar('NEXT_PUBLIC_WLD_BASE_URL', 'https://id.worldcoin.org');

// Client Secret (solo para backend si lo implementas después)
const CLIENT_SECRET = 'sk_5d537d497ccc515d8c14843855feb0132f84b408977ed3b1';

// Generar nonce seguro
function generateNonce() {
    if (crypto && crypto.getRandomValues) {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    // Fallback para browsers viejos
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Generar state seguro
function generateState() {
    if (crypto && crypto.getRandomValues) {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    // Fallback para browsers viejos
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// 🔍 DEBUG: Mostrar configuración en consola (solo en desarrollo)
if (typeof window !== 'undefined' && window.location.hostname.includes('localhost')) {
    console.log('🔧 Worldcoin Config Debug:', {
        app_id: WORLDCOIN_CONFIG.app_id,
        redirect_uri: WORLDCOIN_CONFIG.redirect_uri,
        current_origin: window.location.origin,
        auth_url: `${WORLDCOIN_BASE_URL}/authorize?client_id=${WORLDCOIN_CONFIG.client_id}&redirect_uri=${encodeURIComponent(WORLDCOIN_CONFIG.redirect_uri)}&response_type=${WORLDCOIN_CONFIG.response_type}&scope=${encodeURIComponent(WORLDCOIN_CONFIG.scope)}&nonce=${WORLDCOIN_CONFIG.nonce}&state=${WORLDCOIN_CONFIG.state}`
    });
}

// 🚨 VALIDACIONES DE CONFIGURACIÓN
function validateConfig() {
    const errors = [];
    
    if (!WORLDCOIN_CONFIG.app_id.startsWith('app_')) {
        errors.push('Invalid app_id format');
    }
    
    if (!WORLDCOIN_CONFIG.redirect_uri.startsWith('https://')) {
        errors.push('redirect_uri must be HTTPS');
    }
    
    if (!WORLDCOIN_CONFIG.redirect_uri.endsWith('/callback.html')) {
        errors.push('redirect_uri must end with /callback.html');
    }
    
    if (errors.length > 0) {
        console.error('❌ Worldcoin Config Errors:', errors);
    } else {
        console.log('✅ Worldcoin Config is valid');
    }
    
    return errors.length === 0;
}

// Validar al cargar
if (typeof window !== 'undefined') {
    setTimeout(validateConfig, 100);
}