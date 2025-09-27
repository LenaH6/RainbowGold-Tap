/**
 * api/payments/refill.js - Sistema de Pagos para Refill de Energía
 * Maneja transacciones WLD para recargas de energía y otros pagos
 */

import { requireSiweAuth } from '../auth/siwe.js';
import { createHash } from 'crypto';

// === CONFIGURACIÓN DE PAGOS ===
const PAYMENT_CONFIG = {
  // Precios base en WLD
  PRICES: {
    ENERGY_REFILL: 0.001,           // 0.001 WLD por refill completo
    ENERGY_PER_POINT: 0.000001,     // 0.000001 WLD por punto de energía
    IDEAS_TICKET: 1.0,              // 1 WLD por ticket de ideas
    PREMIUM_BOOST: 5.0,             // 5 WLD por boost premium
    CUSTOM_USERNAME: 2.5,           // 2.5 WLD por username personalizado
    LEADERBOARD_HIGHLIGHT: 0.5      // 0.5 WLD por destacar en ranking
  },
  
  // Configuración de transacciones
  TRANSACTION: {
    TIMEOUT: 300000,              // 5 minutos timeout
    MIN_CONFIRMATION_TIME: 30000, // 30 segundos mínimo antes de confirmar
    MAX_PENDING_TIME: 600000,     // 10 minutos máximo pendiente
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 5000             // 5 segundos entre reintentos
  },
  
  // Límites y validaciones
  LIMITS: {
    MAX_REFILLS_PER_HOUR: 20,
    MAX_REFILLS_PER_DAY: 100,
    MIN_BALANCE_REQUIRED: 0.0001,
    MAX_TRANSACTION_AMOUNT: 100.0
  },
  
  // Estados de transacción
  TRANSACTION_STATES: {
    PENDING: 'pending',
    PROCESSING: 'processing', 
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    REFUNDED: 'refunded'
  },
  
  // Tipos de productos
  PRODUCT_TYPES: {
    ENERGY_REFILL: 'energy_refill',
    IDEAS_TICKET: 'ideas_ticket',
    PREMIUM_BOOST: 'premium_boost',
    CUSTOM_USERNAME: 'custom_username',
    LEADERBOARD_HIGHLIGHT: 'leaderboard_highlight'
  }
};

// Cache de transacciones activas
const activeTransactions = new Map();

// === UTILIDADES ===
function generateTransactionId() {
  return `tx_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

function generatePaymentHash(userId, productType, amount, timestamp) {
  return createHash('sha256')
    .update(`${userId}_${productType}_${amount}_${timestamp}`)
    .digest('hex')
    .substring(0, 16);
}

function validateUserLimits(userId, productType) {
  // En implementación real, consultar base de datos
  // Por ahora, mock validation
  return {
    valid: true,
    remainingHourly: PAYMENT_CONFIG.LIMITS.MAX_REFILLS_PER_HOUR,
    remainingDaily: PAYMENT_CONFIG.LIMITS.MAX_REFILLS_PER_DAY
  };
}

function calculateRefillAmount(currentEnergy, maxEnergy) {
  const missingEnergy = Math.max(0, maxEnergy - currentEnergy);
  const basePrice = PAYMENT_CONFIG.PRICES.ENERGY_REFILL;
  
  // Precio dinámico basado en energía faltante
  const dynamicPrice = Math.max(
    basePrice * 0.1, // Mínimo 10% del precio base
    missingEnergy * PAYMENT_CONFIG.PRICES.ENERGY_PER_POINT
  );
  
  return parseFloat(dynamicPrice.toFixed(6));
}

// === ENDPOINTS ===

/**
 * GET /api/payments/refill/prices
 * Obtiene precios actuales de productos
 */
export async function getRefillPrices(req, res) {
  try {
    const { product_type = 'all' } = req.query;
    
    let prices = {};
    
    if (product_type === 'all') {
      prices = PAYMENT_CONFIG.PRICES;
    } else if (PAYMENT_CONFIG.PRICES[product_type.toUpperCase()]) {
      prices[product_type] = PAYMENT_CONFIG.PRICES[product_type.toUpperCase()];
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid product type'
      });
    }
    
    // Calcular precios dinámicos si es necesario
    const dynamicPrices = {};
    for (const [key, basePrice] of Object.entries(prices)) {
      dynamicPrices[key.toLowerCase()] = {
        base_price: basePrice,
        current_price: basePrice, // En implementación real, aplicar modificadores
        currency: 'WLD',
        last_updated: new Date().toISOString()
      };
    }
    
    res.json({
      success: true,
      prices: dynamicPrices,
      limits: PAYMENT_CONFIG.LIMITS,
      updated_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Get prices error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prices'
    });
  }
}

/**
 * POST /api/payments/refill/calculate
 * Calcula precio exacto para refill basado en energía actual
 */
export async function calculateRefillPrice(req, res) {
  try {
    const userId = req.user.address;
    const { 
      current_energy, 
      max_energy, 
      product_type = 'energy_refill' 
    } = req.body;
    
    // Validar parámetros
    if (current_energy === undefined || max_energy === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing energy parameters'
      });
    }
    
    if (current_energy < 0 || max_energy <= 0 || current_energy > max_energy) {
      return res.status(400).json({
        success: false,
        error: 'Invalid energy values'
      });
    }
    
    // Validar límites de usuario
    const limitsCheck = validateUserLimits(userId, product_type);
    if (!limitsCheck.valid) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        limits: limitsCheck
      });
    }
    
    // Calcular precio
    let calculatedPrice;
    let energyToRestore;
    
    switch (product_type) {
      case PAYMENT_CONFIG.PRODUCT_TYPES.ENERGY_REFILL:
        energyToRestore = max_energy - current_energy;
        calculatedPrice = calculateRefillAmount(current_energy, max_energy);
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'Unsupported product type for calculation'
        });
    }
    
    // Generar hash de cálculo para validación posterior
    const calculationHash = generatePaymentHash(
      userId, 
      product_type, 
      calculatedPrice, 
      Date.now()
    );
    
    res.json({
      success: true,
      calculation: {
        product_type,
        current_energy,
        max_energy,
        energy_to_restore: energyToRestore,
        calculated_price: calculatedPrice,
        currency: 'WLD',
        valid_until: new Date(Date.now() + 300000).toISOString(), // 5 min
        calculation_hash: calculationHash
      },
      limits: limitsCheck,
      estimated_confirmation_time: PAYMENT_CONFIG.TRANSACTION.MIN_CONFIRMATION_TIME / 1000
    });
    
  } catch (error) {
    console.error('Calculate refill price error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate price'
    });
  }
}

/**
 * POST /api/payments/refill/initiate
 * Inicia proceso de pago para refill
 */
export async function initiateRefillPayment(req, res) {
  try {
    const userId = req.user.address;
    const {
      product_type,
      amount,
      calculation_hash,
      metadata = {}
    } = req.body;
    
    // Validar parámetros básicos
    if (!product_type || amount === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required payment parameters'
      });
    }
    
    // Validar monto
    if (amount <= 0 || amount > PAYMENT_CONFIG.LIMITS.MAX_TRANSACTION_AMOUNT) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment amount'
      });
    }
    
    // Validar límites de usuario
    const limitsCheck = validateUserLimits(userId, product_type);
    if (!limitsCheck.valid) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded'
      });
    }
    
    // Verificar balance de usuario (mock)
    const userBalance = await getUserWLDBalance(userId);
    if (userBalance < amount) {
      return res.status(402).json({
        success: false,
        error: 'Insufficient WLD balance',
        required: amount,
        available: userBalance
      });
    }
    
    // Generar ID de transacción
    const transactionId = generateTransactionId();
    
    // Crear registro de transacción
    const transaction = {
      id: transactionId,
      user_id: userId,
      product_type,
      amount,
      currency: 'WLD',
      status: PAYMENT_CONFIG.TRANSACTION_STATES.PENDING,
      calculation_hash,
      metadata: {
        ...metadata,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        initiated_at: new Date().toISOString()
      },
      created_at: new Date(),
      expires_at: new Date(Date.now() + PAYMENT_CONFIG.TRANSACTION.TIMEOUT)
    };
    
    // Guardar en cache temporal y base de datos
    activeTransactions.set(transactionId, transaction);
    await saveTransactionToDatabase(transaction);
    
    // Iniciar proceso de pago (mock)
    setTimeout(() => {
      processPaymentAsync(transactionId);
    }, 100);
    
    res.json({
      success: true,
      transaction: {
        id: transactionId,
        status: transaction.status,
        amount: transaction.amount,
        currency: transaction.currency,
        expires_at: transaction.expires_at.toISOString(),
        estimated_completion: new Date(
          Date.now() + PAYMENT_CONFIG.TRANSACTION.MIN_CONFIRMATION_TIME
        ).toISOString()
      },
      next_steps: {
        poll_url: `/api/payments/refill/status/${transactionId}`,
        poll_interval: 2000, // 2 segundos
        max_wait_time: PAYMENT_CONFIG.TRANSACTION.MAX_PENDING_TIME
      }
    });
    
  } catch (error) {
    console.error('Initiate payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate payment'
    });
  }
}

/**
 * GET /api/payments/refill/status/:transactionId
 * Consulta estado de transacción
 */
export async function getPaymentStatus(req, res) {
  try {
    const { transactionId } = req.params;
    const userId = req.user.address;
    
    if (!transactionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing transaction ID'
      });
    }
    
    // Buscar transacción
    let transaction = activeTransactions.get(transactionId);
    
    if (!transaction) {
      // Buscar en base de datos
      transaction = await getTransactionFromDatabase(transactionId);
    }
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }
    
    // Verificar que el usuario sea el propietario
    if (transaction.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    // Verificar si expiró
    if (new Date() > transaction.expires_at && 
        transaction.status === PAYMENT_CONFIG.TRANSACTION_STATES.PENDING) {
      transaction.status = PAYMENT_CONFIG.TRANSACTION_STATES.CANCELLED;
      await updateTransactionStatus(transactionId, transaction.status, 'Transaction expired');
    }
    
    res.json({
      success: true,
      transaction: {
        id: transaction.id,
        status: transaction.status,
        amount: transaction.amount,
        currency: transaction.currency,
        product_type: transaction.product_type,
        created_at: transaction.created_at,
        completed_at: transaction.completed_at || null,
        expires_at: transaction.expires_at,
        error_message: transaction.error_message || null
      },
      can_retry: transaction.status === PAYMENT_CONFIG.TRANSACTION_STATES.FAILED &&
                transaction.retry_count < PAYMENT_CONFIG.TRANSACTION.RETRY_ATTEMPTS
    });
    
  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get payment status'
    });
  }
}

/**
 * POST /api/payments/refill/confirm/:transactionId
 * Confirma y aplica efectos del pago completado
 */
export async function confirmRefillPayment(req, res) {
  try {
    const { transactionId } = req.params;
    const userId = req.user.address;
    
    if (!transactionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing transaction ID'
      });
    }
    
    // Buscar transacción
    const transaction = activeTransactions.get(transactionId) || 
                       await getTransactionFromDatabase(transactionId);
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }
    
    // Verificar propietario
    if (transaction.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    // Verificar estado
    if (transaction.status !== PAYMENT_CONFIG.TRANSACTION_STATES.COMPLETED) {
      return res.status(400).json({
        success: false,
        error: `Transaction not completed (status: ${transaction.status})`
      });
    }
    
    // Aplicar efectos del pago
    const effects = await applyPaymentEffects(userId, transaction);
    
    if (!effects.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to apply payment effects',
        details: effects.error
      });
    }
    
    // Marcar como confirmado
    await updateTransactionStatus(
      transactionId, 
      'confirmed', 
      'Payment effects applied successfully'
    );
    
    // Limpiar de cache
    activeTransactions.delete(transactionId);
    
    res.json({
      success: true,
      transaction_id: transactionId,
      effects: effects.effects,
      message: 'Payment confirmed and effects applied',
      confirmed_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm payment'
    });
  }
}

/**
 * POST /api/payments/refill/cancel/:transactionId
 * Cancela transacción pendiente
 */
export async function cancelPayment(req, res) {
  try {
    const { transactionId } = req.params;
    const userId = req.user.address;
    const { reason = 'User cancelled' } = req.body;
    
    const transaction = activeTransactions.get(transactionId) || 
                       await getTransactionFromDatabase(transactionId);
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }
    
    if (transaction.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    // Solo se pueden cancelar transacciones pendientes
    if (transaction.status !== PAYMENT_CONFIG.TRANSACTION_STATES.PENDING) {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel transaction with status: ${transaction.status}`
      });
    }
    
    // Actualizar estado
    await updateTransactionStatus(
      transactionId, 
      PAYMENT_CONFIG.TRANSACTION_STATES.CANCELLED, 
      reason
    );
    
    activeTransactions.delete(transactionId);
    
    res.json({
      success: true,
      transaction_id: transactionId,
      status: PAYMENT_CONFIG.TRANSACTION_STATES.CANCELLED,
      message: 'Transaction cancelled successfully',
      cancelled_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Cancel payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel payment'
    });
  }
}

/**
 * GET /api/payments/refill/history
 * Historial de pagos del usuario
 */
export async function getPaymentHistory(req, res) {
  try {
    const userId = req.user.address;
    const {
      limit = 20,
      offset = 0,
      status = 'all',
      product_type = 'all',
      date_from = null,
      date_to = null
    } = req.query;
    
    const limitNum = Math.min(parseInt(limit), 100);
    const offsetNum = Math.max(0, parseInt(offset));
    
    // Obtener historial de base de datos
    const history = await getPaymentHistoryFromDatabase(userId, {
      limit: limitNum,
      offset: offsetNum,
      status: status !== 'all' ? status : null,
      product_type: product_type !== 'all' ? product_type : null,
      date_from,
      date_to
    });
    
    res.json({
      success: true,
      payments: history.transactions,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        total: history.total,
        has_more: (offsetNum + limitNum) < history.total
      },
      summary: history.summary,
      updated_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment history'
    });
  }
}

// === FUNCIONES DE PROCESAMIENTO ASÍNCRONO ===

async function processPaymentAsync(transactionId) {
  try {
    const transaction = activeTransactions.get(transactionId);
    if (!transaction) return;
    
    // Simular procesamiento (en implementación real: blockchain, APIs de pago)
    console.log(`Processing payment: ${transactionId}`);
    
    // Actualizar estado a procesando
    transaction.status = PAYMENT_CONFIG.TRANSACTION_STATES.PROCESSING;
    await updateTransactionStatus(transactionId, transaction.status, 'Payment processing started');
    
    // Simular tiempo de procesamiento
    await new Promise(resolve => setTimeout(resolve, 
      PAYMENT_CONFIG.TRANSACTION.MIN_CONFIRMATION_TIME + Math.random() * 10000));
    
    // Simular éxito/fallo (95% éxito)
    const success = Math.random() > 0.05;
    
    if (success) {
      transaction.status = PAYMENT_CONFIG.TRANSACTION_STATES.COMPLETED;
      transaction.completed_at = new Date();
      await updateTransactionStatus(transactionId, transaction.status, 'Payment completed successfully');
      
      console.log(`Payment completed: ${transactionId}`);
    } else {
      transaction.status = PAYMENT_CONFIG.TRANSACTION_STATES.FAILED;
      transaction.error_message = 'Payment processing failed';
      await updateTransactionStatus(transactionId, transaction.status, transaction.error_message);
      
      console.log(`Payment failed: ${transactionId}`);
    }
    
  } catch (error) {
    console.error(`Payment processing error for ${transactionId}:`, error);
    
    await updateTransactionStatus(
      transactionId, 
      PAYMENT_CONFIG.TRANSACTION_STATES.FAILED, 
      error.message
    );
  }
}

async function applyPaymentEffects(userId, transaction) {
  try {
    const effects = [];
    
    switch (transaction.product_type) {
      case PAYMENT_CONFIG.PRODUCT_TYPES.ENERGY_REFILL:
        // Restaurar energía completa
        const energyEffect = await restoreUserEnergy(userId, transaction.metadata.max_energy || 100);
        effects.push({
          type: 'energy_restored',
          amount: energyEffect.restored,
          new_total: energyEffect.newTotal
        });
        break;
        
      case PAYMENT_CONFIG.PRODUCT_TYPES.IDEAS_TICKET:
        // Dar ticket para votar ideas
        const ticketEffect = await grantIdeasTicket(userId);
        effects.push({
          type: 'ideas_ticket_granted',
          ticket_id: ticketEffect.ticketId,
          valid_until: ticketEffect.validUntil
        });
        break;
        
      case PAYMENT_CONFIG.PRODUCT_TYPES.PREMIUM_BOOST:
        // Activar boost premium
        const boostEffect = await activatePremiumBoost(userId, transaction.metadata.duration || 3600000);
        effects.push({
          type: 'premium_boost_activated',
          multiplier: boostEffect.multiplier,
          duration: boostEffect.duration,
          expires_at: boostEffect.expiresAt
        });
        break;
        
      default:
        throw new Error(`Unknown product type: ${transaction.product_type}`);
    }
    
    return {
      success: true,
      effects
    };
    
  } catch (error) {
    console.error('Apply payment effects error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// === FUNCIONES DE BASE DE DATOS (MOCK) ===

async function getUserWLDBalance(userId) {
  // Mock: En implementación real, consultar balance real del usuario
  return Math.random() * 10 + 5; // Random entre 5-15 WLD
}

async function saveTransactionToDatabase(transaction) {
  // Mock: Guardar en base de datos real
  console.log('Saving transaction to database:', transaction.id);
  return true;
}

async function getTransactionFromDatabase(transactionId) {
  // Mock: Buscar en base de datos real
  return activeTransactions.get(transactionId) || null;
}

async function updateTransactionStatus(transactionId, status, message = null) {
  // Mock: Actualizar en base de datos real
  const transaction = activeTransactions.get(transactionId);
  if (transaction) {
    transaction.status = status;
    transaction.status_message = message;
    transaction.updated_at = new Date();
  }
  
  console.log(`Transaction ${transactionId} updated: ${status} - ${message}`);
  return true;
}

async function getPaymentHistoryFromDatabase(userId, filters) {
  // Mock: Obtener historial real de base de datos
  const mockTransactions = [
    {
      id: 'tx_1234567890_abc',
      product_type: PAYMENT_CONFIG.PRODUCT_TYPES.ENERGY_REFILL,
      amount: 0.001,
      status: PAYMENT_CONFIG.TRANSACTION_STATES.COMPLETED,
      created_at: new Date(Date.now() - 86400000), // 1 día atrás
      completed_at: new Date(Date.now() - 86400000 + 30000)
    }
  ];
  
  return {
    transactions: mockTransactions.slice(filters.offset, filters.offset + filters.limit),
    total: mockTransactions.length,
    summary: {
      total_spent: 0.001,
      total_transactions: 1,
      successful_transactions: 1,
      failed_transactions: 0
    }
  };
}

async function restoreUserEnergy(userId, maxEnergy) {
  // Mock: Restaurar energía en base de datos del juego
  console.log(`Restoring energy for user ${userId} to ${maxEnergy}`);
  return {
    restored: maxEnergy,
    newTotal: maxEnergy
  };
}

async function grantIdeasTicket(userId) {
  // Mock: Otorgar ticket para ideas
  const ticketId = `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  console.log(`Granting ideas ticket ${ticketId} to user ${userId}`);
  return {
    ticketId,
    validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 días
  };
}

async function activatePremiumBoost(userId, duration) {
  // Mock: Activar boost premium
  const multiplier = 2.0;
  const expiresAt = new Date(Date.now() + duration);
  
  console.log(`Activating premium boost for user ${userId}: ${multiplier}x for ${duration}ms`);
  return {
    multiplier,
    duration,
    expiresAt: expiresAt.toISOString()
  };
}

// === CLEANUP DE TRANSACCIONES EXPIRADAS ===
setInterval(() => {
  const now = new Date();
  const expiredTransactions = [];
  
  for (const [id, transaction] of activeTransactions) {
    if (now > transaction.expires_at && 
        transaction.status === PAYMENT_CONFIG.TRANSACTION_STATES.PENDING) {
      expiredTransactions.push(id);
    }
  }
  
  expiredTransactions.forEach(id => {
    updateTransactionStatus(id, PAYMENT_CONFIG.TRANSACTION_STATES.CANCELLED, 'Transaction expired');
    activeTransactions.delete(id);
  });
  
  if (expiredTransactions.length > 0) {
    console.log(`Cleaned up ${expiredTransactions.length} expired transactions`);
  }
}, 60000); // Cada minuto

// === RUTAS ===
export const refillRoutes = {
  'GET /prices': getRefillPrices,
  'POST /calculate': [requireSiweAuth, calculateRefillPrice],
  'POST /initiate': [requireSiweAuth, initiateRefillPayment],
  'GET /status/:transactionId': [requireSiweAuth, getPaymentStatus],
  'POST /confirm/:transactionId': [requireSiweAuth, confirmRefillPayment],
  'POST /cancel/:transactionId': [requireSiweAuth, cancelPayment],
  'GET /history': [requireSiweAuth, getPaymentHistory]
};

// === EXPORTAR CONFIGURACIÓN ===
export const REFILL_CONFIG = PAYMENT_CONFIG;