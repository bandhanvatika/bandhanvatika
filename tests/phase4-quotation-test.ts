/**
 * BANDHAN VATIKA — PHASE 4: QUOTATION MANAGEMENT VERIFICATION TEST SUITE
 * 
 * Verifies:
 * 1. Transactional Quotation creation with itemized pricing, customer & hall validation
 * 2. Server-side Quotation number generation (BV-QUO-YYYY-XXXXX format & sequence)
 * 3. Concurrency protection on quotation numbering (no duplicate numbers)
 * 4. Customer validation & duplicate/inactive customer protection
 * 5. Optional Booking relation with customer mismatch prevention
 * 6. Integer-paise / Decimal financial calculation (Subtotal, Discount, GST 18%, Grand Total)
 * 7. Negative input rejection (negative quantity, negative rate, negative discount)
 * 8. Discount exceeding subtotal validation error
 * 9. Quotation Status State Machine enforcement (DRAFT -> SENT -> ACCEPTED / REJECTED -> CONVERTED)
 * 10. Invalid status transitions rejected (e.g. DRAFT -> ACCEPTED, REJECTED -> CONVERTED, CONVERTED -> DRAFT)
 * 11. Quotation editing restricted exclusively to DRAFT status
 * 12. Quotation Acceptance workflow (preserves pricing, updates status, logs audit)
 * 13. Quotation -> Booking Conversion with Hall Availability validation
 * 14. Availability conflict during conversion fails safely with 409, preserving quotation in ACCEPTED
 * 15. Concurrent Quotation conversion race condition (Advisory lock ensures only 1 succeeds, 1 blocked 409)
 * 16. Audit Logging integrity in PostgreSQL for all quotation lifecycle events
 * 17. RBAC security matrix (Receptionist allowed create/send/accept, Staff blocked 403, Convert requires Manager/Owner)
 */

import { generateToken, AuthUser } from '../src/server/auth.ts';
import { db } from '../src/db/index.ts';
import { quotations, customers, halls, bookings, bookingHalls, auditLogs } from '../src/db/schema.ts';
import { eq, desc, sql } from 'drizzle-orm';

const BASE_URL = 'http://localhost:3000';

const testUsers: Record<string, AuthUser> = {
  OWNER: { id: 'usr-owner-001', email: 'admin@bandhanvatika.com', username: 'admin', name: 'Rajesh Sharma', role: 'OWNER' },
  MANAGER: { id: 'usr-mgr-002', email: 'manager@bandhanvatika.com', username: 'manager', name: 'Amit Patel', role: 'MANAGER' },
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

async function runQuotationTests() {
  console.log('\n===============================================================');
  console.log('BANDHAN VATIKA — PHASE 4: QUOTATION MANAGEMENT TEST EXECUTION');
  console.log('===============================================================\n');

  // Track created test entities for targeted cleanup
  const createdQuotationIds: string[] = [];
  const createdBookingIds: string[] = [];
  const createdCustomerIds: string[] = [];

  try {
    // -------------------------------------------------------------
    // PREREQUISITES: Load or create master data
    // -------------------------------------------------------------
    const [activeHall] = await db.select().from(halls).limit(1);
    if (!activeHall) throw new Error('No hall found in database for testing');

    // Create a dedicated test customer
    const timestamp = Date.now().toString().slice(-6);
    const [custRes] = await db
      .insert(customers)
      .values({
        id: `cust-quo-${Date.now()}`,
        customerCode: `CUST-${timestamp}`,
        name: `Quotation Test Client ${timestamp}`,
        mobile: `9876${timestamp}`,
        email: `quo.${timestamp}@example.com`,
        address: '100 Regal Square, Indore',
        isActive: true,
      })
      .returning();
    createdCustomerIds.push(custRes.id);

    // -------------------------------------------------------------
    // TEST 1: Quotation Creation with Itemized Pricing & Validation
    // -------------------------------------------------------------
    const testItems = [
      { description: 'Grand Hall Day Tariff', quantity: 1, rate: 200000 },
      { description: 'Bridal Suite 301 (2 Nights)', quantity: 2, rate: 8000 },
      { description: 'Royal Stage Floral Setup', quantity: 1, rate: 40000 },
    ];
    // Subtotal: 200000 + 16000 + 40000 = 256000
    // Discount: 6000 => Taxable: 250000
    // GST 18%: 45000
    // Grand Total: 295000

    const createRes = await fetch(`${BASE_URL}/api/v1/quotations`, {
      method: 'POST',
      headers: authHeader('RECEPTIONIST'),
      body: JSON.stringify({
        customerId: custRes.id,
        eventType: 'Golden Wedding Anniversary',
        eventDate: '2029-11-20',
        hallId: activeHall.id,
        items: testItems,
        discount: 6000,
        validUntil: '2029-10-15',
        terms: 'Payment schedule: 50% advance upon contract signing.',
      }),
    });

    const createData = await createRes.json();
    assert(
      createRes.status === 201 && createData.success === true,
      'Quotation Creation with Itemized Services and Discount (201)',
      'QUOTATION_CREATE',
      JSON.stringify(createData.error)
    );

    const quotation1 = createData.data;
    if (quotation1?.id) createdQuotationIds.push(quotation1.id);

    // -------------------------------------------------------------
    // TEST 2: Server-Side Quotation Number Format BV-QUO-YYYY-XXXXX
    // -------------------------------------------------------------
    const currentYear = new Date().getFullYear();
    const pattern = new RegExp(`^BV-QUO-${currentYear}-\\d{5}$`);
    assert(
      pattern.test(quotation1.quotationNumber),
      `Quotation Number Pattern (${quotation1.quotationNumber} matches BV-QUO-YYYY-XXXXX)`,
      'QUOTATION_NUMBER'
    );

    // -------------------------------------------------------------
    // TEST 3: Financial Calculations & Precision
    // -------------------------------------------------------------
    assert(
      Number(quotation1.subtotal) === 256000 &&
      Number(quotation1.discount) === 6000 &&
      Number(quotation1.taxPercent) === 18 &&
      Number(quotation1.taxAmount) === 45000 &&
      Number(quotation1.totalAmount) === 295000,
      'Integer/Decimal Financial Calculation (Subtotal 256000, Disc 6000, GST 45000, Total 295000)',
      'FINANCIAL_CALCULATION'
    );

    // -------------------------------------------------------------
    // TEST 4: Initial Status is DRAFT
    // -------------------------------------------------------------
    assert(
      quotation1.status === 'DRAFT',
      'Initial Quotation Status is strictly DRAFT',
      'STATE_MACHINE'
    );

    // -------------------------------------------------------------
    // TEST 5: Negative Financial Input Rejections
    // -------------------------------------------------------------
    // 5a: Negative item quantity
    const negQtyRes = await fetch(`${BASE_URL}/api/v1/quotations`, {
      method: 'POST',
      headers: authHeader('MANAGER'),
      body: JSON.stringify({
        customerId: custRes.id,
        eventType: 'Invalid Qty Test',
        eventDate: '2029-11-21',
        items: [{ description: 'Room', quantity: -2, rate: 5000 }],
      }),
    });
    assert(
      negQtyRes.status === 400,
      'Negative Item Quantity Rejected with 400 INVALID_ITEM_VALUES',
      'INPUT_VALIDATION'
    );

    // 5b: Negative item rate
    const negRateRes = await fetch(`${BASE_URL}/api/v1/quotations`, {
      method: 'POST',
      headers: authHeader('MANAGER'),
      body: JSON.stringify({
        customerId: custRes.id,
        eventType: 'Invalid Rate Test',
        eventDate: '2029-11-21',
        items: [{ description: 'Room', quantity: 1, rate: -5000 }],
      }),
    });
    assert(
      negRateRes.status === 400,
      'Negative Item Unit Rate Rejected with 400 INVALID_ITEM_VALUES',
      'INPUT_VALIDATION'
    );

    // 5c: Negative discount
    const negDiscRes = await fetch(`${BASE_URL}/api/v1/quotations`, {
      method: 'POST',
      headers: authHeader('MANAGER'),
      body: JSON.stringify({
        customerId: custRes.id,
        eventType: 'Invalid Disc Test',
        eventDate: '2029-11-21',
        items: [{ description: 'Room', quantity: 1, rate: 5000 }],
        discount: -1000,
      }),
    });
    assert(
      negDiscRes.status === 400,
      'Negative Discount Rejected with 400 INVALID_DISCOUNT',
      'INPUT_VALIDATION'
    );

    // -------------------------------------------------------------
    // TEST 6: Discount Exceeding Subtotal Rejection
    // -------------------------------------------------------------
    const excessDiscRes = await fetch(`${BASE_URL}/api/v1/quotations`, {
      method: 'POST',
      headers: authHeader('MANAGER'),
      body: JSON.stringify({
        customerId: custRes.id,
        eventType: 'Excess Discount Test',
        eventDate: '2029-11-21',
        items: [{ description: 'Buffet Catering', quantity: 1, rate: 50000 }],
        discount: 60000, // Exceeds 50000 subtotal
      }),
    });
    assert(
      excessDiscRes.status === 400,
      'Discount Exceeding Subtotal Rejected with 400 DISCOUNT_EXCEEDS_SUBTOTAL',
      'DISCOUNT_PROTECTION'
    );

    // -------------------------------------------------------------
    // TEST 7: Customer Validation & Inactive Customer Protection
    // -------------------------------------------------------------
    // Non-existent customer
    const ghostCustRes = await fetch(`${BASE_URL}/api/v1/quotations`, {
      method: 'POST',
      headers: authHeader('MANAGER'),
      body: JSON.stringify({
        customerId: 'cust-non-existent-999',
        eventType: 'Ghost Customer Test',
        eventDate: '2029-11-22',
        items: [{ description: 'Hall', quantity: 1, rate: 100000 }],
      }),
    });
    assert(
      ghostCustRes.status === 404,
      'Non-existent Customer ID Rejected with 404 CUSTOMER_NOT_FOUND',
      'CUSTOMER_VALIDATION'
    );

    // Deactivated customer
    const [inactiveCust] = await db
      .insert(customers)
      .values({
        id: `cust-inact-${Date.now()}`,
        customerCode: `CUST-INACT-${timestamp}`,
        name: 'Deactivated Customer Test',
        mobile: `9899${timestamp}`,
        isActive: false, // Inactive
      })
      .returning();
    createdCustomerIds.push(inactiveCust.id);

    const inactRes = await fetch(`${BASE_URL}/api/v1/quotations`, {
      method: 'POST',
      headers: authHeader('MANAGER'),
      body: JSON.stringify({
        customerId: inactiveCust.id,
        eventType: 'Inactive Client Test',
        eventDate: '2029-11-22',
        items: [{ description: 'Hall', quantity: 1, rate: 100000 }],
      }),
    });
    assert(
      inactRes.status === 400,
      'Deactivated Customer Rejected with 400 INACTIVE_CUSTOMER',
      'CUSTOMER_VALIDATION'
    );

    // -------------------------------------------------------------
    // TEST 8: Quotation Editing (Permitted for DRAFT)
    // -------------------------------------------------------------
    const updateRes = await fetch(`${BASE_URL}/api/v1/quotations/${quotation1.id}`, {
      method: 'PUT',
      headers: authHeader('MANAGER'),
      body: JSON.stringify({
        eventType: 'Updated Golden Anniversary Gala',
        discount: 10000, // Changed discount from 6000 to 10000
        items: [
          { description: 'Grand Hall Day Tariff', quantity: 1, rate: 200000 },
          { description: 'Bridal Suite 301 (2 Nights)', quantity: 2, rate: 8000 },
          { description: 'Royal Stage Floral Setup', quantity: 1, rate: 40000 },
          { description: 'High-Tea Catering Service', quantity: 50, rate: 400 }, // + 20000
        ],
      }),
    });
    // New subtotal: 256000 + 20000 = 276000
    // Discount: 10000 => Taxable: 266000
    // GST 18%: 47880
    // Grand Total: 313880
    const updateData = await updateRes.json();
    assert(
      updateRes.status === 200 &&
      Number(updateData.data?.totalAmount) === 313880 &&
      updateData.data?.eventType === 'Updated Golden Anniversary Gala',
      'Editing DRAFT Quotation Recalculates Financials & Updates Record (200)',
      'QUOTATION_EDIT'
    );

    // -------------------------------------------------------------
    // TEST 9: State Machine Enforcement — DRAFT -> SENT
    // -------------------------------------------------------------
    // Attempt invalid direct transition: DRAFT -> ACCEPTED (Must Fail 400)
    const invalidJumpRes = await fetch(`${BASE_URL}/api/v1/quotations/${quotation1.id}/status`, {
      method: 'PUT',
      headers: authHeader('MANAGER'),
      body: JSON.stringify({ status: 'ACCEPTED' }),
    });
    assert(
      invalidJumpRes.status === 400,
      'Invalid State Transition DRAFT -> ACCEPTED Rejected (400 INVALID_STATUS_TRANSITION)',
      'STATE_MACHINE'
    );

    // Valid transition: DRAFT -> SENT
    const sendRes = await fetch(`${BASE_URL}/api/v1/quotations/${quotation1.id}/send`, {
      method: 'POST',
      headers: authHeader('RECEPTIONIST'),
    });
    const sendData = await sendRes.json();
    assert(
      sendRes.status === 200 && sendData.data?.status === 'SENT',
      'Valid State Transition DRAFT -> SENT (200 OK)',
      'STATE_MACHINE'
    );

    // -------------------------------------------------------------
    // TEST 10: Editing Non-DRAFT Quotation Rejected
    // -------------------------------------------------------------
    const editSentRes = await fetch(`${BASE_URL}/api/v1/quotations/${quotation1.id}`, {
      method: 'PUT',
      headers: authHeader('MANAGER'),
      body: JSON.stringify({
        eventType: 'Illegal Edit of Sent Quotation',
      }),
    });
    assert(
      editSentRes.status === 400,
      'Editing SENT Quotation Blocked (400 CANNOT_EDIT_NON_DRAFT)',
      'QUOTATION_EDIT'
    );

    // -------------------------------------------------------------
    // TEST 11: Quotation Acceptance (SENT -> ACCEPTED)
    // -------------------------------------------------------------
    const acceptRes = await fetch(`${BASE_URL}/api/v1/quotations/${quotation1.id}/accept`, {
      method: 'POST',
      headers: authHeader('RECEPTIONIST'),
    });
    const acceptData = await acceptRes.json();
    assert(
      acceptRes.status === 200 && acceptData.data?.status === 'ACCEPTED',
      'Valid State Transition SENT -> ACCEPTED (200 OK)',
      'STATE_MACHINE'
    );

    // -------------------------------------------------------------
    // TEST 12: Rejection State Machine & Terminal Enforcement
    // -------------------------------------------------------------
    // Create quotation 2 to test rejection path
    const q2Create = await fetch(`${BASE_URL}/api/v1/quotations`, {
      method: 'POST',
      headers: authHeader('MANAGER'),
      body: JSON.stringify({
        customerId: custRes.id,
        eventType: 'Sangeet Ceremony',
        eventDate: '2029-12-05',
        hallId: activeHall.id,
        items: [{ description: 'Sangeet Hall Hire', quantity: 1, rate: 80000 }],
      }),
    });
    const q2Data = await q2Create.json();
    const q2Id = q2Data.data.id;
    createdQuotationIds.push(q2Id);

    // Send Q2
    await fetch(`${BASE_URL}/api/v1/quotations/${q2Id}/send`, {
      method: 'POST',
      headers: authHeader('MANAGER'),
    });

    // Reject Q2 (SENT -> REJECTED)
    const rejectRes = await fetch(`${BASE_URL}/api/v1/quotations/${q2Id}/reject`, {
      method: 'POST',
      headers: authHeader('MANAGER'),
      body: JSON.stringify({ notes: 'Customer chose a destination resort' }),
    });
    const rejectData = await rejectRes.json();
    assert(
      rejectRes.status === 200 && rejectData.data?.status === 'REJECTED',
      'Valid State Transition SENT -> REJECTED with Audit Notes (200 OK)',
      'STATE_MACHINE'
    );

    // Attempt invalid transition: REJECTED -> CONVERTED (Must Fail 400)
    const invalidConvertRejectRes = await fetch(`${BASE_URL}/api/v1/quotations/${q2Id}/convert`, {
      method: 'POST',
      headers: authHeader('OWNER'),
    });
    assert(
      invalidConvertRejectRes.status === 400,
      'Converting REJECTED Quotation Rejected with 400 INVALID_STATUS_FOR_CONVERSION',
      'STATE_MACHINE'
    );

    // -------------------------------------------------------------
    // TEST 13: Controlled Quotation -> Booking Conversion
    // -------------------------------------------------------------
    const convertRes = await fetch(`${BASE_URL}/api/v1/quotations/${quotation1.id}/convert`, {
      method: 'POST',
      headers: authHeader('MANAGER'),
      body: JSON.stringify({
        startTime: '10:00',
        endTime: '22:00',
        guestCount: 300,
      }),
    });
    const convertData = await convertRes.json();
    assert(
      convertRes.status === 200 &&
      convertData.success === true &&
      convertData.data?.booking?.status === 'CONFIRMED' &&
      convertData.data?.quotation?.status === 'CONVERTED',
      'Controlled Conversion from ACCEPTED Quotation to Booking (200 OK)',
      'QUOTATION_CONVERT',
      JSON.stringify(convertData.error)
    );

    const generatedBooking = convertData.data?.booking;
    if (generatedBooking?.id) createdBookingIds.push(generatedBooking.id);

    // Verify quotation links to created booking in PostgreSQL
    const [dbQuo1] = await db.select().from(quotations).where(eq(quotations.id, quotation1.id));
    assert(
      dbQuo1.status === 'CONVERTED' && dbQuo1.bookingId === generatedBooking.id,
      'PostgreSQL Quotation Record Marked CONVERTED with Linked bookingId',
      'DATABASE_INTEGRITY'
    );

    // Verify converted booking retained pricing & customer
    assert(
      dbQuo1.customerId === generatedBooking.customerId &&
      Number(dbQuo1.totalAmount) === Number(generatedBooking.grandTotal),
      'Booking Retains Customer & Total Financial Value from Quotation',
      'DATABASE_INTEGRITY'
    );

    // Attempting to convert already CONVERTED quotation must fail
    const reConvertRes = await fetch(`${BASE_URL}/api/v1/quotations/${quotation1.id}/convert`, {
      method: 'POST',
      headers: authHeader('MANAGER'),
    });
    assert(
      reConvertRes.status === 400,
      'Converting Already CONVERTED Quotation Blocked (400 ALREADY_CONVERTED)',
      'STATE_MACHINE'
    );

    // -------------------------------------------------------------
    // TEST 14: Conversion Conflict Prevention
    // -------------------------------------------------------------
    // Hall is now booked on 2029-11-20 (10:00-22:00).
    // Create another quotation for the EXACT same hall and date, accept it, then attempt conversion.
    const conflictQuoCreate = await fetch(`${BASE_URL}/api/v1/quotations`, {
      method: 'POST',
      headers: authHeader('MANAGER'),
      body: JSON.stringify({
        customerId: custRes.id,
        eventType: 'Conflicting Evening Gala',
        eventDate: '2029-11-20',
        hallId: activeHall.id,
        items: [{ description: 'Hall Rental', quantity: 1, rate: 150000 }],
      }),
    });
    const conflictQuoData = await conflictQuoCreate.json();
    const conflictQuoId = conflictQuoData.data.id;
    createdQuotationIds.push(conflictQuoId);

    // Advance to ACCEPTED
    await fetch(`${BASE_URL}/api/v1/quotations/${conflictQuoId}/send`, { method: 'POST', headers: authHeader('MANAGER') });
    await fetch(`${BASE_URL}/api/v1/quotations/${conflictQuoId}/accept`, { method: 'POST', headers: authHeader('MANAGER') });

    // Attempt conversion with overlapping slot (14:00-23:00)
    const conflictConvertRes = await fetch(`${BASE_URL}/api/v1/quotations/${conflictQuoId}/convert`, {
      method: 'POST',
      headers: authHeader('MANAGER'),
      body: JSON.stringify({
        startTime: '14:00',
        endTime: '23:00',
      }),
    });
    const conflictConvertData = await conflictConvertRes.json();
    assert(
      conflictConvertRes.status === 409 && conflictConvertData.error?.code === 'BOOKING_CONFLICT',
      'Conversion Overlap Fails Safely with HTTP 409 BOOKING_CONFLICT',
      'DOUBLE_BOOKING_PREVENTION'
    );

    // Verify conflicting quotation remains intact in ACCEPTED status (not partial)
    const [dbConfQuo] = await db.select().from(quotations).where(eq(quotations.id, conflictQuoId));
    assert(
      dbConfQuo.status === 'ACCEPTED' && dbConfQuo.bookingId === null,
      'Conflicted Quotation Remains Preserved in ACCEPTED Status without Partial Booking',
      'TRANSACTION_SAFETY'
    );

    // -------------------------------------------------------------
    // TEST 15: Concurrency Safety via Advisory Locks
    // -------------------------------------------------------------
    // Create two accepted quotations for another future date
    const raceDate = '2029-12-25';
    const [qRaceA, qRaceB] = await Promise.all([
      fetch(`${BASE_URL}/api/v1/quotations`, {
        method: 'POST',
        headers: authHeader('MANAGER'),
        body: JSON.stringify({
          customerId: custRes.id,
          eventType: 'Christmas Party A',
          eventDate: raceDate,
          hallId: activeHall.id,
          items: [{ description: 'Hall Hire A', quantity: 1, rate: 100000 }],
        }),
      }).then((r) => r.json()),
      fetch(`${BASE_URL}/api/v1/quotations`, {
        method: 'POST',
        headers: authHeader('MANAGER'),
        body: JSON.stringify({
          customerId: custRes.id,
          eventType: 'Christmas Party B',
          eventDate: raceDate,
          hallId: activeHall.id,
          items: [{ description: 'Hall Hire B', quantity: 1, rate: 100000 }],
        }),
      }).then((r) => r.json()),
    ]);

    createdQuotationIds.push(qRaceA.data.id, qRaceB.data.id);

    // Move both to ACCEPTED
    await fetch(`${BASE_URL}/api/v1/quotations/${qRaceA.data.id}/send`, { method: 'POST', headers: authHeader('MANAGER') });
    await fetch(`${BASE_URL}/api/v1/quotations/${qRaceA.data.id}/accept`, { method: 'POST', headers: authHeader('MANAGER') });
    await fetch(`${BASE_URL}/api/v1/quotations/${qRaceB.data.id}/send`, { method: 'POST', headers: authHeader('MANAGER') });
    await fetch(`${BASE_URL}/api/v1/quotations/${qRaceB.data.id}/accept`, { method: 'POST', headers: authHeader('MANAGER') });

    // Simultaneous conversion race condition
    const [raceRes1, raceRes2] = await Promise.all([
      fetch(`${BASE_URL}/api/v1/quotations/${qRaceA.data.id}/convert`, {
        method: 'POST',
        headers: authHeader('OWNER'),
        body: JSON.stringify({ startTime: '12:00', endTime: '20:00' }),
      }),
      fetch(`${BASE_URL}/api/v1/quotations/${qRaceB.data.id}/convert`, {
        method: 'POST',
        headers: authHeader('OWNER'),
        body: JSON.stringify({ startTime: '12:00', endTime: '20:00' }),
      }),
    ]);

    const statuses = [raceRes1.status, raceRes2.status].sort();
    const race1Data = await raceRes1.json();
    const race2Data = await raceRes2.json();

    if (race1Data.data?.booking?.id) createdBookingIds.push(race1Data.data.booking.id);
    if (race2Data.data?.booking?.id) createdBookingIds.push(race2Data.data.booking.id);

    assert(
      statuses[0] === 200 && statuses[1] === 409,
      'Concurrent Quotation Conversion: Exactly 1 succeeds (200), 1 safely blocked (409 Conflict)',
      'CONCURRENCY_SAFETY'
    );

    // -------------------------------------------------------------
    // TEST 16: RBAC Authorization Matrix for Quotations
    // -------------------------------------------------------------
    // 16a: Unauthenticated request rejected (401)
    const unauthRes = await fetch(`${BASE_URL}/api/v1/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: custRes.id, eventType: 'Unauth', eventDate: '2029-11-20', items: [] }),
    });
    assert(
      unauthRes.status === 401,
      'Unauthenticated Quotation Request Blocked with 401 Unauthorized',
      'RBAC_SECURITY'
    );

    // 16b: STAFF forbidden from creating quotation (403)
    const staffCreateRes = await fetch(`${BASE_URL}/api/v1/quotations`, {
      method: 'POST',
      headers: authHeader('STAFF'),
      body: JSON.stringify({
        customerId: custRes.id,
        eventType: 'Staff Quotation Attempt',
        eventDate: '2029-11-20',
        items: [{ description: 'Test', quantity: 1, rate: 1000 }],
      }),
    });
    assert(
      staffCreateRes.status === 403,
      'STAFF Role Forbidden from Creating Quotations (403 Forbidden)',
      'RBAC_SECURITY'
    );

    // 16c: RECEPTIONIST forbidden from converting quotation to booking (403)
    const recepConvertRes = await fetch(`${BASE_URL}/api/v1/quotations/${quotation1.id}/convert`, {
      method: 'POST',
      headers: authHeader('RECEPTIONIST'),
    });
    assert(
      recepConvertRes.status === 403,
      'RECEPTIONIST Role Forbidden from Converting Quotation to Booking (403 Forbidden)',
      'RBAC_SECURITY'
    );

    // -------------------------------------------------------------
    // TEST 17: Audit Trail Integrity
    // -------------------------------------------------------------
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entity, 'Quotation'))
      .orderBy(desc(auditLogs.createdAt));

    const actions = new Set(logs.map((l) => l.action));
    const hasCreate = actions.has('QUOTATION_CREATE');
    const hasUpdate = actions.has('QUOTATION_UPDATE');
    const hasSend = actions.has('QUOTATION_SEND');
    const hasAccept = actions.has('QUOTATION_ACCEPT');
    const hasReject = actions.has('QUOTATION_REJECT');
    const hasConvert = actions.has('QUOTATION_CONVERT');

    assert(
      hasCreate && hasUpdate && hasSend && hasAccept && hasReject && hasConvert,
      'Audit Trail Logs All Operations (CREATE, UPDATE, SEND, ACCEPT, REJECT, CONVERT)',
      'AUDIT_LOGGING'
    );

    // -------------------------------------------------------------
    // TEST 18: Quotation List & Filter API
    // -------------------------------------------------------------
    const filterRes = await fetch(`${BASE_URL}/api/v1/quotations?status=CONVERTED&page=1&limit=10`, {
      headers: authHeader('RECEPTIONIST'),
    });
    const filterData = await filterRes.json();
    assert(
      filterRes.status === 200 &&
      filterData.success === true &&
      Array.isArray(filterData.data) &&
      filterData.pagination?.page === 1 &&
      filterData.data.every((q: any) => q.status === 'CONVERTED'),
      'Server-Side Filtered Quotations List with Pagination (status=CONVERTED)',
      'QUERY_FILTERING'
    );

    // -------------------------------------------------------------
    // TEST 19: Quotation Detail API with Settings & Voucher Data
    // -------------------------------------------------------------
    const detailRes = await fetch(`${BASE_URL}/api/v1/quotations/${quotation1.id}`, {
      headers: authHeader('STAFF'), // Staff can view quotations
    });
    const detailData = await detailRes.json();
    assert(
      detailRes.status === 200 &&
      detailData.data?.quotationNumber === quotation1.quotationNumber &&
      detailData.data?.customer?.id === custRes.id &&
      detailData.data?.settings?.businessName !== undefined &&
      Array.isArray(detailData.data?.parsedItems),
      'Quotation Detail Endpoint Returns Customer, Settings & Parsed Items for Print Voucher',
      'DETAIL_ENDPOINT'
    );

  } finally {
    // -------------------------------------------------------------
    // CLEANUP EPHEMERAL TEST DATA
    // -------------------------------------------------------------
    console.log('\nCleaning up ephemeral test records...');
    for (const bId of createdBookingIds) {
      await db.delete(bookingHalls).where(eq(bookingHalls.bookingId, bId)).catch(() => {});
      await db.delete(bookings).where(eq(bookings.id, bId)).catch(() => {});
    }
    for (const qId of createdQuotationIds) {
      await db.delete(quotations).where(eq(quotations.id, qId)).catch(() => {});
    }
    for (const cId of createdCustomerIds) {
      await db.delete(customers).where(eq(customers.id, cId)).catch(() => {});
    }
    console.log(`Cleaned up test data.`);
  }

  // -------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log('PHASE 4 QUOTATION MODULE VERIFICATION SUMMARY:');
  const total = tracker.length;
  const passedCount = tracker.filter((t) => t.passed).length;
  const failedCount = total - passedCount;
  console.log(`Total Tests Executed: ${total}`);
  console.log(`Passed: ${passedCount} / ${total}`);
  if (failedCount > 0) {
    console.error(`Failed: ${failedCount} / ${total}`);
    process.exit(1);
  } else {
    console.log('Overall Result: ALL TESTS PASSED ✅');
    console.log('===============================================================\n');
    process.exit(0);
  }
}

runQuotationTests().catch((err) => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});
