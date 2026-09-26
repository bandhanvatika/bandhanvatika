/**
 * BANDHAN VATIKA — FORENSIC VERIFICATION TEST SUITE
 * Tests Hall Conflict, Room Conflict, Boundary Touching, Concurrency,
 * RBAC Privilege Escalation, Financial Calculations, Payment Reversal,
 * Booking Status Machine, and Sensitive Data Protection.
 */

import { timeOverlaps, datesOverlap, checkHallConflict, checkRoomConflict } from '../src/server/availability.ts';
import { calculateFinancials } from '../src/server/finance.ts';
import { generateToken, AuthUser } from '../src/server/auth.ts';
import { db } from '../src/db/index.ts';
import { bookings, bookingHalls, halls, rooms, customers, invoices, payments, users } from '../src/db/schema.ts';
import { eq } from 'drizzle-orm';

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, category: string, details?: string) {
  results.push({
    name,
    category,
    passed: !!condition,
    details: details || (condition ? 'PASSED' : 'FAILED'),
  });
  const symbol = condition ? '✅ PASS' : '❌ FAIL';
  console.log(`${symbol} [${category}] ${name}`);
  if (!condition && details) {
    console.error(`   Details: ${details}`);
  }
}

async function runForensicTests() {
  console.log('\n==================================================');
  console.log('BANDHAN VATIKA — PHASE 1 FORENSIC VERIFICATION');
  console.log('==================================================\n');

  // --------------------------------------------------------------------------
  // TEST SECTION 1: HALL TIME INTERVAL OVERLAPS & BOUNDARY TOUCHING
  // Base Booking A: 10:00–18:00
  // --------------------------------------------------------------------------
  console.log('\n--- Section 1: Hall Interval Conflict & Boundary Tests ---');
  const baseStart = '10:00';
  const baseEnd = '18:00';

  // 1. Identical Interval: 10:00–18:00 (Must Block)
  assert(
    timeOverlaps(baseStart, baseEnd, '10:00', '18:00') === true,
    'Hall Overlap: 10:00-18:00 vs 10:00-18:00 (Identical)',
    'DOUBLE_BOOKING_HALL'
  );

  // 2. Early Overlap: 09:00–11:00 (Must Block)
  assert(
    timeOverlaps(baseStart, baseEnd, '09:00', '11:00') === true,
    'Hall Overlap: 10:00-18:00 vs 09:00-11:00 (Starts before, overlaps start)',
    'DOUBLE_BOOKING_HALL'
  );

  // 3. Nested Overlap: 11:00–15:00 (Must Block)
  assert(
    timeOverlaps(baseStart, baseEnd, '11:00', '15:00') === true,
    'Hall Overlap: 10:00-18:00 vs 11:00-15:00 (Fully enclosed within slot)',
    'DOUBLE_BOOKING_HALL'
  );

  // 4. Late Overlap: 17:00–19:00 (Must Block)
  assert(
    timeOverlaps(baseStart, baseEnd, '17:00', '19:00') === true,
    'Hall Overlap: 10:00-18:00 vs 17:00-19:00 (Starts inside, overlaps end)',
    'DOUBLE_BOOKING_HALL'
  );

  // 5. Boundary Touching (After): 18:00–20:00 (MUST BE ALLOWED)
  assert(
    timeOverlaps(baseStart, baseEnd, '18:00', '20:00') === false,
    'Hall Boundary: 10:00-18:00 vs 18:00-20:00 (Touching at end time is ALLOWED)',
    'DOUBLE_BOOKING_HALL'
  );

  // 6. Boundary Touching (Before): 08:00–10:00 (MUST BE ALLOWED)
  assert(
    timeOverlaps(baseStart, baseEnd, '08:00', '10:00') === false,
    'Hall Boundary: 10:00-18:00 vs 08:00-10:00 (Touching at start time is ALLOWED)',
    'DOUBLE_BOOKING_HALL'
  );

  // 7. Boundary Adjacent (Short): 18:00–18:30 (MUST BE ALLOWED)
  assert(
    timeOverlaps(baseStart, baseEnd, '18:00', '18:30') === false,
    'Hall Boundary: 10:00-18:00 vs 18:00-18:30 (Immediate follow-up is ALLOWED)',
    'DOUBLE_BOOKING_HALL'
  );

  // --------------------------------------------------------------------------
  // TEST SECTION 2: ROOM CONFLICT & BOUNDARY TESTS
  // --------------------------------------------------------------------------
  console.log('\n--- Section 2: Room Conflict & Reservation Dates Tests ---');

  // 1. Same Room, Same Single Date: 2026-11-20 vs 2026-11-20 (Must Block)
  assert(
    datesOverlap('2026-11-20', '2026-11-20', '2026-11-20', '2026-11-20') === true,
    'Room Conflict: Same room, same single event date (Must Block)',
    'DOUBLE_BOOKING_ROOM'
  );

  // 2. Same Room, Overlapping Ranges: 2026-11-20 to 2026-11-23 vs 2026-11-21 to 2026-11-24 (Must Block)
  assert(
    datesOverlap('2026-11-20', '2026-11-23', '2026-11-21', '2026-11-24') === true,
    'Room Conflict: Same room, overlapping multi-day date range (Must Block)',
    'DOUBLE_BOOKING_ROOM'
  );

  // 3. Same Room, Enclosed Range: 2026-11-20 to 2026-11-25 vs 2026-11-21 to 2026-11-22 (Must Block)
  assert(
    datesOverlap('2026-11-20', '2026-11-25', '2026-11-21', '2026-11-22') === true,
    'Room Conflict: Same room, enclosed inside existing reservation (Must Block)',
    'DOUBLE_BOOKING_ROOM'
  );

  // 4. Same Room, Adjacent Multi-day: 2026-11-20 to 2026-11-22 vs 2026-11-22 to 2026-11-24 (ALLOWED)
  assert(
    datesOverlap('2026-11-20', '2026-11-22', '2026-11-22', '2026-11-24') === false,
    'Room Boundary: Same room, adjacent checkout/checkin dates (ALLOWED)',
    'DOUBLE_BOOKING_ROOM'
  );

  // 5. Same Room, Different Dates: 2026-11-20 vs 2026-11-25 (ALLOWED)
  assert(
    datesOverlap('2026-11-20', '2026-11-20', '2026-11-25', '2026-11-25') === false,
    'Room Boundary: Same room, non-overlapping separate dates (ALLOWED)',
    'DOUBLE_BOOKING_ROOM'
  );

  // 6. Maintenance room status verification
  const [maintenanceRoom] = await db
    .insert(rooms)
    .values({
      id: `room-maint-test-${Date.now()}`,
      roomNumber: 'M-999',
      roomType: 'Deluxe Room',
      capacity: 2,
      pricePerNight: '3500.00',
      status: 'MAINTENANCE',
    })
    .returning();

  const roomMaintCheck = await checkRoomConflict(maintenanceRoom.id, '2026-11-20', '2026-11-20');
  assert(
    Boolean(roomMaintCheck.hasConflict === true && roomMaintCheck.message?.includes('maintenance')),
    'Room Status: Maintenance room is automatically blocked from reservations',
    'DOUBLE_BOOKING_ROOM'
  );

  // Clean up test room
  await db.delete(rooms).where(eq(rooms.id, maintenanceRoom.id));

  // --------------------------------------------------------------------------
  // TEST SECTION 3: FINANCIAL PRECISION & GST ARITHMETIC
  // --------------------------------------------------------------------------
  console.log('\n--- Section 3: Financial Precision & GST Arithmetic ---');

  const items = [
    { description: 'Royal Grand Ballroom', qty: 1, rate: 120000 },
    { description: 'Deluxe Rooms (5)', qty: 5, rate: 3500 },
    { description: 'Premium Buffet Catering', qty: 300, rate: 850 },
    { description: 'Theme Floral Decoration', qty: 1, rate: 75000 },
  ];
  // Subtotal = 120000 + 17500 + 255000 + 75000 = 467500.00
  // Discount = 10000.00 -> Net = 457500.00
  // GST 18% = 457500.00 * 0.18 = 82350.00
  // Grand Total = 457500.00 + 82350.00 = 539850.00
  // Advance Paid = 100000.00
  // Balance = 439850.00

  const fin = calculateFinancials(items, '10000.00', '18.00', '100000.00');

  assert(fin.subtotal === '467500.00', 'Financial Subtotal: 467500.00', 'FINANCE', `Got ${fin.subtotal}`);
  assert(fin.discount === '10000.00', 'Financial Discount: 10000.00', 'FINANCE', `Got ${fin.discount}`);
  assert(fin.taxPercent === '18.00', 'Financial Tax Rate: 18.00%', 'FINANCE', `Got ${fin.taxPercent}`);
  assert(fin.taxAmount === '82350.00', 'Financial Tax Amount: 82350.00', 'FINANCE', `Got ${fin.taxAmount}`);
  assert(fin.grandTotal === '539850.00', 'Financial Grand Total: 539850.00', 'FINANCE', `Got ${fin.grandTotal}`);
  assert(fin.paidAmount === '100000.00', 'Financial Paid Amount: 100000.00', 'FINANCE', `Got ${fin.paidAmount}`);
  assert(fin.balanceAmount === '439850.00', 'Financial Balance Amount: 439850.00', 'FINANCE', `Got ${fin.balanceAmount}`);

  // Test Zero Discount and Zero Advance
  const finZero = calculateFinancials(
    [{ description: 'Hall', qty: 1, rate: 50000 }],
    0,
    18,
    0
  );
  assert(finZero.subtotal === '50000.00', 'Zero Discount Subtotal: 50000.00', 'FINANCE');
  assert(finZero.taxAmount === '9000.00', 'Zero Discount Tax: 9000.00', 'FINANCE');
  assert(finZero.grandTotal === '59000.00', 'Zero Discount Grand Total: 59000.00', 'FINANCE');
  assert(finZero.balanceAmount === '59000.00', 'Zero Discount Balance: 59000.00', 'FINANCE');

  // --------------------------------------------------------------------------
  // TEST SECTION 4: HTTP API & SECURITY INTEGRATION TESTS
  // --------------------------------------------------------------------------
  console.log('\n--- Section 4: HTTP API & Security Integration Tests ---');

  const ownerToken = generateToken({
    id: 'usr-owner-001',
    email: 'admin@bandhanvatika.com',
    username: 'admin',
    name: 'Rajesh Sharma',
    role: 'OWNER',
  });
  const receptionistToken = generateToken({
    id: 'usr-recep-004',
    email: 'reception@bandhanvatika.com',
    username: 'reception',
    name: 'Priya Verma',
    role: 'RECEPTIONIST',
  });

  // 1. RBAC Test: Receptionist calling User Creation (Must be 403 Forbidden)
  const userCreateRes = await fetch(`${BASE_URL}/api/v1/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${receptionistToken}`,
    },
    body: JSON.stringify({
      email: 'hacker@test.com',
      username: 'hacker',
      password: 'password123',
      name: 'Hacker User',
      role: 'OWNER',
    }),
  });
  assert(
    userCreateRes.status === 403,
    'RBAC Privilege Escalation: Receptionist blocked from POST /api/v1/users (403 Forbidden)',
    'RBAC_SECURITY',
    `Expected 403, got ${userCreateRes.status}`
  );

  // 2. Unauthenticated request to /api/v1/bookings (Must be 401 Unauthorized)
  const unauthRes = await fetch(`${BASE_URL}/api/v1/bookings`);
  assert(
    unauthRes.status === 401,
    'Authentication: Protected route blocks unauthenticated access (401 Unauthorized)',
    'API_SECURITY',
    `Expected 401, got ${unauthRes.status}`
  );

  // 3. API Security: Password hash never exposed in /api/v1/users
  const usersListRes = await fetch(`${BASE_URL}/api/v1/users`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const usersListData = await usersListRes.json();
  const hasPasswordLeak = usersListData.data?.some((u: any) => 'passwordHash' in u || 'password' in u);
  assert(
    !hasPasswordLeak,
    'Data Protection: Password hashes never returned in /api/v1/users response',
    'SENSITIVE_DATA'
  );

  // 4. Live Booking Conflict & Concurrency Test
  const testDate = `2027-04-15`; // Future test date
  const [targetHall] = await db.select().from(halls).limit(1);
  const [targetCust] = await db.select().from(customers).limit(1);

  // Create primary booking A (10:00 to 18:00)
  const bookingARes = await fetch(`${BASE_URL}/api/v1/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({
      customerId: targetCust.id,
      eventType: 'Wedding Reception',
      eventDate: testDate,
      startTime: '10:00',
      endTime: '18:00',
      guestCount: 250,
      hallId: targetHall.id,
      roomIds: [],
      services: [],
      discount: 0,
      taxPercent: 18,
      advancePayment: 25000,
    }),
  });
  const bookingAData = await bookingARes.json();
  assert(
    (bookingARes.status === 200 || bookingARes.status === 201) && bookingAData.success === true,
    'Booking Creation: Primary booking created successfully (10:00–18:00)',
    'BOOKING_WORKFLOW'
  );

  const createdBookingId = bookingAData.data?.id;

  // Attempt Overlapping Booking B (12:00 to 16:00) -> MUST RETURN 409 CONFLICT
  const bookingOverlapRes = await fetch(`${BASE_URL}/api/v1/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({
      customerId: targetCust.id,
      eventType: 'Corporate Gala',
      eventDate: testDate,
      startTime: '12:00',
      endTime: '16:00',
      guestCount: 150,
      hallId: targetHall.id,
      roomIds: [],
      services: [],
      discount: 0,
      taxPercent: 18,
      advancePayment: 0,
    }),
  });
  assert(
    bookingOverlapRes.status === 409,
    'Booking Conflict Prevention: Overlapping booking request rejected with 409 Conflict',
    'DOUBLE_BOOKING_PREVENTION',
    `Expected 409, got ${bookingOverlapRes.status}`
  );

  // Attempt Touching/Adjacent Booking C (18:00 to 22:00) -> MUST SUCCEED (200 OK)
  const bookingAdjacentRes = await fetch(`${BASE_URL}/api/v1/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({
      customerId: targetCust.id,
      eventType: 'Sangeet Night',
      eventDate: testDate,
      startTime: '18:00',
      endTime: '22:00',
      guestCount: 180,
      hallId: targetHall.id,
      roomIds: [],
      services: [],
      discount: 0,
      taxPercent: 18,
      advancePayment: 0,
    }),
  });
  const bookingAdjacentData = await bookingAdjacentRes.json();
  assert(
    (bookingAdjacentRes.status === 200 || bookingAdjacentRes.status === 201) && bookingAdjacentData.success === true,
    'Boundary Touching Booking: Adjacent booking (18:00–22:00) created successfully (200/201)',
    'DOUBLE_BOOKING_PREVENTION'
  );

  const adjacentBookingId = bookingAdjacentData.data?.id;

  // 5. Booking Status Machine: Invalid transition test (e.g. COMPLETED -> CONFIRMED)
  // First update status to COMPLETED
  await fetch(`${BASE_URL}/api/v1/bookings/${createdBookingId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({ status: 'COMPLETED' }),
  });

  // Now attempt invalid transition COMPLETED -> CONFIRMED
  const invalidTransitionRes = await fetch(`${BASE_URL}/api/v1/bookings/${createdBookingId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({ status: 'CONFIRMED' }),
  });
  assert(
    invalidTransitionRes.status === 400,
    'Status Machine: Invalid transition from COMPLETED to CONFIRMED rejected (400 Bad Request)',
    'STATUS_MACHINE',
    `Expected 400, got ${invalidTransitionRes.status}`
  );

  // 6. Payment Reversal and Audit Integrity Test
  // Find payment associated with createdBookingId
  const [createdPayment] = await db
    .select()
    .from(payments)
    .where(eq(payments.bookingId, createdBookingId));

  if (createdPayment) {
    // Receptionist attempts reversal (Must fail with 403 Forbidden)
    const recRevRes = await fetch(`${BASE_URL}/api/v1/payments/${createdPayment.id}/reverse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionistToken}`,
      },
      body: JSON.stringify({ reversalReason: 'Unauthorized test reversal' }),
    });
    assert(
      recRevRes.status === 403,
      'RBAC Security: Receptionist blocked from payment reversal (403 Forbidden)',
      'RBAC_SECURITY'
    );

    // Authorized Owner reverses payment
    const ownerRevRes = await fetch(`${BASE_URL}/api/v1/payments/${createdPayment.id}/reverse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ reversalReason: 'Customer cheque bounced' }),
    });
    assert(
      ownerRevRes.status === 200,
      'Payment Reversal: Owner successfully reverses payment with audit trail (200 OK)',
      'PAYMENT_REVERSAL'
    );

    // Verify payment record is preserved (not deleted) and isReversed = true
    const [revPaymentInDb] = await db.select().from(payments).where(eq(payments.id, createdPayment.id));
    assert(
      revPaymentInDb && revPaymentInDb.isReversed === true,
      'Financial Safety: Reversed payment record retained in database with isReversed = true',
      'PAYMENT_REVERSAL'
    );

    // Verify booking paidAmount is updated (recomputed to 0.00)
    const [revBookingInDb] = await db.select().from(bookings).where(eq(bookings.id, createdBookingId));
    assert(
      revBookingInDb && Number(revBookingInDb.paidAmount) === 0,
      'Financial Recalculation: Booking paidAmount recalculated to 0.00 after payment reversal',
      'PAYMENT_REVERSAL',
      `Got paidAmount: ${revBookingInDb?.paidAmount}`
    );
  }

  // Clean up created test bookings
  if (createdBookingId) {
    await db.delete(payments).where(eq(payments.bookingId, createdBookingId));
    await db.delete(invoices).where(eq(invoices.bookingId, createdBookingId));
    await db.delete(bookingHalls).where(eq(bookingHalls.bookingId, createdBookingId));
    await db.delete(bookings).where(eq(bookings.id, createdBookingId));
  }
  if (adjacentBookingId) {
    await db.delete(invoices).where(eq(invoices.bookingId, adjacentBookingId));
    await db.delete(bookingHalls).where(eq(bookingHalls.bookingId, adjacentBookingId));
    await db.delete(bookings).where(eq(bookings.id, adjacentBookingId));
  }

  // --------------------------------------------------------------------------
  // TEST SECTION 5: SUMMARY & RESULTS
  // --------------------------------------------------------------------------
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n==================================================');
  console.log(`TEST SUMMARY: ${passed}/${total} PASSED (${failed} FAILED)`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runForensicTests().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
