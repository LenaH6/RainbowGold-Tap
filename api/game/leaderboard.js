/**
 * api/game/leaderboard.js - Sistema de Rankings y Leaderboards
 * Maneja rankings globales, por tiempo y logros del juego
 */

import { requireSiweAuth } from '../auth/siwe.js';

// === CONFIGURACIÓN LEADERBOARD ===
const LEADERBOARD_CONFIG = {
  // Tipos de rankings
  RANKING_TYPES: {
    GLOBAL_RBGP: 'global_rbgp',
    WEEKLY_RBGP: 'weekly_rbgp', 
    DAILY_RBGP: 'daily_rbgp',
    HIGHEST_COMBO: 'highest_combo',
    RAINBOW_COMPLETIONS: 'rainbow_completions',
    TOTAL_TAPS: 'total_taps',
    PLAYTIME: 'total_playtime'
  },
  
  // Límites de resultados
  MAX_RESULTS: {
    TOP: 100,
    AROUND_USER: 20,
    SEARCH: 50
  },
  
  // Cache settings
  CACHE_DURATION: {
    GLOBAL: 5 * 60 * 1000,    // 5 minutos
    WEEKLY: 2 * 60 * 1000,    // 2 minutos
    DAILY: 1 * 60 * 1000,     // 1 minuto
    USER_RANK: 30 * 1000      // 30 segundos
  },
  
  // Períodos temporales
  TIME_PERIODS: {
    DAILY: 24 * 60 * 60 * 1000,
    WEEKLY: 7 * 24 * 60 * 60 * 1000,
    MONTHLY: 30 * 24 * 60 * 60 * 1000
  },
  
  // Premios por posición
  REWARDS: {
    TOP_1: { rbgp: 1000, wld: 0.5 },
    TOP_3: { rbgp: 500, wld: 0.2 },
    TOP_10: { rbgp: 200, wld: 0.1 },
    TOP_100: { rbgp: 50, wld: 0.01 }
  }
};

// Cache de leaderboards
const leaderboardCache = new Map();

// === UTILIDADES ===
function getCacheKey(type, period = null, userId = null) {
  let key = `leaderboard_${type}`;
  if (period) key += `_${period}`;
  if (userId) key += `_user_${userId}`;
  return key;
}

function isCacheValid(cacheData, maxAge) {
  return cacheData && (Date.now() - cacheData.timestamp) < maxAge;
}

function calculateRankChange(currentRank, previousRank) {
  if (!previousRank) return { change: 0, trend: 'new' };
  
  const change = previousRank - currentRank;
  let trend = 'stable';
  
  if (change > 0) trend = 'up';
  else if (change < 0) trend = 'down';
  
  return { change: Math.abs(change), trend };
}

function getTimeRange(period) {
  const now = new Date();
  let startTime;
  
  switch (period) {
    case 'daily':
      startTime = new Date(now);
      startTime.setHours(0, 0, 0, 0);
      break;
    case 'weekly':
      startTime = new Date(now);
      startTime.setDate(now.getDate() - 7);
      break;
    case 'monthly':
      startTime = new Date(now);
      startTime.setMonth(now.getMonth() - 1);
      break;
    default:
      startTime = new Date(0); // All time
  }
  
  return { startTime, endTime: now };
}

// === ENDPOINTS ===

/**
 * GET /api/game/leaderboard/:type
 * Obtiene ranking por tipo
 */
export async function getLeaderboard(req, res) {
  try {
    const { type } = req.params;
    const { 
      period = 'all',
      limit = 50,
      offset = 0,
      around_user = null 
    } = req.query;
    
    // Validar tipo de ranking
    if (!Object.values(LEADERBOARD_CONFIG.RANKING_TYPES).includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ranking type'
      });
    }
    
    // Validar límites
    const limitNum = Math.min(parseInt(limit), LEADERBOARD_CONFIG.MAX_RESULTS.TOP);
    const offsetNum = Math.max(0, parseInt(offset));
    
    // Verificar cache
    const cacheKey = getCacheKey(type, period);
    const cached = leaderboardCache.get(cacheKey);
    const cacheMaxAge = LEADERBOARD_CONFIG.CACHE_DURATION.GLOBAL;
    
    if (isCacheValid(cached, cacheMaxAge)) {
      const startIndex = offsetNum;
      const endIndex = startIndex + limitNum;
      
      return res.json({
        success: true,
        rankings: cached.data.slice(startIndex, endIndex),
        total: cached.data.length,
        type,
        period,
        cached_at: new Date(cached.timestamp).toISOString(),
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          has_more: endIndex < cached.data.length
        }
      });
    }
    
    // Obtener datos frescos
    const { startTime, endTime } = getTimeRange(period);
    const rankings = await fetchLeaderboardData(type, startTime, endTime);
    
    // Guardar en cache
    leaderboardCache.set(cacheKey, {
      data: rankings,
      timestamp: Date.now()
    });
    
    // Responder con subset solicitado
    const startIndex = offsetNum;
    const endIndex = startIndex + limitNum;
    
    res.json({
      success: true,
      rankings: rankings.slice(startIndex, endIndex),
      total: rankings.length,
      type,
      period,
      updated_at: new Date().toISOString(),
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        has_more: endIndex < rankings.length
      }
    });
    
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard'
    });
  }
}

/**
 * GET /api/game/leaderboard/:type/user/:userId
 * Obtiene ranking específico de un usuario
 */
export async function getUserRanking(req, res) {
  try {
    const { type, userId } = req.params;
    const { period = 'all' } = req.query;
    
    // Validar tipo de ranking
    if (!Object.values(LEADERBOARD_CONFIG.RANKING_TYPES).includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ranking type'
      });
    }
    
    // Verificar cache de usuario
    const cacheKey = getCacheKey(type, period, userId);
    const cached = leaderboardCache.get(cacheKey);
    const cacheMaxAge = LEADERBOARD_CONFIG.CACHE_DURATION.USER_RANK;
    
    if (isCacheValid(cached, cacheMaxAge)) {
      return res.json({
        success: true,
        user_ranking: cached.data,
        cached_at: new Date(cached.timestamp).toISOString()
      });
    }
    
    // Obtener ranking del usuario
    const { startTime, endTime } = getTimeRange(period);
    const userRanking = await fetchUserRanking(userId, type, startTime, endTime);
    
    if (!userRanking) {
      return res.json({
        success: true,
        user_ranking: null,
        message: 'User not found in rankings'
      });
    }
    
    // Guardar en cache
    leaderboardCache.set(cacheKey, {
      data: userRanking,
      timestamp: Date.now()
    });
    
    res.json({
      success: true,
      user_ranking: userRanking,
      updated_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('User ranking fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user ranking'
    });
  }
}

/**
 * GET /api/game/leaderboard/:type/around/:userId
 * Obtiene ranking alrededor de un usuario específico
 */
export async function getLeaderboardAroundUser(req, res) {
  try {
    const { type, userId } = req.params;
    const { 
      period = 'all',
      range = 10 
    } = req.query;
    
    // Validar parámetros
    if (!Object.values(LEADERBOARD_CONFIG.RANKING_TYPES).includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ranking type'
      });
    }
    
    const rangeNum = Math.min(parseInt(range), LEADERBOARD_CONFIG.MAX_RESULTS.AROUND_USER);
    
    // Obtener ranking del usuario primero
    const { startTime, endTime } = getTimeRange(period);
    const userRanking = await fetchUserRanking(userId, type, startTime, endTime);
    
    if (!userRanking) {
      return res.json({
        success: true,
        rankings: [],
        user_ranking: null,
        message: 'User not found in rankings'
      });
    }
    
    // Obtener usuarios alrededor
    const surroundingRankings = await fetchRankingsAroundPosition(
      type, 
      userRanking.rank, 
      rangeNum, 
      startTime, 
      endTime
    );
    
    res.json({
      success: true,
      rankings: surroundingRankings,
      user_ranking: userRanking,
      center_rank: userRanking.rank,
      range: rangeNum,
      type,
      period,
      updated_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Around user leaderboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rankings around user'
    });
  }
}

/**
 * POST /api/game/leaderboard/update-score
 * Actualiza puntuación de usuario (requiere auth)
 */
export async function updateUserScore(req, res) {
  try {
    // Middleware de auth ya validó el token
    const userId = req.user.address;
    const { 
      score_type,
      score_value,
      game_session_id,
      metadata = {}
    } = req.body;
    
    // Validar datos
    if (!score_type || score_value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing score_type or score_value'
      });
    }
    
    // Validar que sea un tipo de score válido
    const validScoreTypes = [
      'rbgp_earned',
      'highest_combo', 
      'rainbow_completions',
      'total_taps',
      'session_duration'
    ];
    
    if (!validScoreTypes.includes(score_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid score_type'
      });
    }
    
    // Actualizar puntuación en base de datos
    const updateResult = await updateUserGameScore(
      userId,
      score_type,
      score_value,
      game_session_id,
      metadata
    );
    
    if (!updateResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update score'
      });
    }
    
    // Invalidar caches relevantes
    invalidateUserCaches(userId);
    
    // Verificar si logró nuevo ranking
    const newRanking = await checkNewRankingAchievement(userId, score_type, score_value);
    
    res.json({
      success: true,
      message: 'Score updated successfully',
      new_score: score_value,
      score_type,
      ranking_update: newRanking,
      updated_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Score update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update score'
    });
  }
}

/**
 * GET /api/game/leaderboard/my-rankings
 * Obtiene todos los rankings del usuario autenticado
 */
export async function getMyRankings(req, res) {
  try {
    const userId = req.user.address;
    const { period = 'all' } = req.query;
    
    // Obtener rankings en todos los tipos
    const { startTime, endTime } = getTimeRange(period);
    const allRankings = {};
    
    for (const [key, type] of Object.entries(LEADERBOARD_CONFIG.RANKING_TYPES)) {
      const ranking = await fetchUserRanking(userId, type, startTime, endTime);
      allRankings[key] = ranking;
    }
    
    // Calcular resumen
    const summary = {
      best_rank: Math.min(...Object.values(allRankings).filter(r => r).map(r => r.rank)),
      total_rankings: Object.values(allRankings).filter(r => r).length,
      improvements_needed: Object.values(allRankings).filter(r => !r).length
    };
    
    res.json({
      success: true,
      my_rankings: allRankings,
      summary,
      period,
      user_id: userId,
      updated_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('My rankings fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user rankings'
    });
  }
}

// === FUNCIONES DE BASE DE DATOS ===

async function fetchLeaderboardData(type, startTime, endTime) {
  try {
    // Implementar según tu esquema de base de datos
    // Ejemplo de query para diferentes tipos:
    
    let baseQuery, orderBy, scoreField;
    
    switch (type) {
      case LEADERBOARD_CONFIG.RANKING_TYPES.GLOBAL_RBGP:
        scoreField = 'rbgp_balance';
        orderBy = 'rbgp_balance DESC';
        break;
        
      case LEADERBOARD_CONFIG.RANKING_TYPES.HIGHEST_COMBO:
        scoreField = 'highest_combo';
        orderBy = 'highest_combo DESC';
        break;
        
      case LEADERBOARD_CONFIG.RANKING_TYPES.RAINBOW_COMPLETIONS:
        scoreField = 'rainbow_completions';
        orderBy = 'rainbow_completions DESC';
        break;
        
      case LEADERBOARD_CONFIG.RANKING_TYPES.TOTAL_TAPS:
        scoreField = 'total_taps';
        orderBy = 'total_taps DESC';
        break;
        
      case LEADERBOARD_CONFIG.RANKING_TYPES.PLAYTIME:
        scoreField = 'total_playtime';
        orderBy = 'total_playtime DESC';
        break;
        
      default:
        throw new Error('Unknown ranking type');
    }
    
    /* Ejemplo de implementación con tu esquema:
    const results = await db.query(`
      SELECT 
        u.id,
        u.username,
        u.nullifier_hash,
        gs.${scoreField} as score,
        gs.updated_at,
        ROW_NUMBER() OVER (ORDER BY gs.${orderBy}) as rank
      FROM users u
      JOIN game_stats gs ON u.id = gs.user_id
      WHERE gs.updated_at >= $1 AND gs.updated_at <= $2
        AND gs.${scoreField} > 0
      ORDER BY ${orderBy}
      LIMIT ${LEADERBOARD_CONFIG.MAX_RESULTS.TOP}
    `, [startTime, endTime]);
    
    return results.rows.map((row, index) => ({
      rank: index + 1,
      user: {
        id: row.id,
        username: row.username || `Player ${row.id.substring(0, 8)}`,
        anonymous_id: row.nullifier_hash ? 
          `${row.nullifier_hash.substring(0, 6)}...${row.nullifier_hash.substring(-4)}` : 
          row.id.substring(0, 8)
      },
      score: parseFloat(row.score),
      last_updated: row.updated_at,
      score_type: type
    }));
    */
    
    // Mock data para desarrollo
    return generateMockLeaderboard(type, 50);
    
  } catch (error) {
    console.error('Database error in fetchLeaderboardData:', error);
    throw error;
  }
}

async function fetchUserRanking(userId, type, startTime, endTime) {
  try {
    /* Implementación real:
    const result = await db.query(`
      WITH ranked_users AS (
        SELECT 
          u.id,
          u.username,
          gs.${getScoreField(type)} as score,
          ROW_NUMBER() OVER (ORDER BY gs.${getOrderBy(type)}) as rank,
          LAG(ROW_NUMBER() OVER (ORDER BY gs.${getOrderBy(type)})) 
            OVER (PARTITION BY u.id ORDER BY gs.updated_at) as previous_rank
        FROM users u
        JOIN game_stats gs ON u.id = gs.user_id
        WHERE gs.updated_at >= $1 AND gs.updated_at <= $2
      )
      SELECT * FROM ranked_users WHERE id = $3
    `, [startTime, endTime, userId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    const rankChange = calculateRankChange(row.rank, row.previous_rank);
    
    return {
      user_id: userId,
      rank: row.rank,
      score: parseFloat(row.score),
      rank_change: rankChange,
      score_type: type,
      updated_at: new Date().toISOString()
    };
    */
    
    // Mock para desarrollo
    return {
      user_id: userId,
      rank: Math.floor(Math.random() * 100) + 1,
      score: Math.random() * 10000,
      rank_change: { change: Math.floor(Math.random() * 10), trend: 'up' },
      score_type: type,
      updated_at: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Database error in fetchUserRanking:', error);
    throw error;
  }
}

async function fetchRankingsAroundPosition(type, centerRank, range, startTime, endTime) {
  try {
    const startRank = Math.max(1, centerRank - range);
    const endRank = centerRank + range;
    
    /* Implementación real:
    const results = await db.query(`
      WITH ranked_users AS (
        SELECT 
          u.id,
          u.username,
          gs.${getScoreField(type)} as score,
          ROW_NUMBER() OVER (ORDER BY gs.${getOrderBy(type)}) as rank
        FROM users u
        JOIN game_stats gs ON u.id = gs.user_id
        WHERE gs.updated_at >= $1 AND gs.updated_at <= $2
      )
      SELECT * FROM ranked_users 
      WHERE rank >= $3 AND rank <= $4
      ORDER BY rank
    `, [startTime, endTime, startRank, endRank]);
    */
    
    // Mock para desarrollo
    return generateMockLeaderboard(type, range * 2, startRank);
    
  } catch (error) {
    console.error('Database error in fetchRankingsAroundPosition:', error);
    throw error;
  }
}

async function updateUserGameScore(userId, scoreType, scoreValue, sessionId, metadata) {
  try {
    /* Implementación real:
    await db.query(`
      INSERT INTO game_stats (user_id, ${getScoreField(scoreType)}, session_id, metadata, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET 
        ${getScoreField(scoreType)} = GREATEST(game_stats.${getScoreField(scoreType)}, $2),
        updated_at = NOW(),
        metadata = $4
    `, [userId, scoreValue, sessionId, JSON.stringify(metadata)]);
    */
    
    console.log(`Updated ${scoreType} to ${scoreValue} for user ${userId}`);
    return { success: true };
    
  } catch (error) {
    console.error('Database error in updateUserGameScore:', error);
    return { success: false, error: error.message };
  }
}

async function checkNewRankingAchievement(userId, scoreType, scoreValue) {
  try {
    // Verificar si el usuario alcanzó un nuevo hito
    const currentRanking = await fetchUserRanking(userId, scoreType, new Date(0), new Date());
    
    if (currentRanking && currentRanking.rank <= 100) {
      return {
        achieved: true,
        rank: currentRanking.rank,
        score: scoreValue,
        reward_eligible: currentRanking.rank <= 10
      };
    }
    
    return { achieved: false };
    
  } catch (error) {
    console.error('Error checking ranking achievement:', error);
    return { achieved: false };
  }
}

// === UTILIDADES ===
function invalidateUserCaches(userId) {
  const keysToDelete = [];
  for (const key of leaderboardCache.keys()) {
    if (key.includes(`user_${userId}`)) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(key => leaderboardCache.delete(key));
}

function generateMockLeaderboard(type, count = 10, startRank = 1) {
  const rankings = [];
  
  for (let i = 0; i < count; i++) {
    const rank = startRank + i;
    const baseScore = Math.max(0, 10000 - (rank * 50) + Math.random() * 1000);
    
    rankings.push({
      rank,
      user: {
        id: `user_${rank}`,
        username: `Player ${rank.toString().padStart(3, '0')}`,
        anonymous_id: `${Math.random().toString(36).substring(2, 8)}...`
      },
      score: parseFloat(baseScore.toFixed(3)),
      last_updated: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      score_type: type
    });
  }
  
  return rankings;
}

// === MIDDLEWARE ===
export const leaderboardAuth = requireSiweAuth;

// === RUTAS ===
export const leaderboardRoutes = {
  'GET /': getLeaderboard,
  'GET /:type': getLeaderboard,
  'GET /:type/user/:userId': getUserRanking,
  'GET /:type/around/:userId': getLeaderboardAroundUser,
  'POST /update-score': [requireSiweAuth, updateUserScore],
  'GET /my-rankings': [requireSiweAuth, getMyRankings]
};