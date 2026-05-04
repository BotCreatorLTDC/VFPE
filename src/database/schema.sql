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
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS event_message TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS event_expires_at TIMESTAMP;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS service_tags TEXT[] DEFAULT '{}';
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(3,1) DEFAULT 0;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS reviews_count INTEGER DEFAULT 0;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- Table for user reviews of clubs
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    review_text TEXT,
    reviewer_handle TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reviews_club_id ON reviews(club_id);

-- Table for server-side likes (replaces localStorage)
CREATE TABLE IF NOT EXISTS club_likes (
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    user_fingerprint TEXT NOT NULL, -- tg_user_id or UUID fallback
    PRIMARY KEY (club_id, user_fingerprint)
);

-- Table for user reports
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    details TEXT,
    reporter_handle TEXT,
    status TEXT DEFAULT 'pending', -- pending, resolved, dismissed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reports_club_id ON reports(club_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

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

-- ══════════════════════════════════════════════════
-- CATALOG SERVICE TABLES (HashANDCrafts Catalog Bot)
-- ══════════════════════════════════════════════════

-- Each plug's catalog store configuration
CREATE TABLE IF NOT EXISTS catalog_stores (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,              -- URL-friendly name: 'hashandcrafts'
    name TEXT NOT NULL,                     -- Display name: 'HashAndCrafts'
    tg_owner_id BIGINT NOT NULL,            -- Telegram user ID of the owner
    logo_url TEXT,
    bio TEXT,
    theme_color TEXT DEFAULT '#00d26a',     -- Hex color for UI accent
    min_order_amount NUMERIC(10,2) DEFAULT 0,
    is_pro BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_catalog_stores_slug ON catalog_stores(slug);
CREATE INDEX IF NOT EXISTS idx_catalog_stores_owner ON catalog_stores(tg_owner_id);

-- Products listed in each catalog
CREATE TABLE IF NOT EXISTS catalog_products (
    id SERIAL PRIMARY KEY,
    store_id INTEGER REFERENCES catalog_stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'flower' CHECK (category IN ('flower', 'extract', 'edible', 'accessory', 'other')),
    description TEXT,
    photo_url TEXT,
    price NUMERIC(10,2) DEFAULT 0,
    unit TEXT DEFAULT 'g',
    available BOOLEAN DEFAULT TRUE,
    featured BOOLEAN DEFAULT FALSE,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_catalog_products_store ON catalog_products(store_id);
CREATE INDEX IF NOT EXISTS idx_catalog_products_available ON catalog_products(store_id, available);
