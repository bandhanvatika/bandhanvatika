-- ============================================================================
-- BANDHAN VATIKA — PHASE 2: MASTER DATA MIGRATION
-- Adds is_active to customers for soft-delete/deactivation
-- Adds unique constraint on customers(mobile) for database-level duplicate protection
-- Adds query pattern indexes for Customers, Halls, and Rooms
-- ============================================================================

ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_mobile_unique') THEN
    ALTER TABLE customers ADD CONSTRAINT customers_mobile_unique UNIQUE (mobile);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile);
CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers(is_active);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_halls_status ON halls(status);
CREATE INDEX IF NOT EXISTS idx_halls_type ON halls(type);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_type ON rooms(room_type);
