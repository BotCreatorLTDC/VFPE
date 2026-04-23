-- VFPE Database Schema for PostgreSQL

-- Table for verified and pending clubs
CREATE TABLE IF NOT EXISTS clubs (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    country TEXT NOT NULL,
    telegram_username TEXT NOT NULL,
    instagram TEXT,
    description TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP
);

-- Table for group members and moderation
CREATE TABLE IF NOT EXISTS users (
    telegram_id BIGINT PRIMARY KEY,
    username TEXT,
    warnings_count INTEGER DEFAULT 0,
    is_admin BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for moderation rules (keywords, patterns)
CREATE TABLE IF NOT EXISTS moderation_rules (
    id SERIAL PRIMARY KEY,
    rule_type TEXT NOT NULL, -- 'keyword', 'regex'
    pattern TEXT NOT NULL,
    action TEXT DEFAULT 'delete' -- 'delete', 'warn', 'ban'
);

-- Initial moderation rules based on spec
INSERT INTO moderation_rules (rule_type, pattern) 
SELECT 'keyword', pattern FROM (
    VALUES ('vendo'), ('sell'), ('selling'), ('precio'), ('price'), ('€/g'), ('compra'), ('buy'), ('buying'), ('delivery'), ('entrega')
) AS t(pattern)
WHERE NOT EXISTS (SELECT 1 FROM moderation_rules WHERE pattern = t.pattern);
