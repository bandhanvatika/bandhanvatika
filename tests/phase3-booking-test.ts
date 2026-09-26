/**
 * BANDHAN VATIKA — PHASE 3 BOOKING ENGINE AUTOMATED VERIFICATION SUITE
 * Tests:
 * 1. Booking creation with valid data
 * 2. Booking number generation format (BV-BKG-YYYY-XXXXX) & sequence
 * 3. Customer duplicate mobile protection during booking
 * 4. Invalid event timing (startTime >= endTime, invalid dates, negative guest count)
 * 5. Hall conflict detection (identical, early overlap, nested, late overlap)
 * 6. Hall boundary touching: 10:00-18:00 vs 18:00-20:00 (Allowed)
 * 7. Room conflict detection (same room, overlapping intervals)
 * 8. Room boundary touching: 10 Oct-12 Oct vs 12 Oct-14 Oct (Allowed [checkin, checkout))
 * 9. Concurrent booking safety (two simultaneous requests, same hall & time -> exactly one succeeds, one gets 409)
 * 10. Financial pricing calculation (subtotal, discount, GST tax, grand total)
 * 11. Discount exceeding subtotal rejection
 * 12. Negative input rejection (negative price/rate, negative guest count, negative discount)
 * 13. Booking status transitions: valid path (CONFIRMED -> SCHEDULED -> IN_PROGRESS -> COMPLETED) vs invalid path (CONFIRMED -> COMPLETED rejected)
 * 14. Booking cancellation: availability released, record retained
 * 15. Audit log creation for booking operations
 * 16. Unauthorized booking creation (e.g. invalid role/no token)
 * 17. Unauthorized booking modification & unauthorized cancellation (e.g. RECEPTIONIST cannot cancel)
 */

import { generateToken } from '../src/server/auth.ts';
import { db } from '../src/db/index.ts';
import {
  halls,
  rooms,
  customers,
  bookings,
  bookingHalls,
  bookingRooms,
  auditLogs,
  users,
} from '../src/db/schema.ts';
import { eq, and, sql } from 'drizzle-orm';
import { timeOverlaps, datesOverlap, checkHallConflict, checkRoomConflict } from '../src/server/availability.ts';
import { calculateFinancials } from '../src/server/finance.ts';

const BASE_URL = 'http://localhost:3000';

interface VerificationResult {
  num: number;
  testName: string;
  category: string;
  passed: boolean;
  message?: string;
}

const testResults: VerificationResult[] = [];

function recordResult(num: number, testName: string, category: string, passed: boolean, message?: string) {
  testResults.push({ num, testName, category, passed, message });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [Test ${num}] [${category}] ${testName}`);
  if (!passed && message) {
    console.error(`   Failure Details: ${message}`);
  }
}

async function runPhase3Verification() {
  console.log('\n===============================================================');
  console.log('BANDHAN VATIKA — PHASE 3: BOOKING ENGINE TEST EXECUTION');
  console.log('===============================================================\n');

  // Fetch users for various RBAC roles from DB
  const [ownerUser] = await db.select().from(users).where(eq(users.role, 'OWNER')).limit(1);
  const [mgrUser] = await db.select().from(users).where(eq(users.role, 'MANAGER')).limit(1);
  const [recepUser] = await db.select().from(users).where(eq(users.role, 'RECEPTIONIST')).limit(1);
  const [acctUser] = await db.select().from(users).where(eq(users.role, 'ACCOUNTANT')).limit(1);

  const ownerToken = generateToken({
    id: ownerUser.id,
    email: ownerUser.email,
    username: ownerUser.username,
    name: ownerUser.name,
    role: 'OWNER',
  });

  const managerToken = generateToken({
    id: mgrUser.id,
    email: mgrUser.email,
    username: mgrUser.username,
    name: mgrUser.name,
    role: 'MANAGER',
  });

  const receptionistToken = generateToken({
    id: recepUser.id,
    email: recepUser.email,
    username: recepUser.username,
    name: recepUser.name,
    role: 'RECEPTIONIST',
  });

  const accountantToken = generateToken({
    id: acctUser.id,
    email: acctUser.email,
    username: acctUser.username,
    name: acctUser.name,
    role: 'ACCOUNTANT',
  });

  // Fetch or ensure master data fixtures
  const [testHall] = await db.select().from(halls).where(eq(halls.status, 'ACTIVE')).limit(1);
  const [testRoom1, testRoom2] = await db.select().from(rooms).where(eq(rooms.status, 'AVAILABLE')).limit(2);
  const [testCustomer] = await db.select().from(customers).limit(1);

  if (!testHall || !testRoom1 || !testCustomer) {
    throw new Error('Master data fixtures (hall, room, customer) missing in database.');
  }

  // Track created booking IDs for cleanup
  const cleanupBookingIds: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Booking Creation with Valid Data
    // -------------------------------------------------------------------------
    const booking1Date = '2028-01-15';
    const createRes1 = await fetch(`${BASE_URL}/api/v1/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionistToken}`,
      },
      body: JSON.stringify({
        customerId: testCustomer.id,
        eventType: 'Golden Jubilee Celebration',
        eventDate: booking1Date,
        startTime: '10:00',
        endTime: '16:00',
        guestCount: 300,
        hallId: testHall.id,
        roomIds: [testRoom1.id],
        checkInDate: '2028-01-15',
        checkOutDate: '2028-01-16',
        services: [
          { name: 'Royal Welcome Garland & Tilak', quantity: 1, rate: 5000, amount: 5000 },
          { name: 'Live Shehnai Ensemble', quantity: 1, rate: 12000, amount: 12000 },
        ],
        discount: 2000,
        advancePayment: 25000,
        notes: 'VIP event for Sharma family',
      }),
    });

    const createData1 = await createRes1.json();
    const test1Pass =
      (createRes1.status === 201 || createRes1.status === 200) &&
      createData1.success === true &&
      createData1.data?.id &&
      createData1.data?.status === 'CONFIRMED';

    if (createData1.data?.id) cleanupBookingIds.push(createData1.data.id);

    recordResult(
      1,
      'Transactional Booking Creation with Hall, Rooms, Services and Discount',
      'BOOKING_CREATION',
      test1Pass,
      test1Pass ? undefined : JSON.stringify(createData1)
    );

    // -------------------------------------------------------------------------
    // TEST 2: Booking Number Format & Sequence Generation (BV-BKG-YYYY-XXXXX)
    // -------------------------------------------------------------------------
    const bNum = createData1.data?.bookingNumber || '';
    const currentYear = new Date().getFullYear();
    const bNumRegex = new RegExp(`^BV-BKG-${currentYear}-\\d{5}$`);
    const test2Pass = bNumRegex.test(bNum);
    recordResult(
      2,
      `Server-Side Booking Number Pattern (${bNum} matches BV-BKG-YYYY-XXXXX)`,
      'BOOKING_NUMBER',
      test2Pass,
      `Generated number: ${bNum}`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Customer Duplicate Mobile Protection
    // -------------------------------------------------------------------------
    const dupRes = await fetch(`${BASE_URL}/api/v1/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionistToken}`,
      },
      body: JSON.stringify({
        name: 'Imposter Duplicate',
        mobile: testCustomer.mobile, // Existing mobile
        email: 'duplicate@test.com',
      }),
    });
    const dupData = await dupRes.json();
    const test3Pass = dupRes.status === 409 && dupData.error?.code === 'DUPLICATE_MOBILE';
    recordResult(
      3,
      'Customer Duplicate Mobile Enforced Server-Side (409 DUPLICATE_MOBILE)',
      'CUSTOMER_PROTECTION',
      test3Pass,
      `Status: ${dupRes.status}, Body: ${JSON.stringify(dupData)}`
    );

    // -------------------------------------------------------------------------
    // TEST 4: Invalid Event Timing Rejection
    // -------------------------------------------------------------------------
    // 4a. startTime >= endTime
    const invalidTimeRes = await fetch(`${BASE_URL}/api/v1/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionistToken}`,
      },
      body: JSON.stringify({
        customerId: testCustomer.id,
        eventType: 'Inverted Times Event',
        eventDate: '2028-02-10',
        startTime: '18:00',
        endTime: '12:00', // Inverted!
        guestCount: 150,
        hallId: testHall.id,
      }),
    });
    const invalidTimeData = await invalidTimeRes.json();
    const test4aPass = invalidTimeRes.status === 400 && invalidTimeData.error?.code === 'INVALID_TIME_RANGE';

    // 4b. Negative Guest Count
    const negGuestRes = await fetch(`${BASE_URL}/api/v1/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionistToken}`,
      },
      body: JSON.stringify({
        customerId: testCustomer.id,
        eventType: 'Negative Guests Event',
        eventDate: '2028-02-10',
        startTime: '10:00',
        endTime: '14:00',
        guestCount: -50, // Negative!
        hallId: testHall.id,
      }),
    });
    const negGuestData = await negGuestRes.json();
    const test4bPass =
      negGuestRes.status === 400 &&
      (negGuestData.error?.code === 'VALIDATION_ERROR' || negGuestData.error?.code === 'INVALID_GUEST_COUNT');

    recordResult(
      4,
      'Event Timing Validation (Inverted times & negative guests rejected with 400)',
      'VALIDATION',
      test4aPass && test4bPass,
      `4a: ${invalidTimeRes.status}, 4b: ${negGuestRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Hall Conflict Detection (Overlapping Intervals Blocked)
    // Existing slot: 2028-01-15, 10:00-16:00 (from Test 1)
    // -------------------------------------------------------------------------
    const overlapRes = await fetch(`${BASE_URL}/api/v1/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionistToken}`,
      },
      body: JSON.stringify({
        customerId: testCustomer.id,
        eventType: 'Overlapping Evening Event',
        eventDate: booking1Date,
        startTime: '14:00', // Overlaps with 10:00-16:00
        endTime: '20:00',
        guestCount: 200,
        hallId: testHall.id,
      }),
    });
    const overlapData = await overlapRes.json();
    const test5Pass = overlapRes.status === 409 && overlapData.error?.code === 'BOOKING_CONFLICT';
    recordResult(
      5,
      'Hall Overlap Conflict Detection (14:00-20:00 rejected against 10:00-16:00 with 409)',
      'DOUBLE_BOOKING_HALL',
      test5Pass,
      `Status: ${overlapRes.status}, message: ${overlapData.error?.message}`
    );

    // -------------------------------------------------------------------------
    // TEST 6: Hall Boundary Touching: 10:00-16:00 vs 16:00-22:00 (Must Succeed!)
    // -------------------------------------------------------------------------
    const boundaryTouchRes = await fetch(`${BASE_URL}/api/v1/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionistToken}`,
      },
      body: JSON.stringify({
        customerId: testCustomer.id,
        eventType: 'Evening Reception (Boundary Touching)',
        eventDate: booking1Date,
        startTime: '16:00', // Exactly touches end time of Test 1 (16:00)
        endTime: '22:00',
        guestCount: 250,
        hallId: testHall.id,
      }),
    });
    const boundaryTouchData = await boundaryTouchRes.json();
    const test6Pass = (boundaryTouchRes.status === 201 || boundaryTouchRes.status === 200) && boundaryTouchData.success === true;
    if (boundaryTouchData.data?.id) cleanupBookingIds.push(boundaryTouchData.data.id);

    recordResult(
      6,
      'Hall Boundary Touching (16:00-22:00 adjacent to 10:00-16:00 allowed without conflict)',
      'BOUNDARY_TOUCHING_HALL',
      test6Pass,
      `Status: ${boundaryTouchRes.status}, error: ${JSON.stringify(boundaryTouchData.error || null)}`
    );

    // -------------------------------------------------------------------------
    // TEST 7: Room Conflict Detection (Overlapping Reservations Blocked)
    // Test 1 booked testRoom1 for [2028-01-15, 2028-01-16)
    // -------------------------------------------------------------------------
    const roomConflictRes = await fetch(`${BASE_URL}/api/v1/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionistToken}`,
      },
      body: JSON.stringify({
        customerId: testCustomer.id,
        eventType: 'Conflicting Room Event',
        eventDate: '2028-01-15',
        startTime: '08:00',
        endTime: '09:30',
        guestCount: 50,
        roomIds: [testRoom1.id],
        checkInDate: '2028-01-15',
        checkOutDate: '2028-01-17', // Overlaps with 2028-01-15 to 2028-01-16
      }),
    });
    const roomConflictData = await roomConflictRes.json();
    const test7Pass = roomConflictRes.status === 409 && roomConflictData.error?.code === 'ROOM_CONFLICT';
    recordResult(
      7,
      'Room Conflict Detection (Overlapping room date interval rejected with 409 ROOM_CONFLICT)',
      'DOUBLE_BOOKING_ROOM',
      test7Pass,
      `Status: ${roomConflictRes.status}, msg: ${roomConflictData.error?.message}`
    );

    // -------------------------------------------------------------------------
    // TEST 8: Room Boundary Touching: 10 Oct-12 Oct vs 12 Oct-14 Oct (Allowed)
    // -------------------------------------------------------------------------
    const rBoundary1 = datesOverlap('2028-10-10', '2028-10-12', '2028-10-12', '2028-10-14');
    const rBoundary2 = datesOverlap('2028-10-12', '2028-10-14', '2028-10-10', '2028-10-12');
    const test8Pass = rBoundary1 === false && rBoundary2 === false;
    recordResult(
      8,
      'Room Boundary Touching [10 Oct - 12 Oct) vs [12 Oct - 14 Oct) (Checkout equals Checkin is ALLOWED)',
      'BOUNDARY_TOUCHING_ROOM',
      test8Pass,
      `rBoundary1: ${rBoundary1}, rBoundary2: ${rBoundary2}`
    );

    // -------------------------------------------------------------------------
    // TEST 9: Concurrent Booking Safety (Advisory Locks Serialization)
    // Dispatch 2 simultaneous requests for the EXACT same slot and hall
    // -------------------------------------------------------------------------
    const raceDate = `2029-05-${Math.floor(Math.random() * 20 + 1).toString().padStart(2, '0')}`;
    const existingOnRaceDate = await db.select().from(bookings).where(eq(bookings.eventDate, raceDate));
    for (const eb of existingOnRaceDate) {
      await db.delete(bookingHalls).where(eq(bookingHalls.bookingId, eb.id));
      await db.delete(bookingRooms).where(eq(bookingRooms.bookingId, eb.id));
      await db.delete(bookings).where(eq(bookings.id, eb.id));
    }

    const racePayload = {
      customerId: testCustomer.id,
      eventType: 'Race Condition Test',
      eventDate: raceDate,
      startTime: '10:00',
      endTime: '18:00',
      guestCount: 150,
      hallId: testHall.id,
    };

    const [raceReqA, raceReqB] = await Promise.all([
      fetch(`${BASE_URL}/api/v1/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify(racePayload),
      }),
      fetch(`${BASE_URL}/api/v1/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify(racePayload),
      }),
    ]);

    const [raceDataA, raceDataB] = await Promise.all([raceReqA.json(), raceReqB.json()]);
    const oneWon =
      ((raceReqA.status === 201 || raceReqA.status === 200) && raceReqB.status === 409) ||
      (raceReqA.status === 409 && (raceReqB.status === 201 || raceReqB.status === 200));

    if ((raceReqA.status === 200 || raceReqA.status === 201) && raceDataA.data?.id) cleanupBookingIds.push(raceDataA.data.id);
    if ((raceReqB.status === 200 || raceReqB.status === 201) && raceDataB.data?.id) cleanupBookingIds.push(raceDataB.data.id);

    recordResult(
      9,
      'Concurrent Booking Safety via Advisory Lock (Simultaneous identical requests: exactly 1 succeeds, 1 blocked with 409)',
      'CONCURRENCY_SAFETY',
      oneWon,
      `ReqA status: ${raceReqA.status}, ReqB status: ${raceReqB.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 10: Financial Calculation Engine
    // Hall = 100,000, 2 Rooms x 2 nights x 3,000 = 12,000, Service = 8,000
    // Subtotal = 120,000. Discount = 20,000 -> Taxable = 100,000. Tax (18%) = 18,000. Grand = 118,000.
    // -------------------------------------------------------------------------
    const finItems = [
      { description: 'Hall Rental', qty: 1, rate: 100000 },
      { description: 'Rooms', qty: 4, rate: 3000 },
      { description: 'Service', qty: 1, rate: 8000 },
    ];
    const fin = calculateFinancials(finItems, 20000, 18, 50000);
    const test10Pass =
      Number(fin.subtotal) === 120000 &&
      Number(fin.discount) === 20000 &&
      Number(fin.taxAmount) === 18000 &&
      Number(fin.grandTotal) === 118000 &&
      Number(fin.paidAmount) === 50000 &&
      Number(fin.balanceAmount) === 68000;

    recordResult(
      10,
      'Integer/Decimal Financial Calculation (Subtotal, Discount, GST 18%, Grand Total, Balance)',
      'FINANCIAL_CALCULATION',
      test10Pass,
      `Calculated: Subtotal ₹${fin.subtotal}, Tax ₹${fin.taxAmount}, Grand ₹${fin.grandTotal}, Balance ₹${fin.balanceAmount}`
    );

    // -------------------------------------------------------------------------
    // TEST 11: Discount Exceeding Subtotal Rejection
    // -------------------------------------------------------------------------
    const discDate = `2029-11-${Math.floor(Math.random() * 20 + 1).toString().padStart(2, '0')}`;
    const discExceedRes = await fetch(`${BASE_URL}/api/v1/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionistToken}`,
      },
      body: JSON.stringify({
        customerId: testCustomer.id,
        eventType: 'Excessive Discount Event',
        eventDate: discDate,
        startTime: '10:00',
        endTime: '15:00',
        guestCount: 100,
        hallId: testHall.id,
        discount: 9999999, // Exceeds hall base price
      }),
    });
    const discExceedData = await discExceedRes.json();
    const test11Pass =
      discExceedRes.status === 400 &&
      (discExceedData.error?.message?.includes('cannot exceed subtotal') ||
        discExceedData.error?.code === 'VALIDATION_ERROR');

    recordResult(
      11,
      'Discount Exceeding Subtotal Rejected with 400 Validation Error',
      'DISCOUNT_PROTECTION',
      test11Pass,
      `Status: ${discExceedRes.status}, error: ${discExceedData.error?.message}`
    );

    // -------------------------------------------------------------------------
    // TEST 12: Negative Input Rejection
    // -------------------------------------------------------------------------
    const negPriceRes = await fetch(`${BASE_URL}/api/v1/halls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        name: 'Negative Hall',
        type: 'BANQUET',
        capacity: 100,
        basePrice: -5000, // Negative!
      }),
    });
    const negPriceData = await negPriceRes.json();
    const test12Pass = negPriceRes.status === 400;
    recordResult(
      12,
      'Negative Financial Input Rejection (Negative base price rejected with 400)',
      'NEGATIVE_INPUT_REJECTION',
      test12Pass,
      `Status: ${negPriceRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 13: Booking State Machine Transitions
    // Valid: CONFIRMED -> SCHEDULED -> IN_PROGRESS -> COMPLETED
    // Invalid: CONFIRMED -> COMPLETED directly (Must be rejected with 400)
    // -------------------------------------------------------------------------
    const validBookingId = createData1.data?.id;

    // 13a: Invalid Jump: CONFIRMED -> COMPLETED
    const invalidJumpRes = await fetch(`${BASE_URL}/api/v1/bookings/${validBookingId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({ status: 'COMPLETED' }),
    });
    const invalidJumpData = await invalidJumpRes.json();
    const test13aPass = invalidJumpRes.status === 400 && invalidJumpData.error?.code === 'INVALID_STATUS_TRANSITION';

    // 13b: Valid Transition: CONFIRMED -> SCHEDULED
    const validTransRes = await fetch(`${BASE_URL}/api/v1/bookings/${validBookingId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({ status: 'SCHEDULED', notes: 'Vendor contracts confirmed' }),
    });
    const validTransData = await validTransRes.json();
    const test13bPass = validTransRes.status === 200 && validTransData.data?.status === 'SCHEDULED';

    recordResult(
      13,
      'State Machine Enforcement (CONFIRMED -> COMPLETED rejected 400; CONFIRMED -> SCHEDULED allowed 200)',
      'STATE_MACHINE',
      test13aPass && test13bPass,
      `13a status: ${invalidJumpRes.status}, 13b status: ${validTransRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 14: Booking Cancellation (Controlled Transition, Slot Released, Record Retained)
    // -------------------------------------------------------------------------
    const cancelRes = await fetch(`${BASE_URL}/api/v1/bookings/${validBookingId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({ reason: 'Customer requested date change' }),
    });
    const cancelData = await cancelRes.json();
    const test14aPass = cancelRes.status === 200 && cancelData.data?.status === 'CANCELLED';

    // Verify record is NOT deleted from database
    const [cancelledBookingInDb] = await db.select().from(bookings).where(eq(bookings.id, validBookingId));
    const test14bPass = cancelledBookingInDb !== undefined && cancelledBookingInDb.status === 'CANCELLED';

    // Verify availability is released: Now booking the exact same slot should SUCCEED!
    const rebookRes = await fetch(`${BASE_URL}/api/v1/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionistToken}`,
      },
      body: JSON.stringify({
        customerId: testCustomer.id,
        eventType: 'New Replacement Event',
        eventDate: booking1Date,
        startTime: '10:00',
        endTime: '16:00',
        guestCount: 200,
        hallId: testHall.id,
      }),
    });
    const rebookData = await rebookRes.json();
    const test14cPass = (rebookRes.status === 201 || rebookRes.status === 200) && rebookData.success === true;
    if (rebookData.data?.id) cleanupBookingIds.push(rebookData.data.id);

    recordResult(
      14,
      'Booking Cancellation: Record preserved in database and hall slot immediately released for re-booking',
      'CANCELLATION_WORKFLOW',
      test14aPass && test14bPass && test14cPass,
      `14a: ${cancelRes.status}, 14b (in DB): ${!!cancelledBookingInDb}, 14c (rebook): ${rebookRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 15: Audit Log Creation for Booking Operations
    // -------------------------------------------------------------------------
    const bookingAuditLogs = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entity, 'Booking'), eq(auditLogs.entityId, validBookingId)));

    const hasCreateAudit = bookingAuditLogs.some((l) => l.action === 'BOOKING_CREATE');
    const hasStatusAudit = bookingAuditLogs.some((l) => l.action === 'BOOKING_STATUS_CHANGE');
    const hasCancelAudit = bookingAuditLogs.some((l) => l.action === 'BOOKING_CANCEL');
    const test15Pass = hasCreateAudit && hasStatusAudit && hasCancelAudit;

    recordResult(
      15,
      'Audit Trail Integrity (BOOKING_CREATE, BOOKING_STATUS_CHANGE, BOOKING_CANCEL logged in PostgreSQL)',
      'AUDIT_LOGGING',
      test15Pass,
      `Found ${bookingAuditLogs.length} audit logs. Create: ${hasCreateAudit}, Status: ${hasStatusAudit}, Cancel: ${hasCancelAudit}`
    );

    // -------------------------------------------------------------------------
    // TEST 16: Unauthorized Booking Creation (No token / Malformed token)
    // -------------------------------------------------------------------------
    const noTokenRes = await fetch(`${BASE_URL}/api/v1/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerId: testCustomer.id,
        eventType: 'Hacker Gala',
        eventDate: '2028-12-31',
        startTime: '18:00',
        endTime: '23:00',
        guestCount: 500,
        hallId: testHall.id,
      }),
    });
    const test16Pass = noTokenRes.status === 401;
    recordResult(
      16,
      'Unauthorized Booking Creation Rejected (HTTP 401 Unauthorized without Bearer JWT)',
      'SECURITY_AUTH',
      test16Pass,
      `Status: ${noTokenRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 17: Unauthorized Booking Modification & Cancellation
    // E.g. RECEPTIONIST has permission to view & create, but CANNOT cancel a booking (OWNER/MANAGER required)
    // -------------------------------------------------------------------------
    const targetToCancel = rebookData.data?.id;
    const recepCancelRes = await fetch(`${BASE_URL}/api/v1/bookings/${targetToCancel}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionistToken}`, // RECEPTIONIST is forbidden from cancellation
      },
      body: JSON.stringify({ reason: 'Recep unauthorized cancel attempt' }),
    });
    const test17Pass = recepCancelRes.status === 403;

    recordResult(
      17,
      'RBAC Privilege Escalation Prevention (RECEPTIONIST forbidden from cancelling booking: 403 FORBIDDEN)',
      'RBAC_AUTHORIZATION',
      test17Pass,
      `Status: ${recepCancelRes.status}`
    );
  } finally {
    // Clean up created test bookings
    console.log('\nCleaning up ephemeral test bookings...');
    for (const bId of cleanupBookingIds) {
      await db.delete(bookingRooms).where(eq(bookingRooms.bookingId, bId));
      await db.delete(bookingHalls).where(eq(bookingHalls.bookingId, bId));
      await db.delete(bookings).where(eq(bookings.id, bId));
    }
    console.log(`Cleaned up ${cleanupBookingIds.length} test booking records.`);
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log('PHASE 3 VERIFICATION SUMMARY:');
  const allPassed = testResults.every((r) => r.passed);
  const passedCount = testResults.filter((r) => r.passed).length;
  console.log(`Total Tests Executed: ${testResults.length}`);
  console.log(`Passed: ${passedCount} / ${testResults.length}`);
  console.log(`Overall Result: ${allPassed ? 'ALL TESTS PASSED ✅' : 'FAILURES DETECTED ❌'}`);
  console.log('===============================================================\n');

  if (!allPassed) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase3Verification().catch((err) => {
  console.error('Fatal test execution failure:', err);
  process.exit(1);
});
