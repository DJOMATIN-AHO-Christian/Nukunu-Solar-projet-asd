-- ════════════════════════════════════════════════════════════
-- NUKUNU SOLAR — INITIALIZATION SCRIPT
-- PostgreSQL 16 Schema and Tables
-- ════════════════════════════════════════════════════════════

-- Base users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    email_verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Installer detailed data
CREATE TABLE IF NOT EXISTS role_installateur (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(255),
    qualipv_id VARCHAR(100),
    managed_sites INTEGER DEFAULT 0
);

-- Fund/Asset Manager detailed data
CREATE TABLE IF NOT EXISTS role_fonds (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    management_company VARCHAR(255),
    managed_volume_mwp NUMERIC(10, 2) DEFAULT 0,
    active_assets INTEGER DEFAULT 0
);

-- Industrial detailed data
CREATE TABLE IF NOT EXISTS role_industriel (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    site_name VARCHAR(255),
    roof_surface_m2 INTEGER DEFAULT 0,
    annual_consumption_kwh INTEGER DEFAULT 0
);

-- Residential detailed data
CREATE TABLE IF NOT EXISTS role_particulier (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    installation_address TEXT,
    peak_power_kwp NUMERIC(6, 2) DEFAULT 0,
    connection_type VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    site_name VARCHAR(255) NOT NULL,
    site_code VARCHAR(50),
    type VARCHAR(100) DEFAULT 'Correctif',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(30) NOT NULL DEFAULT 'normal',
    status VARCHAR(30) NOT NULL DEFAULT 'todo',
    tech VARCHAR(255),
    due_date DATE,
    cost_np NUMERIC(10, 2) DEFAULT 0,
    sla_hours INTEGER DEFAULT 24,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    site_name VARCHAR(255) NOT NULL,
    document_date DATE,
    expiry_date DATE,
    file_name VARCHAR(255),
    file_mime_type VARCHAR(255),
    file_content TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'valid',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prospects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact VARCHAR(255),
    power_kwc NUMERIC(10, 2) DEFAULT 0,
    value_eur NUMERIC(12, 2) DEFAULT 0,
    stage VARCHAR(30) NOT NULL DEFAULT 'lead',
    last_contact DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS billing_entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    site_name VARCHAR(255) NOT NULL,
    contract_name VARCHAR(255),
    period_label VARCHAR(100) DEFAULT 'Mars 2026',
    energy_kwh NUMERIC(12, 2) DEFAULT 0,
    tariff_label VARCHAR(100),
    tariff_rate NUMERIC(10, 4) DEFAULT 0,
    gross_revenue NUMERIC(12, 2) DEFAULT 0,
    notes TEXT,
    payment_status VARCHAR(30) DEFAULT 'paid',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_settings (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, setting_key)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    entity VARCHAR(100),
    entity_id VARCHAR(100),
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT TRUE;

ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS file_mime_type VARCHAR(255),
    ADD COLUMN IF NOT EXISTS file_content TEXT;

ALTER TABLE billing_entries
    ADD COLUMN IF NOT EXISTS notes TEXT;
