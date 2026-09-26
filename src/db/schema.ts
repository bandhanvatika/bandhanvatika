import { pgTable, text, varchar, integer, numeric, boolean, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: varchar('id', { length: 64 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  role: varchar('role', { length: 50 }).notNull().default('STAFF'), // OWNER, MANAGER, ACCOUNTANT, RECEPTIONIST, STAFF
  status: varchar('status', { length: 50 }).notNull().default('ACTIVE'), // ACTIVE, INACTIVE
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const customers = pgTable('customers', {
  id: varchar('id', { length: 64 }).primaryKey(),
  customerCode: varchar('customer_code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  mobile: varchar('mobile', { length: 50 }).notNull(),
  email: varchar('email', { length: 255 }),
  address: text('address'),
  city: varchar('city', { length: 100 }),
  idProofType: varchar('id_proof_type', { length: 50 }),
  idProofNumber: varchar('id_proof_number', { length: 100 }),
  notes: text('notes'),
  isActive: boolean('is_active').default(true).notNull(),
  totalBookings: integer('total_bookings').default(0).notNull(),
  totalSpent: numeric('total_spent', { precision: 12, scale: 2 }).default('0.00').notNull(),
  outstandingAmount: numeric('outstanding_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const halls = pgTable('halls', {
  id: varchar('id', { length: 64 }).primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 100 }).notNull(), // Banquet Hall, Open Air Lawn, Mini Hall
  capacity: integer('capacity').notNull(),
  basePrice: numeric('base_price', { precision: 12, scale: 2 }).notNull(),
  status: varchar('status', { length: 50 }).default('ACTIVE').notNull(), // ACTIVE, INACTIVE, MAINTENANCE
  amenities: text('amenities').notNull().default('[]'), // JSON array of string tags
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const rooms = pgTable('rooms', {
  id: varchar('id', { length: 64 }).primaryKey(),
  roomNumber: varchar('room_number', { length: 50 }).notNull().unique(),
  roomType: varchar('room_type', { length: 100 }).notNull(), // Deluxe Room, Family Room, Suite Room
  isAc: boolean('is_ac').default(true).notNull(),
  capacity: integer('capacity').notNull(),
  pricePerNight: numeric('price_per_night', { precision: 12, scale: 2 }).notNull(),
  status: varchar('status', { length: 50 }).default('AVAILABLE').notNull(), // AVAILABLE, RESERVED, OCCUPIED, CLEANING, MAINTENANCE, BLOCKED
  amenities: text('amenities').notNull().default('[]'), // JSON array of string tags
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const bookings = pgTable('bookings', {
  id: varchar('id', { length: 64 }).primaryKey(),
  bookingNumber: varchar('booking_number', { length: 50 }).notNull().unique(),
  customerId: varchar('customer_id', { length: 64 }).notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(), // Wedding, Reception, Engagement, Birthday, Anniversary, Corporate
  eventDate: varchar('event_date', { length: 20 }).notNull(), // YYYY-MM-DD
  startTime: varchar('start_time', { length: 10 }).notNull(), // HH:mm
  endTime: varchar('end_time', { length: 10 }).notNull(), // HH:mm
  guestCount: integer('guest_count').default(100).notNull(),
  hallId: varchar('hall_id', { length: 64 }),
  hallIds: text('hall_ids').default('[]').notNull(), // JSON array of hall IDs
  roomIds: text('room_ids').default('[]').notNull(), // JSON array of room IDs
  services: text('services').default('[]').notNull(), // JSON array of service line items
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).default('0.00').notNull(),
  discount: numeric('discount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  taxPercent: numeric('tax_percent', { precision: 5, scale: 2 }).default('0.00').notNull(),
  taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  grandTotal: numeric('grand_total', { precision: 12, scale: 2 }).default('0.00').notNull(),
  paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  balanceAmount: numeric('balance_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  status: varchar('status', { length: 50 }).default('CONFIRMED').notNull(), // INQUIRY, QUOTATION, PENDING_ADVANCE, CONFIRMED, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, POSTPONED
  notes: text('notes'),
  createdBy: varchar('created_by', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const bookingHalls = pgTable('booking_halls', {
  id: varchar('id', { length: 64 }).primaryKey(),
  bookingId: varchar('booking_id', { length: 64 }).notNull(),
  hallId: varchar('hall_id', { length: 64 }).notNull(),
  eventDate: varchar('event_date', { length: 20 }).notNull(),
  startTime: varchar('start_time', { length: 10 }).notNull(),
  endTime: varchar('end_time', { length: 10 }).notNull(),
  price: numeric('price', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const bookingRooms = pgTable('booking_rooms', {
  id: varchar('id', { length: 64 }).primaryKey(),
  bookingId: varchar('booking_id', { length: 64 }).notNull(),
  roomId: varchar('room_id', { length: 64 }).notNull(),
  checkInDate: varchar('check_in_date', { length: 20 }).notNull(),
  checkOutDate: varchar('check_out_date', { length: 20 }).notNull(),
  price: numeric('price', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const quotations = pgTable('quotations', {
  id: varchar('id', { length: 64 }).primaryKey(),
  quotationNumber: varchar('quotation_number', { length: 50 }).notNull().unique(),
  customerId: varchar('customer_id', { length: 64 }).notNull(),
  bookingId: varchar('booking_id', { length: 64 }),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  eventDate: varchar('event_date', { length: 20 }).notNull(),
  hallId: varchar('hall_id', { length: 64 }),
  items: text('items').default('[]').notNull(), // JSON array
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).default('0.00').notNull(),
  discount: numeric('discount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  taxPercent: numeric('tax_percent', { precision: 5, scale: 2 }).default('0.00').notNull(),
  taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  validUntil: varchar('valid_until', { length: 20 }).notNull(),
  terms: text('terms'),
  status: varchar('status', { length: 50 }).default('DRAFT').notNull(), // DRAFT, SENT, ACCEPTED, REJECTED, CONVERTED
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const invoices = pgTable('invoices', {
  id: varchar('id', { length: 64 }).primaryKey(),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull().unique(),
  customerId: varchar('customer_id', { length: 64 }).notNull(),
  bookingId: varchar('booking_id', { length: 64 }),
  quotationId: varchar('quotation_id', { length: 64 }),
  invoiceDate: varchar('invoice_date', { length: 20 }).default('').notNull(),
  eventDate: varchar('event_date', { length: 20 }).notNull(),
  eventType: varchar('event_type', { length: 100 }).default('Event').notNull(),
  items: text('items').default('[]').notNull(), // JSON array: { description, quantity, rate, amount }
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).default('0.00').notNull(),
  discount: numeric('discount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  taxPercent: numeric('tax_percent', { precision: 5, scale: 2 }).default('0.00').notNull(),
  taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  cgstAmount: numeric('cgst_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  sgstAmount: numeric('sgst_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  igstAmount: numeric('igst_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  grandTotal: numeric('grand_total', { precision: 12, scale: 2 }).default('0.00').notNull(),
  paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  balanceAmount: numeric('balance_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  status: varchar('status', { length: 50 }).default('ISSUED').notNull(), // DRAFT, ISSUED, PARTIAL, PAID, CANCELLED
  dueDate: varchar('due_date', { length: 20 }),
  terms: text('terms'),
  notes: text('notes'),
  snapshot: text('snapshot').default('{}').notNull(), // Immutable historical business & customer details
  createdBy: varchar('created_by', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const payments = pgTable('payments', {
  id: varchar('id', { length: 64 }).primaryKey(),
  receiptNumber: varchar('receipt_number', { length: 50 }).notNull().unique(),
  invoiceId: varchar('invoice_id', { length: 64 }),
  bookingId: varchar('booking_id', { length: 64 }),
  customerId: varchar('customer_id', { length: 64 }).notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 50 }).notNull(), // CASH, UPI, CARD, BANK_TRANSFER, CHEQUE, OTHER
  transactionReference: varchar('transaction_reference', { length: 100 }),
  paymentDate: varchar('payment_date', { length: 20 }).notNull(), // YYYY-MM-DD
  paymentType: varchar('payment_type', { length: 50 }).default('PARTIAL').notNull(), // ADVANCE, PARTIAL, FINAL
  notes: text('notes'),
  isReversed: boolean('is_reversed').default(false).notNull(),
  reversalReason: text('reversal_reason'),
  reversedAt: timestamp('reversed_at'),
  reversedBy: varchar('reversed_by', { length: 255 }),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const expenses = pgTable('expenses', {
  id: varchar('id', { length: 64 }).primaryKey(),
  expenseCode: varchar('expense_code', { length: 50 }).notNull().unique(),
  category: varchar('category', { length: 100 }).notNull(), // Catering, Decoration, Electricity, Maintenance, Cleaning, Wages, Marketing, Other
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  date: varchar('date', { length: 20 }).notNull(), // YYYY-MM-DD
  vendor: varchar('vendor', { length: 255 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 50 }).notNull(),
  notes: text('notes'),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 64 }),
  userName: varchar('user_name', { length: 255 }).notNull(),
  userRole: varchar('user_role', { length: 50 }).notNull(),
  action: varchar('action', { length: 100 }).notNull(), // LOGIN, BOOKING_CREATE, BOOKING_UPDATE, BOOKING_CANCEL, etc.
  entity: varchar('entity', { length: 100 }).notNull(), // Booking, Invoice, Payment, Customer, Expense, User, Settings
  entityId: varchar('entity_id', { length: 64 }),
  details: text('details'),
  ipAddress: varchar('ip_address', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const settings = pgTable('settings', {
  id: varchar('id', { length: 50 }).primaryKey().default('default'),
  businessName: varchar('business_name', { length: 255 }).default('Bandhan Vatika').notNull(),
  tagline: varchar('tagline', { length: 255 }).default('Celebrations · Together · Always').notNull(),
  address: text('address').default('123, MG Road, Indore, MP 452001').notNull(),
  phone: varchar('phone', { length: 50 }).default('9876543210').notNull(),
  email: varchar('email', { length: 255 }).default('contact@bandhanvatika.com').notNull(),
  gstin: varchar('gstin', { length: 50 }).default('23AAAAA0000A1Z5').notNull(),
  defaultTaxPercent: numeric('default_tax_percent', { precision: 5, scale: 2 }).default('18.00').notNull(),
  bankName: varchar('bank_name', { length: 255 }).default('HDFC Bank').notNull(),
  accountNumber: varchar('account_number', { length: 100 }).default('50200012345678').notNull(),
  ifscCode: varchar('ifsc_code', { length: 50 }).default('HDFC0001234').notNull(),
  termsAndConditions: text('terms_and_conditions').default('1. Advance payment is required to confirm booking.\n2. In case of cancellation before 30 days, 50% advance will be refunded.\n3. Outside catering and alcohol strictly subject to prior permission.').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
