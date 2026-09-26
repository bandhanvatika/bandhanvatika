/**
 * BANDHAN VATIKA — FULL RBAC MATRIX DIRECT API CALL VERIFICATION
 * Tests backend role authorization for OWNER, MANAGER, ACCOUNTANT, RECEPTIONIST, STAFF
 * across sensitive API endpoints to prove privilege escalation is prevented.
 */

import { generateToken, AuthUser } from '../src/server/auth.ts';
import { db } from '../src/db/index.ts';
import { payments, invoices } from '../src/db/schema.ts';

const BASE_URL = 'http://localhost:3000';

interface RoleTest {
  role: 'OWNER' | 'MANAGER' | 'ACCOUNTANT' | 'RECEPTIONIST' | 'STAFF';
  user: AuthUser;
}

const roles: RoleTest[] = [
  {
    role: 'OWNER',
    user: { id: 'usr-owner-001', email: 'admin@bandhanvatika.com', username: 'admin', name: 'Rajesh Sharma', role: 'OWNER' },
  },
  {
    role: 'MANAGER',
    user: { id: 'usr-mgr-002', email: 'manager@bandhanvatika.com', username: 'manager', name: 'Amit Patel', role: 'MANAGER' },
  },
  {
    role: 'ACCOUNTANT',
    user: { id: 'usr-acct-003', email: 'accountant@bandhanvatika.com', username: 'accountant', name: 'Sunil Gupta', role: 'ACCOUNTANT' },
  },
  {
    role: 'RECEPTIONIST',
    user: { id: 'usr-recep-004', email: 'reception@bandhanvatika.com', username: 'reception', name: 'Priya Verma', role: 'RECEPTIONIST' },
  },
  {
    role: 'STAFF',
    user: { id: 'usr-staff-005', email: 'staff@bandhanvatika.com', username: 'staff', name: 'Ramesh Kumar', role: 'STAFF' },
  },
];

async function runRbacMatrix() {
  console.log('\n==================================================');
  console.log('BANDHAN VATIKA — RBAC DIRECT HTTP ENDPOINT MATRIX');
  console.log('==================================================\n');

  const [existingPayment] = await db.select().from(payments).limit(1);
  const paymentId = existingPayment?.id || 'pay-dummy';

  const results: Array<{
    endpoint: string;
    method: string;
    role: string;
    expectedStatus: number[];
    actualStatus: number;
    passed: boolean;
  }> = [];

  for (const { role, user } of roles) {
    const token = generateToken(user);
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    // 1. POST /api/v1/users (Only OWNER allowed, others 403)
    const rand = Date.now() + Math.floor(Math.random() * 1000);
    const userRes = await fetch(`${BASE_URL}/api/v1/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: `rbac-${rand}@test.com`,
        username: `rbac-${rand}`,
        password: 'password123',
        name: 'Test Staff',
        role: 'STAFF',
      }),
    });
    const userExpected = role === 'OWNER' ? [200, 201] : [403];
    results.push({
      endpoint: '/api/v1/users',
      method: 'POST',
      role,
      expectedStatus: userExpected,
      actualStatus: userRes.status,
      passed: userExpected.includes(userRes.status),
    });

    // 2. GET /api/v1/audit-logs (Only OWNER, MANAGER allowed, others 403)
    const auditRes = await fetch(`${BASE_URL}/api/v1/audit-logs`, { headers });
    const auditExpected = ['OWNER', 'MANAGER'].includes(role) ? [200] : [403];
    results.push({
      endpoint: '/api/v1/audit-logs',
      method: 'GET',
      role,
      expectedStatus: auditExpected,
      actualStatus: auditRes.status,
      passed: auditExpected.includes(auditRes.status),
    });

    // 3. POST /api/v1/payments/:id/reverse (Only OWNER, ACCOUNTANT allowed, others 403)
    const reverseRes = await fetch(`${BASE_URL}/api/v1/payments/${paymentId}/reverse`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reversalReason: 'RBAC verification test' }),
    });
    // For OWNER/ACCOUNTANT, if dummy payment or already reversed it might return 400/404/200, but NEVER 403
    const reverseExpected = ['OWNER', 'ACCOUNTANT'].includes(role) ? [200, 400, 404] : [403];
    results.push({
      endpoint: `/api/v1/payments/:id/reverse`,
      method: 'POST',
      role,
      expectedStatus: reverseExpected,
      actualStatus: reverseRes.status,
      passed: reverseExpected.includes(reverseRes.status),
    });

    // 4. POST /api/v1/expenses (OWNER, MANAGER, ACCOUNTANT allowed, RECEPTIONIST & STAFF 403)
    const expenseRes = await fetch(`${BASE_URL}/api/v1/expenses`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ category: 'Utilities', title: 'Test Expense', amount: 500, expenseDate: '2026-10-01' }),
    });
    const expenseExpected = ['OWNER', 'MANAGER', 'ACCOUNTANT'].includes(role) ? [200, 201] : [403];
    results.push({
      endpoint: '/api/v1/expenses',
      method: 'POST',
      role,
      expectedStatus: expenseExpected,
      actualStatus: expenseRes.status,
      passed: expenseExpected.includes(expenseRes.status),
    });

    // 5. GET /api/v1/reports (OWNER, MANAGER, ACCOUNTANT allowed, RECEPTIONIST & STAFF 403)
    const reportRes = await fetch(`${BASE_URL}/api/v1/reports`, { headers });
    const reportExpected = ['OWNER', 'MANAGER', 'ACCOUNTANT'].includes(role) ? [200] : [403];
    results.push({
      endpoint: '/api/v1/reports',
      method: 'GET',
      role,
      expectedStatus: reportExpected,
      actualStatus: reportRes.status,
      passed: reportExpected.includes(reportRes.status),
    });

    // 6. PUT /api/v1/settings (Only OWNER allowed, others 403)
    const settingsRes = await fetch(`${BASE_URL}/api/v1/settings`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ gardenName: 'Bandhan Vatika Updated' }),
    });
    const settingsExpected = role === 'OWNER' ? [200] : [403];
    results.push({
      endpoint: '/api/v1/settings',
      method: 'PUT',
      role,
      expectedStatus: settingsExpected,
      actualStatus: settingsRes.status,
      passed: settingsExpected.includes(settingsRes.status),
    });

    // 7. GET /api/v1/bookings (All authenticated roles allowed: 200)
    const bookingsRes = await fetch(`${BASE_URL}/api/v1/bookings`, { headers });
    results.push({
      endpoint: '/api/v1/bookings',
      method: 'GET',
      role,
      expectedStatus: [200],
      actualStatus: bookingsRes.status,
      passed: bookingsRes.status === 200,
    });
  }

  // Print results table
  console.log('| Role | Method | Endpoint | Expected Status | Actual Status | Result |');
  console.log('|:---|:---|:---|:---|:---|:---|');
  for (const r of results) {
    const symbol = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`| ${r.role} | ${r.method} | ${r.endpoint} | ${r.expectedStatus.join('/')} | ${r.actualStatus} | ${symbol} |`);
  }

  const failed = results.filter((r) => !r.passed);
  console.log(`\nRBAC Matrix Summary: ${results.length - failed.length}/${results.length} PASSED`);
  if (failed.length > 0) {
    console.error('RBAC Verification Failed for:', failed);
    process.exit(1);
  }
}

runRbacMatrix().catch((err) => {
  console.error('Fatal RBAC test error:', err);
  process.exit(1);
});
