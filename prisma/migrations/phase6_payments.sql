-- ============================================================================
-- BANDHAN VATIKA — PHASE 6: PAYMENT MANAGEMENT MIGRATION
-- Enhances payments table with payment_type (ADVANCE, PARTIAL, FINAL),
-- reversed_at, reversed_by, updated_at, and lookup indexes.
-- ============================================================================

DO $$
BEGIN
  -- Add payment_type
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'payment_type') THEN
    ALTER TABLE payments ADD COLUMN payment_type varchar(50) DEFAULT 'PARTIAL' NOT NULL;
  END IF;

  -- Add reversed_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'reversed_at') THEN
    ALTER TABLE payments ADD COLUMN reversed_at timestamp;
  END IF;

  -- Add reversed_by
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'reversed_by') THEN
    ALTER TABLE payments ADD COLUMN reversed_by varchar(255);
  END IF;

  -- Add updated_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'updated_at') THEN
    ALTER TABLE payments ADD COLUMN updated_at timestamp DEFAULT now() NOT NULL;
  END IF;
END $$;

-- Query Performance Indexes
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_receipt_number ON payments(receipt_number);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_is_reversed ON payments(is_reversed);
