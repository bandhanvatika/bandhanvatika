/**
 * BANDHAN VATIKA — CONCURRENT DOUBLE BOOKING SIMULATION
 * Dispatches two simultaneous booking requests for the exact same hall and overlapping time slot.
 * Verifies that PostgreSQL transactional advisory locks guarantee only 1 booking succeeds
 * and the concurrent request is safely blocked with HTTP 409 Conflict.
 */

import { generateToken } from '../src/server/auth.ts';
import { db } from '../src/db/index.ts';
import { halls, customers, bookings, invoices, bookingHalls, payments } from '../src/db/schema.ts';
import { eq } from 'drizzle-orm';

const BASE_URL = 'http://localhost:3000';

async function runConcurrencyTest() {
  console.log('\n--- Running Concurrent Double-Booking Race Condition Test ---');

  const ownerToken = generateToken({
    id: 'usr-owner-001',
    email: 'admin@bandhanvatika.com',
    username: 'admin',
    name: 'Rajesh Sharma',
    role: 'OWNER',
  });

  const [testHall] = await db.select().from(halls).limit(1);
  const [testCust] = await db.select().from(customers).limit(1);

  const testDate = `2029-08-${Math.floor(Math.random() * 20 + 1).toString().padStart(2, '0')}`;
  const startTime = '11:00';
  const endTime = '17:00';

  console.log(`Simulating concurrent requests for Hall ${testHall.name} on ${testDate} (${startTime}-${endTime})...`);

  const requestPayload = {
    customerId: testCust.id,
    eventType: 'Concurrent Wedding Test',
    eventDate: testDate,
    startTime,
    endTime,
    guestCount: 200,
    hallId: testHall.id,
    roomIds: [],
    services: [],
    discount: 0,
    taxPercent: 18,
    advancePayment: 10000,
  };

  // Launch two simultaneous fetch requests
  const [req1, req2] = await Promise.all([
    fetch(`${BASE_URL}/api/v1/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify(requestPayload),
    }),
    fetch(`${BASE_URL}/api/v1/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify(requestPayload),
    }),
  ]);

  const [data1, data2] = await Promise.all([req1.json(), req2.json()]);

  console.log(`Request 1 Response: Status ${req1.status}`, data1.success ? 'SUCCESS' : data1.error);
  console.log(`Request 2 Response: Status ${req2.status}`, data2.success ? 'SUCCESS' : data2.error);

  const req1Ok = req1.status === 200 || req1.status === 201;
  const req2Ok = req2.status === 200 || req2.status === 201;
  const oneSuccess = (req1Ok && req2.status === 409) || (req1.status === 409 && req2Ok);
  
  if (!oneSuccess) {
    console.error('❌ CONCURRENCY FAILURE: Both requests succeeded or both failed unexpectedly!');
    process.exit(1);
  }

  console.log('✅ PASS [CONCURRENCY]: Exactly one request succeeded and the competing race condition was blocked (409 Conflict)!');

  // Clean up test booking
  const successfulId = req1Ok ? data1.data?.id : data2.data?.id;
  if (successfulId) {
    await db.delete(payments).where(eq(payments.bookingId, successfulId));
    await db.delete(invoices).where(eq(invoices.bookingId, successfulId));
    await db.delete(bookingHalls).where(eq(bookingHalls.bookingId, successfulId));
    await db.delete(bookings).where(eq(bookings.id, successfulId));
    console.log('Test booking cleaned up.');
  }

  process.exit(0);
}

runConcurrencyTest().catch((err) => {
  console.error('Fatal concurrency test error:', err);
  process.exit(1);
});
