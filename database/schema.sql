-- RainbowGold-Tap Database Schema
-- Diseñado para WorldApp con World ID + SIWE + WLD payments

-- ===============================================
-- EXTENSIONS Y CONFIGURACIÓN
-- ===============================================

-- UUID extension para IDs únicos
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Crypto extension para verificaciones
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Timezone por defecto
SET timezone = 'UTC';

-- ===============================================
-- TIPOS CUSTOM
-- ===============================================

-- Tipo para estado de verificación
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected', 'expired');

-- Tipo para estado de transacciones
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'cancelled', 'refunded');

-- Tipo para tipos de transacción
CREATE TYPE transaction_type AS ENUM ('refill', 'ideas_ticket', 'withdrawal', 'bonus', 'referral');

-- Tipo para estado de mensajes
CREATE TYPE message_status AS ENUM ('unread', 'read', 'archived', 'deleted');

-- Tipo para tipos de mensaje
CREATE TYPE message_type AS ENUM ('system', 'reward', 'announcement', 'warning', 'promotion');

-- ===============================================
-- TABLA PRINCIPAL DE USUARIOS
-- ===============================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- World ID Data
    world_id_hash VARCHAR(66) UNIQUE NOT NULL, -- World ID nullifier hash
    world_verification_level VARCHAR(20) DEFAULT 'orb', -- orb, phone
    world_verified_at TIMESTAMP WITH TIME ZONE,
    world_verification_status verification_status DEFAULT 'pending',
    
    -- SIWE Data (opcional)
    ethereum_address VARCHAR(42), -- 0x... format
    siwe_verified_at TIMESTAMP WITH TIME ZONE,
    siwe_nonce VARCHAR(64),
    siwe_signature TEXT,
    
    -- Profile Data
    username VARCHAR(50) UNIQUE,
    display_name VARCHAR(100),
    avatar_url TEXT,
    language_code VARCHAR(5) DEFAULT 'es', -- es, en
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Game Preferences
    preferred_theme VARCHAR(20) DEFAULT 'dark',
    sound_enabled BOOLEAN DEFAULT true,
    vibration_enabled BOOLEAN DEFAULT true,
    notifications_enabled BOOLEAN DEFAULT true,
    
    -- Status & Metadata
    status VARCHAR(20) DEFAULT 'active', -- active, suspended, banned, deleted
    is_premium BOOLEAN DEFAULT false,
    premium_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes hints
    CONSTRAINT users_username_length CHECK (LENGTH(username) >= 3),
    CONSTRAINT users_world_id_format CHECK (world_id_hash ~ '^0x[a-fA-F0-9]{64}$'),
    CONSTRAINT users_eth_address_format CHECK (ethereum_address IS NULL OR ethereum_address ~ '^0x[a-fA-F0-9]{40}$')
);

-- Indexes para búsquedas frecuentes
CREATE INDEX idx_users_world_id ON users(world_id_hash);
CREATE INDEX idx_users_ethereum ON users(ethereum_address) WHERE ethereum_address IS NOT NULL;
CREATE INDEX idx_users_username ON users(username) WHERE username IS NOT NULL;
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_activity ON users(last_activity_at DESC);

-- ===============================================
-- ESTADO DEL JUEGO POR USUARIO
-- ===============================================

CREATE TABLE user_game_state (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    
    -- Balances principales
    rbgp_balance DECIMAL(20,6) DEFAULT 0.000000, -- RainbowGold Points (juego)
    wld_balance DECIMAL(20,6) DEFAULT 0.000000,  -- WLD balance (real)
    
    -- Sistema de energía
    energy_current INTEGER DEFAULT 100,
    energy_max INTEGER DEFAULT 100,
    energy_regen_rate DECIMAL(10,4) DEFAULT 0.5, -- por segundo
    last_energy_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Sistema de combos
    combo_level INTEGER DEFAULT 0, -- 0 base, 1-5 = X1-X5
    combo_progress_1 INTEGER DEFAULT 0,
    combo_progress_2 INTEGER DEFAULT 0,
    combo_progress_3 INTEGER DEFAULT 0,
    combo_progress_4 INTEGER DEFAULT 0,
    frenzy_until TIMESTAMP WITH TIME ZONE,
    
    -- Desafío Rainbow
    rainbow_completed_count INTEGER DEFAULT 0,
    rainbow_best_time INTEGER, -- milisegundos
    rainbow_last_attempt TIMESTAMP WITH TIME ZONE,
    
    -- Estadísticas generales
    total_taps BIGINT DEFAULT 0,
    total_rbgp_earned DECIMAL(20,6) DEFAULT 0,
    total_wld_spent DECIMAL(20,6) DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    total_playtime_seconds BIGINT DEFAULT 0,
    
    -- Racha y logros
    daily_streak INTEGER DEFAULT 0,
    max_daily_streak INTEGER DEFAULT 0,
    last_daily_claim DATE,
    achievements_unlocked JSONB DEFAULT '[]'::jsonb,
    
    -- Power-ups y boosters
    active_boosters JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT positive_balances CHECK (rbgp_balance >= 0 AND wld_balance >= 0),
    CONSTRAINT valid_energy CHECK (energy_current >= 0 AND energy_current <= energy_max),
    CONSTRAINT valid_combo CHECK (combo_level >= 0 AND combo_level <= 5)
);

-- Index para actualizaciones frecuentes
CREATE INDEX idx_game_state_updated ON user_game_state(updated_at DESC);
CREATE INDEX idx_game_state_energy ON user_game_state(last_energy_update) WHERE energy_current < energy_max;

-- ===============================================
-- TRANSACCIONES WLD
-- ===============================================

CREATE TABLE wld_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Datos de la transacción
    transaction_type transaction_type NOT NULL,
    amount DECIMAL(20,6) NOT NULL,
    currency VARCHAR(10) DEFAULT 'WLD',
    
    -- Status y resultado
    status transaction_status DEFAULT 'pending',
    blockchain_hash VARCHAR(66), -- Transaction hash en blockchain
    block_number BIGINT,
    confirmation_count INTEGER DEFAULT 0,
    
    -- Datos del payment intent
    payment_intent_id VARCHAR(255),
    payment_provider VARCHAR(50), -- worldcoin, metamask, etc
    
    -- Metadatos del juego
    game_action VARCHAR(50), -- refill, ideas_ticket, etc
    game_metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Direcciones
    from_address VARCHAR(42),
    to_address VARCHAR(42),
    
    -- Fees y gas
    gas_used BIGINT,
    gas_price DECIMAL(20,0),
    transaction_fee DECIMAL(20,6),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT positive_amount CHECK (amount > 0),
    CONSTRAINT valid_addresses CHECK (
        from_address IS NULL OR from_address ~ '^0x[a-fA-F0-9]{40}$'
    )
);

-- Indexes para consultas de transacciones
CREATE INDEX idx_wld_tx_user ON wld_transactions(user_id, created_at DESC);
CREATE INDEX idx_wld_tx_status ON wld_transactions(status, created_at DESC);
CREATE INDEX idx_wld_tx_hash ON wld_transactions(blockchain_hash) WHERE blockchain_hash IS NOT NULL;
CREATE INDEX idx_wld_tx_pending ON wld_transactions(created_at) WHERE status = 'pending';

-- ===============================================
-- SISTEMA DE IDEAS/VOTACIONES
-- ===============================================

CREATE TABLE ideas_polls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Datos de la encuesta
    title VARCHAR(200) NOT NULL,
    description TEXT,
    options JSONB NOT NULL, -- ["A", "B", "C"] etc
    
    -- Control temporal
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    
    -- Metadatos
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    category VARCHAR(50) DEFAULT 'general',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE ideas_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    poll_id UUID NOT NULL REFERENCES ideas_polls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Voto
    selected_option VARCHAR(10) NOT NULL, -- A, B, C, etc
    
    -- Metadatos
    user_agent TEXT,
    ip_address INET,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Un voto por usuario por poll
    UNIQUE(poll_id, user_id)
);

CREATE TABLE ideas_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Contenido de la sugerencia
    title VARCHAR(200),
    content TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'gameplay',
    
    -- Moderación y estado
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, implemented
    admin_notes TEXT,
    moderated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    moderated_at TIMESTAMP WITH TIME ZONE,
    
    -- Engagement
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT content_length CHECK (LENGTH(content) >= 10 AND LENGTH(content) <= 2000)
);

-- Indexes para ideas
CREATE INDEX idx_ideas_polls_active ON ideas_polls(is_active, end_date DESC);
CREATE INDEX idx_ideas_votes_poll ON ideas_votes(poll_id, created_at);
CREATE INDEX idx_ideas_suggestions_user ON ideas_suggestions(user_id, created_at DESC);
CREATE INDEX idx_ideas_suggestions_status ON ideas_suggestions(status, created_at DESC);

-- ===============================================
-- SISTEMA DE MENSAJES/INBOX
-- ===============================================

CREATE TABLE user_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Contenido del mensaje
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    message_type message_type DEFAULT 'system',
    
    -- Estado del mensaje
    status message_status DEFAULT 'unread',
    priority INTEGER DEFAULT 0, -- 0=normal, 1=high, -1=low
    
    -- Metadatos
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    sender_name VARCHAR(100),
    
    -- Datos adicionales (rewards, etc)
    action_data JSONB,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_priority CHECK (priority BETWEEN -1 AND 1)
);

-- Indexes para mensajes
CREATE INDEX idx_messages_user_status ON user_messages(user_id, status, created_at DESC);
CREATE INDEX idx_messages_unread ON user_messages(user_id, created_at DESC) WHERE status = 'unread';
CREATE INDEX idx_messages_expires ON user_messages(expires_at) WHERE expires_at IS NOT NULL;

-- ===============================================
-- LEADERBOARDS Y RANKINGS
-- ===============================================

CREATE TABLE leaderboards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Tipo de leaderboard
    leaderboard_type VARCHAR(50) NOT NULL, -- daily, weekly, monthly, alltime
    category VARCHAR(50) NOT NULL, -- rbgp, taps, streak, etc
    
    -- Puntuación y posición
    score DECIMAL(20,6) NOT NULL,
    rank INTEGER,
    
    -- Período temporal
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Metadatos adicionales
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Un registro por usuario por período/categoría
    UNIQUE(user_id, leaderboard_type, category, period_start)
);

-- Indexes para leaderboards
CREATE INDEX idx_leaderboards_ranking ON leaderboards(leaderboard_type, category, period_start, rank);
CREATE INDEX idx_leaderboards_user ON leaderboards(user_id, leaderboard_type, period_start DESC);
CREATE INDEX idx_leaderboards_period ON leaderboards(period_start DESC, period_end DESC);

-- ===============================================
-- SESIONES Y ANALÍTICAS
-- ===============================================

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Datos de la sesión
    session_token VARCHAR(255) UNIQUE NOT NULL,
    device_type VARCHAR(50), -- world-app, mobile, desktop
    device_info JSONB,
    user_agent TEXT,
    ip_address INET,
    
    -- Ubicación (opcional)
    country_code VARCHAR(2),
    city VARCHAR(100),
    timezone VARCHAR(50),
    
    -- Duración y actividad
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    
    -- Estadísticas de la sesión
    taps_in_session INTEGER DEFAULT 0,
    rbgp_earned_in_session DECIMAL(20,6) DEFAULT 0,
    
    -- Estado
    is_active BOOLEAN DEFAULT true,
    
    CONSTRAINT positive_duration CHECK (duration_seconds IS NULL OR duration_seconds >= 0)
);

-- Indexes para sesiones
CREATE INDEX idx_sessions_user ON user_sessions(user_id, started_at DESC);
CREATE INDEX idx_sessions_active ON user_sessions(last_activity_at DESC) WHERE is_active = true;
CREATE INDEX idx_sessions_token ON user_sessions(session_token);

-- ===============================================
-- EVENTOS Y LOGS DEL JUEGO
-- ===============================================

CREATE TABLE game_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES user_sessions(id) ON DELETE SET NULL,
    
    -- Tipo y datos del evento
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL,
    
    -- Contexto
    game_version VARCHAR(20),
    platform VARCHAR(50),
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Partición por fecha (opcional para performance)
    event_date DATE GENERATED ALWAYS AS (created_at::DATE) STORED
);

-- Indexes para eventos (considera partitioning en producción)
CREATE INDEX idx_game_events_user ON game_events(user_id, created_at DESC);
CREATE INDEX idx_game_events_type ON game_events(event_type, created_at DESC);
CREATE INDEX idx_game_events_date ON game_events(event_date DESC);

-- ===============================================
-- CONFIGURACIÓN DEL SISTEMA
-- ===============================================

CREATE TABLE system_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'general',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Configuración inicial del juego
INSERT INTO system_config (key, value, description, category) VALUES
('game.energy.base_cap', '100', 'Base energy capacity', 'game'),
('game.energy.regen_rate', '0.5', 'Energy regeneration per second', 'game'),
('game.power.base_tap', '0.1000', 'Base RBGp per tap', 'game'),
('payments.refill_cost', '0.1', 'WLD cost for energy refill', 'payments'),
('payments.ideas_ticket_cost', '1.0', 'WLD cost for ideas ticket', 'payments'),
('leaderboards.update_interval', '300', 'Seconds between leaderboard updates', 'system'),
('maintenance.enabled', 'false', 'Maintenance mode flag', 'system');

-- ===============================================
-- FUNCIONES Y TRIGGERS
-- ===============================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_game_state_updated_at BEFORE UPDATE ON user_game_state FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_wld_tx_updated_at BEFORE UPDATE ON wld_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ideas_polls_updated_at BEFORE UPDATE ON ideas_polls FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ideas_suggestions_updated_at BEFORE UPDATE ON ideas_suggestions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leaderboards_updated_at BEFORE UPDATE ON leaderboards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para regenerar energía automáticamente
CREATE OR REPLACE FUNCTION regenerate_user_energy(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    current_state RECORD;
    time_diff_seconds NUMERIC;
    energy_to_add NUMERIC;
    new_energy INTEGER;
BEGIN
    -- Obtener estado actual
    SELECT energy_current, energy_max, energy_regen_rate, last_energy_update
    INTO current_state
    FROM user_game_state 
    WHERE user_id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    
    -- Si ya está al máximo, no hacer nada
    IF current_state.energy_current >= current_state.energy_max THEN
        RETURN current_state.energy_current;
    END IF;
    
    -- Calcular tiempo transcurrido
    time_diff_seconds := EXTRACT(EPOCH FROM (NOW() - current_state.last_energy_update));
    
    -- Calcular energía a agregar
    energy_to_add := time_diff_seconds * current_state.energy_regen_rate;
    new_energy := LEAST(
        current_state.energy_max, 
        current_state.energy_current + FLOOR(energy_to_add)::INTEGER
    );
    
    -- Actualizar solo si hay cambio
    IF new_energy != current_state.energy_current THEN
        UPDATE user_game_state 
        SET energy_current = new_energy,
            last_energy_update = NOW()
        WHERE user_id = p_user_id;
    END IF;
    
    RETURN new_energy;
END;
$$ LANGUAGE plpgsql;

-- Función para calcular rankings de leaderboard
CREATE OR REPLACE FUNCTION update_leaderboard_rankings(
    p_leaderboard_type VARCHAR(50),
    p_category VARCHAR(50),
    p_period_start DATE
)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER := 0;
BEGIN
    -- Actualizar rankings basado en score descendente
    WITH ranked_scores AS (
        SELECT 
            user_id,
            ROW_NUMBER() OVER (ORDER BY score DESC, updated_at ASC) as new_rank
        FROM leaderboards 
        WHERE leaderboard_type = p_leaderboard_type 
          AND category = p_category 
          AND period_start = p_period_start
    )
    UPDATE leaderboards 
    SET rank = ranked_scores.new_rank,
        updated_at = NOW()
    FROM ranked_scores
    WHERE leaderboards.user_id = ranked_scores.user_id
      AND leaderboards.leaderboard_type = p_leaderboard_type
      AND leaderboards.category = p_category
      AND leaderboards.period_start = p_period_start;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- VISTAS ÚTILES
-- ===============================================

-- Vista de usuarios con estado de juego
CREATE VIEW users_with_game_state AS
SELECT 
    u.id,
    u.username,
    u.display_name,
    u.world_verification_status,
    u.language_code,
    u.status,
    u.last_activity_at,
    gs.rbgp_balance,
    gs.wld_balance,
    gs.energy_current,
    gs.combo_level,
    gs.total_taps,
    gs.daily_streak,
    gs.updated_at as game_state_updated
FROM users u
LEFT JOIN user_game_state gs ON u.id = gs.user_id;

-- Vista de top players
CREATE VIEW top_players_alltime AS
SELECT 
    u.username,
    u.display_name,
    gs.rbgp_balance,
    gs.total_taps,
    gs.total_rbgp_earned,
    gs.rainbow_completed_count,
    gs.max_daily_streak,
    ROW_NUMBER() OVER (ORDER BY gs.rbgp_balance DESC) as rank
FROM users u
JOIN user_game_state gs ON u.id = gs.user_id
WHERE u.status = 'active'
ORDER BY gs.rbgp_balance DESC
LIMIT 100;

-- Vista de transacciones recientes
CREATE VIEW recent_wld_transactions AS
SELECT 
    t.id,
    u.username,
    t.transaction_type,
    t.amount,
    t.status,
    t.game_action,
    t.created_at,
    t.completed_at
FROM wld_transactions t
JOIN users u ON t.user_id = u.id
ORDER BY t.created_at DESC;

-- ===============================================
-- ÍNDICES DE PERFORMANCE ADICIONALES
-- ===============================================

-- Índices compuestos para consultas comunes
CREATE INDEX idx_users_active_by_activity ON users(last_activity_at DESC) WHERE status = 'active';
CREATE INDEX idx_game_state_top_players ON user_game_state(rbgp_balance DESC, total_taps DESC);
CREATE INDEX idx_wld_tx_user_recent ON wld_transactions(user_id, created_at DESC) WHERE status IN ('completed', 'pending');

-- Índices parciales para optimizar consultas frecuentes
CREATE INDEX idx_messages_unread_priority ON user_messages(user_id, priority DESC, created_at DESC) 
    WHERE status = 'unread';
    
CREATE INDEX idx_sessions_active_recent ON user_sessions(user_id, last_activity_at DESC) 
    WHERE is_active = true AND last_activity_at > NOW() - INTERVAL '1 hour';

-- ===============================================
-- POLÍTICAS RLS (Row Level Security) - Opcional
-- ===============================================

-- Habilitar RLS en tablas sensibles (descomenta si necesitas)
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_game_state ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE wld_transactions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_messages ENABLE ROW LEVEL SECURITY;

-- Ejemplo de política: usuarios solo pueden ver sus propios datos
-- CREATE POLICY users_own_data ON users FOR ALL USING (id = current_setting('app.current_user_id')::uuid);

-- ===============================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ===============================================

COMMENT ON TABLE users IS 'Tabla principal de usuarios con World ID y datos de perfil';
COMMENT ON TABLE user_game_state IS 'Estado del juego por usuario (balances, energía, combos)';
COMMENT ON TABLE wld_transactions IS 'Transacciones WLD reales en blockchain';
COMMENT ON TABLE ideas_polls IS 'Encuestas del sistema de ideas comunitarias';
COMMENT ON TABLE ideas_votes IS 'Votos de usuarios en encuestas';
COMMENT ON TABLE ideas_suggestions IS 'Sugerencias de usuarios para el juego';
COMMENT ON TABLE user_messages IS 'Sistema de mensajería/inbox';
COMMENT ON TABLE leaderboards IS 'Rankings y leaderboards por categoría y período';
COMMENT ON TABLE user_sessions IS 'Sesiones de usuario para analíticas';
COMMENT ON TABLE game_events IS 'Log de eventos del juego para analíticas';
COMMENT ON TABLE system_config IS 'Configuración del sistema y parámetros del juego';

COMMENT ON COLUMN users.world_id_hash IS 'Nullifier hash de World ID (único por persona)';
COMMENT ON COLUMN user_game_state.rbgp_balance IS 'RainbowGold Points - moneda del juego';
COMMENT ON COLUMN user_game_state.wld_balance IS 'Balance WLD real del usuario';
COMMENT ON COLUMN wld_transactions.blockchain_hash IS 'Hash de la transacción en blockchain';

-- ===============================================
-- DATOS DE PRUEBA (OPCIONAL - SOLO DESARROLLO)
-- ===============================================

-- Descomentar para insertar datos de prueba
/*
-- Usuario de prueba
INSERT INTO users (world_id_hash, username, display_name, world_verification_status) VALUES
('0x1234567890123456789012345678901234567890123456789012345678901234', 'testuser', 'Test User', 'verified');

-- Estado de juego inicial
INSERT INTO user_game_state (user_id, rbgp_balance, energy_current) VALUES
((SELECT id FROM users WHERE username = 'testuser'), 1000.500000, 100);

-- Configuración de ejemplo
INSERT INTO system_config (key, value, description) VALUES
('app.version', '"1.0.0"', 'Current app version'),
('features.ideas_enabled', 'true', 'Enable ideas system'),
('features.leaderboards_enabled', 'true', 'Enable leaderboards');
*/