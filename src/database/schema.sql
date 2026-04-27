-- VFPE Database Schema for PostgreSQL
-- Country values use ISO 2-letter codes: 'ES', 'DE', 'NL', etc.

-- Table for verified and pending clubs
CREATE TABLE IF NOT EXISTS clubs (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    country TEXT NOT NULL CHECK (LENGTH(country) = 2), -- ISO 2-letter code
    telegram_username TEXT NOT NULL,
    instagram TEXT,
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    is_premium BOOLEAN DEFAULT FALSE,
    click_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP
);

-- Migrations for existing tables
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS tg_user_id BIGINT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS selected_plan TEXT;

-- Drop and recreate the status constraint to include 'accepted'
ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_status_check;
ALTER TABLE clubs ADD CONSTRAINT clubs_status_check CHECK (status IN ('pending', 'accepted', 'verified', 'rejected'));

-- FIX: Index on the most frequent query pattern (city + status lookups)
CREATE INDEX IF NOT EXISTS idx_clubs_city_status ON clubs(city, status);

-- FIX: Index for weekly summary query (verified_at range scan)
CREATE INDEX IF NOT EXISTS idx_clubs_verified_at ON clubs(verified_at) WHERE status = 'verified';

-- Table for group members and moderation
CREATE TABLE IF NOT EXISTS users (
    telegram_id BIGINT PRIMARY KEY,
    username TEXT,
    warnings_count INTEGER DEFAULT 0,
    is_admin BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for moderation rules (keywords, patterns) — read dynamically by moderator bot
CREATE TABLE IF NOT EXISTS moderation_rules (
    id SERIAL PRIMARY KEY,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('keyword', 'regex')),
    pattern TEXT NOT NULL UNIQUE,
    action TEXT DEFAULT 'delete' CHECK (action IN ('delete', 'warn', 'ban'))
);

-- Initial moderation rules based on spec
INSERT INTO moderation_rules (rule_type, pattern)
SELECT 'keyword', pattern FROM (
    VALUES
        ('vendo'), ('sell'), ('selling'),
        ('precio'), ('price'), ('€/g'), ('/g'),
        ('compra'), ('buy'), ('buying'),
        ('delivery'), ('entrega'),
        ('whatsapp'), ('wp:'), ('wa:')
) AS t(pattern)
WHERE NOT EXISTS (SELECT 1 FROM moderation_rules WHERE pattern = t.pattern);
