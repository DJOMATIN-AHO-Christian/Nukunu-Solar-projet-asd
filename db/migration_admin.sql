-- Migration : Add Audit Logs and Super Admin Role capability
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

-- Seed a Super Admin if not exists
-- Note: password is 'superadmin123' hashed with bcrypt (cost 10)
-- $2b$10$wI8tmZHZthc9EaTq26960.N7A0H08T7A0H08T7A0H08T7A0H0s. (Mock hash, will use real one in seed script)
