// Usar variables de entorno en producción, fallback para desarrollo
const WORLDCOIN_CONFIG = {
    app_id: process.env.NEXT_PUBLIC_APP_ID || 'app_33bb8068826b85d4cd56d2ec2caba7cc',
    action: process.env.NEXT_PUBLIC_ACTION_NAME || 'rainbow-gold-tap',
    client_id: process.env.NEXT_PUBLIC_WLD_CLIENT_ID || 'app_33bb8068826b85d4cd56d2ec2caba7cc',
    redirect_uri: window.location.origin,
    response_type: 'code',
    scope: 'openid profile',
    nonce: generateNonce(),
    state: generateState()
};

const PAYMENT_ADDRESS = process.env.NEXT_PUBLIC_PAYMENT_ADDRESS || '0x91bf252c335f2540871d0d2ef1476ae193a5bc8a';

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