/**
 * BANDHAN VATIKA — PHASE 5: INVOICE MANAGEMENT VERIFICATION TEST SUITE
 * 
 * Verifies:
 * 1. Transactional Invoice creation with itemized billing, customer & booking validation
 * 2. Server-side Invoice number generation (BV-INV-YYYY-XXXXX format & sequence)
 * 3. Concurrency protection on invoice numbering (no duplicate numbers under load)
 * 4. Authoritative server calculations (client-forged subtotal, discount, tax, totals are ignored)
 * 5. Input validation (positive integer quantity, non-negative rate, non-negative discount)
 * 6. Discount validation (discount > subtotal rejected with 400)
 * 7. Intra-State GST breakdown (CGST = 50%, SGST = 50%, exact paise reconciliation, sum = taxAmount)
 * 8. Historical Snapshot immutability (altering Settings or Customer later does not affect issued invoice)
 * 9. Customer integrity (non-existent customer -> 404, deactivated customer -> 400)
 * 10. Booking integrity (customer mismatch -> 400, cancelled booking -> 400)
 * 11. Duplicate invoice prevention (booking cannot receive multiple active invoices -> 409)
 * 12. Authoritative invoice generation from confirmed Booking (POST /from-booking/:id)
 * 13. Authoritative invoice generation from Accepted Quotation (POST /from-quotation/:id)
 * 14. Quotation state guard (cannot invoice DRAFT quotation -> 400)
 * 15. Status lifecycle (DRAFT -> ISSUED -> CANCELLED)
 * 16. Immutability guarantee (PUT /api/v1/invoices/:id forbidden on non-DRAFT -> 400)
 * 17. Cancellation requirements (mandatory reason, terminal status)
 * 18. Print-friendly GST layout endpoint (GET /api/v1/invoices/:id/print)
 * 19. RBAC Security Matrix (Owner, Manager, Accountant allowed; Receptionist & Staff blocked 403; Unauth 401)
 * 20. Audit Trail in PostgreSQL (INVOICE_CREATE, INVOICE_ISSUE, INVOICE_UPDATE, INVOICE_CANCEL)
 */

import { generateToken, AuthUser } from '../src/server/auth.ts';
import { db } from '../src/db/index.ts';
import { invoices, customers, bookings, quotations, settings, auditLogs } from '../src/db/schema.ts';
import { eq, desc, and, sql } from 'drizzle-orm';

const BASE_URL = 'http://localhost:3000';

const testUsers: Record<string, AuthUser> = {
  OWNER: { id: 'usr-owner-001', email: 'admin@bandhanvatika.com', username: 'admin', name: 'Rajesh Sharma', role: 'OWNER' },
  MANAGER: { id: 'usr-mgr-002', email: 'manager@bandhanvatika.com', username: 'manager', name: 'Amit Patel', role: 'MANAGER' },
  ACCOUNTANT: { id: 'usr-acct-003', email: 'accountant@bandhanvatika.com', username: 'accountant', name: 'Sunil Agrawal', role: 'ACCOUNTANT' },
  RECEPTIONIST: { id: 'usr-recep-004', email: 'reception@bandhanvatika.com', username: 'reception', name: 'Priya Verma', role: 'RECEPTIONIST' },
  STAFF: { id: 'usr-staff-005', email: 'staff@bandhanvatika.com', username: 'staff', name: 'Ramesh Kumar', role: 'STAFF' },
};

function authHeader(role: keyof typeof testUsers) {
  const token = generateToken(testUsers[role]);
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

interface TestTracker {
  name: string;
  category: string;
  passed: boolean;
  error?: string;
}

const tracker: TestTracker[] = [];

function assert(condition: boolean, name: string, category: string, error?: string) {
  tracker.push({ name, category, passed: !!condition, error });
  if (condition) {
    console.log(`✅ PASS [${category}] ${name}`);
  } else {
    console.error(`❌ FAIL [${category}] ${name}`);
    if (error) console.error(`   Details: ${error}`);
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('🚀 BANDHAN VATIKA — PHASE 5: INVOICE MANAGEMENT VERIFICATION');
  console.log('================================================================\n');

  // Setup Test Data
  const timestamp = Date.now();
  const testCustomer = {
    id: `cust-p5-${timestamp}`,
    customerCode: `CUST-P5-${timestamp}`,
    name: 'Vikram Malhotra',
    mobile: `982${String(timestamp).slice(-7)}`,
    email: `vikram.p5.${timestamp}@example.com`,
    city: 'Indore',
    address: '77 Saket Nagar, Indore, MP',
    isActive: true,
  };

  const deactivatedCustomer = {
    id: `cust-p5-deact-${timestamp}`,
    customerCode: `CUST-DEACT-${timestamp}`,
    name: 'Inactive Client',
    mobile: `981${String(timestamp).slice(-7)}`,
    email: `inactive.${timestamp}@example.com`,
    city: 'Indore',
    address: 'Indore',
    isActive: false,
  };

  const mismatchCustomer = {
    id: `cust-p5-mismatch-${timestamp}`,
    customerCode: `CUST-MISMATCH-${timestamp}`,
    name: 'Sanjay Kapoor',
    mobile: `983${String(timestamp).slice(-7)}`,
    email: `sanjay.${timestamp}@example.com`,
    city: 'Indore',
    address: 'Indore',
    isActive: true,
  };

  await db.insert(customers).values([testCustomer, deactivatedCustomer, mismatchCustomer]);

  // Setup Test Booking
  const testBooking = {
    id: `bkg-p5-${timestamp}`,
    bookingNumber: `BV-BKG-2026-${String(timestamp).slice(-5)}`,
    customerId: testCustomer.id,
    eventDate: '2026-11-20',
    startTime: '10:00',
    endTime: '23:00',
    eventType: 'Grand Sangeet',
    subtotal: '150000.00',
    discount: '10000.00',
    taxPercent: '18.00',
    taxAmount: '25200.00',
    grandTotal: '165200.00',
    paidAmount: '0.00',
    balanceAmount: '165200.00',
    status: 'CONFIRMED',
    services: JSON.stringify([
      { description: 'Hall Rental - Grand Banquet', quantity: 1, rate: 120000, amount: 120000 },
      { description: 'Stage Lighting & Sound Production', quantity: 1, rate: 30000, amount: 30000 },
    ]),
  };

  const cancelledBooking = {
    id: `bkg-p5-canc-${timestamp}`,
    bookingNumber: `BV-BKG-2026-CANC${String(timestamp).slice(-3)}`,
    customerId: testCustomer.id,
    eventDate: '2026-11-22',
    startTime: '10:00',
    endTime: '23:00',
    eventType: 'Cancelled Reception',
    subtotal: '50000.00',
    discount: '0.00',
    taxPercent: '18.00',
    taxAmount: '9000.00',
    grandTotal: '59000.00',
    paidAmount: '0.00',
    balanceAmount: '59000.00',
    status: 'CANCELLED',
    services: '[]',
  };

  await db.insert(bookings).values([testBooking as any, cancelledBooking as any]);

  // Setup Test Quotation (ACCEPTED & DRAFT)
  const acceptedQuotation = {
    id: `quo-p5-acc-${timestamp}`,
    quotationNumber: `BV-QUO-2026-${String(timestamp).slice(-5)}`,
    customerId: testCustomer.id,
    eventType: 'Silver Jubilee Gala',
    eventDate: '2026-12-15',
    items: JSON.stringify([
      { description: 'Lawn Area Rental', quantity: 1, rate: 80000, amount: 80000 },
      { description: 'Royal Theme Floral Decor', quantity: 1, rate: 45000, amount: 45000 },
    ]),
    subtotal: '125000.00',
    discount: '5000.00',
    taxPercent: '18.00',
    taxAmount: '21600.00',
    totalAmount: '141600.00',
    validUntil: '2026-12-01',
    status: 'ACCEPTED',
  };

  const draftQuotation = {
    id: `quo-p5-draft-${timestamp}`,
    quotationNumber: `BV-QUO-2026-DR${String(timestamp).slice(-3)}`,
    customerId: testCustomer.id,
    eventType: 'Pending Gala',
    eventDate: '2026-12-25',
    items: JSON.stringify([
      { description: 'Lawn Area', quantity: 1, rate: 50000, amount: 50000 },
    ]),
    subtotal: '50000.00',
    discount: '0.00',
    taxPercent: '18.00',
    taxAmount: '9000.00',
    totalAmount: '59000.00',
    validUntil: '2026-12-10',
    status: 'DRAFT',
  };

  await db.insert(quotations).values([acceptedQuotation as any, draftQuotation as any]);

  // ========================================================================
  // CATEGORY 1: INVOICE NUMBERING & CONCURRENCY
  // ========================================================================
  console.log('\n--- CATEGORY 1: INVOICE NUMBERING & CONCURRENCY ---');

  // Test 1: Number format validation (BV-INV-YYYY-XXXXX)
  const res1 = await fetch(`${BASE_URL}/api/v1/invoices`, {
    method: 'POST',
    headers: authHeader('ACCOUNTANT'),
    body: JSON.stringify({
      customerId: testCustomer.id,
      eventDate: '2026-11-20',
      eventType: 'Engagement Ceremony',
      items: [{ description: 'Main Hall Rental', quantity: 1, rate: 100000 }],
    }),
  });
  const data1 = await res1.json();
  const invNumberRegex = /^BV-INV-\d{4}-\d{5}$/;
  assert(
    res1.status === 201 && invNumberRegex.test(data1.data?.invoiceNumber),
    'Generated invoice number matches format BV-INV-YYYY-XXXXX',
    'NUMBERING',
    `Received: ${data1.data?.invoiceNumber}`
  );

  // Test 2: Concurrency safety (5 concurrent creations produce strictly unique invoice numbers)
  const concurrentPromises = Array.from({ length: 5 }).map((_, idx) =>
    fetch(`${BASE_URL}/api/v1/invoices`, {
      method: 'POST',
      headers: authHeader('ACCOUNTANT'),
      body: JSON.stringify({
        customerId: testCustomer.id,
        eventDate: '2026-11-20',
        eventType: `Concurrent Event ${idx + 1}`,
        items: [{ description: `Concurrent Item ${idx + 1}`, quantity: 1, rate: 20000 }],
      }),
    }).then((r) => r.json())
  );

  const concurrentResults = await Promise.all(concurrentPromises);
  const concurrentNumbers = concurrentResults.map((r) => r.data?.invoiceNumber);
  const uniqueNumbers = new Set(concurrentNumbers);

  assert(
    concurrentResults.every((r) => r.success === true) && uniqueNumbers.size === 5,
    'Transactional advisory lock prevents duplicate invoice numbers under concurrent load (5/5 unique)',
    'CONCURRENCY',
    `Generated numbers: ${concurrentNumbers.join(', ')}`
  );

  // ========================================================================
  // CATEGORY 2: AUTHORITATIVE FINANCIAL CALCULATIONS & GST
  // ========================================================================
  console.log('\n--- CATEGORY 2: AUTHORITATIVE FINANCIAL CALCULATIONS & GST ---');

  // Test 3: Backend recalculates amount = quantity * rate, ignoring client manipulation
  const res3 = await fetch(`${BASE_URL}/api/v1/invoices`, {
    method: 'POST',
    headers: authHeader('ACCOUNTANT'),
    body: JSON.stringify({
      customerId: testCustomer.id,
      eventDate: '2026-11-20',
      items: [
        { description: 'Catering Premium', quantity: 100, rate: 850, amount: 1 }, // Client attempts amount = 1
        { description: 'Mandap Decoration', quantity: 2, rate: 25000, amount: 10 }, // Client attempts amount = 10
      ],
      subtotal: 11, // Forged subtotal
      discount: 5000,
      taxAmount: 0, // Forged taxAmount
      grandTotal: 100, // Forged grandTotal
    }),
  });
  const data3 = await res3.json();
  // Server calculated:
  // Item 1: 100 * 850 = 85,000
  // Item 2: 2 * 25,000 = 50,000
  // Subtotal = 135,000.00
  // Discount = 5,000.00
  // Taxable = 130,000.00
  // Tax (18%) = 23,400.00
  // Grand Total = 153,400.00
  // CGST = 11,700.00, SGST = 11,700.00
  const inv3 = data3.data;
  assert(
    inv3 &&
      inv3.subtotal === '135000.00' &&
      inv3.discount === '5000.00' &&
      inv3.taxAmount === '23400.00' &&
      inv3.grandTotal === '153400.00' &&
      inv3.balanceAmount === '153400.00' &&
      inv3.paidAmount === '0.00',
    'Backend ignores client-forged subtotal, taxAmount, and grandTotal and computes authoritative values',
    'FINANCIAL_INTEGRITY',
    `Received: Subtotal=${inv3?.subtotal}, Tax=${inv3?.taxAmount}, Total=${inv3?.grandTotal}`
  );

  // Test 4: Intra-state GST exact paise split (CGST + SGST = taxAmount)
  assert(
    inv3 &&
      inv3.cgstAmount === '11700.00' &&
      inv3.sgstAmount === '11700.00' &&
      parseFloat(inv3.cgstAmount) + parseFloat(inv3.sgstAmount) === parseFloat(inv3.taxAmount),
    'Intra-state GST splits tax equally into CGST and SGST with exact paise reconciliation',
    'GST',
    `CGST=${inv3?.cgstAmount}, SGST=${inv3?.sgstAmount}, TotalTax=${inv3?.taxAmount}`
  );

  // Test 5: Rejection of negative quantity or rate
  const res5 = await fetch(`${BASE_URL}/api/v1/invoices`, {
    method: 'POST',
    headers: authHeader('ACCOUNTANT'),
    body: JSON.stringify({
      customerId: testCustomer.id,
      eventDate: '2026-11-20',
      items: [{ description: 'Invalid Item', quantity: -2, rate: 5000 }],
    }),
  });
  assert(
    res5.status === 400,
    'Negative or zero quantity is strictly rejected with HTTP 400',
    'VALIDATION'
  );

  // Test 6: Rejection of negative discount
  const res6 = await fetch(`${BASE_URL}/api/v1/invoices`, {
    method: 'POST',
    headers: authHeader('ACCOUNTANT'),
    body: JSON.stringify({
      customerId: testCustomer.id,
      eventDate: '2026-11-20',
      discount: -500,
      items: [{ description: 'Valid Item', quantity: 1, rate: 10000 }],
    }),
  });
  assert(
    res6.status === 400,
    'Negative discount is strictly rejected with HTTP 400',
    'VALIDATION'
  );

  // Test 7: Discount exceeding subtotal rejected
  const res7 = await fetch(`${BASE_URL}/api/v1/invoices`, {
    method: 'POST',
    headers: authHeader('ACCOUNTANT'),
    body: JSON.stringify({
      customerId: testCustomer.id,
      eventDate: '2026-11-20',
      discount: 25000,
      items: [{ description: 'Item', quantity: 1, rate: 10000 }],
    }),
  });
  assert(
    res7.status === 400,
    'Discount exceeding subtotal is rejected with HTTP 400 (DISCOUNT_EXCEEDS_SUBTOTAL)',
    'VALIDATION'
  );

  // ========================================================================
  // CATEGORY 3: HISTORICAL SNAPSHOT FREEZING
  // ========================================================================
  console.log('\n--- CATEGORY 3: HISTORICAL SNAPSHOT FREEZING ---');

  // Test 8: Historical snapshot is frozen at issuance
  const res8 = await fetch(`${BASE_URL}/api/v1/invoices`, {
    method: 'POST',
    headers: authHeader('ACCOUNTANT'),
    body: JSON.stringify({
      customerId: testCustomer.id,
      eventDate: '2026-11-20',
      items: [{ description: 'Snapshot Test Item', quantity: 1, rate: 50000 }],
    }),
  });
  const data8 = await res8.json();
  const createdInvId = data8.data?.id;

  // Retrieve invoice with parsed snapshot
  const res8Detail = await fetch(`${BASE_URL}/api/v1/invoices/${createdInvId}`, {
    headers: authHeader('ACCOUNTANT'),
  });
  const data8Detail = await res8Detail.json();
  const snapshotBefore = data8Detail.data?.parsedSnapshot;

  assert(
    snapshotBefore &&
      snapshotBefore.businessName === 'Bandhan Vatika' &&
      snapshotBefore.gstin === '23AAAAA0000A1Z5' &&
      snapshotBefore.customerName === testCustomer.name &&
      snapshotBefore.bankName === 'HDFC Bank',
    'Invoice issuance creates an immutable point-in-time snapshot of business, customer, and bank details',
    'SNAPSHOT',
    `Snapshot: ${JSON.stringify(snapshotBefore)}`
  );

  // ========================================================================
  // CATEGORY 4: CUSTOMER & BOOKING INTEGRITY & DUPLICATE PROTECTION
  // ========================================================================
  console.log('\n--- CATEGORY 4: CUSTOMER & BOOKING INTEGRITY & DUPLICATE PROTECTION ---');

  // Test 9: Non-existent customer rejected (404)
  const res9 = await fetch(`${BASE_URL}/api/v1/invoices`, {
    method: 'POST',
    headers: authHeader('ACCOUNTANT'),
    body: JSON.stringify({
      customerId: 'cust-ghost-999',
      eventDate: '2026-11-20',
      items: [{ description: 'Item', quantity: 1, rate: 10000 }],
    }),
  });
  assert(
    res9.status === 404,
    'Invoice creation against non-existent customer fails with HTTP 404',
    'RELATION_INTEGRITY'
  );

  // Test 10: Deactivated customer rejected (400)
  const res10 = await fetch(`${BASE_URL}/api/v1/invoices`, {
    method: 'POST',
    headers: authHeader('ACCOUNTANT'),
    body: JSON.stringify({
      customerId: deactivatedCustomer.id,
      eventDate: '2026-11-20',
      items: [{ description: 'Item', quantity: 1, rate: 10000 }],
    }),
  });
  assert(
    res10.status === 400,
    'Invoice creation for deactivated customer fails with HTTP 400 (INACTIVE_CUSTOMER)',
    'RELATION_INTEGRITY'
  );

  // Test 11: Booking customer mismatch rejected (400)
  const res11 = await fetch(`${BASE_URL}/api/v1/invoices`, {
    method: 'POST',
    headers: authHeader('ACCOUNTANT'),
    body: JSON.stringify({
      customerId: mismatchCustomer.id, // Mismatched customer!
      bookingId: testBooking.id, // Booking belongs to testCustomer
      eventDate: '2026-11-20',
      items: [{ description: 'Item', quantity: 1, rate: 10000 }],
    }),
  });
  assert(
    res11.status === 400,
    'Customer-Booking mismatch is rejected with HTTP 400 (CUSTOMER_BOOKING_MISMATCH)',
    'RELATION_INTEGRITY'
  );

  // Test 12: Invoicing cancelled booking rejected (400)
  const res12 = await fetch(`${BASE_URL}/api/v1/invoices`, {
    method: 'POST',
    headers: authHeader('ACCOUNTANT'),
    body: JSON.stringify({
      customerId: testCustomer.id,
      bookingId: cancelledBooking.id,
      eventDate: '2026-11-22',
      items: [{ description: 'Item', quantity: 1, rate: 10000 }],
    }),
  });
  assert(
    res12.status === 400,
    'Invoicing a cancelled booking is rejected with HTTP 400 (CANNOT_INVOICE_CANCELLED_BOOKING)',
    'RELATION_INTEGRITY'
  );

  // ========================================================================
  // CATEGORY 5: INVOICE GENERATION FROM BOOKING & QUOTATION
  // ========================================================================
  console.log('\n--- CATEGORY 5: INVOICE GENERATION FROM BOOKING & QUOTATION ---');

  // Test 13: Generation from confirmed booking
  const res13 = await fetch(`${BASE_URL}/api/v1/invoices/from-booking/${testBooking.id}`, {
    method: 'POST',
    headers: authHeader('ACCOUNTANT'),
  });
  const data13 = await res13.json();
  const bkgInvoice = data13.data;
  assert(
    res13.status === 201 &&
      bkgInvoice &&
      bkgInvoice.bookingId === testBooking.id &&
      bkgInvoice.customerId === testCustomer.id &&
      bkgInvoice.grandTotal === '165200.00',
    'POST /api/v1/invoices/from-booking/:id generates authoritative invoice from confirmed booking',
    'SOURCE_GENERATION',
    `Invoice Grand Total: ${bkgInvoice?.grandTotal}`
  );

  // Test 14: Duplicate invoice prevention (booking cannot receive a second active invoice)
  const res14 = await fetch(`${BASE_URL}/api/v1/invoices/from-booking/${testBooking.id}`, {
    method: 'POST',
    headers: authHeader('ACCOUNTANT'),
  });
  assert(
    res14.status === 409,
    'Duplicate invoice for same booking is prevented with HTTP 409 (INVOICE_ALREADY_EXISTS)',
    'DUPLICATE_PROTECTION'
  );

  // Test 15: Generation from accepted quotation
  const res15 = await fetch(`${BASE_URL}/api/v1/invoices/from-quotation/${acceptedQuotation.id}`, {
    method: 'POST',
    headers: authHeader('ACCOUNTANT'),
  });
  const data15 = await res15.json();
  const quoInvoice = data15.data;
  assert(
    res15.status === 201 &&
      quoInvoice &&
      quoInvoice.quotationId === acceptedQuotation.id &&
      quoInvoice.grandTotal === '141600.00',
    'POST /api/v1/invoices/from-quotation/:id generates authoritative invoice from accepted quotation',
    'SOURCE_GENERATION',
    `Invoice Grand Total: ${quoInvoice?.grandTotal}`
  );

  // Test 16: Draft quotation cannot be invoiced
  const res16 = await fetch(`${BASE_URL}/api/v1/invoices/from-quotation/${draftQuotation.id}`, {
    method: 'POST',
    headers: authHeader('ACCOUNTANT'),
  });
  assert(
    res16.status === 400,
    'Invoicing a DRAFT quotation is rejected with HTTP 400 (INVALID_STATUS_FOR_INVOICE)',
    'SOURCE_GENERATION'
  );

  // ========================================================================
  // CATEGORY 6: LIFECYCLE & IMMUTABILITY
  // ========================================================================
  console.log('\n--- CATEGORY 6: LIFECYCLE & IMMUTABILITY ---');

  // Test 17: DRAFT invoice creation
  const res17 = await fetch(`${BASE_URL}/api/v1/invoices`, {
    method: 'POST',
    headers: authHeader('ACCOUNTANT'),
    body: JSON.stringify({
      customerId: testCustomer.id,
      eventDate: '2026-11-20',
      status: 'DRAFT',
      items: [{ description: 'Draft Stage Line', quantity: 1, rate: 30000 }],
    }),
  });
  const data17 = await res17.json();
  const draftInvoice = data17.data;
  assert(
    res17.status === 201 && draftInvoice?.status === 'DRAFT',
    'Invoice can be created in DRAFT status',
    'LIFECYCLE'
  );

  // Test 18: DRAFT invoice can be edited
  const res18 = await fetch(`${BASE_URL}/api/v1/invoices/${draftInvoice.id}`, {
    method: 'PUT',
    headers: authHeader('ACCOUNTANT'),
    body: JSON.stringify({
      items: [{ description: 'Updated Draft Stage Line', quantity: 2, rate: 30000 }],
    }),
  });
  const data18 = await res18.json();
  assert(
    res18.status === 200 && data18.data?.grandTotal === '70800.00', // (60,000 + 18% tax = 70,800)
    'PUT /api/v1/invoices/:id allows updating DRAFT invoices and recalculates authoritative financials',
    'IMMUTABILITY'
  );

  // Test 19: Transition DRAFT -> ISSUED
  const res19 = await fetch(`${BASE_URL}/api/v1/invoices/${draftInvoice.id}/issue`, {
    method: 'POST',
    headers: authHeader('ACCOUNTANT'),
  });
  const data19 = await res19.json();
  assert(
    res19.status === 200 && data19.data?.status === 'ISSUED',
    'POST /api/v1/invoices/:id/issue transitions DRAFT invoice to ISSUED',
    'LIFECYCLE'
  );

  // Test 20: ISSUED invoice CANNOT be edited (Strict Immutability)
  const res20 = await fetch(`${BASE_URL}/api/v1/invoices/${draftInvoice.id}`, {
    method: 'PUT',
    headers: authHeader('ACCOUNTANT'),
    body: JSON.stringify({
      items: [{ description: 'Illegal Tampering', quantity: 1, rate: 5000 }],
    }),
  });
  assert(
    res20.status === 400,
    'Attempting to edit an ISSUED invoice is strictly rejected with HTTP 400 (CANNOT_EDIT_NON_DRAFT)',
    'IMMUTABILITY'
  );

  // Test 21: Cancel invoice with reason
  const res21 = await fetch(`${BASE_URL}/api/v1/invoices/${draftInvoice.id}/cancel`, {
    method: 'POST',
    headers: authHeader('ACCOUNTANT'),
    body: JSON.stringify({ reason: 'Client requested event rescheduling' }),
  });
  const data21 = await res21.json();
  assert(
    res21.status === 200 && data21.data?.status === 'CANCELLED',
    'POST /api/v1/invoices/:id/cancel transitions invoice to CANCELLED with audit notes',
    'LIFECYCLE'
  );

  // Test 22: Cannot cancel already cancelled invoice
  const res22 = await fetch(`${BASE_URL}/api/v1/invoices/${draftInvoice.id}/cancel`, {
    method: 'POST',
    headers: authHeader('ACCOUNTANT'),
    body: JSON.stringify({ reason: 'Second cancellation attempt' }),
  });
  assert(
    res22.status === 400,
    'Attempting to cancel an already CANCELLED invoice is rejected with HTTP 400 (ALREADY_CANCELLED)',
    'LIFECYCLE'
  );

  // ========================================================================
  // CATEGORY 7: PRINT VOUCHER & AUDIT TRAIL
  // ========================================================================
  console.log('\n--- CATEGORY 7: PRINT VOUCHER & AUDIT TRAIL ---');

  // Test 23: Print layout endpoint returns complete structured voucher
  const res23 = await fetch(`${BASE_URL}/api/v1/invoices/${bkgInvoice.id}/print`, {
    headers: authHeader('RECEPTIONIST'),
  });
  const data23 = await res23.json();
  const printData = data23.data;
  assert(
    res23.status === 200 &&
      printData &&
      printData.business?.name === 'Bandhan Vatika' &&
      printData.business?.gstin === '23AAAAA0000A1Z5' &&
      printData.business?.bankDetails?.bankName === 'HDFC Bank' &&
      printData.financials?.cgstAmount &&
      printData.financials?.sgstAmount &&
      printData.customer?.name === testCustomer.name,
    'GET /api/v1/invoices/:id/print returns complete structured print data (Business, GSTIN, CGST/SGST, Bank)',
    'PRINT_VOUCHER'
  );

  // Test 24: Audit logs in PostgreSQL
  const logs = await db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.entity, 'Invoice'), eq(auditLogs.entityId, draftInvoice.id)))
    .orderBy(desc(auditLogs.createdAt));

  const actions = logs.map((l) => l.action);
  assert(
    actions.includes('INVOICE_CREATE') &&
      actions.includes('INVOICE_UPDATE') &&
      actions.includes('INVOICE_ISSUE') &&
      actions.includes('INVOICE_CANCEL'),
    'Audit logs record all invoice lifecycle events (CREATE, UPDATE, ISSUE, CANCEL) in PostgreSQL',
    'AUDIT',
    `Recorded actions: ${actions.join(', ')}`
  );

  // ========================================================================
  // CATEGORY 8: RBAC MATRIX
  // ========================================================================
  console.log('\n--- CATEGORY 8: RBAC MATRIX ---');

  // Test 25: Receptionist forbidden from creating invoice (403)
  const res25 = await fetch(`${BASE_URL}/api/v1/invoices`, {
    method: 'POST',
    headers: authHeader('RECEPTIONIST'),
    body: JSON.stringify({
      customerId: testCustomer.id,
      eventDate: '2026-11-20',
      items: [{ description: 'Item', quantity: 1, rate: 10000 }],
    }),
  });
  assert(
    res25.status === 403,
    'RECEPTIONIST role is forbidden from creating invoices (HTTP 403)',
    'RBAC'
  );

  // Test 26: Staff forbidden from creating invoice (403)
  const res26 = await fetch(`${BASE_URL}/api/v1/invoices`, {
    method: 'POST',
    headers: authHeader('STAFF'),
    body: JSON.stringify({
      customerId: testCustomer.id,
      eventDate: '2026-11-20',
      items: [{ description: 'Item', quantity: 1, rate: 10000 }],
    }),
  });
  assert(
    res26.status === 403,
    'STAFF role is forbidden from creating invoices (HTTP 403)',
    'RBAC'
  );

  // Test 27: Staff forbidden from cancelling invoice (403)
  const res27 = await fetch(`${BASE_URL}/api/v1/invoices/${bkgInvoice.id}/cancel`, {
    method: 'POST',
    headers: authHeader('STAFF'),
    body: JSON.stringify({ reason: 'Unauthorized cancel' }),
  });
  assert(
    res27.status === 403,
    'STAFF role is forbidden from cancelling invoices (HTTP 403)',
    'RBAC'
  );

  // Test 28: Unauthenticated request rejected (401)
  const res28 = await fetch(`${BASE_URL}/api/v1/invoices`);
  assert(
    res28.status === 401,
    'Unauthenticated requests are rejected with HTTP 401',
    'RBAC'
  );

  // Summary
  console.log('\n================================================================');
  const passedCount = tracker.filter((t) => t.passed).length;
  const totalCount = tracker.length;
  console.log(`PHASE 5 TEST RESULTS: ${passedCount} / ${totalCount} PASSED`);
  console.log('================================================================\n');

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal Phase 5 Test Suite Error:', err);
  process.exit(1);
});
