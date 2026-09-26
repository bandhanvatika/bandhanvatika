-- ============================================================================
-- BANDHAN VATIKA — PHASE 5: INVOICE MANAGEMENT MIGRATION
-- Enhances invoices table with quotation relation, GST breakdown (CGST/SGST/IGST),
-- event type, invoice date, terms, and immutable historical snapshot storage.
-- ============================================================================

DO $$
BEGIN
  -- Add invoice_date
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'invoice_date') THEN
    ALTER TABLE invoices ADD COLUMN invoice_date varchar(20);
    UPDATE invoices SET invoice_date = TO_CHAR(created_at, 'YYYY-MM-DD') WHERE invoice_date IS NULL;
    ALTER TABLE invoices ALTER COLUMN invoice_date SET NOT NULL;
  END IF;

  -- Add event_type
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'event_type') THEN
    ALTER TABLE invoices ADD COLUMN event_type varchar(100) DEFAULT 'Event' NOT NULL;
  END IF;

  -- Add quotation_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'quotation_id') THEN
    ALTER TABLE invoices ADD COLUMN quotation_id varchar(64);
  END IF;

  -- Add GST split amounts
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'cgst_amount') THEN
    ALTER TABLE invoices ADD COLUMN cgst_amount numeric(12, 2) DEFAULT '0.00' NOT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'sgst_amount') THEN
    ALTER TABLE invoices ADD COLUMN sgst_amount numeric(12, 2) DEFAULT '0.00' NOT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'igst_amount') THEN
    ALTER TABLE invoices ADD COLUMN igst_amount numeric(12, 2) DEFAULT '0.00' NOT NULL;
  END IF;

  -- Add snapshot column for immutable point-in-time financial/business/customer records
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'snapshot') THEN
    ALTER TABLE invoices ADD COLUMN snapshot text DEFAULT '{}' NOT NULL;
  END IF;

  -- Add terms
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'terms') THEN
    ALTER TABLE invoices ADD COLUMN terms text;
  END IF;

  -- Add created_by
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'created_by') THEN
    ALTER TABLE invoices ADD COLUMN created_by varchar(100);
  END IF;

  -- Add foreign key constraint for quotation_id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoices_quotation') THEN
    ALTER TABLE invoices ADD CONSTRAINT fk_invoices_quotation FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Query Pattern Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_quotation_id ON invoices(quotation_id);
CREATE INDEX IF NOT EXISTS idx_invoices_event_date ON invoices(event_date);
