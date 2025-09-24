/**
 * api/game/stats.js - Sistema de Estadísticas y Analytics del Juego
 * Maneja métricas detalladas, progreso y análisis de gameplay
 */

import { requireSiweAuth } from '../auth/siwe.js';

// === CONFIGURACIÓN STATS ===
const STATS_CONFIG = {
  // Métricas principales
  CORE_METRICS: [
    'total_taps',
    'rbgp_earned',
    'highest_combo',
    'rainbow_completions',
    'total_playtime',
    'sessions_played',
    'energy_consumed',
    'wld_spent'
  ],
  
  // Métricas por sesión
  SESSION_METRICS: [
    'session_duration',
    'taps_per_session',
    'rbgp_per_session',
    'highest_combo_session',
    'rainbow_attempts',
    'rainbow_successes'
  ],
  
  // Períodos de agregación
  TIME_PERIODS: {
    HOURLY: 'hourly',
    DAILY: 'daily', 
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
    ALL_TIME: 'all_time'
  },
  
  // Categorías de logros
  ACHIEVEMENT_CATEGORIES: {
    TAPPING: 'tapping',
    COMBOS: 'combos',
    RAINBOW: 'rainbow_challenge',
    PERSISTENCE: 'persistence',
    SPENDING: 'spending',
    SOCIAL: 'social'
  },
  
  // Límites de consulta
  MAX_QUERY_DAYS: 90,
  MAX_SESSION_HISTORY: 100,
  CACHE_DURATION: 2 * 60 * 1000, // 2 minutos
  
  // Umbrales para logros
  ACHIEVEMENT_THRESHOLDS: {
    COMBO_MASTER: [5, 10, 25, 50, 100],      // Combos consecutivos
    TAP_CHAMPION: [1000, 10000, 50000, 100000, 500000], // Total taps
    RAINBOW_LEGEND: [1, 5, 25, 50, 100],     // Rainbow completions
    PERSISTENT_PLAYER: [7, 30, 90, 365],     // Días jugando
    BIG_SPENDER: [1, 10, 50, 100, 500]       // WLD gastado
  }
};

// Cache de estadísticas
const statsCache = new Map();

// === UTILIDADES ===
function getCacheKey(userId, type, period = null) {
  let key = `stats_${userId}_${type}`;
  if (period) key += `_${period}`;
  return key;
}

function isCacheValid(cacheData) {
  return cacheData && (Date.now() - cacheData.timestamp) < STATS_CONFIG.CACHE_DURATION;
}

function calculateGrowthRate(current, previous) {
  if (!previous || previous === 0) return { rate: 0, trend: 'new' };
  
  const rate = ((current - previous) / previous) * 100;
  const trend = rate > 0 ? 'up' : rate < 0 ? 'down' : 'stable';
  
  return { rate: parseFloat(rate.toFixed(2)), trend };
}

function getTimeRange(period) {
  const now = new Date();
  let startTime, groupBy;
  
  switch (period) {
    case STATS_CONFIG.TIME_PERIODS.HOURLY:
      startTime = new Date(now - 24 * 60 * 60 * 1000); // Último día
      groupBy = 'HOUR';
      break;
    case STATS_CONFIG.TIME_PERIODS.DAILY:
      startTime = new Date(now - 30 * 24 * 60 * 60 * 1000); // Último mes
      groupBy = 'DAY';
      break;
    case STATS_CONFIG.TIME_PERIODS.WEEKLY:
      startTime = new Date(now - 12 * 7 * 24 * 60 * 60 * 1000); // 12 semanas
      groupBy = 'WEEK';
      break;
    case STATS_CONFIG.TIME_PERIODS.MONTHLY:
      startTime = new Date(now - 12 * 30 * 24 * 60 * 60 * 1000); // 12 meses
      groupBy = 'MONTH';
      break;
    default:
      startTime = new Date(0);
      groupBy = 'ALL';
  }
  
  return { startTime, endTime: now, groupBy };
}

// === ENDPOINTS ===

/**
 * GET /api/game/stats/overview
 * Obtiene resumen general de estadísticas del usuario
 */
export async function getStatsOverview(req, res) {
  try {
    const userId = req.user.address;
    const { period = STATS_CONFIG.TIME_PERIODS.ALL_TIME } = req.query;
    
    // Verificar cache
    const cacheKey = getCacheKey(userId, 'overview', period);
    const cached = statsCache.get(cacheKey);
    
    if (isCacheValid(cached)) {
      return res.json({
        success: true,
        stats: cached.data,
        cached_at: new Date(cached.timestamp).toISOString()
      });
    }
    
    // Obtener estadísticas principales
    const { startTime, endTime } = getTimeRange(period);
    const coreStats = await fetchCoreStats(userId, startTime, endTime);
    
    // Calcular métricas derivadas
    const derivedMetrics = calculateDerivedMetrics(coreStats);
    
    // Obtener comparación con período anterior
    const comparison = await getComparisonStats(userId, period);
    
    // Obtener logros recientes
    const recentAchievements = await getRecentAchievements(userId, 5);
    
    const overview = {
      core_stats: coreStats,
      derived_metrics: derivedMetrics,
      comparison,
      recent_achievements: recentAchievements,
      period,
      updated_at: new Date().toISOString()
    };
    
    // Guardar en cache
    statsCache.set(cacheKey, {
      data: overview,
      timestamp: Date.now()
    });
    
    res.json({
      success: true,
      stats: overview,
      updated_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Stats overview error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats overview'
    });
  }
}

/**
 * GET /api/game/stats/detailed/:metric
 * Obtiene estadísticas detalladas de una métrica específica
 */
export async function getDetailedStats(req, res) {
  try {
    const userId = req.user.address;
    const { metric } = req.params;
    const { 
      period = STATS_CONFIG.TIME_PERIODS.DAILY,
      granularity = 'day',
      limit = 30 
    } = req.query;
    
    // Validar métrica
    const allMetrics = [...STATS_CONFIG.CORE_METRICS, ...STATS_CONFIG.SESSION_METRICS];
    if (!allMetrics.includes(metric)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid metric'
      });
    }
    
    // Obtener datos históricos
    const { startTime, endTime, groupBy } = getTimeRange(period);
    const timeSeriesData = await fetchTimeSeriesStats(
      userId, 
      metric, 
      startTime, 
      endTime, 
      granularity,
      Math.min(parseInt(limit), 365)
    );
    
    // Calcular estadísticas agregadas
    const aggregates = calculateAggregates(timeSeriesData, metric);
    
    res.json({
      success: true,
      metric,
      time_series: timeSeriesData,
      aggregates,
      period,
      granularity,
      updated_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Detailed stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch detailed stats'
    });
  }
}

/**
 * GET /api/game/stats/sessions
 * Obtiene historial de sesiones de juego
 */
export async function getSessionStats(req, res) {
  try {
    const userId = req.user.address;
    const { 
      limit = 20,
      offset = 0,
      date_from = null,
      date_to = null 
    } = req.query;
    
    const limitNum = Math.min(parseInt(limit), STATS_CONFIG.MAX_SESSION_HISTORY);
    const offsetNum = Math.max(0, parseInt(offset));
    
    // Obtener sesiones
    const sessions = await fetchUserSessions(
      userId, 
      limitNum, 
      offsetNum, 
      date_from, 
      date_to
    );
    
    // Calcular estadísticas de sesiones
    const sessionAnalytics = calculateSessionAnalytics(sessions);
    
    res.json({
      success: true,
      sessions,
      analytics: sessionAnalytics,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        has_more: sessions.length === limitNum
      },
      updated_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Session stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch session stats'
    });
  }
}

/**
 * GET /api/game/stats/achievements
 * Obtiene logros y progreso del usuario
 */
export async function getAchievements(req, res) {
  try {
    const userId = req.user.address;
    const { category = null, include_locked = 'true' } = req.query;
    
    // Obtener logros del usuario
    const userAchievements = await fetchUserAchievements(userId, category);
    
    // Obtener todos los logros disponibles si se incluyen los bloqueados
    let allAchievements = [];
    if (include_locked === 'true') {
      allAchievements = await fetchAllAchievements(category);
    }
    
    // Calcular progreso hacia logros no conseguidos
    const progressTowards = await calculateAchievementProgress(userId, allAchievements);
    
    // Organizar por categorías
    const achievementsByCategory = organizeAchievementsByCategory(
      userAchievements, 
      allAchievements, 
      progressTowards
    );
    
    // Calcular estadísticas generales de logros
    const achievementStats = {
      total_unlocked: userAchievements.length,
      total_available: allAchievements.length,
      completion_percentage: allAchievements.length > 0 ? 
        Math.round((userAchievements.length / allAchievements.length) * 100) : 0,
      categories_completed: Object.values(achievementsByCategory)
        .filter(cat => cat.completion_percentage === 100).length
    };
    
    res.json({
      success: true,
      achievements: achievementsByCategory,
      stats: achievementStats,
      updated_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Achievements fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch achievements'
    });
  }
}

/**
 * POST /api/game/stats/record-event
 * Registra evento de juego para estadísticas
 */
export async function recordGameEvent(req, res) {
  try {
    const userId = req.user.address;
    const {
      event_type,
      event_data,
      session_id,
      timestamp = new Date().toISOString()
    } = req.body;
    
    // Validar evento
    const validEventTypes = [
      'tap',
      'combo_achieved',
      'combo_failed', 
      'rainbow_started',
      'rainbow_completed',
      'rainbow_failed',
      'energy_depleted',
      'energy_refilled',
      'session_started',
      'session_ended',
      'payment_made',
      'achievement_unlocked'
    ];
    
    if (!validEventTypes.includes(event_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid event type'
      });
    }
    
    // Registrar evento
    const eventRecord = await saveGameEvent({
      user_id: userId,
      event_type,
      event_data,
      session_id,
      timestamp: new Date(timestamp),
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });
    
    // Actualizar estadísticas incrementales
    await updateIncrementalStats(userId, event_type, event_data);
    
    // Verificar logros desbloqueados
    const newAchievements = await checkAchievementTriggers(userId, event_type, event_data);
    
    // Invalidar caches relevantes
    invalidateStatsCache(userId);
    
    res.json({
      success: true,
      event_id: eventRecord.id,
      new_achievements: newAchievements,
      message: 'Event recorded successfully'
    });
    
  } catch (error) {
    console.error('Event recording error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record event'
    });
  }
}

/**
 * GET /api/game/stats/leaderboard-position
 * Obtiene posición del usuario en diferentes leaderboards
 */
export async function getLeaderboardPositions(req, res) {
  try {
    const userId = req.user.address;
    
    // Obtener posiciones en diferentes métricas
    const positions = {};
    
    for (const metric of STATS_CONFIG.CORE_METRICS) {
      const position = await getUserLeaderboardPosition(userId, metric);
      positions[metric] = position;
    }
    
    // Calcular mejores posiciones y tendencias
    const bestPositions = Object.entries(positions)
      .filter(([_, pos]) => pos && pos.rank)
      .sort((a, b) => a[1].rank - b[1].rank)
      .slice(0, 3);
    
    res.json({
      success: true,
      positions,
      best_positions: bestPositions,
      updated_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Leaderboard positions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard positions'
    });
  }
}

/**
 * GET /api/game/stats/global
 * Obtiene estadísticas globales del juego (públicas)
 */
export async function getGlobalStats(req, res) {
  try {
    // Cache de estadísticas globales (más tiempo)
    const cacheKey = 'global_stats';
    const cached = statsCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < 10 * 60 * 1000) { // 10 min
      return res.json({
        success: true,
        global_stats: cached.data,
        cached_at: new Date(cached.timestamp).toISOString()
      });
    }
    
    // Obtener estadísticas globales agregadas
    const globalStats = await fetchGlobalGameStats();
    
    // Guardar en cache
    statsCache.set(cacheKey, {
      data: globalStats,
      timestamp: Date.now()
    });
    
    res.json({
      success: true,
      global_stats: globalStats,
      updated_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Global stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch global stats'
    });
  }
}

// === FUNCIONES DE BASE DE DATOS ===

async function fetchCoreStats(userId, startTime, endTime) {
  try {
    /* Implementación real con tu esquema:
    const result = await db.query(`
      SELECT 
        COALESCE(SUM(total_taps), 0) as total_taps,
        COALESCE(SUM(rbgp_earned), 0) as rbgp_earned,
        COALESCE(MAX(highest_combo), 0) as highest_combo,
        COALESCE(SUM(rainbow_completions), 0) as rainbow_completions,
        COALESCE(SUM(total_playtime), 0) as total_playtime,
        COALESCE(COUNT(DISTINCT session_id), 0) as sessions_played,
        COALESCE(SUM(energy_consumed), 0) as energy_consumed,
        COALESCE(SUM(wld_spent), 0) as wld_spent
      FROM game_events 
      WHERE user_id = $1 AND timestamp >= $2 AND timestamp <= $3
    `, [userId, startTime, endTime]);
    
    return result.rows[0];
    */
    
    // Mock para desarrollo
    return {
      total_taps: Math.floor(Math.random() * 50000) + 1000,
      rbgp_earned: (Math.random() * 10000 + 500).toFixed(3),
      highest_combo: Math.floor(Math.random() * 20) + 1,
      rainbow_completions: Math.floor(Math.random() * 10),
      total_playtime: Math.floor(Math.random() * 100000) + 10000, // seconds
      sessions_played: Math.floor(Math.random() * 50) + 5,
      energy_consumed: Math.floor(Math.random() * 5000) + 500,
      wld_spent: (Math.random() * 50).toFixed(2)
    };
    
  } catch (error) {
    console.error('Database error in fetchCoreStats:', error);
    throw error;
  }
}

async function fetchTimeSeriesStats(userId, metric, startTime, endTime, granularity, limit) {
  try {
    /* Implementación real:
    let groupByClause;
    switch (granularity) {
      case 'hour':
        groupByClause = "DATE_TRUNC('hour', timestamp)";
        break;
      case 'day':
        groupByClause = "DATE_TRUNC('day', timestamp)";
        break;
      case 'week':
        groupByClause = "DATE_TRUNC('week', timestamp)";
        break;
      case 'month':
        groupByClause = "DATE_TRUNC('month', timestamp)";
        break;
    }
    
    const result = await db.query(`
      SELECT 
        ${groupByClause} as period,
        SUM(${metric}) as value,
        COUNT(*) as event_count
      FROM game_events 
      WHERE user_id = $1 
        AND timestamp >= $2 
        AND timestamp <= $3
        AND ${metric} IS NOT NULL
      GROUP BY ${groupByClause}
      ORDER BY period DESC
      LIMIT $4
    `, [userId, startTime, endTime, limit]);
    
    return result.rows.map(row => ({
      period: row.period,
      value: parseFloat(row.value || 0),
      event_count: parseInt(row.event_count)
    }));
    */
    
    // Mock para desarrollo
    const data = [];
    const now = new Date();
    
    for (let i = 0; i < limit; i++) {
      const date = new Date(now - (i * 24 * 60 * 60 * 1000));
      data.push({
        period: date.toISOString().split('T')[0],
        value: Math.random() * 1000 + Math.random() * i * 10,
        event_count: Math.floor(Math.random() * 100) + 10
      });
    }
    
    return data.reverse();
    
  } catch (error) {
    console.error('Database error in fetchTimeSeriesStats:', error);
    throw error;
  }
}

async function fetchUserSessions(userId, limit, offset, dateFrom, dateTo) {
  try {
    /* Implementación real:
    let dateFilter = '';
    const params = [userId, limit, offset];
    
    if (dateFrom) {
      dateFilter += ' AND started_at >= $4';
      params.push(dateFrom);
    }
    if (dateTo) {
      dateFilter += dateFrom ? ' AND started_at <= $5' : ' AND started_at <= $4';
      params.push(dateTo);
    }
    
    const result = await db.query(`
      SELECT 
        session_id,
        started_at,
        ended_at,
        duration_seconds,
        total_taps,
        rbgp_earned,
        highest_combo,
        rainbow_attempts,
        rainbow_completions,
        energy_consumed,
        metadata
      FROM game_sessions 
      WHERE user_id = $1 ${dateFilter}
      ORDER BY started_at DESC
      LIMIT $2 OFFSET $3
    `, params);
    
    return result.rows;
    */
    
    // Mock para desarrollo
    const sessions = [];
    for (let i = 0; i < limit; i++) {
      const startTime = new Date(Date.now() - (i + offset) * 60 * 60 * 1000);
      const duration = Math.floor(Math.random() * 1800) + 300; // 5-35 min
      
      sessions.push({
        session_id: `session_${Date.now()}_${i}`,
        started_at: startTime.toISOString(),
        ended_at: new Date(startTime.getTime() + duration * 1000).toISOString(),
        duration_seconds: duration,
        total_taps: Math.floor(Math.random() * 500) + 50,
        rbgp_earned: (Math.random() * 100 + 10).toFixed(3),
        highest_combo: Math.floor(Math.random() * 10) + 1,
        rainbow_attempts: Math.floor(Math.random() * 3),
        rainbow_completions: Math.floor(Math.random() * 2),
        energy_consumed: Math.floor(Math.random() * 80) + 20,
        metadata: { platform: 'web', version: '1.0.0' }
      });
    }
    
    return sessions;
    
  } catch (error) {
    console.error('Database error in fetchUserSessions:', error);
    throw error;
  }
}

// === FUNCIONES DE CÁLCULO ===

function calculateDerivedMetrics(coreStats) {
  const {
    total_taps,
    rbgp_earned,
    sessions_played,
    total_playtime,
    energy_consumed,
    highest_combo
  } = coreStats;
  
  return {
    avg_taps_per_session: sessions_played > 0 ? 
      Math.round(total_taps / sessions_played) : 0,
    avg_rbgp_per_tap: total_taps > 0 ? 
      parseFloat((rbgp_earned / total_taps).toFixed(6)) : 0,
    avg_session_duration: sessions_played > 0 ? 
      Math.round(total_playtime / sessions_played) : 0,
    taps_per_minute: total_playtime > 0 ? 
      parseFloat((total_taps / (total_playtime / 60)).toFixed(2)) : 0,
    energy_efficiency: energy_consumed > 0 ? 
      parseFloat((total_taps / energy_consumed).toFixed(2)) : 0,
    combo_score: highest_combo * 100 // Score basado en combo máximo
  };
}

function calculateAggregates(timeSeriesData, metric) {
  if (!timeSeriesData || timeSeriesData.length === 0) {
    return {
      total: 0,
      average: 0,
      max: 0,
      min: 0,
      trend: 'stable'
    };
  }
  
  const values = timeSeriesData.map(d => d.value);
  const total = values.reduce((sum, val) => sum + val, 0);
  const average = total / values.length;
  const max = Math.max(...values);
  const min = Math.min(...values);
  
  // Calcular tendencia simple
  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
  
  let trend = 'stable';
  if (secondAvg > firstAvg * 1.1) trend = 'up';
  else if (secondAvg < firstAvg * 0.9) trend = 'down';
  
  return {
    total: parseFloat(total.toFixed(3)),
    average: parseFloat(average.toFixed(3)),
    max: parseFloat(max.toFixed(3)),
    min: parseFloat(min.toFixed(3)),
    trend,
    data_points: values.length
  };
}

function calculateSessionAnalytics(sessions) {
  if (!sessions || sessions.length === 0) {
    return {
      avg_duration: 0,
      avg_taps: 0,
      avg_rbgp: 0,
      best_session: null,
      total_sessions: 0
    };
  }
  
  const durations = sessions.map(s => s.duration_seconds);
  const taps = sessions.map(s => s.total_taps);
  const rbgp = sessions.map(s => parseFloat(s.rbgp_earned));
  
  // Encontrar mejor sesión (por RBGp ganado)
  const bestSession = sessions.reduce((best, current) => 
    parseFloat(current.rbgp_earned) > parseFloat(best.rbgp_earned || 0) ? current : best
  );
  
  return {
    avg_duration: Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length),
    avg_taps: Math.round(taps.reduce((sum, t) => sum + t, 0) / taps.length),
    avg_rbgp: parseFloat((rbgp.reduce((sum, r) => sum + r, 0) / rbgp.length).toFixed(3)),
    best_session: {
      session_id: bestSession.session_id,
      rbgp_earned: bestSession.rbgp_earned,
      started_at: bestSession.started_at
    },
    total_sessions: sessions.length
  };
}

// === UTILIDADES ===
function invalidateStatsCache(userId) {
  const keysToDelete = [];
  for (const key of statsCache.keys()) {
    if (key.includes(userId) || key === 'global_stats') {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(key => statsCache.delete(key));
}

async function getComparisonStats(userId, period) {
  // Mock - en implementación real calcularías período anterior
  return {
    previous_period: {
      total_taps: Math.floor(Math.random() * 1000),
      rbgp_earned: Math.random() * 100
    },
    growth: {
      total_taps: { rate: Math.random() * 50 - 25, trend: 'up' },
      rbgp_earned: { rate: Math.random() * 30 - 15, trend: 'up' }
    }
  };
}

// Mock functions para desarrollo
async function fetchUserAchievements(userId, category) {
  return [
    {
      id: 'first_tap',
      name: 'First Tap',
      description: 'Complete your first tap',
      category: 'tapping',
      unlocked_at: new Date().toISOString(),
      rarity: 'common'
    }
  ];
}

async function fetchAllAchievements(category) {
  return [
    {
      id: 'first_tap',
      name: 'First Tap',
      description: 'Complete your first tap',
      category: 'tapping',
      requirement: { type: 'total_taps', value: 1 },
      rarity: 'common'
    },
    {
      id: 'combo_master',
      name: 'Combo Master',
      description: 'Achieve a 10x combo',
      category: 'combos',
      requirement: { type: 'highest_combo', value: 10 },
      rarity: 'rare'
    }
  ];
}

async function getRecentAchievements(userId, limit) {
  return [
    {
      id: 'first_tap',
      name: 'First Tap',
      unlocked_at: new Date(Date.now() - 60000).toISOString()
    }
  ];
}

async function saveGameEvent(eventData) {
  console.log('Saving game event:', eventData);
  return { id: 'event_' + Date.now() };
}

async function updateIncrementalStats(userId, eventType, eventData) {
  console.log(`Updating incremental stats for ${userId}: ${eventType}`);
}

async function checkAchievementTriggers(userId, eventType, eventData) {
  console.log(`Checking achievements for ${userId}: ${eventType}`);
  return [];
}

async function getUserLeaderboardPosition(userId, metric) {
  return {
    rank: Math.floor(Math.random() * 1000) + 1,
    score: Math.random() * 10000,
    percentile: Math.floor(Math.random() * 100)
  };
}

async function fetchGlobalGameStats() {
  return {
    total_players: 15743,
    total_taps: 2847392,
    total_rbgp_earned: 184729.456,
    total_rainbow_completions: 3847,
    average_session_duration: 847, // seconds
    top_combo: 47,
    last_updated: new Date().toISOString()
  };
}

function organizeAchievementsByCategory(userAchievements, allAchievements, progress) {
  const categories = {};
  
  for (const category of Object.values(STATS_CONFIG.ACHIEVEMENT_CATEGORIES)) {
    categories[category] = {
      unlocked: userAchievements.filter(a => a.category === category),
      available: allAchievements.filter(a => a.category === category),
      progress: progress.filter(p => p.category === category),
      completion_percentage: 0
    };
    
    if (categories[category].available.length > 0) {
      categories[category].completion_percentage = Math.round(
        (categories[category].unlocked.length / categories[category].available.length) * 100
      );
    }
  }
  
  return categories;
}

async function calculateAchievementProgress(userId, achievements) {
  // Mock - calcularía progreso real hacia logros
  return achievements.map(achievement => ({
    id: achievement.id,
    category: achievement.category,
    progress: Math.random() * 100,
    current_value: Math.floor(Math.random() * achievement.requirement?.value || 100),
    target_value: achievement.requirement?.value || 100
  }));
}

// === RUTAS ===
export const statsRoutes = {
  'GET /overview': [requireSiweAuth, getStatsOverview],
  'GET /detailed/:metric': [requireSiweAuth, getDetailedStats],
  'GET /sessions': [requireSiweAuth, getSessionStats],
  'GET /achievements': [requireSiweAuth, getAchievements],
  'POST /record-event': [requireSiweAuth, recordGameEvent],
  'GET /leaderboard-position': [requireSiweAuth, getLeaderboardPositions],
  'GET /global': getGlobalStats
};