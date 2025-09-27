/**
 * api/payments/ideas.js - Sistema de Pagos para Ideas
 * Maneja compra de tickets para votaciones y sugerencias
 */

import { requireWorldIDAuth } from '../auth/worldcoin.js';
import { Encryption } from '../../lib/encryption.js';

// === CONFIGURACIÓN IDEAS ===
const IDEAS_CONFIG = {
  // Precios en WLD
  PRICES: {
    TICKET: 1.0,           // 1 WLD por ticket de ideas
    PREMIUM_SUGGESTION: 2.5, // Para sugerencias prioritarias
    POLL_CREATION: 5.0     // Para crear encuestas personalizadas
  },
  
  // Duraciones de tickets
  TICKET_DURATION: {
    STANDARD: 5 * 60 * 1000,    // 5 minutos
    PREMIUM: 15 * 60 * 1000,    // 15 minutos
    EXTENDED: 30 * 60 * 1000    // 30 minutos
  },
  
  // Límites y restricciones
  LIMITS: {
    MAX_TICKETS_PER_USER: 10,
    MAX_VOTES_PER_POLL: 1,
    MAX_SUGGESTIONS_PER_DAY: 5,
    COOLDOWN_BETWEEN_PURCHASES: 30 * 1000 // 30 segundos
  },
  
  // Configuración de transacciones
  TRANSACTION: {
    NETWORK: process.env.NODE_ENV === 'production' ? 'mainnet' : 'sepolia',
    RECIPIENT_ADDRESS: process.env.WLD_RECIPIENT_ADDRESS || '0x...',
    GAS_LIMIT: 50000,
    CONFIRMATION_BLOCKS: 3,
    TIMEOUT: 5 * 60 * 1000 // 5 minutos
  },
  
  // Estados de ticket
  TICKET_STATES: {
    ACTIVE: 'active',
    EXPIRED: 'expired', 
    USED: 'used',
    REFUNDED: 'refunded'
  },
  
  // Tipos de acciones
  ACTION_TYPES: {
    VOTE: 'vote',
    SUGGEST: 'suggest',
    CREATE_POLL: 'create_poll'
  }
};

// === CACHE Y ESTADO ===
const ticketCache = new Map();
const purchaseCooldowns = new Map();
const transactionsPending = new Map();

// === UTILIDADES ===
function generateTicketId() {
  return `ticket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function isInCooldown(userId) {
  const lastPurchase = purchaseCooldowns.get(userId);
  if (!lastPurchase) return false;
  
  return Date.now() - lastPurchase < IDEAS_CONFIG.LIMITS.COOLDOWN_BETWEEN_PURCHASES;
}

function setCooldown(userId) {
  purchaseCooldowns.set(userId, Date.now());
  
  // Limpiar después del cooldown
  setTimeout(() => {
    purchaseCooldowns.delete(userId);
  }, IDEAS_CONFIG.LIMITS.COOLDOWN_BETWEEN_PURCHASES);
}

function validateTicketRequest(ticketType, userId) {
  // Verificar cooldown
  if (isInCooldown(userId)) {
    throw new Error('Purchase cooldown active. Please wait before buying another ticket.');
  }
  
  // Verificar límites diarios
  const userTickets = Array.from(ticketCache.values())
    .filter(ticket => ticket.userId === userId && ticket.createdToday);
    
  if (userTickets.length >= IDEAS_CONFIG.LIMITS.MAX_TICKETS_PER_USER) {
    throw new Error('Daily ticket limit reached.');
  }
  
  return true;
}

async function createTransactionRecord(userId, ticketData, transactionHash = null) {
  try {
    const transaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      type: 'ideas_ticket_purchase',
      amount: ticketData.price,
      currency: 'WLD',
      status: transactionHash ? 'pending' : 'initiated',
      ticketId: ticketData.id,
      transactionHash,
      network: IDEAS_CONFIG.TRANSACTION.NETWORK,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + IDEAS_CONFIG.TRANSACTION.TIMEOUT).toISOString()
    };
    
    /* En implementación real, guardar en base de datos:
    await db.query(`
      INSERT INTO wld_transactions (
        id, user_id, transaction_type, amount, currency, status,
        blockchain_hash, payment_intent_id, game_action, game_metadata,
        created_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      transaction.id,
      userId,
      'ideas_ticket',
      transaction.amount,
      'WLD',
      transaction.status,
      transactionHash,
      transaction.id,
      'ticket_purchase',
      JSON.stringify(ticketData),
      transaction.createdAt,
      transaction.expiresAt
    ]);
    */
    
    // Guardar en cache temporal
    transactionsPending.set(transaction.id, transaction);
    
    // Auto-limpiar si no se confirma
    setTimeout(() => {
      if (transactionsPending.has(transaction.id)) {
        console.log(`Transaction ${transaction.id} expired`);
        transactionsPending.delete(transaction.id);
      }
    }, IDEAS_CONFIG.TRANSACTION.TIMEOUT);
    
    return transaction;
  } catch (error) {
    console.error('Error creating transaction record:', error);
    throw error;
  }
}

// === GESTIÓN DE TICKETS ===
class IdeasTicket {
  constructor(data) {
    this.id = data.id || generateTicketId();
    this.userId = data.userId;
    this.type = data.type || 'standard';
    this.price = data.price;
    this.duration = data.duration;
    this.actionsRemaining = data.actionsRemaining || 1;
    this.state = IDEAS_CONFIG.TICKET_STATES.ACTIVE;
    this.createdAt = new Date().toISOString();
    this.expiresAt = new Date(Date.now() + this.duration).toISOString();
    this.createdToday = true;
    this.usageHistory = [];
    this.transactionId = data.transactionId;
  }
  
  isValid() {
    return this.state === IDEAS_CONFIG.TICKET_STATES.ACTIVE && 
           Date.now() < new Date(this.expiresAt).getTime() &&
           this.actionsRemaining > 0;
  }
  
  use(actionType, actionData = {}) {
    if (!this.isValid()) {
      throw new Error('Ticket is not valid for use');
    }
    
    this.actionsRemaining--;
    this.usageHistory.push({
      actionType,
      actionData,
      usedAt: new Date().toISOString()
    });
    
    if (this.actionsRemaining <= 0) {
      this.state = IDEAS_CONFIG.TICKET_STATES.USED;
    }
    
    return this;
  }
  
  expire() {
    this.state = IDEAS_CONFIG.TICKET_STATES.EXPIRED;
    return this;
  }
  
  getRemainingTime() {
    return Math.max(0, new Date(this.expiresAt).getTime() - Date.now());
  }
  
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      state: this.state,
      actionsRemaining: this.actionsRemaining,
      remainingTime: this.getRemainingTime(),
      createdAt: this.createdAt,
      expiresAt: this.expiresAt,
      usageHistory: this.usageHistory
    };
  }
}

// === ENDPOINTS ===

/**
 * POST /api/payments/ideas/purchase-ticket
 * Comprar ticket para sistema de ideas
 */
export async function purchaseIdeasTicket(req, res) {
  try {
    const userId = req.user.worldIdHash;
    const { 
      ticketType = 'standard',
      paymentMethod = 'worldcoin',
      returnUrl = null
    } = req.body;
    
    // Validar tipo de ticket
    const validTypes = ['standard', 'premium', 'extended'];
    if (!validTypes.includes(ticketType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ticket type'
      });
    }
    
    // Validar solicitud
    validateTicketRequest(ticketType, userId);
    
    // Determinar precio y duración según tipo
    let price, duration;
    switch (ticketType) {
      case 'standard':
        price = IDEAS_CONFIG.PRICES.TICKET;
        duration = IDEAS_CONFIG.TICKET_DURATION.STANDARD;
        break;
      case 'premium':
        price = IDEAS_CONFIG.PRICES.PREMIUM_SUGGESTION;
        duration = IDEAS_CONFIG.TICKET_DURATION.PREMIUM;
        break;
      case 'extended':
        price = IDEAS_CONFIG.PRICES.TICKET * 2;
        duration = IDEAS_CONFIG.TICKET_DURATION.EXTENDED;
        break;
    }
    
    // Crear ticket (inactivo hasta confirmación de pago)
    const ticketData = {
      userId,
      type: ticketType,
      price,
      duration,
      actionsRemaining: ticketType === 'premium' ? 3 : 1
    };
    
    const ticket = new IdeasTicket(ticketData);
    
    // Crear registro de transacción
    const transaction = await createTransactionRecord(userId, {
      id: ticket.id,
      type: ticketType,
      price,
      duration
    });
    
    ticket.transactionId = transaction.id;
    
    // Preparar payment intent según método
    let paymentIntent;
    
    if (paymentMethod === 'worldcoin') {
      paymentIntent = await createWorldcoinPaymentIntent({
        amount: price,
        currency: 'WLD',
        description: `RainbowGold Ideas Ticket (${ticketType})`,
        metadata: {
          ticketId: ticket.id,
          userId,
          ticketType
        },
        returnUrl: returnUrl || `${req.protocol}://${req.get('host')}/ideas?ticket=${ticket.id}`
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Payment method not supported'
      });
    }
    
    // Guardar ticket en cache (inactivo)
    ticket.state = 'pending_payment';
    ticketCache.set(ticket.id, ticket);
    
    // Establecer cooldown
    setCooldown(userId);
    
    res.json({
      success: true,
      ticket: ticket.toJSON(),
      transaction: {
        id: transaction.id,
        amount: price,
        currency: 'WLD',
        status: 'pending_payment'
      },
      payment_intent: paymentIntent,
      message: 'Ticket created. Complete payment to activate.'
    });
    
  } catch (error) {
    console.error('Ideas ticket purchase error:', error);
    
    if (error.message.includes('cooldown') || error.message.includes('limit')) {
      return res.status(429).json({
        success: false,
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create ideas ticket'
    });
  }
}

/**
 * POST /api/payments/ideas/confirm-payment
 * Confirmar pago y activar ticket
 */
export async function confirmIdeasPayment(req, res) {
  try {
    const userId = req.user.worldIdHash;
    const { 
      ticketId, 
      transactionHash,
      paymentProof
    } = req.body;
    
    if (!ticketId || !transactionHash) {
      return res.status(400).json({
        success: false,
        error: 'Ticket ID and transaction hash are required'
      });
    }
    
    // Obtener ticket del cache
    const ticket = ticketCache.get(ticketId);
    if (!ticket || ticket.userId !== userId) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found or not owned by user'
      });
    }
    
    if (ticket.state !== 'pending_payment') {
      return res.status(400).json({
        success: false,
        error: 'Ticket is not awaiting payment confirmation'
      });
    }
    
    // Verificar transacción en blockchain
    const isValidTransaction = await verifyWLDTransaction(
      transactionHash, 
      ticket.price,
      IDEAS_CONFIG.TRANSACTION.RECIPIENT_ADDRESS
    );
    
    if (!isValidTransaction) {
      return res.status(400).json({
        success: false,
        error: 'Transaction verification failed'
      });
    }
    
    // Activar ticket
    ticket.state = IDEAS_CONFIG.TICKET_STATES.ACTIVE;
    ticket.transactionHash = transactionHash;
    ticket.activatedAt = new Date().toISOString();
    
    // Actualizar transacción
    const transaction = transactionsPending.get(ticket.transactionId);
    if (transaction) {
      transaction.status = 'confirmed';
      transaction.transactionHash = transactionHash;
      transaction.confirmedAt = new Date().toISOString();
    }
    
    // Programar expiración automática
    setTimeout(() => {
      if (ticketCache.has(ticketId)) {
        const expiredTicket = ticketCache.get(ticketId);
        if (expiredTicket.state === IDEAS_CONFIG.TICKET_STATES.ACTIVE) {
          expiredTicket.expire();
        }
      }
    }, ticket.duration);
    
    // Guardar en base de datos permanente
    await saveTicketToDatabase(ticket, transaction);
    
    res.json({
      success: true,
      ticket: ticket.toJSON(),
      transaction: {
        id: transaction.id,
        hash: transactionHash,
        status: 'confirmed',
        confirmedAt: transaction.confirmedAt
      },
      message: 'Payment confirmed. Ticket is now active!'
    });
    
  } catch (error) {
    console.error('Ideas payment confirmation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm payment'
    });
  }
}

/**
 * GET /api/payments/ideas/my-tickets
 * Obtener tickets activos del usuario
 */
export async function getMyIdeasTickets(req, res) {
  try {
    const userId = req.user.worldIdHash;
    
    // Obtener tickets del cache y base de datos
    const cacheTickets = Array.from(ticketCache.values())
      .filter(ticket => ticket.userId === userId);
    
    const dbTickets = await getUserTicketsFromDB(userId);
    
    // Combinar y filtrar tickets válidos
    const allTickets = [...cacheTickets, ...dbTickets];
    const uniqueTickets = allTickets.filter((ticket, index, self) => 
      index === self.findIndex(t => t.id === ticket.id)
    );
    
    // Filtrar por estado
    const activeTickets = uniqueTickets.filter(ticket => ticket.isValid?.() || ticket.state === 'active');
    const expiredTickets = uniqueTickets.filter(ticket => ticket.state === 'expired');
    const usedTickets = uniqueTickets.filter(ticket => ticket.state === 'used');
    
    res.json({
      success: true,
      tickets: {
        active: activeTickets.map(t => t.toJSON?.() || t),
        expired: expiredTickets.map(t => t.toJSON?.() || t),
        used: usedTickets.map(t => t.toJSON?.() || t)
      },
      summary: {
        active_count: activeTickets.length,
        total_purchased: uniqueTickets.length,
        total_spent: uniqueTickets.reduce((sum, t) => sum + (t.price || 0), 0)
      }
    });
    
  } catch (error) {
    console.error('Get user tickets error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user tickets'
    });
  }
}

/**
 * POST /api/payments/ideas/use-ticket
 * Usar ticket para una acción
 */
export async function useIdeasTicket(req, res) {
  try {
    const userId = req.user.worldIdHash;
    const { 
      ticketId, 
      actionType,
      actionData = {}
    } = req.body;
    
    // Validar acción
    if (!Object.values(IDEAS_CONFIG.ACTION_TYPES).includes(actionType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action type'
      });
    }
    
    // Obtener ticket
    let ticket = ticketCache.get(ticketId);
    if (!ticket) {
      ticket = await getTicketFromDB(ticketId);
    }
    
    if (!ticket || ticket.userId !== userId) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found or not owned by user'
      });
    }
    
    // Verificar validez
    if (!ticket.isValid()) {
      return res.status(400).json({
        success: false,
        error: 'Ticket is expired or already used'
      });
    }
    
    // Usar ticket
    ticket.use(actionType, actionData);
    
    // Actualizar en cache y DB
    if (ticketCache.has(ticketId)) {
      ticketCache.set(ticketId, ticket);
    }
    await updateTicketInDB(ticket);
    
    res.json({
      success: true,
      ticket: ticket.toJSON(),
      action: {
        type: actionType,
        data: actionData,
        executedAt: new Date().toISOString()
      },
      message: `Ticket used for ${actionType}. ${ticket.actionsRemaining} actions remaining.`
    });
    
  } catch (error) {
    console.error('Use ticket error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to use ticket'
    });
  }
}

/**
 * GET /api/payments/ideas/pricing
 * Obtener información de precios
 */
export async function getIdeasPricing(req, res) {
  try {
    res.json({
      success: true,
      pricing: {
        tickets: {
          standard: {
            price: IDEAS_CONFIG.PRICES.TICKET,
            duration: IDEAS_CONFIG.TICKET_DURATION.STANDARD / 1000, // en segundos
            actions: 1,
            description: 'Basic ticket for voting or suggesting'
          },
          premium: {
            price: IDEAS_CONFIG.PRICES.PREMIUM_SUGGESTION,
            duration: IDEAS_CONFIG.TICKET_DURATION.PREMIUM / 1000,
            actions: 3,
            description: 'Premium ticket with multiple actions'
          },
          extended: {
            price: IDEAS_CONFIG.PRICES.TICKET * 2,
            duration: IDEAS_CONFIG.TICKET_DURATION.EXTENDED / 1000,
            actions: 1,
            description: 'Extended duration ticket'
          }
        },
        special: {
          poll_creation: {
            price: IDEAS_CONFIG.PRICES.POLL_CREATION,
            description: 'Create your own poll'
          }
        }
      },
      limits: {
        max_tickets_per_user: IDEAS_CONFIG.LIMITS.MAX_TICKETS_PER_USER,
        max_suggestions_per_day: IDEAS_CONFIG.LIMITS.MAX_SUGGESTIONS_PER_DAY,
        cooldown_seconds: IDEAS_CONFIG.LIMITS.COOLDOWN_BETWEEN_PURCHASES / 1000
      },
      currency: 'WLD',
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get pricing error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pricing information'
    });
  }
}

// === FUNCIONES DE PAGO ===
async function createWorldcoinPaymentIntent(paymentData) {
  try {
    // Implementar integración con Worldcoin Pay API
    const paymentIntent = {
      id: `pi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount: paymentData.amount,
      currency: paymentData.currency,
      status: 'requires_payment',
      client_secret: `pi_secret_${Math.random().toString(36)}`,
      payment_url: `worldapp://payment/${paymentData.amount}/WLD?recipient=${IDEAS_CONFIG.TRANSACTION.RECIPIENT_ADDRESS}&description=${encodeURIComponent(paymentData.description)}`,
      qr_code: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`worldapp://payment/${paymentData.amount}/WLD`)}`,
      expires_at: new Date(Date.now() + IDEAS_CONFIG.TRANSACTION.TIMEOUT).toISOString()
    };
    
    return paymentIntent;
  } catch (error) {
    console.error('Payment intent creation error:', error);
    throw error;
  }
}

async function verifyWLDTransaction(txHash, expectedAmount, expectedRecipient) {
  try {
    // En implementación real, verificar con un provider de blockchain
    console.log(`Verifying transaction ${txHash} for ${expectedAmount} WLD to ${expectedRecipient}`);
    
    // Mock verification - en producción usar ethers.js o similar
    if (txHash.startsWith('0x') && txHash.length === 66) {
      // Simular verificación exitosa
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Transaction verification error:', error);
    return false;
  }
}

// === FUNCIONES DE BASE DE DATOS ===
async function saveTicketToDatabase(ticket, transaction) {
  try {
    /* Implementación real:
    await db.query(`
      INSERT INTO ideas_tickets (
        id, user_id, type, price, duration, actions_remaining,
        state, created_at, expires_at, activated_at, transaction_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      ticket.id,
      ticket.userId,
      ticket.type,
      ticket.price,
      ticket.duration,
      ticket.actionsRemaining,
      ticket.state,
      ticket.createdAt,
      ticket.expiresAt,
      ticket.activatedAt,
      ticket.transactionId
    ]);
    */
    
    console.log('Saving ticket to database:', ticket.id);
  } catch (error) {
    console.error('Database save error:', error);
    throw error;
  }
}

async function getUserTicketsFromDB(userId) {
  try {
    /* Implementación real:
    const result = await db.query(`
      SELECT * FROM ideas_tickets 
      WHERE user_id = $1 
      ORDER BY created_at DESC
    `, [userId]);
    
    return result.rows.map(row => new IdeasTicket(row));
    */
    
    // Mock para desarrollo
    return [];
  } catch (error) {
    console.error('Database fetch error:', error);
    return [];
  }
}

async function getTicketFromDB(ticketId) {
  try {
    /* Implementación real:
    const result = await db.query(`
      SELECT * FROM ideas_tickets WHERE id = $1
    `, [ticketId]);
    
    return result.rows[0] ? new IdeasTicket(result.rows[0]) : null;
    */
    
    return null;
  } catch (error) {
    console.error('Database fetch error:', error);
    return null;
  }
}

async function updateTicketInDB(ticket) {
  try {
    /* Implementación real:
    await db.query(`
      UPDATE ideas_tickets 
      SET actions_remaining = $2, state = $3, usage_history = $4
      WHERE id = $1
    `, [
      ticket.id,
      ticket.actionsRemaining,
      ticket.state,
      JSON.stringify(ticket.usageHistory)
    ]);
    */
    
    console.log('Updating ticket in database:', ticket.id);
  } catch (error) {
    console.error('Database update error:', error);
    throw error;
  }
}

// === CLEANUP AUTOMÁTICO ===
setInterval(() => {
  // Limpiar tickets expirados del cache
  for (const [ticketId, ticket] of ticketCache.entries()) {
    if (!ticket.isValid() && ticket.state !== 'pending_payment') {
      ticketCache.delete(ticketId);
    }
  }
  
  // Limpiar transacciones pendientes expiradas
  for (const [txId, tx] of transactionsPending.entries()) {
    if (Date.now() > new Date(tx.expiresAt).getTime()) {
      transactionsPending.delete(txId);
    }
  }
}, 5 * 60 * 1000); // Cada 5 minutos

// === RUTAS ===
export const ideasPaymentRoutes = {
  'POST /purchase-ticket': [requireWorldIDAuth, purchaseIdeasTicket],
  'POST /confirm-payment': [requireWorldIDAuth, confirmIdeasPayment],
  'GET /my-tickets': [requireWorldIDAuth, getMyIdeasTickets],
  'POST /use-ticket': [requireWorldIDAuth, useIdeasTicket],
  'GET /pricing': getIdeasPricing
};