/**
 * BANDHAN VATIKA — PHASE 2 MASTER DATA VERIFICATION TEST SUITE
 * Tests Customer, Hall, and Room modules:
 * 1. CRUD operations
 * 2. Server-side duplicate prevention (Mobile number, Hall code, Room number)
 * 3. RBAC authorization matrix (Least privilege verification)
 * 4. Input validations (positive capacity, non-negative price, valid phone format)
 * 5. Soft-deletion & reactivation lifecycle
 * 6. Audit logging integrity
 */

import { generateToken, AuthUser } from '../src/server/auth.ts';
import { db } from '../src/db/index.ts';
import { customers, halls, rooms, auditLogs } from '../src/db/schema.ts';
import { eq, desc } from 'drizzle-orm';

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

async function runMasterDataTests() {
  console.log('\n=============================================================');
  console.log('BANDHAN VATIKA — PHASE 2: MASTER DATA VERIFICATION TEST SUITE');
  console.log('=============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(testName: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} — ${details || 'Assertion failed'}`);
      failed++;
    }
  }

  const timestamp = Date.now().toString().slice(-6);
  const testMobile1 = `9811${timestamp}`;
  const testMobile2 = `9822${timestamp}`;

  // -------------------------------------------------------------
  // 1. CUSTOMER MODULE TESTS
  // -------------------------------------------------------------
  console.log('\n--- 1. CUSTOMER MODULE TESTS ---');

  let createdCustId = '';

  // 1.1 Customer creation with valid payload
  try {
    const res = await fetch(`${BASE_URL}/api/v1/customers`, {
      method: 'POST',
      headers: authHeader('MANAGER'),
      body: JSON.stringify({
        name: 'Test Customer Alpha',
        mobile: testMobile1,
        email: 'alpha@test.com',
        city: 'Indore',
        address: '123 MG Road',
        idProofType: 'Aadhaar Card',
        idProofNumber: '1234-5678-9012',
        notes: 'Test client profile',
      }),
    });
    const data = await res.json();
    assert(
      'Customer Creation: Successfully creates customer with valid payload and auto-generated customerCode',
      res.status === 201 && data.success && data.data.customerCode.startsWith('BV-CUST-') && data.data.isActive === true,
      `Status: ${res.status}, Body: ${JSON.stringify(data)}`
    );
    createdCustId = data.data?.id;
  } catch (err: any) {
    assert('Customer Creation: Exception', false, err.message);
  }

  // 1.2 Customer duplicate mobile prevention (Critical requirement)
  try {
    const res = await fetch(`${BASE_URL}/api/v1/customers`, {
      method: 'POST',
      headers: authHeader('MANAGER'),
      body: JSON.stringify({
        name: 'Duplicate Phone Person',
        mobile: testMobile1, // Same phone!
        city: 'Indore',
      }),
    });
    const data = await res.json();
    assert(
      'Customer Duplicate Mobile: Server rejects duplicate mobile with 409 Conflict',
      res.status === 409 && data.error?.code === 'DUPLICATE_MOBILE',
      `Status: ${res.status}, Error code: ${data.error?.code}`
    );
  } catch (err: any) {
    assert('Customer Duplicate Mobile: Exception', false, err.message);
  }

  // 1.3 Customer input validation: invalid phone format
  try {
    const res = await fetch(`${BASE_URL}/api/v1/customers`, {
      method: 'POST',
      headers: authHeader('MANAGER'),
      body: JSON.stringify({
        name: 'Bad Phone',
        mobile: '123', // Too short
      }),
    });
    assert(
      'Customer Validation: Server rejects invalid phone format (< 10 digits) with 400',
      res.status === 400,
      `Status: ${res.status}`
    );
  } catch (err: any) {
    assert('Customer Validation: Exception', false, err.message);
  }

  // 1.4 Customer RBAC: STAFF role cannot create customer
  try {
    const res = await fetch(`${BASE_URL}/api/v1/customers`, {
      method: 'POST',
      headers: authHeader('STAFF'),
      body: JSON.stringify({
        name: 'Staff Unauthorized Customer',
        mobile: testMobile2,
      }),
    });
    assert(
      'Customer RBAC: STAFF role is forbidden (403) from creating customers',
      res.status === 403,
      `Status: ${res.status}`
    );
  } catch (err: any) {
    assert('Customer RBAC Create: Exception', false, err.message);
  }

  // 1.5 Customer Update & Duplicate check on edit
  if (createdCustId) {
    try {
      // First create a second customer to test edit collision
      const cust2Res = await fetch(`${BASE_URL}/api/v1/customers`, {
        method: 'POST',
        headers: authHeader('MANAGER'),
        body: JSON.stringify({
          name: 'Second Customer',
          mobile: testMobile2,
        }),
      });
      const cust2Data = await cust2Res.json();
      const cust2Id = cust2Data.data?.id;

      // Now attempt to update Customer 1 with Customer 2's mobile -> should fail with 409
      const editDupRes = await fetch(`${BASE_URL}/api/v1/customers/${createdCustId}`, {
        method: 'PUT',
        headers: authHeader('MANAGER'),
        body: JSON.stringify({
          mobile: testMobile2,
        }),
      });
      assert(
        'Customer Edit: Prevents updating customer mobile to another existing customer mobile (409)',
        editDupRes.status === 409,
        `Status: ${editDupRes.status}`
      );

      // Now valid update
      const validEditRes = await fetch(`${BASE_URL}/api/v1/customers/${createdCustId}`, {
        method: 'PUT',
        headers: authHeader('MANAGER'),
        body: JSON.stringify({
          name: 'Updated Alpha Customer',
          city: 'Bhopal',
        }),
      });
      const validEditData = await validEditRes.json();
      assert(
        'Customer Edit: Successfully updates customer data',
        validEditRes.status === 200 && validEditData.data?.name === 'Updated Alpha Customer' && validEditData.data?.city === 'Bhopal',
        `Status: ${validEditRes.status}`
      );

      // Clean up second customer if needed
    } catch (err: any) {
      assert('Customer Edit: Exception', false, err.message);
    }
  }

  // 1.6 Customer Deactivation (Soft Delete) & Reactivation
  if (createdCustId) {
    try {
      // Staff cannot deactivate
      const staffDeactivate = await fetch(`${BASE_URL}/api/v1/customers/${createdCustId}`, {
        method: 'DELETE',
        headers: authHeader('STAFF'),
      });
      assert(
        'Customer RBAC: STAFF role cannot deactivate customers (403)',
        staffDeactivate.status === 403,
        `Status: ${staffDeactivate.status}`
      );

      // Manager deactivates
      const deactivateRes = await fetch(`${BASE_URL}/api/v1/customers/${createdCustId}`, {
        method: 'DELETE',
        headers: authHeader('MANAGER'),
      });
      const deactData = await deactivateRes.json();
      assert(
        'Customer Deactivation: Successfully soft-deactivates customer (isActive = false)',
        deactivateRes.status === 200 && deactData.data?.isActive === false,
        `Status: ${deactivateRes.status}`
      );

      // Reactivate
      const reactivateRes = await fetch(`${BASE_URL}/api/v1/customers/${createdCustId}/activate`, {
        method: 'POST',
        headers: authHeader('MANAGER'),
      });
      const reactData = await reactivateRes.json();
      assert(
        'Customer Reactivation: Successfully restores customer (isActive = true)',
        reactivateRes.status === 200 && reactData.data?.isActive === true,
        `Status: ${reactivateRes.status}`
      );
    } catch (err: any) {
      assert('Customer Lifecycle: Exception', false, err.message);
    }
  }

  // -------------------------------------------------------------
  // 2. HALL MODULE TESTS
  // -------------------------------------------------------------
  console.log('\n--- 2. HALL MODULE TESTS ---');

  const testHallCode = `HALL-T${timestamp.slice(-3)}`;
  let createdHallId = '';

  // 2.1 Hall creation with valid payload (Decimal base price)
  try {
    const res = await fetch(`${BASE_URL}/api/v1/halls`, {
      method: 'POST',
      headers: authHeader('OWNER'),
      body: JSON.stringify({
        code: testHallCode,
        name: 'Pavilion Test Hall',
        type: 'Banquet Hall',
        capacity: 450,
        basePrice: '175000.00',
        status: 'ACTIVE',
        amenities: ['Central AC', 'Stage', 'Valet Parking'],
        description: 'Test venue with complete infrastructure',
      }),
    });
    const data = await res.json();
    assert(
      'Hall Creation: Successfully creates venue with valid capacity and Decimal basePrice',
      res.status === 201 && data.success && data.data.code === testHallCode && data.data.basePrice === '175000.00',
      `Status: ${res.status}, Body: ${JSON.stringify(data)}`
    );
    createdHallId = data.data?.id;
  } catch (err: any) {
    assert('Hall Creation: Exception', false, err.message);
  }

  // 2.2 Hall Duplicate Code rejection
  try {
    const res = await fetch(`${BASE_URL}/api/v1/halls`, {
      method: 'POST',
      headers: authHeader('OWNER'),
      body: JSON.stringify({
        code: testHallCode, // Same code
        name: 'Duplicate Code Hall',
        capacity: 100,
        basePrice: '50000',
      }),
    });
    assert(
      'Hall Duplicate Code: Server rejects duplicate hall code with 409 Conflict',
      res.status === 409,
      `Status: ${res.status}`
    );
  } catch (err: any) {
    assert('Hall Duplicate Code: Exception', false, err.message);
  }

  // 2.3 Hall Validation: Negative capacity and negative price
  try {
    const badCapRes = await fetch(`${BASE_URL}/api/v1/halls`, {
      method: 'POST',
      headers: authHeader('OWNER'),
      body: JSON.stringify({
        code: `INV-${timestamp}`,
        name: 'Negative Capacity Hall',
        capacity: -50,
        basePrice: '50000',
      }),
    });
    assert(
      'Hall Validation: Rejects negative capacity with 400 Validation Error',
      badCapRes.status === 400,
      `Status: ${badCapRes.status}`
    );

    const badPriceRes = await fetch(`${BASE_URL}/api/v1/halls`, {
      method: 'POST',
      headers: authHeader('OWNER'),
      body: JSON.stringify({
        code: `INV2-${timestamp}`,
        name: 'Negative Price Hall',
        capacity: 100,
        basePrice: '-2000',
      }),
    });
    assert(
      'Hall Validation: Rejects negative price with 400 Validation Error',
      badPriceRes.status === 400,
      `Status: ${badPriceRes.status}`
    );
  } catch (err: any) {
    assert('Hall Validation: Exception', false, err.message);
  }

  // 2.4 Hall RBAC: RECEPTIONIST & STAFF cannot create or update halls
  try {
    const recepRes = await fetch(`${BASE_URL}/api/v1/halls`, {
      method: 'POST',
      headers: authHeader('RECEPTIONIST'),
      body: JSON.stringify({
        code: `RECEP-${timestamp}`,
        name: 'Recep Hall',
        capacity: 100,
        basePrice: '50000',
      }),
    });
    assert(
      'Hall RBAC: RECEPTIONIST role is forbidden (403) from creating halls',
      recepRes.status === 403,
      `Status: ${recepRes.status}`
    );
  } catch (err: any) {
    assert('Hall RBAC: Exception', false, err.message);
  }

  // 2.5 Hall Status Change (ACTIVE -> MAINTENANCE -> ACTIVE)
  if (createdHallId) {
    try {
      const maintRes = await fetch(`${BASE_URL}/api/v1/halls/${createdHallId}/status`, {
        method: 'PATCH',
        headers: authHeader('MANAGER'),
        body: JSON.stringify({ status: 'MAINTENANCE' }),
      });
      const maintData = await maintRes.json();
      assert(
        'Hall Status Change: Successfully updates hall status to MAINTENANCE',
        maintRes.status === 200 && maintData.data?.status === 'MAINTENANCE',
        `Status: ${maintRes.status}`
      );

      // Restore to ACTIVE
      const activeRes = await fetch(`${BASE_URL}/api/v1/halls/${createdHallId}/status`, {
        method: 'PATCH',
        headers: authHeader('MANAGER'),
        body: JSON.stringify({ status: 'ACTIVE' }),
      });
      const activeData = await activeRes.json();
      assert(
        'Hall Status Change: Successfully restores hall status to ACTIVE',
        activeRes.status === 200 && activeData.data?.status === 'ACTIVE',
        `Status: ${activeRes.status}`
      );
    } catch (err: any) {
      assert('Hall Status: Exception', false, err.message);
    }
  }

  // -------------------------------------------------------------
  // 3. ROOM MODULE TESTS
  // -------------------------------------------------------------
  console.log('\n--- 3. ROOM MODULE TESTS ---');

  const testRoomNumber = `RM-${timestamp.slice(-4)}`;
  let createdRoomId = '';

  // 3.1 Room creation with valid payload
  try {
    const res = await fetch(`${BASE_URL}/api/v1/rooms`, {
      method: 'POST',
      headers: authHeader('RECEPTIONIST'),
      body: JSON.stringify({
        roomNumber: testRoomNumber,
        roomType: 'Deluxe Suite',
        isAc: true,
        capacity: 3,
        pricePerNight: '4500.00',
        status: 'AVAILABLE',
        amenities: ['Split AC', 'King Bed', 'Attached Bath'],
        description: 'First floor bridal suite',
      }),
    });
    const data = await res.json();
    assert(
      'Room Creation: Successfully creates guest room with valid parameters and Decimal tariff',
      res.status === 201 && data.success && data.data.roomNumber === testRoomNumber && data.data.pricePerNight === '4500.00',
      `Status: ${res.status}, Body: ${JSON.stringify(data)}`
    );
    createdRoomId = data.data?.id;
  } catch (err: any) {
    assert('Room Creation: Exception', false, err.message);
  }

  // 3.2 Room Duplicate Number rejection
  try {
    const res = await fetch(`${BASE_URL}/api/v1/rooms`, {
      method: 'POST',
      headers: authHeader('RECEPTIONIST'),
      body: JSON.stringify({
        roomNumber: testRoomNumber, // Same room number!
        roomType: 'Standard Room',
        capacity: 2,
        pricePerNight: '3000',
      }),
    });
    assert(
      'Room Duplicate Number: Server rejects duplicate room number with 409 Conflict',
      res.status === 409,
      `Status: ${res.status}`
    );
  } catch (err: any) {
    assert('Room Duplicate: Exception', false, err.message);
  }

  // 3.3 Room RBAC: STAFF role cannot create rooms
  try {
    const res = await fetch(`${BASE_URL}/api/v1/rooms`, {
      method: 'POST',
      headers: authHeader('STAFF'),
      body: JSON.stringify({
        roomNumber: `BAD-${timestamp}`,
        roomType: 'Standard',
        capacity: 2,
        pricePerNight: '2000',
      }),
    });
    assert(
      'Room RBAC: STAFF role is forbidden (403) from creating rooms',
      res.status === 403,
      `Status: ${res.status}`
    );
  } catch (err: any) {
    assert('Room RBAC: Exception', false, err.message);
  }

  // 3.4 Room Housekeeping Status Management
  if (createdRoomId) {
    try {
      const statusesToTest = ['CLEANING', 'OCCUPIED', 'AVAILABLE'] as const;
      let statusOk = true;
      for (const st of statusesToTest) {
        const patchRes = await fetch(`${BASE_URL}/api/v1/rooms/${createdRoomId}/status`, {
          method: 'PATCH',
          headers: authHeader('RECEPTIONIST'),
          body: JSON.stringify({ status: st }),
        });
        const patchData = await patchRes.json();
        if (patchRes.status !== 200 || patchData.data?.status !== st) {
          statusOk = false;
        }
      }
      assert(
        'Room Status: Successfully cycles through housekeeping statuses (CLEANING, OCCUPIED, AVAILABLE)',
        statusOk
      );

      // Rejects invalid status
      const badStatusRes = await fetch(`${BASE_URL}/api/v1/rooms/${createdRoomId}/status`, {
        method: 'PATCH',
        headers: authHeader('RECEPTIONIST'),
        body: JSON.stringify({ status: 'NON_EXISTENT_STATUS' }),
      });
      assert(
        'Room Status: Rejects invalid status string with 400 Validation Error',
        badStatusRes.status === 400
      );
    } catch (err: any) {
      assert('Room Status Cycle: Exception', false, err.message);
    }
  }

  // -------------------------------------------------------------
  // 4. AUDIT LOGGING VERIFICATION
  // -------------------------------------------------------------
  console.log('\n--- 4. AUDIT LOGGING INTEGRITY ---');
  try {
    const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(10);
    const actions = logs.map((l) => l.action);
    const hasCustAction = actions.some((a) => a.startsWith('CUSTOMER_'));
    const hasHallAction = actions.some((a) => a.startsWith('HALL_'));
    const hasRoomAction = actions.some((a) => a.startsWith('ROOM_'));

    assert(
      'Audit Logging: Customer operations logged to PostgreSQL audit_logs table',
      hasCustAction,
      `Found actions: ${actions.join(', ')}`
    );
    assert(
      'Audit Logging: Hall operations logged to PostgreSQL audit_logs table',
      hasHallAction,
      `Found actions: ${actions.join(', ')}`
    );
    assert(
      'Audit Logging: Room operations logged to PostgreSQL audit_logs table',
      hasRoomAction,
      `Found actions: ${actions.join(', ')}`
    );
  } catch (err: any) {
    assert('Audit Log Query: Exception', false, err.message);
  }

  console.log('\n=============================================================');
  console.log(`MASTER DATA VERIFICATION COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runMasterDataTests().catch((err) => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});
