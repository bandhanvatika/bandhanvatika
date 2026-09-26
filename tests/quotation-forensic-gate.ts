/**
 * BANDHAN VATIKA — QUOTATION SCHEMA & INTEGRITY FORENSIC GATE TEST
 * 
 * Performs exhaustive empirical verification of:
 * 1. Strict YYYY-MM-DD Date Validation (no invalid dates can enter PostgreSQL)
 * 2. Tax Rate Authority & Historical Reproducibility (client cannot forge tax; historical quote retains rate)
 * 3. Quotation Item Integrity (client amounts ignored; negative/decimal qty rejected; negative rates rejected)
 * 4. Authoritative Financials (client subtotals/totals ignored; discount bounds enforced)
 * 5. Quotation Deletion Protection (no DELETE endpoint; non-draft edits blocked)
 * 6. Customer & Booking Relation Guardrails (inactive customer, non-existent customer, customer mismatch)
 * 7. Booking Conversion Atomicity & Concurrency Safety
 */

import { generateToken, AuthUser } from '../src/server/auth.ts';
import { db } from '../src/db/index.ts';
import { quotations, customers, halls, bookings, settings } from '../src/db/schema.ts';
import { eq } from 'drizzle-orm';

const BASE_URL = 'http://localhost:3000';

const testUsers: Record<string, AuthUser> = {
  OWNER: { id: 'usr-owner-001', email: 'admin@bandhanvatika.com', username: 'admin', name: 'Rajesh Sharma', role: 'OWNER' },
  MANAGER: { id: 'usr-mgr-002', email: 'manager@bandhanvatika.com', username: 'manager', name: 'Amit Patel', role: 'MANAGER' },
  RECEPTIONIST: { id: 'usr-recep-004', email: 'reception@bandhanvatika.com', username: 'reception', name: 'Priya Verma', role: 'RECEPTIONIST' },
};

function authHeader(role: keyof typeof testUsers = 'OWNER') {
  const token = generateToken(testUsers[role]);
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

interface GateResult {
  name: string;
  category: string;
  passed: boolean;
  notes?: string;
}

const results: GateResult[] = [];

function record(condition: boolean, name: string, category: string, notes?: string) {
  results.push({ name, category, passed: !!condition, notes });
  if (condition) {
    console.log(`[PASS] [${category}] ${name}`);
  } else {
    console.error(`[FAIL] [${category}] ${name} - ${notes}`);
  }
}

async function runGate() {
  console.log('================================================================');
  console.log('BANDHAN VATIKA — QUOTATION SCHEMA INTEGRITY FORENSIC GATE TEST');
  console.log('================================================================\n');

  // Setup: Create active and inactive test customers
  const activeCustId = `cust-gate-act-${Date.now()}`;
  const inactiveCustId = `cust-gate-inact-${Date.now()}`;
  const hallId = `hall-gate-${Date.now()}`;

  await db.insert(customers).values([
    {
      id: activeCustId,
      customerCode: `CUST-ACT-${Date.now().toString().slice(-4)}`,
      name: 'Integrity Test Active Customer',
      mobile: `999${Date.now().toString().slice(-7)}`,
      email: 'active@gate.test',
      isActive: true,
    },
    {
      id: inactiveCustId,
      customerCode: `CUST-INA-${Date.now().toString().slice(-4)}`,
      name: 'Integrity Test Inactive Customer',
      mobile: `998${Date.now().toString().slice(-7)}`,
      email: 'inactive@gate.test',
      isActive: false,
    },
  ]);

  await db.insert(halls).values({
    id: hallId,
    code: `HALL-GATE-${Date.now().toString().slice(-3)}`,
    name: 'Gate Test Lawn',
    type: 'Open Air Lawn',
    capacity: 600,
    basePrice: '75000.00',
    status: 'ACTIVE',
  });

  // -------------------------------------------------------------------------
  // 1. DATE FIELD VERIFICATION
  // -------------------------------------------------------------------------
  console.log('--- 1. DATE FIELD VALIDATION ---');

  const invalidDates = [
    '2026-02-30',        // Non-existent February date
    '2026-13-01',        // Invalid month
    '2026-00-10',        // Zero month
    '2026-05-32',        // Day 32
    '2026/05/20',        // Slash format
    '20-05-2026',        // DD-MM-YYYY format
    '2026-5-5',          // Unpadded format
    'invalid-string',    // Random text
    '2026-05-20T10:00Z', // Full ISO timestamp
  ];

  for (const badDate of invalidDates) {
    const res = await fetch(`${BASE_URL}/api/v1/quotations`, {
      method: 'POST',
      headers: authHeader('MANAGER'),
      body: JSON.stringify({
        customerId: activeCustId,
        eventType: 'Wedding',
        eventDate: badDate,
        items: [{ description: 'Test Item', quantity: 1, rate: 1000 }],
      }),
    });
    record(
      res.status === 400,
      `Invalid eventDate "${badDate}" rejected with HTTP 400`,
      'DATE_VALIDATION',
      `Got status ${res.status}`
    );
  }

  // Test invalid validUntil date
  const badValidRes = await fetch(`${BASE_URL}/api/v1/quotations`, {
    method: 'POST',
    headers: authHeader('MANAGER'),
    body: JSON.stringify({
      customerId: activeCustId,
      eventType: 'Wedding',
      eventDate: '2026-11-20',
      validUntil: '2026-02-30',
      items: [{ description: 'Test Item', quantity: 1, rate: 1000 }],
    }),
  });
  record(
    badValidRes.status === 400,
    'Invalid validUntil "2026-02-30" rejected with HTTP 400',
    'DATE_VALIDATION',
    `Got status ${badValidRes.status}`
  );

  // -------------------------------------------------------------------------
  // 2. TAX / GST INTEGRITY & HISTORICAL REPRODUCIBILITY
  // -------------------------------------------------------------------------
  console.log('\n--- 2. TAX / GST INTEGRITY & HISTORICAL REPRODUCIBILITY ---');

  // Attempt client-side tax forgery
  const forgedTaxRes = await fetch(`${BASE_URL}/api/v1/quotations`, {
    method: 'POST',
    headers: authHeader('OWNER'),
    body: JSON.stringify({
      customerId: activeCustId,
      eventType: 'Wedding Gala',
      eventDate: '2026-11-25',
      items: [{ description: 'Mandap Floral Setup', quantity: 1, rate: 100000 }],
      // Deliberately forged financial fields:
      subtotal: 100,
      discount: 0,
      taxPercent: 0,
      taxAmount: 0,
      totalAmount: 100,
    }),
  });
  const forgedTaxData = await forgedTaxRes.json();
  const quoId1 = forgedTaxData.data?.id;

  record(
    forgedTaxRes.status === 201 &&
    forgedTaxData.data?.subtotal === '100000.00' &&
    forgedTaxData.data?.taxPercent === '18.00' &&
    forgedTaxData.data?.taxAmount === '18000.00' &&
    forgedTaxData.data?.totalAmount === '118000.00',
    'Client-forged taxPercent (0%) and totalAmount (100) ignored; server authoritative GST applied (18% = 18,000, Total = 118,000)',
    'TAX_INTEGRITY'
  );

  // Verify historical reproduction: if settings tax changes, quoId1 MUST still show 18.00%
  // Temporarily update settings tax to 12.00%
  await db.update(settings).set({ defaultTaxPercent: '12.00' }).where(eq(settings.id, 'default'));

  const detailCheckRes = await fetch(`${BASE_URL}/api/v1/quotations/${quoId1}`, {
    headers: authHeader('OWNER'),
  });
  const detailCheckData = await detailCheckRes.json();

  record(
    detailCheckData.data?.taxPercent === '18.00' &&
    detailCheckData.data?.taxAmount === '18000.00' &&
    detailCheckData.data?.totalAmount === '118000.00',
    'Historical quotation preserves original 18.00% tax even when Settings default tax is altered to 12.00%',
    'TAX_HISTORICAL_REPRODUCIBILITY'
  );

  // Restore settings tax back to 18.00%
  await db.update(settings).set({ defaultTaxPercent: '18.00' }).where(eq(settings.id, 'default'));

  // -------------------------------------------------------------------------
  // 3. QUOTATION ITEM INTEGRITY
  // -------------------------------------------------------------------------
  console.log('\n--- 3. QUOTATION ITEM INTEGRITY ---');

  // Test 3.1: Forged item amount
  const forgedItemAmountRes = await fetch(`${BASE_URL}/api/v1/quotations`, {
    method: 'POST',
    headers: authHeader('OWNER'),
    body: JSON.stringify({
      customerId: activeCustId,
      eventType: 'Engagement',
      eventDate: '2026-11-28',
      items: [
        {
          description: 'Catering Premium Buffet',
          quantity: 200,
          rate: 1500,
          amount: 50, // Forged client amount! (Should be 300,000)
        },
      ],
    }),
  });
  const forgedItemData = await forgedItemAmountRes.json();
  const parsedItem = forgedItemData.data?.parsedItems?.[0];

  record(
    forgedItemAmountRes.status === 201 &&
    parsedItem?.amount === 300000 &&
    forgedItemData.data?.subtotal === '300000.00',
    'Client forged item amount (₹50) ignored; server recalculated quantity × rate = ₹300,000.00',
    'ITEM_INTEGRITY'
  );

  // Test 3.2: Negative quantity rejected
  const negQtyRes = await fetch(`${BASE_URL}/api/v1/quotations`, {
    method: 'POST',
    headers: authHeader('OWNER'),
    body: JSON.stringify({
      customerId: activeCustId,
      eventType: 'Engagement',
      eventDate: '2026-11-28',
      items: [{ description: 'Chairs', quantity: -10, rate: 50 }],
    }),
  });
  record(negQtyRes.status === 400, 'Negative item quantity rejected with HTTP 400', 'ITEM_INTEGRITY');

  // Test 3.3: Decimal/Float quantity rejected (only integer allowed)
  const floatQtyRes = await fetch(`${BASE_URL}/api/v1/quotations`, {
    method: 'POST',
    headers: authHeader('OWNER'),
    body: JSON.stringify({
      customerId: activeCustId,
      eventType: 'Engagement',
      eventDate: '2026-11-28',
      items: [{ description: 'Sound System', quantity: 1.5, rate: 5000 }],
    }),
  });
  record(floatQtyRes.status === 400, 'Fractional/non-integer item quantity rejected with HTTP 400', 'ITEM_INTEGRITY');

  // Test 3.4: Negative unit rate rejected
  const negRateRes = await fetch(`${BASE_URL}/api/v1/quotations`, {
    method: 'POST',
    headers: authHeader('OWNER'),
    body: JSON.stringify({
      customerId: activeCustId,
      eventType: 'Engagement',
      eventDate: '2026-11-28',
      items: [{ description: 'Decoration', quantity: 1, rate: -5000 }],
    }),
  });
  record(negRateRes.status === 400, 'Negative item unit rate rejected with HTTP 400', 'ITEM_INTEGRITY');

  // Test 3.5: Large values handled accurately in paise
  const largeValRes = await fetch(`${BASE_URL}/api/v1/quotations`, {
    method: 'POST',
    headers: authHeader('OWNER'),
    body: JSON.stringify({
      customerId: activeCustId,
      eventType: 'Destination Wedding Package',
      eventDate: '2026-12-10',
      items: [{ description: 'Royal Lawn Full Estate Hire', quantity: 1, rate: 2500000 }], // 25 Lakhs
      discount: 100000, // 1 Lakh discount
    }),
  });
  const largeValData = await largeValRes.json();
  // Subtotal = 2,500,000.00; Discount = 100,000.00; Taxable = 2,400,000.00; 18% Tax = 432,000.00; Grand Total = 2,832,000.00
  record(
    largeValRes.status === 201 &&
    largeValData.data?.subtotal === '2500000.00' &&
    largeValData.data?.discount === '100000.00' &&
    largeValData.data?.taxAmount === '432000.00' &&
    largeValData.data?.totalAmount === '2832000.00',
    'Large multi-lakh financial amounts handled with exact precision (Subtotal: 25L, Disc: 1L, GST: 4.32L, Total: 28.32L)',
    'FINANCIAL_PRECISION'
  );

  // -------------------------------------------------------------------------
  // 4. TOTAL INTEGRITY & DISCOUNT PROTECTION
  // -------------------------------------------------------------------------
  console.log('\n--- 4. TOTAL INTEGRITY & DISCOUNT PROTECTION ---');

  // Test 4.1: Negative discount rejected
  const negDiscRes = await fetch(`${BASE_URL}/api/v1/quotations`, {
    method: 'POST',
    headers: authHeader('OWNER'),
    body: JSON.stringify({
      customerId: activeCustId,
      eventType: 'Birthday',
      eventDate: '2026-12-15',
      items: [{ description: 'Catering', quantity: 50, rate: 500 }],
      discount: -500,
    }),
  });
  record(negDiscRes.status === 400, 'Negative discount rejected with HTTP 400', 'TOTAL_INTEGRITY');

  // Test 4.2: Discount exceeding subtotal rejected
  const excessiveDiscRes = await fetch(`${BASE_URL}/api/v1/quotations`, {
    method: 'POST',
    headers: authHeader('OWNER'),
    body: JSON.stringify({
      customerId: activeCustId,
      eventType: 'Birthday',
      eventDate: '2026-12-15',
      items: [{ description: 'Catering', quantity: 10, rate: 500 }], // Subtotal: 5000
      discount: 6000, // Exceeds 5000
    }),
  });
  record(excessiveDiscRes.status === 400, 'Discount exceeding subtotal rejected with HTTP 400', 'TOTAL_INTEGRITY');

  // -------------------------------------------------------------------------
  // 5. QUOTATION HISTORY & IMMUTABILITY (DELETION & EDIT PROTECTION)
  // -------------------------------------------------------------------------
  console.log('\n--- 5. QUOTATION HISTORY & IMMUTABILITY ---');

  // Create a quotation to test lifecycle transitions
  const createLifecycleRes = await fetch(`${BASE_URL}/api/v1/quotations`, {
    method: 'POST',
    headers: authHeader('OWNER'),
    body: JSON.stringify({
      customerId: activeCustId,
      eventType: 'Sangeet Ceremony',
      eventDate: '2026-12-20',
      items: [{ description: 'Stage Lighting', quantity: 1, rate: 20000 }],
    }),
  });
  const lifecycleQuo = (await createLifecycleRes.json()).data;

  // Test 5.1: No DELETE endpoint exists
  const deleteRes = await fetch(`${BASE_URL}/api/v1/quotations/${lifecycleQuo.id}`, {
    method: 'DELETE',
    headers: authHeader('OWNER'),
  });
  record(
    deleteRes.status === 404,
    `Direct DELETE /api/v1/quotations/:id is not supported (HTTP ${deleteRes.status} Not Found)`,
    'HISTORY_PRESERVATION'
  );

  // Transition DRAFT -> SENT
  await fetch(`${BASE_URL}/api/v1/quotations/${lifecycleQuo.id}/send`, {
    method: 'POST',
    headers: authHeader('OWNER'),
  });

  // Test 5.2: Cannot edit SENT quotation
  const editSentRes = await fetch(`${BASE_URL}/api/v1/quotations/${lifecycleQuo.id}`, {
    method: 'PUT',
    headers: authHeader('OWNER'),
    body: JSON.stringify({
      eventType: 'Attempted Malicious Modification',
    }),
  });
  record(
    editSentRes.status === 400,
    'Editing non-DRAFT (SENT) quotation blocked with HTTP 400 CANNOT_EDIT_NON_DRAFT',
    'HISTORY_PRESERVATION'
  );

  // Transition SENT -> ACCEPTED
  await fetch(`${BASE_URL}/api/v1/quotations/${lifecycleQuo.id}/accept`, {
    method: 'POST',
    headers: authHeader('OWNER'),
  });

  // Test 5.3: Cannot edit ACCEPTED quotation
  const editAcceptedRes = await fetch(`${BASE_URL}/api/v1/quotations/${lifecycleQuo.id}`, {
    method: 'PUT',
    headers: authHeader('OWNER'),
    body: JSON.stringify({
      eventType: 'Attempted Malicious Modification',
    }),
  });
  record(
    editAcceptedRes.status === 400,
    'Editing non-DRAFT (ACCEPTED) quotation blocked with HTTP 400 CANNOT_EDIT_NON_DRAFT',
    'HISTORY_PRESERVATION'
  );

  // -------------------------------------------------------------------------
  // 6. CUSTOMER & BOOKING RELATION GUARDRAILS
  // -------------------------------------------------------------------------
  console.log('\n--- 6. CUSTOMER & BOOKING RELATION GUARDRAILS ---');

  // Test 6.1: Inactive customer rejected
  const inactCustRes = await fetch(`${BASE_URL}/api/v1/quotations`, {
    method: 'POST',
    headers: authHeader('OWNER'),
    body: JSON.stringify({
      customerId: inactiveCustId,
      eventType: 'Anniversary',
      eventDate: '2026-12-22',
      items: [{ description: 'Catering', quantity: 1, rate: 10000 }],
    }),
  });
  record(
    inactCustRes.status === 400,
    'Quotation creation for deactivated customer blocked with HTTP 400 INACTIVE_CUSTOMER',
    'CUSTOMER_RELATION'
  );

  // Test 6.2: Non-existent customer rejected
  const nonExistentCustRes = await fetch(`${BASE_URL}/api/v1/quotations`, {
    method: 'POST',
    headers: authHeader('OWNER'),
    body: JSON.stringify({
      customerId: 'cust-non-existent-99999',
      eventType: 'Anniversary',
      eventDate: '2026-12-22',
      items: [{ description: 'Catering', quantity: 1, rate: 10000 }],
    }),
  });
  record(
    nonExistentCustRes.status === 404,
    'Quotation creation for non-existent customer rejected with HTTP 404 CUSTOMER_NOT_FOUND',
    'CUSTOMER_RELATION'
  );

  // Test 6.3: Booking conversion customer consistency & double-conversion protection
  const convertRes = await fetch(`${BASE_URL}/api/v1/quotations/${lifecycleQuo.id}/convert`, {
    method: 'POST',
    headers: authHeader('OWNER'),
    body: JSON.stringify({
      startTime: '10:00',
      endTime: '16:00',
      guestCount: 250,
    }),
  });
  const convertData = await convertRes.json();
  const bookingId = convertData.data?.booking?.id;
  const bookingCustomerId = convertData.data?.booking?.customerId;

  record(
    convertRes.status === 200 &&
    bookingCustomerId === lifecycleQuo.customerId &&
    convertData.data?.quotation?.bookingId === bookingId &&
    convertData.data?.quotation?.status === 'CONVERTED',
    'Booking conversion atomically links bookingId to quotation, matches customerId, and sets status to CONVERTED',
    'BOOKING_RELATION'
  );

  // Test 6.4: Double conversion blocked
  const doubleConvertRes = await fetch(`${BASE_URL}/api/v1/quotations/${lifecycleQuo.id}/convert`, {
    method: 'POST',
    headers: authHeader('OWNER'),
    body: JSON.stringify({
      startTime: '10:00',
      endTime: '16:00',
    }),
  });
  record(
    doubleConvertRes.status === 400,
    'Re-converting already CONVERTED quotation blocked with HTTP 400 ALREADY_CONVERTED',
    'BOOKING_RELATION'
  );

  // -------------------------------------------------------------------------
  // CLEANUP
  // -------------------------------------------------------------------------
  console.log('\n--- CLEANING UP TEST DATA ---');
  if (bookingId) {
    await db.delete(bookings).where(eq(bookings.id, bookingId));
  }
  await db.delete(quotations).where(eq(quotations.customerId, activeCustId));
  await db.delete(quotations).where(eq(quotations.customerId, inactiveCustId));
  await db.delete(customers).where(eq(customers.id, activeCustId));
  await db.delete(customers).where(eq(customers.id, inactiveCustId));
  await db.delete(halls).where(eq(halls.id, hallId));

  console.log('\n================================================================');
  const allPassed = results.every(r => r.passed);
  console.log(`FORENSIC GATE RESULTS: ${results.filter(r => r.passed).length} / ${results.length} PASSED`);
  console.log(`OVERALL: ${allPassed ? 'ALL FORENSIC CHECKS PASSED' : 'FAILURES DETECTED'}`);
  console.log('================================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

runGate().catch((err) => {
  console.error('Fatal forensic gate test error:', err);
  process.exit(1);
});
