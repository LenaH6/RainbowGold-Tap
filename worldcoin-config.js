// Worldcoin OIDC Configuration
const WORLDCOIN_CONFIG = {
    app_id: 'app_33bb8068826b85d4cd56d2ec2caba7cc',
    action: 'rainbow-gold-tap',
    signal: '',
    // Configuración OIDC
    client_id: 'app_33bb8068826b85d4cd56d2ec2caba7cc',
    redirect_uri: window.location.origin,
    response_type: 'code',
    scope: 'openid profile',
    nonce: generateNonce(),
    state: generateState()
};

// Dirección de destino para pagos
const PAYMENT_ADDRESS = '0x91bf252c335f2540871d0d2ef1476ae193a5bc8a';

// Generar nonce aleatorio
function generateNonce() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Generar state aleatorio
function generateState() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// URL base de Worldcoin
const WORLDCOIN_BASE_URL = 'https://id.worldcoin.org';