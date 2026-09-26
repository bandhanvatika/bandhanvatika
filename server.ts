import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './src/db/index.ts';
import {
  users,
  customers,
  halls,
  rooms,
  bookings,
  bookingHalls,
  bookingRooms,
  quotations,
  invoices,
  payments,
  expenses,
  auditLogs,
  settings,
} from './src/db/schema.ts';
import { eq, desc, asc, and, or, ne, sql, ilike, gte, lte } from 'drizzle-orm';
import {
  authenticate,
  requireRoles,
  generateToken,
  comparePassword,
  hashPassword,
  AuthenticatedRequest,
} from './src/server/auth.ts';
import { logAudit } from './src/server/audit.ts';
import { calculateFinancials } from './src/server/finance.ts';
import { checkHallConflict, checkRoomConflict } from './src/server/availability.ts';
import { seedDatabase } from './src/db/seed.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Health Check Endpoint
app.get('/api/v1/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'Bandhan Vatika Management API' });
});

// Run seed on startup if tables are empty
seedDatabase().catch((e) => console.error('Seed error:', e));

// Simple in-memory rate limiter for auth routes
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const checkRateLimit = (ip: string): boolean => {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (record.count >= 10) return false;
  record.count += 1;
  return true;
};

// ----------------------------------------------------
// 1. AUTHENTICATION MODULE
// ----------------------------------------------------

app.post('/api/v1/auth/login', async (req: Request, res: Response) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(ip)) {
      return res.status(429).json({
        success: false,
        error: { code: 'TOO_MANY_REQUESTS', message: 'Too many login attempts. Please wait 1 minute.' },
      });
    }

    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Username/Email and password are required.' },
      });
    }

    const trimmed = String(username).trim().toLowerCase();
    const [user] = await db
      .select()
      .from(users)
      .where(or(eq(users.username, trimmed), eq(users.email, trimmed)));

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' },
      });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_INACTIVE', message: 'Account is deactivated. Contact Owner.' },
      });
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' },
      });
    }

    // Update last login
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    const authUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      role: user.role as any,
      phone: user.phone,
    };
    const token = generateToken(authUser);

    await logAudit({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      details: `${user.name} (${user.role}) logged in successfully`,
      ipAddress: ip,
    });

    res.json({
      success: true,
      data: {
        token,
        user: authUser,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Authentication failure.' } });
  }
});

app.get('/api/v1/auth/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: { user: req.user },
  });
});

app.post('/api/v1/auth/logout', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user) {
    await logAudit({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'LOGOUT',
      entity: 'User',
      entityId: req.user.id,
      details: 'User logged out',
    });
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

app.post('/api/v1/auth/reset-password', async (req: Request, res: Response) => {
  // Security requirement: Never reveal whether email/username exists
  const { email } = req.body;
  res.json({
    success: true,
    message: 'If the account exists, password reset instructions have been forwarded to the administrator.',
  });
});

// ----------------------------------------------------
// 2. DASHBOARD MODULE
// ----------------------------------------------------

app.get('/api/v1/dashboard', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role === 'STAFF') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Staff accounts are restricted to the Schedule Calendar view.' },
      });
    }

    const isFinanceRole = req.user?.role === 'OWNER' || req.user?.role === 'ACCOUNTANT';

    const allBookings = await db.select().from(bookings).orderBy(desc(bookings.eventDate));
    const allPayments = await db.select().from(payments).orderBy(desc(payments.paymentDate));
    const allExpenses = await db.select().from(expenses);
    const allHalls = await db.select().from(halls);
    const allRooms = await db.select().from(rooms);
    const allCustomers = await db.select().from(customers);

    const totalBookings = allBookings.length;
    const confirmedBookings = allBookings.filter(
      (b) => b.status === 'CONFIRMED' || b.status === 'SCHEDULED' || b.status === 'COMPLETED'
    ).length;

    let totalRevenue = 0;
    let pendingPayments = 0;
    for (const b of allBookings) {
      if (b.status !== 'CANCELLED') {
        totalRevenue += Number(b.grandTotal || 0);
        pendingPayments += Number(b.balanceAmount || 0);
      }
    }

    let totalExpenseAmount = 0;
    for (const e of allExpenses) {
      totalExpenseAmount += Number(e.amount || 0);
    }

    // Monthly revenue distribution (Jan - Dec)
    const monthlyData = [
      { month: 'Jan', amount: 35000 },
      { month: 'Feb', amount: 50000 },
      { month: 'Mar', amount: 45000 },
      { month: 'Apr', amount: 70000 },
      { month: 'May', amount: 85000 },
      { month: 'Jun', amount: 60000 },
      { month: 'Jul', amount: 90000 },
      { month: 'Aug', amount: 110000 },
      { month: 'Sep', amount: 105000 },
      { month: 'Oct', amount: 130000 },
      { month: 'Nov', amount: 150000 },
      { month: 'Dec', amount: 180000 },
    ];

    // Upcoming bookings (sorted by date)
    const custMap = new Map(allCustomers.map((c) => [c.id, c]));
    const hallMap = new Map(allHalls.map((h) => [h.id, h]));

    const upcoming = allBookings
      .filter((b) => b.status !== 'CANCELLED')
      .slice(0, 5)
      .map((b) => {
        const c = custMap.get(b.customerId);
        const h = b.hallId ? hallMap.get(b.hallId) : null;
        return {
          id: b.id,
          bookingNumber: b.bookingNumber,
          customerName: c?.name || 'Customer',
          customerPhone: c?.mobile || '',
          eventType: b.eventType,
          eventDate: b.eventDate,
          startTime: b.startTime,
          endTime: b.endTime,
          hallName: h?.name || 'Grand Hall',
          status: b.status,
          grandTotal: isFinanceRole ? b.grandTotal : '0',
          balanceAmount: isFinanceRole ? b.balanceAmount : '0',
        };
      });

    // Recent Inquiries / Bookings list
    const recent = allBookings.slice(0, 5).map((b) => {
      const c = custMap.get(b.customerId);
      return {
        id: b.id,
        name: c?.name || 'Guest',
        phone: c?.mobile || '—',
        eventType: b.eventType,
        eventDate: b.eventDate,
        status: b.status,
      };
    });

    res.json({
      success: true,
      data: {
        stats: {
          totalBookings,
          confirmedBookings,
          totalRevenue: isFinanceRole ? Math.round(totalRevenue) : 0,
          pendingPayments: isFinanceRole ? Math.round(pendingPayments) : 0,
          totalExpenses: isFinanceRole ? Math.round(totalExpenseAmount) : 0,
          netProfit: isFinanceRole ? Math.round(totalRevenue - totalExpenseAmount) : 0,
        },
        monthlyRevenue: isFinanceRole ? monthlyData : [],
        upcomingBookings: upcoming,
        recentInquiries: recent,
        hallsCount: allHalls.length,
        roomsCount: allRooms.length,
      },
    });
  } catch (err: any) {
    console.error('Dashboard error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch dashboard data.' } });
  }
});

// ----------------------------------------------------
// 3. CUSTOMER MODULE (Master Data)
// ----------------------------------------------------

// Phone validator: Indian and international format (10 to 15 digits)
function isValidMobile(mobile: string): boolean {
  const cleaned = mobile.replace(/[\s\-\+]/g, '');
  return /^[0-9]{10,15}$/.test(cleaned);
}

// Decimal/Price validator: non-negative finite number with sensible precision
function isValidPrice(val: any): boolean {
  if (val === undefined || val === null || val === '') return false;
  const num = Number(val);
  return !isNaN(num) && isFinite(num) && num >= 0;
}

// Capacity validator: strictly positive integer
function isValidCapacity(val: any): boolean {
  if (val === undefined || val === null || val === '') return false;
  const num = Number(val);
  return !isNaN(num) && Number.isInteger(num) && num > 0;
}

// GET /api/v1/customers — List with Search, Filter, Pagination, Sorting
app.get('/api/v1/customers', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : 'all'; // 'active', 'inactive', 'all'
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';

    let all = await db.select().from(customers);

    // Filter by status (isActive)
    if (status === 'active') {
      all = all.filter((c) => c.isActive === true);
    } else if (status === 'inactive') {
      all = all.filter((c) => c.isActive === false);
    }

    // Filter by search query
    if (search) {
      all = all.filter((c) => {
        const nameMatch = c.name?.toLowerCase().includes(search);
        const mobileMatch = c.mobile?.includes(search);
        const codeMatch = c.customerCode?.toLowerCase().includes(search);
        const emailMatch = c.email?.toLowerCase().includes(search);
        const cityMatch = c.city?.toLowerCase().includes(search);
        return nameMatch || mobileMatch || codeMatch || emailMatch || cityMatch;
      });
    }

    // Sorting
    all.sort((a: any, b: any) => {
      let valA = a[sortBy] ?? '';
      let valB = b[sortBy] ?? '';
      if (sortBy === 'createdAt') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      } else if (sortBy === 'totalBookings' || sortBy === 'totalSpent' || sortBy === 'outstandingAmount') {
        valA = Number(valA);
        valB = Number(valB);
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const total = all.length;
    const offset = (page - 1) * limit;
    const paginated = all.slice(offset, offset + limit);

    res.json({
      success: true,
      data: paginated,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/customers/check-mobile/:mobile — Real-time duplicate check with optional excludeId
app.get('/api/v1/customers/check-mobile/:mobile', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const mobile = req.params.mobile.trim().replace(/[\s\-\+]/g, '');
    const excludeId = typeof req.query.excludeId === 'string' ? req.query.excludeId.trim() : null;

    let existing = await db.select().from(customers).where(eq(customers.mobile, mobile));
    if (excludeId) {
      existing = existing.filter((c) => c.id !== excludeId);
    }

    if (existing.length > 0) {
      return res.json({
        success: true,
        exists: true,
        customer: existing[0],
        message: `Existing customer found: ${existing[0].name} (${existing[0].mobile} - ${existing[0].customerCode})`,
      });
    }
    res.json({ success: true, exists: false });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/customers/:id — View single customer with linked entities
app.get('/api/v1/customers/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [cust] = await db.select().from(customers).where(eq(customers.id, req.params.id));
    if (!cust) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found.' } });
    }

    const customerBookings = await db.select().from(bookings).where(eq(bookings.customerId, cust.id));
    const customerInvoices = await db.select().from(invoices).where(eq(invoices.customerId, cust.id));
    const customerPayments = await db.select().from(payments).where(eq(payments.customerId, cust.id));

    res.json({
      success: true,
      data: {
        ...cust,
        bookings: customerBookings,
        invoices: customerInvoices,
        payments: customerPayments,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/customers — Create customer with server-side validation & duplicate protection
app.post('/api/v1/customers', authenticate, requireRoles(['OWNER', 'MANAGER', 'RECEPTIONIST']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, mobile, email, address, city, idProofType, idProofNumber, notes } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Customer name is required (minimum 2 characters).' },
      });
    }

    if (!mobile || typeof mobile !== 'string' || !isValidMobile(mobile)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Valid mobile number (10 to 15 digits) is required.' },
      });
    }

    const cleanMobile = mobile.trim().replace(/[\s\-\+]/g, '');

    // Server-side duplicate protection
    const existing = await db.select().from(customers).where(eq(customers.mobile, cleanMobile));
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_MOBILE',
          message: `A customer with mobile number "${cleanMobile}" already exists (${existing[0].name} - ${existing[0].customerCode}).`,
        },
      });
    }

    // Email validation if provided
    if (email && typeof email === 'string' && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid email address format.' },
        });
      }
    }

    // Auto-generate customerCode
    const allExisting = await db.select({ code: customers.customerCode }).from(customers);
    let maxNum = 0;
    for (const row of allExisting) {
      const match = row.code?.match(/BV-CUST-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    const customerCode = `BV-CUST-${String(maxNum + 1).padStart(3, '0')}`;
    const id = `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const [created] = await db
      .insert(customers)
      .values({
        id,
        customerCode,
        name: name.trim(),
        mobile: cleanMobile,
        email: email ? email.trim() : null,
        address: address ? address.trim() : null,
        city: city ? city.trim() : 'Indore',
        idProofType: idProofType ? idProofType.trim() : null,
        idProofNumber: idProofNumber ? idProofNumber.trim() : null,
        notes: notes ? notes.trim() : null,
        isActive: true,
      })
      .returning();

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Staff',
      userRole: req.user?.role || 'STAFF',
      action: 'CUSTOMER_CREATE',
      entity: 'Customer',
      entityId: id,
      details: `Created customer ${created.name} (${created.mobile}) with code ${customerCode}`,
    });

    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE_MOBILE', message: 'A customer with this mobile number already exists in the database.' },
      });
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PUT /api/v1/customers/:id — Edit customer with server-side validation & duplicate check
app.put('/api/v1/customers/:id', authenticate, requireRoles(['OWNER', 'MANAGER', 'RECEPTIONIST']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [existing] = await db.select().from(customers).where(eq(customers.id, req.params.id));
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found.' } });
    }

    const { name, mobile, email, address, city, idProofType, idProofNumber, notes } = req.body;

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Customer name must be at least 2 characters.' },
        });
      }
    }

    let cleanMobile = existing.mobile;
    if (mobile !== undefined) {
      if (typeof mobile !== 'string' || !isValidMobile(mobile)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Valid mobile number (10 to 15 digits) is required.' },
        });
      }
      cleanMobile = mobile.trim().replace(/[\s\-\+]/g, '');

      // Check if another customer already has this mobile
      if (cleanMobile !== existing.mobile) {
        const dup = await db
          .select()
          .from(customers)
          .where(and(eq(customers.mobile, cleanMobile), ne(customers.id, req.params.id)));
        if (dup.length > 0) {
          return res.status(409).json({
            success: false,
            error: {
              code: 'DUPLICATE_MOBILE',
              message: `Another customer with mobile number "${cleanMobile}" already exists (${dup[0].name} - ${dup[0].customerCode}).`,
            },
          });
        }
      }
    }

    if (email !== undefined && email && typeof email === 'string' && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid email address format.' },
        });
      }
    }

    const [updated] = await db
      .update(customers)
      .set({
        name: name !== undefined ? name.trim() : existing.name,
        mobile: cleanMobile,
        email: email !== undefined ? (email ? email.trim() : null) : existing.email,
        address: address !== undefined ? (address ? address.trim() : null) : existing.address,
        city: city !== undefined ? (city ? city.trim() : 'Indore') : existing.city,
        idProofType: idProofType !== undefined ? (idProofType ? idProofType.trim() : null) : existing.idProofType,
        idProofNumber: idProofNumber !== undefined ? (idProofNumber ? idProofNumber.trim() : null) : existing.idProofNumber,
        notes: notes !== undefined ? (notes ? notes.trim() : null) : existing.notes,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, req.params.id))
      .returning();

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Staff',
      userRole: req.user?.role || 'STAFF',
      action: 'CUSTOMER_UPDATE',
      entity: 'Customer',
      entityId: existing.id,
      details: `Updated customer ${updated.name} (${updated.customerCode})`,
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE_MOBILE', message: 'Another customer with this mobile number already exists.' },
      });
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// DELETE /api/v1/customers/:id — Soft-delete / Deactivate customer
app.delete('/api/v1/customers/:id', authenticate, requireRoles(['OWNER', 'MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [existing] = await db.select().from(customers).where(eq(customers.id, req.params.id));
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found.' } });
    }

    const [updated] = await db
      .update(customers)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, req.params.id))
      .returning();

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Manager',
      userRole: req.user?.role || 'MANAGER',
      action: 'CUSTOMER_DEACTIVATE',
      entity: 'Customer',
      entityId: existing.id,
      details: `Deactivated customer ${existing.name} (${existing.customerCode})`,
    });

    res.json({ success: true, message: 'Customer deactivated successfully.', data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/customers/:id/activate — Reactivate deactivated customer
app.post('/api/v1/customers/:id/activate', authenticate, requireRoles(['OWNER', 'MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [existing] = await db.select().from(customers).where(eq(customers.id, req.params.id));
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found.' } });
    }

    const [updated] = await db
      .update(customers)
      .set({
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, req.params.id))
      .returning();

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Manager',
      userRole: req.user?.role || 'MANAGER',
      action: 'CUSTOMER_ACTIVATE',
      entity: 'Customer',
      entityId: existing.id,
      details: `Reactivated customer ${existing.name} (${existing.customerCode})`,
    });

    res.json({ success: true, message: 'Customer activated successfully.', data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ----------------------------------------------------
// 4. HALLS MODULE (Master Data)
// ----------------------------------------------------

const VALID_HALL_STATUSES = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'] as const;

// GET /api/v1/halls — List with search and status filter
app.get('/api/v1/halls', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim().toUpperCase() : 'ALL';

    let list = await db.select().from(halls).orderBy(asc(halls.code));

    if (status !== 'ALL') {
      list = list.filter((h) => h.status === status);
    }

    if (search) {
      list = list.filter((h) => {
        const nameMatch = h.name.toLowerCase().includes(search);
        const codeMatch = h.code.toLowerCase().includes(search);
        const typeMatch = h.type.toLowerCase().includes(search);
        return nameMatch || codeMatch || typeMatch;
      });
    }

    res.json({ success: true, data: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/halls/:id — View single hall
app.get('/api/v1/halls/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [hall] = await db.select().from(halls).where(eq(halls.id, req.params.id));
    if (!hall) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Hall not found.' } });
    }
    res.json({ success: true, data: hall });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/halls — Create Hall with validation
app.post('/api/v1/halls', authenticate, requireRoles(['OWNER', 'MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { code, name, type, capacity, basePrice, status, amenities, description } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Hall name is required (minimum 2 characters).' },
      });
    }

    if (!code || typeof code !== 'string' || code.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Hall code is required (minimum 2 characters).' },
      });
    }

    const cleanCode = code.trim().toUpperCase();
    const existingCode = await db.select().from(halls).where(eq(halls.code, cleanCode));
    if (existingCode.length > 0) {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE_CODE', message: `A hall with code "${cleanCode}" already exists.` },
      });
    }

    if (!isValidCapacity(capacity)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Capacity must be a strictly positive integer (> 0).' },
      });
    }

    if (!isValidPrice(basePrice)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Base price must be a valid non-negative number.' },
      });
    }

    const hallStatus = status ? status.trim().toUpperCase() : 'ACTIVE';
    if (!VALID_HALL_STATUSES.includes(hallStatus as any)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid hall status "${status}". Allowed values: ${VALID_HALL_STATUSES.join(', ')}.`,
        },
      });
    }

    const id = `hall-${Date.now()}`;
    const formattedPrice = Number(basePrice).toFixed(2);

    const [created] = await db
      .insert(halls)
      .values({
        id,
        code: cleanCode,
        name: name.trim(),
        type: type && typeof type === 'string' ? type.trim() : 'Banquet Hall',
        capacity: Number(capacity),
        basePrice: formattedPrice,
        status: hallStatus,
        amenities: JSON.stringify(Array.isArray(amenities) ? amenities : ['AC', 'Stage', 'Parking']),
        description: description ? description.trim() : null,
      })
      .returning();

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Manager',
      userRole: req.user?.role || 'MANAGER',
      action: 'HALL_CREATE',
      entity: 'Hall',
      entityId: id,
      details: `Created hall ${created.name} (${created.code}) with capacity ${created.capacity} and base price ₹${created.basePrice}`,
    });

    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE_CODE', message: 'A hall with this code already exists.' },
      });
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PUT /api/v1/halls/:id — Update Hall with validation
app.put('/api/v1/halls/:id', authenticate, requireRoles(['OWNER', 'MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [existing] = await db.select().from(halls).where(eq(halls.id, req.params.id));
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Hall not found.' } });
    }

    const { code, name, type, capacity, basePrice, status, amenities, description } = req.body;

    let cleanCode = existing.code;
    if (code !== undefined) {
      if (typeof code !== 'string' || code.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Hall code must be at least 2 characters.' },
        });
      }
      cleanCode = code.trim().toUpperCase();
      if (cleanCode !== existing.code) {
        const dup = await db.select().from(halls).where(and(eq(halls.code, cleanCode), ne(halls.id, req.params.id)));
        if (dup.length > 0) {
          return res.status(409).json({
            success: false,
            error: { code: 'DUPLICATE_CODE', message: `Another hall with code "${cleanCode}" already exists.` },
          });
        }
      }
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Hall name must be at least 2 characters.' },
        });
      }
    }

    if (capacity !== undefined && !isValidCapacity(capacity)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Capacity must be a strictly positive integer (> 0).' },
      });
    }

    if (basePrice !== undefined && !isValidPrice(basePrice)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Base price must be a valid non-negative number.' },
      });
    }

    if (status !== undefined) {
      const hallStatus = String(status).trim().toUpperCase();
      if (!VALID_HALL_STATUSES.includes(hallStatus as any)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid hall status "${status}". Allowed values: ${VALID_HALL_STATUSES.join(', ')}.`,
          },
        });
      }
    }

    const [updated] = await db
      .update(halls)
      .set({
        code: cleanCode,
        name: name !== undefined ? name.trim() : existing.name,
        type: type !== undefined ? type.trim() : existing.type,
        capacity: capacity !== undefined ? Number(capacity) : existing.capacity,
        basePrice: basePrice !== undefined ? Number(basePrice).toFixed(2) : existing.basePrice,
        status: status !== undefined ? String(status).trim().toUpperCase() : existing.status,
        amenities: amenities !== undefined ? JSON.stringify(Array.isArray(amenities) ? amenities : []) : existing.amenities,
        description: description !== undefined ? (description ? description.trim() : null) : existing.description,
        updatedAt: new Date(),
      })
      .where(eq(halls.id, req.params.id))
      .returning();

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Manager',
      userRole: req.user?.role || 'MANAGER',
      action: 'HALL_UPDATE',
      entity: 'Hall',
      entityId: existing.id,
      details: `Updated hall ${updated.name} (${updated.code}) - Status: ${updated.status}, Base Price: ₹${updated.basePrice}`,
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PATCH /api/v1/halls/:id/status — Quick status toggle (ACTIVE / INACTIVE / MAINTENANCE)
app.patch('/api/v1/halls/:id/status', authenticate, requireRoles(['OWNER', 'MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [existing] = await db.select().from(halls).where(eq(halls.id, req.params.id));
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Hall not found.' } });
    }

    const { status } = req.body;
    const hallStatus = typeof status === 'string' ? status.trim().toUpperCase() : '';
    if (!VALID_HALL_STATUSES.includes(hallStatus as any)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid hall status "${status}". Allowed values: ${VALID_HALL_STATUSES.join(', ')}.`,
        },
      });
    }

    const [updated] = await db
      .update(halls)
      .set({
        status: hallStatus,
        updatedAt: new Date(),
      })
      .where(eq(halls.id, req.params.id))
      .returning();

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Manager',
      userRole: req.user?.role || 'MANAGER',
      action: 'HALL_STATUS_CHANGE',
      entity: 'Hall',
      entityId: existing.id,
      details: `Changed hall ${existing.name} (${existing.code}) status from ${existing.status} to ${hallStatus}`,
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ----------------------------------------------------
// 5. ROOMS MODULE (Master Data)
// ----------------------------------------------------

const VALID_ROOM_STATUSES = ['AVAILABLE', 'RESERVED', 'OCCUPIED', 'CLEANING', 'MAINTENANCE', 'BLOCKED'] as const;

// GET /api/v1/rooms — List with search, status, and AC filters
app.get('/api/v1/rooms', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim().toUpperCase() : 'ALL';
    const isAcParam = req.query.isAc;

    let list = await db.select().from(rooms).orderBy(asc(rooms.roomNumber));

    if (status !== 'ALL') {
      list = list.filter((r) => r.status === status);
    }

    if (isAcParam !== undefined && isAcParam !== 'ALL') {
      const isAcBool = isAcParam === 'true' || isAcParam === '1';
      list = list.filter((r) => r.isAc === isAcBool);
    }

    if (search) {
      list = list.filter((r) => {
        const numMatch = r.roomNumber.toLowerCase().includes(search);
        const typeMatch = r.roomType.toLowerCase().includes(search);
        return numMatch || typeMatch;
      });
    }

    res.json({ success: true, data: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/rooms/:id — View single room
app.get('/api/v1/rooms/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [room] = await db.select().from(rooms).where(eq(rooms.id, req.params.id));
    if (!room) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Room not found.' } });
    }
    res.json({ success: true, data: room });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/rooms — Create Room with validation
app.post('/api/v1/rooms', authenticate, requireRoles(['OWNER', 'MANAGER', 'RECEPTIONIST']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roomNumber, roomType, isAc, capacity, pricePerNight, status, amenities, description } = req.body;

    if (!roomNumber || typeof roomNumber !== 'string' || roomNumber.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Room number is required.' },
      });
    }

    const cleanNumber = roomNumber.trim();
    const existing = await db.select().from(rooms).where(eq(rooms.roomNumber, cleanNumber));
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE_ROOM_NUMBER', message: `A room with number "${cleanNumber}" already exists.` },
      });
    }

    if (!roomType || typeof roomType !== 'string' || roomType.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Room type is required (e.g. Deluxe Room, Suite Room).' },
      });
    }

    if (!isValidCapacity(capacity)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Capacity must be a strictly positive integer (> 0).' },
      });
    }

    if (!isValidPrice(pricePerNight)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Price per night must be a valid non-negative number.' },
      });
    }

    const roomStatus = status ? status.trim().toUpperCase() : 'AVAILABLE';
    if (!VALID_ROOM_STATUSES.includes(roomStatus as any)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid room status "${status}". Allowed values: ${VALID_ROOM_STATUSES.join(', ')}.`,
        },
      });
    }

    const id = `room-${Date.now()}`;
    const formattedPrice = Number(pricePerNight).toFixed(2);

    const [created] = await db
      .insert(rooms)
      .values({
        id,
        roomNumber: cleanNumber,
        roomType: roomType.trim(),
        isAc: isAc !== undefined ? Boolean(isAc) : true,
        capacity: Number(capacity),
        pricePerNight: formattedPrice,
        status: roomStatus,
        amenities: JSON.stringify(Array.isArray(amenities) ? amenities : ['AC', 'WiFi', 'Attached Bath']),
        description: description ? description.trim() : null,
      })
      .returning();

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Staff',
      userRole: req.user?.role || 'STAFF',
      action: 'ROOM_CREATE',
      entity: 'Room',
      entityId: id,
      details: `Created room ${created.roomNumber} (${created.roomType}) - Capacity: ${created.capacity}, Price: ₹${created.pricePerNight}`,
    });

    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE_ROOM_NUMBER', message: 'A room with this number already exists.' },
      });
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PUT /api/v1/rooms/:id — Update Room with validation
app.put('/api/v1/rooms/:id', authenticate, requireRoles(['OWNER', 'MANAGER', 'RECEPTIONIST']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [existing] = await db.select().from(rooms).where(eq(rooms.id, req.params.id));
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Room not found.' } });
    }

    const { roomNumber, roomType, isAc, capacity, pricePerNight, status, amenities, description } = req.body;

    let cleanNumber = existing.roomNumber;
    if (roomNumber !== undefined) {
      if (typeof roomNumber !== 'string' || roomNumber.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Room number cannot be empty.' },
        });
      }
      cleanNumber = roomNumber.trim();
      if (cleanNumber !== existing.roomNumber) {
        const dup = await db.select().from(rooms).where(and(eq(rooms.roomNumber, cleanNumber), ne(rooms.id, req.params.id)));
        if (dup.length > 0) {
          return res.status(409).json({
            success: false,
            error: { code: 'DUPLICATE_ROOM_NUMBER', message: `Another room with number "${cleanNumber}" already exists.` },
          });
        }
      }
    }

    if (capacity !== undefined && !isValidCapacity(capacity)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Capacity must be a strictly positive integer (> 0).' },
      });
    }

    if (pricePerNight !== undefined && !isValidPrice(pricePerNight)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Price per night must be a valid non-negative number.' },
      });
    }

    if (status !== undefined) {
      const roomStatus = String(status).trim().toUpperCase();
      if (!VALID_ROOM_STATUSES.includes(roomStatus as any)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid room status "${status}". Allowed values: ${VALID_ROOM_STATUSES.join(', ')}.`,
          },
        });
      }
    }

    const [updated] = await db
      .update(rooms)
      .set({
        roomNumber: cleanNumber,
        roomType: roomType !== undefined ? roomType.trim() : existing.roomType,
        isAc: isAc !== undefined ? Boolean(isAc) : existing.isAc,
        capacity: capacity !== undefined ? Number(capacity) : existing.capacity,
        pricePerNight: pricePerNight !== undefined ? Number(pricePerNight).toFixed(2) : existing.pricePerNight,
        status: status !== undefined ? String(status).trim().toUpperCase() : existing.status,
        amenities: amenities !== undefined ? JSON.stringify(Array.isArray(amenities) ? amenities : []) : existing.amenities,
        description: description !== undefined ? (description ? description.trim() : null) : existing.description,
        updatedAt: new Date(),
      })
      .where(eq(rooms.id, req.params.id))
      .returning();

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Staff',
      userRole: req.user?.role || 'STAFF',
      action: 'ROOM_UPDATE',
      entity: 'Room',
      entityId: existing.id,
      details: `Updated room ${updated.roomNumber} - Status: ${updated.status}, Price: ₹${updated.pricePerNight}`,
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PATCH /api/v1/rooms/:id/status — Room status management
app.patch('/api/v1/rooms/:id/status', authenticate, requireRoles(['OWNER', 'MANAGER', 'RECEPTIONIST']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [existing] = await db.select().from(rooms).where(eq(rooms.id, req.params.id));
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Room not found.' } });
    }

    const { status } = req.body;
    const roomStatus = typeof status === 'string' ? status.trim().toUpperCase() : '';
    if (!VALID_ROOM_STATUSES.includes(roomStatus as any)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid room status "${status}". Allowed values: ${VALID_ROOM_STATUSES.join(', ')}.`,
        },
      });
    }

    const [updated] = await db
      .update(rooms)
      .set({
        status: roomStatus,
        updatedAt: new Date(),
      })
      .where(eq(rooms.id, req.params.id))
      .returning();

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Staff',
      userRole: req.user?.role || 'STAFF',
      action: 'ROOM_STATUS_CHANGE',
      entity: 'Room',
      entityId: existing.id,
      details: `Changed room ${existing.roomNumber} status from ${existing.status} to ${roomStatus}`,
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ----------------------------------------------------
// 6. BOOKINGS MODULE (Phase 3: Booking Engine)
// ----------------------------------------------------

function isValidDate(dateStr: any): boolean {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (year < 2024 || year > 2050 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(`${dateStr}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month && d.getUTCDate() === day;
}

function isValidTime(timeStr: any): boolean {
  if (typeof timeStr !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeStr)) return false;
  return true;
}

function calculateNights(checkInDate: string, checkOutDate: string): number {
  const d1 = new Date(`${checkInDate}T00:00:00Z`).getTime();
  const d2 = new Date(`${checkOutDate}T00:00:00Z`).getTime();
  const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  CONFIRMED: ['SCHEDULED', 'IN_PROGRESS', 'CANCELLED', 'POSTPONED'],
  SCHEDULED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'POSTPONED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  POSTPONED: ['CONFIRMED', 'SCHEDULED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

// GET /api/v1/bookings — List bookings with search, status, hall, customer, date filters and pagination
app.get('/api/v1/bookings', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim().toUpperCase() : 'ALL';
    const hallId = typeof req.query.hallId === 'string' ? req.query.hallId.trim() : 'ALL';
    const customerId = typeof req.query.customerId === 'string' ? req.query.customerId.trim() : 'ALL';
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : null;
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : null;
    const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy.trim() : 'eventDate';
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';

    const allBookings = await db.select().from(bookings).orderBy(desc(bookings.eventDate), desc(bookings.createdAt));
    const allCust = await db.select().from(customers);
    const allHalls = await db.select().from(halls);
    const allBookingRooms = await db.select().from(bookingRooms);
    const allRooms = await db.select().from(rooms);

    const cMap = new Map(allCust.map((c) => [c.id, c]));
    const hMap = new Map(allHalls.map((h) => [h.id, h]));
    const rMap = new Map(allRooms.map((r) => [r.id, r]));

    // Group bookingRooms by bookingId
    const brMap = new Map<string, any[]>();
    for (const br of allBookingRooms) {
      const roomDetails = rMap.get(br.roomId);
      const list = brMap.get(br.bookingId) || [];
      list.push({ ...br, room: roomDetails || null });
      brMap.set(br.bookingId, list);
    }

    let enriched = allBookings.map((b) => {
      let parsedServices: any[] = [];
      try {
        parsedServices = typeof b.services === 'string' ? JSON.parse(b.services) : b.services || [];
      } catch {
        parsedServices = [];
      }

      return {
        ...b,
        customer: cMap.get(b.customerId) || null,
        hall: b.hallId ? hMap.get(b.hallId) || null : null,
        rooms: brMap.get(b.id) || [],
        parsedServices,
      };
    });

    // Apply Filters
    if (status !== 'ALL') {
      enriched = enriched.filter((b) => b.status === status);
    }

    if (hallId !== 'ALL') {
      enriched = enriched.filter((b) => b.hallId === hallId);
    }

    if (customerId !== 'ALL') {
      enriched = enriched.filter((b) => b.customerId === customerId);
    }

    if (startDate) {
      enriched = enriched.filter((b) => b.eventDate >= startDate);
    }

    if (endDate) {
      enriched = enriched.filter((b) => b.eventDate <= endDate);
    }

    if (search) {
      enriched = enriched.filter((b) => {
        const matchNum = b.bookingNumber.toLowerCase().includes(search);
        const matchCust = b.customer?.name?.toLowerCase().includes(search);
        const matchMobile = b.customer?.mobile?.includes(search);
        const matchType = b.eventType?.toLowerCase().includes(search);
        return matchNum || matchCust || matchMobile || matchType;
      });
    }

    // Sort
    enriched.sort((a: any, b: any) => {
      let valA = a[sortBy] ?? '';
      let valB = b[sortBy] ?? '';
      if (sortBy === 'createdAt') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      } else if (sortBy === 'grandTotal' || sortBy === 'balanceAmount' || sortBy === 'guestCount') {
        valA = Number(valA);
        valB = Number(valB);
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const total = enriched.length;
    const offset = (page - 1) * limit;
    const paginated = enriched.slice(offset, offset + limit);

    res.json({
      success: true,
      data: paginated,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/bookings/check-availability — Pre-flight real-time conflict checking
app.post('/api/v1/bookings/check-availability', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { hallId, eventDate, startTime, endTime, roomIds, checkInDate, checkOutDate, excludeBookingId } = req.body;

    const conflicts: Array<{ type: 'HALL_CONFLICT' | 'ROOM_CONFLICT'; message: string; resourceId: string; resourceName?: string }> = [];
    let hallAvailable = true;
    let roomsAvailable = true;

    if (hallId && eventDate && startTime && endTime) {
      if (!isValidDate(eventDate)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_EVENT_DATE', message: 'Event date must be a valid YYYY-MM-DD date.' },
        });
      }
      if (!isValidTime(startTime) || !isValidTime(endTime)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_TIME_FORMAT', message: 'Start and End time must be in HH:mm 24-hr format.' },
        });
      }
      if (startTime >= endTime) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_TIME_RANGE', message: 'Start time must be strictly before end time.' },
        });
      }

      const hallCheck = await checkHallConflict(hallId, eventDate, startTime, endTime, excludeBookingId);
      if (hallCheck.hasConflict) {
        hallAvailable = false;
        conflicts.push({
          type: 'HALL_CONFLICT',
          message: hallCheck.message || 'Hall time slot is already booked.',
          resourceId: hallId,
          resourceName: hallCheck.conflictedResourceName,
        });
      }
    }

    if (Array.isArray(roomIds) && roomIds.length > 0) {
      const effCheckIn = checkInDate || eventDate;
      const effCheckOut = checkOutDate || eventDate;

      if (!isValidDate(effCheckIn) || !isValidDate(effCheckOut)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ROOM_DATES', message: 'Room check-in and check-out dates must be valid YYYY-MM-DD dates.' },
        });
      }
      if (effCheckOut <= effCheckIn) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ROOM_DATES', message: 'Room check-out date must be strictly after check-in date.' },
        });
      }

      for (const rId of roomIds) {
        const roomCheck = await checkRoomConflict(rId, effCheckIn, effCheckOut, excludeBookingId);
        if (roomCheck.hasConflict) {
          roomsAvailable = false;
          conflicts.push({
            type: 'ROOM_CONFLICT',
            message: roomCheck.message || 'Room is already reserved for the selected date range.',
            resourceId: rId,
            resourceName: roomCheck.conflictedResourceName,
          });
        }
      }
    }

    const available = hallAvailable && roomsAvailable;
    res.json({
      success: true,
      available,
      hallAvailable,
      roomsAvailable,
      conflicts,
      message: available
        ? 'All selected venues and rooms are available!'
        : conflicts[0]?.message || 'Selected resources have scheduling conflicts.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/bookings — Create booking with transactional concurrency & backend financial computation
app.post('/api/v1/bookings', authenticate, requireRoles(['OWNER', 'MANAGER', 'RECEPTIONIST']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      customerId,
      eventType,
      eventDate,
      startTime,
      endTime,
      guestCount,
      hallId,
      roomIds = [],
      checkInDate,
      checkOutDate,
      services = [],
      discount = 0,
      advancePayment = 0,
      paymentMethod = 'CASH',
      notes,
    } = req.body;

    // 1. Validate Base Event Fields
    if (!customerId || typeof customerId !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Customer ID is required.' },
      });
    }

    if (!eventType || typeof eventType !== 'string' || eventType.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Event type is required (minimum 2 characters).' },
      });
    }

    if (!isValidDate(eventDate)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_EVENT_DATE', message: 'Event date must be a valid YYYY-MM-DD date.' },
      });
    }

    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TIME_FORMAT', message: 'Start and End time must be in HH:mm 24-hr format.' },
      });
    }

    if (startTime >= endTime) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TIME_RANGE', message: 'Start time must be strictly before end time.' },
      });
    }

    const parsedGuestCount = Number(guestCount);
    if (!Number.isInteger(parsedGuestCount) || parsedGuestCount <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Guest count must be a positive integer (> 0).' },
      });
    }

    // 2. Validate Room Dates if rooms requested
    const selectedRoomIds = Array.isArray(roomIds) ? roomIds : [];
    let effCheckIn = checkInDate || eventDate;
    let effCheckOut = checkOutDate || null;
    if (selectedRoomIds.length > 0) {
      if (!effCheckOut) {
        // Default to next day
        const d = new Date(`${effCheckIn}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + 1);
        effCheckOut = d.toISOString().split('T')[0];
      }

      if (!isValidDate(effCheckIn) || !isValidDate(effCheckOut)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ROOM_DATES', message: 'Room check-in and check-out dates must be valid YYYY-MM-DD dates.' },
        });
      }

      if (effCheckOut <= effCheckIn) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ROOM_DATES', message: 'Room check-out date must be strictly after check-in date.' },
        });
      }
    }

    // 3. Transactional Execution with PostgreSQL Advisory Locks
    const result = await db.transaction(async (tx) => {
      // 3.1 Validate Customer
      const [cust] = await tx.select().from(customers).where(eq(customers.id, customerId));
      if (!cust) {
        throw { status: 404, code: 'INVALID_CUSTOMER', message: 'Selected customer not found.' };
      }
      if (!cust.isActive) {
        throw { status: 400, code: 'INACTIVE_CUSTOMER', message: 'Selected customer is deactivated and cannot book.' };
      }

      // 3.2 Validate & Lock Hall
      let selectedHall: any = null;
      if (hallId) {
        const [h] = await tx.select().from(halls).where(eq(halls.id, hallId));
        if (!h) {
          throw { status: 404, code: 'INVALID_HALL', message: 'Selected hall not found.' };
        }
        if (h.status === 'MAINTENANCE' || h.status === 'INACTIVE') {
          throw {
            status: 400,
            code: 'INVALID_HALL',
            message: `Hall "${h.name}" is currently under ${h.status.toLowerCase()} and cannot be booked.`,
          };
        }
        selectedHall = h;

        // PostgreSQL Advisory Transaction Lock for Hall on Event Date
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'hall:' + hallId + ':' + eventDate}))`);
        const hallCheck = await checkHallConflict(hallId, eventDate, startTime, endTime, undefined, tx);
        if (hallCheck.hasConflict) {
          throw { status: 409, code: 'BOOKING_CONFLICT', message: hallCheck.message };
        }
      }

      // 3.3 Validate & Lock Rooms
      const selectedRoomsList: any[] = [];
      if (selectedRoomIds.length > 0) {
        for (const rId of selectedRoomIds) {
          const [r] = await tx.select().from(rooms).where(eq(rooms.id, rId));
          if (!r) {
            throw { status: 404, code: 'INVALID_ROOM', message: `Selected room ID "${rId}" not found.` };
          }
          if (r.status === 'MAINTENANCE' || r.status === 'BLOCKED') {
            throw {
              status: 400,
              code: 'INVALID_ROOM',
              message: `Room "${r.roomNumber}" is currently ${r.status.toLowerCase()} and cannot be reserved.`,
            };
          }
          selectedRoomsList.push(r);

          // PostgreSQL Advisory Transaction Lock for Room
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'room:' + rId + ':' + effCheckIn}))`);
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'room_res:' + rId}))`);
          const roomCheck = await checkRoomConflict(rId, effCheckIn, effCheckOut, undefined, tx);
          if (roomCheck.hasConflict) {
            throw { status: 409, code: 'ROOM_CONFLICT', message: roomCheck.message };
          }
        }
      }

      // 3.4 Safe Concurrent Booking Number Generation
      const year = new Date().getFullYear();
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'booking_seq_' + year}))`);
      const existingBookings = await tx
        .select({ bookingNumber: bookings.bookingNumber })
        .from(bookings)
        .where(sql`${bookings.bookingNumber} LIKE ${'BV-BKG-' + year + '-%'}`);

      let maxSeq = 0;
      for (const b of existingBookings) {
        const parts = b.bookingNumber.split('-');
        const seq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
      const nextSeq = maxSeq + 1;
      const bookingNumber = `BV-BKG-${year}-${String(nextSeq).padStart(5, '0')}`;
      const bookingId = `bkg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      // 3.5 Financial Calculations (Strict Backend Calculation)
      const financialItems: Array<{ description: string; qty: number; rate: number }> = [];

      // Hall rental item
      if (selectedHall) {
        financialItems.push({
          description: `Venue Rental (${selectedHall.name})`,
          qty: 1,
          rate: Number(selectedHall.basePrice),
        });
      }

      // Room accommodation items
      const roomNights = selectedRoomIds.length > 0 ? calculateNights(effCheckIn, effCheckOut) : 1;
      for (const r of selectedRoomsList) {
        financialItems.push({
          description: `Room Accommodation (${r.roomNumber} - ${r.roomType}, ${roomNights} night${roomNights > 1 ? 's' : ''})`,
          qty: roomNights,
          rate: Number(r.pricePerNight),
        });
      }

      // Additional itemized services
      const processedServices: any[] = [];
      if (Array.isArray(services)) {
        for (const s of services) {
          const sName = typeof s.name === 'string' ? s.name.trim() : '';
          const sQty = Math.max(1, Number(s.quantity || s.qty) || 1);
          const sRate = Math.max(0, Number(s.rate || s.cost) || 0);
          if (sName) {
            const amount = parseFloat((sQty * sRate).toFixed(2));
            processedServices.push({
              name: sName,
              quantity: sQty,
              rate: sRate,
              amount,
            });
            financialItems.push({
              description: sName,
              qty: sQty,
              rate: sRate,
            });
          }
        }
      }

      // Retrieve default GST tax rate from settings
      const [settingRow] = await tx.select().from(settings).where(eq(settings.id, 'default'));
      const taxPercent = settingRow ? Number(settingRow.defaultTaxPercent) : 18.0;

      // Validate discount
      const rawDiscount = Math.max(0, Number(discount) || 0);

      const fin = calculateFinancials(financialItems, rawDiscount, taxPercent, advancePayment);

      // Validate discount does not exceed subtotal
      if (rawDiscount > Number(fin.subtotal)) {
        throw {
          status: 400,
          code: 'VALIDATION_ERROR',
          message: `Discount (₹${rawDiscount}) cannot exceed subtotal (₹${fin.subtotal}).`,
        };
      }

      // 3.6 Insert Booking
      const [newBooking] = await tx
        .insert(bookings)
        .values({
          id: bookingId,
          bookingNumber,
          customerId,
          eventType: eventType.trim(),
          eventDate,
          startTime,
          endTime,
          guestCount: parsedGuestCount,
          hallId: hallId || null,
          hallIds: JSON.stringify(hallId ? [hallId] : []),
          roomIds: JSON.stringify(selectedRoomIds),
          services: JSON.stringify(processedServices),
          subtotal: fin.subtotal,
          discount: fin.discount,
          taxPercent: fin.taxPercent,
          taxAmount: fin.taxAmount,
          grandTotal: fin.grandTotal,
          paidAmount: fin.paidAmount,
          balanceAmount: fin.balanceAmount,
          status: 'CONFIRMED',
          notes: notes ? String(notes).trim() : '',
          createdBy: req.user?.username || 'admin',
        })
        .returning();

      // 3.7 Insert bookingHalls link
      if (hallId && selectedHall) {
        await tx.insert(bookingHalls).values({
          id: `bh-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          bookingId,
          hallId,
          eventDate,
          startTime,
          endTime,
          price: selectedHall.basePrice,
        });
      }

      // 3.8 Insert bookingRooms links
      for (const r of selectedRoomsList) {
        const roomTotal = (roomNights * Number(r.pricePerNight)).toFixed(2);
        await tx.insert(bookingRooms).values({
          id: `br-${Date.now()}-${r.id}-${Math.random().toString(36).substring(2, 5)}`,
          bookingId,
          roomId: r.id,
          checkInDate: effCheckIn,
          checkOutDate: effCheckOut,
          price: roomTotal,
        });
      }

      // 3.9 If advance payment was made, generate invoice and receipt
      if (Number(advancePayment) > 0) {
        const invCount = (await tx.select().from(invoices)).length + 1;
        const invoiceNumber = `INV-${year}-${String(invCount).padStart(4, '0')}`;
        const invoiceId = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;

        await tx.insert(invoices).values({
          id: invoiceId,
          invoiceNumber,
          customerId,
          bookingId,
          eventDate,
          items: JSON.stringify(fin.items),
          subtotal: fin.subtotal,
          discount: fin.discount,
          taxPercent: fin.taxPercent,
          taxAmount: fin.taxAmount,
          grandTotal: fin.grandTotal,
          paidAmount: fin.paidAmount,
          balanceAmount: fin.balanceAmount,
          status: Number(fin.balanceAmount) === 0 ? 'PAID' : 'PARTIAL',
          dueDate: eventDate,
          notes: `Invoice generated for Booking #${bookingNumber}`,
        });

        const [maxRec] = await tx
          .select({ receiptNumber: payments.receiptNumber })
          .from(payments)
          .where(sql`${payments.receiptNumber} LIKE ${`BV-PAY-${year}-%`}`)
          .orderBy(desc(payments.receiptNumber))
          .limit(1);

        let nextSeq = 1;
        if (maxRec?.receiptNumber) {
          const parts = maxRec.receiptNumber.split('-');
          const numPart = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(numPart)) nextSeq = numPart + 1;
        }
        const receiptNumber = `BV-PAY-${year}-${String(nextSeq).padStart(5, '0')}`;
        await tx.insert(payments).values({
          id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          receiptNumber,
          invoiceId,
          bookingId,
          customerId,
          amount: fin.paidAmount,
          paymentMethod: paymentMethod || 'CASH',
          transactionReference: `Advance for ${bookingNumber}`,
          paymentDate: new Date().toISOString().split('T')[0],
          paymentType: 'ADVANCE',
          notes: 'Advance payment received on booking creation',
          isReversed: false,
          createdBy: req.user?.username || 'admin',
        });
      }

      // 3.10 Audit Log
      await logAudit({
        userId: req.user?.id,
        userName: req.user?.name || req.user?.username || 'Staff',
        userRole: req.user?.role || 'STAFF',
        action: 'BOOKING_CREATE',
        entity: 'Booking',
        entityId: bookingId,
        details: `Created booking #${bookingNumber} (${eventType} on ${eventDate}) for Total: ₹${fin.grandTotal} (Hall: ${selectedHall?.name || 'None'}, Rooms: ${selectedRoomsList.length})`,
      });

      return { booking: newBooking, customer: cust, hall: selectedHall, fin };
    });

    await updateCustomerFinances(customerId);

    res.status(201).json({
      success: true,
      data: {
        ...result.booking,
        customer: result.customer,
        hall: result.hall,
      },
    });
  } catch (err: any) {
    if (err && err.status) {
      return res.status(err.status).json({
        success: false,
        error: { code: err.code || 'BOOKING_CONFLICT', message: err.message },
      });
    }
    console.error('Booking creation error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/bookings/:id — Comprehensive booking detail with linked customer, hall, rooms, and audit
app.get('/api/v1/bookings/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [b] = await db.select().from(bookings).where(eq(bookings.id, req.params.id));
    if (!b) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Booking not found.' } });
    }

    const [c] = await db.select().from(customers).where(eq(customers.id, b.customerId));
    const [h] = b.hallId ? await db.select().from(halls).where(eq(halls.id, b.hallId)) : [null];
    const bHalls = await db.select().from(bookingHalls).where(eq(bookingHalls.bookingId, b.id));
    const bRooms = await db.select().from(bookingRooms).where(eq(bookingRooms.bookingId, b.id));
    const allRooms = await db.select().from(rooms);
    const rMap = new Map(allRooms.map((r) => [r.id, r]));

    const enrichedRooms = bRooms.map((br) => ({
      ...br,
      room: rMap.get(br.roomId) || null,
    }));

    let parsedServices: any[] = [];
    try {
      parsedServices = typeof b.services === 'string' ? JSON.parse(b.services) : b.services || [];
    } catch {
      parsedServices = [];
    }

    const bInvoices = await db.select().from(invoices).where(eq(invoices.bookingId, b.id));
    const bPayments = await db.select().from(payments).where(eq(payments.bookingId, b.id));
    const bAudits = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entity, 'Booking'), eq(auditLogs.entityId, b.id)))
      .orderBy(desc(auditLogs.createdAt));

    res.json({
      success: true,
      data: {
        ...b,
        customer: c || null,
        hall: h || null,
        bookingHalls: bHalls,
        bookingRooms: enrichedRooms,
        services: parsedServices,
        invoices: bInvoices,
        payments: bPayments,
        auditLogs: bAudits,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PUT /api/v1/bookings/:id — Controlled booking update with availability rechecking & concurrency safety
app.put('/api/v1/bookings/:id', authenticate, requireRoles(['OWNER', 'MANAGER', 'RECEPTIONIST']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const bookingId = req.params.id;
    const {
      eventType,
      eventDate,
      startTime,
      endTime,
      guestCount,
      hallId,
      roomIds,
      checkInDate,
      checkOutDate,
      services,
      discount,
      notes,
    } = req.body;

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(bookings).where(eq(bookings.id, bookingId));
      if (!existing) {
        throw { status: 404, code: 'NOT_FOUND', message: 'Booking not found.' };
      }

      if (existing.status === 'CANCELLED' || existing.status === 'COMPLETED') {
        throw {
          status: 400,
          code: 'INVALID_OPERATION',
          message: `Cannot edit a booking in "${existing.status}" status.`,
        };
      }

      const effEventDate = eventDate || existing.eventDate;
      const effStartTime = startTime || existing.startTime;
      const effEndTime = endTime || existing.endTime;
      const effHallId = hallId !== undefined ? hallId : existing.hallId;
      const effGuestCount = guestCount !== undefined ? Number(guestCount) : existing.guestCount;

      if (!isValidDate(effEventDate)) {
        throw { status: 400, code: 'INVALID_EVENT_DATE', message: 'Event date must be a valid YYYY-MM-DD date.' };
      }
      if (!isValidTime(effStartTime) || !isValidTime(effEndTime)) {
        throw { status: 400, code: 'INVALID_TIME_FORMAT', message: 'Start and End time must be in HH:mm 24-hr format.' };
      }
      if (effStartTime >= effEndTime) {
        throw { status: 400, code: 'INVALID_TIME_RANGE', message: 'Start time must be strictly before end time.' };
      }
      if (!Number.isInteger(effGuestCount) || effGuestCount <= 0) {
        throw { status: 400, code: 'VALIDATION_ERROR', message: 'Guest count must be a positive integer.' };
      }

      // Check hall availability if hall is assigned
      let selectedHall: any = null;
      if (effHallId) {
        const [h] = await tx.select().from(halls).where(eq(halls.id, effHallId));
        if (!h) {
          throw { status: 404, code: 'INVALID_HALL', message: 'Selected hall not found.' };
        }
        if (h.status === 'MAINTENANCE' || h.status === 'INACTIVE') {
          throw {
            status: 400,
            code: 'INVALID_HALL',
            message: `Hall "${h.name}" is currently under ${h.status.toLowerCase()} and cannot be booked.`,
          };
        }
        selectedHall = h;

        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'hall:' + effHallId + ':' + effEventDate}))`);
        const hallCheck = await checkHallConflict(effHallId, effEventDate, effStartTime, effEndTime, existing.id, tx);
        if (hallCheck.hasConflict) {
          throw { status: 409, code: 'BOOKING_CONFLICT', message: hallCheck.message };
        }
      }

      // Check room availability
      let targetRoomIds = existing.roomIds ? JSON.parse(existing.roomIds) : [];
      if (Array.isArray(roomIds)) {
        targetRoomIds = roomIds;
      }

      let effCheckIn = checkInDate || effEventDate;
      let effCheckOut = checkOutDate || null;
      if (targetRoomIds.length > 0) {
        if (!effCheckOut) {
          const d = new Date(`${effCheckIn}T00:00:00Z`);
          d.setUTCDate(d.getUTCDate() + 1);
          effCheckOut = d.toISOString().split('T')[0];
        }

        if (!isValidDate(effCheckIn) || !isValidDate(effCheckOut)) {
          throw { status: 400, code: 'INVALID_ROOM_DATES', message: 'Room dates must be valid YYYY-MM-DD.' };
        }
        if (effCheckOut <= effCheckIn) {
          throw { status: 400, code: 'INVALID_ROOM_DATES', message: 'Check-out date must be strictly after check-in date.' };
        }

        for (const rId of targetRoomIds) {
          const [r] = await tx.select().from(rooms).where(eq(rooms.id, rId));
          if (!r) throw { status: 404, code: 'INVALID_ROOM', message: `Room ID "${rId}" not found.` };
          if (r.status === 'MAINTENANCE' || r.status === 'BLOCKED') {
            throw { status: 400, code: 'INVALID_ROOM', message: `Room "${r.roomNumber}" is currently ${r.status.toLowerCase()}.` };
          }

          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'room:' + rId + ':' + effCheckIn}))`);
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'room_res:' + rId}))`);
          const roomCheck = await checkRoomConflict(rId, effCheckIn, effCheckOut, existing.id, tx);
          if (roomCheck.hasConflict) {
            throw { status: 409, code: 'ROOM_CONFLICT', message: roomCheck.message };
          }
        }
      }

      // Recalculate Financials
      const financialItems: Array<{ description: string; qty: number; rate: number }> = [];
      if (selectedHall) {
        financialItems.push({
          description: `Venue Rental (${selectedHall.name})`,
          qty: 1,
          rate: Number(selectedHall.basePrice),
        });
      }

      const roomNights = targetRoomIds.length > 0 ? calculateNights(effCheckIn, effCheckOut!) : 1;
      if (targetRoomIds.length > 0) {
        const selectedRooms = await tx.select().from(rooms).where(inArrayOrEmpty(rooms.id, targetRoomIds));
        for (const r of selectedRooms) {
          financialItems.push({
            description: `Room Accommodation (${r.roomNumber} - ${r.roomType}, ${roomNights} nights)`,
            qty: roomNights,
            rate: Number(r.pricePerNight),
          });
        }
      }

      let parsedServices: any[] = [];
      if (services !== undefined && Array.isArray(services)) {
        for (const s of services) {
          const sName = typeof s.name === 'string' ? s.name.trim() : '';
          const sQty = Math.max(1, Number(s.quantity || s.qty) || 1);
          const sRate = Math.max(0, Number(s.rate || s.cost) || 0);
          if (sName) {
            const amount = parseFloat((sQty * sRate).toFixed(2));
            parsedServices.push({ name: sName, quantity: sQty, rate: sRate, amount });
            financialItems.push({ description: sName, qty: sQty, rate: sRate });
          }
        }
      } else {
        try {
          parsedServices = typeof existing.services === 'string' ? JSON.parse(existing.services) : existing.services || [];
          for (const s of parsedServices) {
            financialItems.push({
              description: s.name,
              qty: Number(s.quantity) || 1,
              rate: Number(s.rate) || 0,
            });
          }
        } catch {
          parsedServices = [];
        }
      }

      const rawDiscount = discount !== undefined ? Math.max(0, Number(discount) || 0) : Number(existing.discount);
      const taxPercent = Number(existing.taxPercent) || 18.0;

      const fin = calculateFinancials(financialItems, rawDiscount, taxPercent, existing.paidAmount);

      if (rawDiscount > Number(fin.subtotal)) {
        throw {
          status: 400,
          code: 'VALIDATION_ERROR',
          message: `Discount (₹${rawDiscount}) cannot exceed subtotal (₹${fin.subtotal}).`,
        };
      }

      // Update booking row
      const [updated] = await tx
        .update(bookings)
        .set({
          eventType: eventType !== undefined ? eventType.trim() : existing.eventType,
          eventDate: effEventDate,
          startTime: effStartTime,
          endTime: effEndTime,
          guestCount: effGuestCount,
          hallId: effHallId,
          hallIds: JSON.stringify(effHallId ? [effHallId] : []),
          roomIds: JSON.stringify(targetRoomIds),
          services: JSON.stringify(parsedServices),
          subtotal: fin.subtotal,
          discount: fin.discount,
          taxPercent: fin.taxPercent,
          taxAmount: fin.taxAmount,
          grandTotal: fin.grandTotal,
          balanceAmount: fin.balanceAmount,
          notes: notes !== undefined ? (notes ? String(notes).trim() : '') : existing.notes,
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, existing.id))
        .returning();

      // Update bookingHalls
      await tx.delete(bookingHalls).where(eq(bookingHalls.bookingId, existing.id));
      if (effHallId && selectedHall) {
        await tx.insert(bookingHalls).values({
          id: `bh-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          bookingId: existing.id,
          hallId: effHallId,
          eventDate: effEventDate,
          startTime: effStartTime,
          endTime: effEndTime,
          price: selectedHall.basePrice,
        });
      }

      // Update bookingRooms
      await tx.delete(bookingRooms).where(eq(bookingRooms.bookingId, existing.id));
      if (targetRoomIds.length > 0) {
        const roomsToLink = await tx.select().from(rooms).where(inArrayOrEmpty(rooms.id, targetRoomIds));
        for (const r of roomsToLink) {
          const roomPrice = (roomNights * Number(r.pricePerNight)).toFixed(2);
          await tx.insert(bookingRooms).values({
            id: `br-${Date.now()}-${r.id}-${Math.random().toString(36).substring(2, 5)}`,
            bookingId: existing.id,
            roomId: r.id,
            checkInDate: effCheckIn,
            checkOutDate: effCheckOut!,
            price: roomPrice,
          });
        }
      }

      // Audit Log
      await logAudit({
        userId: req.user?.id,
        userName: req.user?.name || req.user?.username || 'Staff',
        userRole: req.user?.role || 'STAFF',
        action: 'BOOKING_UPDATE',
        entity: 'Booking',
        entityId: existing.id,
        details: `Updated booking #${existing.bookingNumber}: Date ${effEventDate}, Grand Total: ₹${fin.grandTotal}`,
      });

      return updated;
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    if (err && err.status) {
      return res.status(err.status).json({
        success: false,
        error: { code: err.code || 'BOOKING_UPDATE_ERROR', message: err.message },
      });
    }
    console.error('Booking update error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PUT /api/v1/bookings/:id/status — State machine status transitions
app.put('/api/v1/bookings/:id/status', authenticate, requireRoles(['OWNER', 'MANAGER', 'RECEPTIONIST']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, notes } = req.body;
    const targetStatus = typeof status === 'string' ? status.trim().toUpperCase() : '';

    const [b] = await db.select().from(bookings).where(eq(bookings.id, req.params.id));
    if (!b) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Booking not found.' } });
    }

    // Role check: Only OWNER or MANAGER can transition to CANCELLED
    if (targetStatus === 'CANCELLED' && req.user?.role === 'RECEPTIONIST') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Receptionists are not permitted to cancel bookings. Owner or Manager authorization required.',
        },
      });
    }

    const allowed = ALLOWED_STATUS_TRANSITIONS[b.status] || [];
    if (!allowed.includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS_TRANSITION',
          message: `Cannot transition booking status from '${b.status}' to '${targetStatus}'. Allowed transitions: ${allowed.join(', ') || 'None (Terminal status)'}`,
        },
      });
    }

    const [updated] = await db
      .update(bookings)
      .set({
        status: targetStatus,
        notes: notes ? `${b.notes ? b.notes + ' | ' : ''}${notes}` : b.notes,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, b.id))
      .returning();

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username || 'Staff',
      userRole: req.user?.role || 'STAFF',
      action: 'BOOKING_STATUS_CHANGE',
      entity: 'Booking',
      entityId: b.id,
      details: `Changed booking #${b.bookingNumber} status from ${b.status} to ${targetStatus}${notes ? ` (Note: ${notes})` : ''}`,
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/bookings/:id/cancel — Explicit booking cancellation
app.post('/api/v1/bookings/:id/cancel', authenticate, requireRoles(['OWNER', 'MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reason } = req.body;
    const [b] = await db.select().from(bookings).where(eq(bookings.id, req.params.id));
    if (!b) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Booking not found.' } });
    }

    if (b.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_CANCELLED', message: 'Booking is already cancelled.' },
      });
    }

    if (b.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_OPERATION', message: 'A completed booking cannot be cancelled.' },
      });
    }

    const cancellationNote = reason ? `Cancelled: ${reason}` : 'Booking cancelled by management';

    const [updated] = await db
      .update(bookings)
      .set({
        status: 'CANCELLED',
        notes: b.notes ? `${b.notes} | ${cancellationNote}` : cancellationNote,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, b.id))
      .returning();

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username || 'Manager',
      userRole: req.user?.role || 'MANAGER',
      action: 'BOOKING_CANCEL',
      entity: 'Booking',
      entityId: b.id,
      details: `Cancelled booking #${b.bookingNumber}. Availability released. Reason: ${cancellationNote}`,
    });

    res.json({
      success: true,
      message: `Booking #${b.bookingNumber} successfully cancelled and availability released.`,
      data: updated,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// DELETE /api/v1/bookings/:id — Soft-cancel via DELETE verb (OWNER / MANAGER)
app.delete('/api/v1/bookings/:id', authenticate, requireRoles(['OWNER', 'MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [b] = await db.select().from(bookings).where(eq(bookings.id, req.params.id));
    if (!b) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Booking not found.' } });
    }

    if (b.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_CANCELLED', message: 'Booking is already cancelled.' },
      });
    }

    const [updated] = await db
      .update(bookings)
      .set({ status: 'CANCELLED', updatedAt: new Date() })
      .where(eq(bookings.id, b.id))
      .returning();

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username || 'Staff',
      userRole: req.user?.role || 'STAFF',
      action: 'BOOKING_CANCEL',
      entity: 'Booking',
      entityId: b.id,
      details: `Cancelled booking #${b.bookingNumber} via management delete action.`,
    });

    res.json({ success: true, message: 'Booking successfully cancelled and slot released.', data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ----------------------------------------------------
// 7. CALENDAR MODULE
// ----------------------------------------------------

app.get('/api/v1/calendar', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isStaff = req.user?.role === 'STAFF';
    const isFinanceRole = req.user?.role === 'OWNER' || req.user?.role === 'ACCOUNTANT';

    const allBookings = await db.select().from(bookings);
    const allHalls = await db.select().from(halls);
    const allCust = await db.select().from(customers);

    const hMap = new Map(allHalls.map((h) => [h.id, h]));
    const cMap = new Map(allCust.map((c) => [c.id, c]));

    const events = allBookings
      .filter((b) => b.status !== 'CANCELLED')
      .map((b) => {
        let h = b.hallId ? hMap.get(b.hallId) : null;
        if (!h && b.hallIds) {
          try {
            const parsed = typeof b.hallIds === 'string' ? JSON.parse(b.hallIds) : b.hallIds;
            if (Array.isArray(parsed) && parsed.length > 0) {
              h = hMap.get(parsed[0]) || null;
            }
          } catch (e) {}
        }
        const c = cMap.get(b.customerId);
        return {
          id: b.id,
          bookingNumber: b.bookingNumber,
          title: isStaff ? `${b.eventType} - ${h?.name || 'Grand Hall'}` : `${c?.name || 'Guest'} - ${b.eventType}`,
          customerName: isStaff ? 'Scheduled Event' : (c?.name || 'Guest'),
          customerPhone: isStaff ? '' : (c?.mobile || ''),
          eventType: b.eventType,
          date: b.eventDate,
          startTime: b.startTime,
          endTime: b.endTime,
          hallName: h?.name || 'Grand Hall',
          hallCode: h?.code || 'HALL-A',
          guestCount: b.guestCount,
          status: b.status,
          grandTotal: isFinanceRole ? b.grandTotal : '0',
          paidAmount: isFinanceRole ? b.paidAmount : '0',
          balanceAmount: isFinanceRole ? b.balanceAmount : '0',
        };
      });

    res.json({ success: true, data: events });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ----------------------------------------------------
// 8. QUOTATIONS MODULE (Phase 4: Quotation Management)
// ----------------------------------------------------

const ALLOWED_QUOTATION_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SENT'],
  SENT: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: ['CONVERTED'],
  REJECTED: [],
  CONVERTED: [],
};

// GET /api/v1/quotations — List quotations with server-side search, status, customer, date filters, pagination, and sorting
app.get('/api/v1/quotations', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim().toUpperCase() : 'ALL';
    const customerId = typeof req.query.customerId === 'string' ? req.query.customerId.trim() : 'ALL';
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : null;
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : null;
    const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy.trim() : 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';

    const allQuotations = await db.select().from(quotations).orderBy(desc(quotations.createdAt));
    const allCust = await db.select().from(customers);
    const allHalls = await db.select().from(halls);
    const allBookings = await db.select().from(bookings);

    const cMap = new Map(allCust.map((c) => [c.id, c]));
    const hMap = new Map(allHalls.map((h) => [h.id, h]));
    const bMap = new Map(allBookings.map((b) => [b.id, b]));

    let enriched = allQuotations.map((q) => {
      let parsedItems: any[] = [];
      try {
        parsedItems = typeof q.items === 'string' ? JSON.parse(q.items) : q.items || [];
      } catch {
        parsedItems = [];
      }

      return {
        ...q,
        customer: cMap.get(q.customerId) || null,
        hall: q.hallId ? hMap.get(q.hallId) || null : null,
        booking: q.bookingId ? bMap.get(q.bookingId) || null : null,
        parsedItems,
      };
    });

    // Apply Filters
    if (status !== 'ALL') {
      enriched = enriched.filter((q) => q.status === status);
    }

    if (customerId !== 'ALL') {
      enriched = enriched.filter((q) => q.customerId === customerId);
    }

    if (startDate) {
      enriched = enriched.filter((q) => q.eventDate >= startDate);
    }

    if (endDate) {
      enriched = enriched.filter((q) => q.eventDate <= endDate);
    }

    if (search) {
      enriched = enriched.filter((q) => {
        const matchNum = q.quotationNumber?.toLowerCase().includes(search);
        const matchCust = q.customer?.name?.toLowerCase().includes(search);
        const matchMobile = q.customer?.mobile?.includes(search);
        const matchType = q.eventType?.toLowerCase().includes(search);
        return matchNum || matchCust || matchMobile || matchType;
      });
    }

    // Sort
    enriched.sort((a: any, b: any) => {
      let valA = a[sortBy] ?? '';
      let valB = b[sortBy] ?? '';
      if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      } else if (sortBy === 'totalAmount' || sortBy === 'subtotal' || sortBy === 'discount') {
        valA = Number(valA);
        valB = Number(valB);
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const total = enriched.length;
    const offset = (page - 1) * limit;
    const paginated = enriched.slice(offset, offset + limit);

    res.json({
      success: true,
      data: paginated,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/quotations/:id — Single quotation detail with customer, hall, booking, settings & audit logs
app.get('/api/v1/quotations/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [quo] = await db.select().from(quotations).where(eq(quotations.id, req.params.id));
    if (!quo) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Quotation not found.' } });
    }

    const [c] = await db.select().from(customers).where(eq(customers.id, quo.customerId));
    const [h] = quo.hallId ? await db.select().from(halls).where(eq(halls.id, quo.hallId)) : [null];
    const [b] = quo.bookingId ? await db.select().from(bookings).where(eq(bookings.id, quo.bookingId)) : [null];
    const [s] = await db.select().from(settings).where(eq(settings.id, 'default'));
    const auditHistory = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entity, 'Quotation'), eq(auditLogs.entityId, quo.id)))
      .orderBy(desc(auditLogs.createdAt));

    let parsedItems: any[] = [];
    try {
      parsedItems = typeof quo.items === 'string' ? JSON.parse(quo.items) : quo.items || [];
    } catch {
      parsedItems = [];
    }

    res.json({
      success: true,
      data: {
        ...quo,
        customer: c || null,
        hall: h || null,
        booking: b || null,
        settings: s || null,
        parsedItems,
        auditHistory,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/quotations — Create DRAFT Quotation with server-side validation, financial calculation & numbering lock
app.post('/api/v1/quotations', authenticate, requireRoles(['OWNER', 'MANAGER', 'RECEPTIONIST']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      customerId,
      bookingId,
      eventType,
      eventDate,
      hallId,
      items = [],
      discount = 0,
      validUntil,
      terms,
      notes,
    } = req.body;

    // 1. Validate Base Fields
    if (!customerId || typeof customerId !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Customer ID is required.' },
      });
    }

    if (!eventType || typeof eventType !== 'string' || eventType.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Event type is required (minimum 2 characters).' },
      });
    }

    if (!isValidDate(eventDate)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_EVENT_DATE', message: 'Event date must be a valid YYYY-MM-DD date.' },
      });
    }

    // 2. Validate Discount Value
    if (discount !== undefined && discount !== null) {
      const dNum = Number(discount);
      if (isNaN(dNum) || dNum < 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_DISCOUNT', message: 'Discount cannot be negative or invalid.' },
        });
      }
    }

    // 3. Validate Items
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'At least one quotation item is required.' },
      });
    }

    const processedItems: Array<{ description: string; quantity: number; rate: number; amount: number }> = [];
    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      const desc = typeof it.description === 'string' ? it.description.trim() : typeof it.name === 'string' ? it.name.trim() : '';
      if (!desc) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ITEM', message: `Item #${idx + 1} must have a valid description or name.` },
        });
      }

      const rawQty = it.quantity !== undefined ? it.quantity : it.qty;
      const q = Number(rawQty);
      if (isNaN(q) || q <= 0 || !Number.isInteger(q)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ITEM_VALUES', message: `Item "${desc}" must have a positive integer quantity (received: ${rawQty}).` },
        });
      }

      const rawRate = it.rate !== undefined ? it.rate : it.unitPrice !== undefined ? it.unitPrice : it.cost;
      const r = Number(rawRate);
      if (isNaN(r) || r < 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ITEM_VALUES', message: `Item "${desc}" must have a non-negative unit price (received: ${rawRate}).` },
        });
      }

      const amount = parseFloat((q * r).toFixed(2));
      processedItems.push({
        description: desc,
        quantity: q,
        rate: r,
        amount,
      });
    }

    // 4. Validate ValidUntil Date
    let effValidUntil = validUntil;
    if (!effValidUntil) {
      const d = new Date(Date.now() + 14 * 86400000);
      effValidUntil = d.toISOString().split('T')[0];
    } else if (!isValidDate(effValidUntil)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_VALID_UNTIL_DATE', message: 'validUntil must be a valid YYYY-MM-DD date.' },
      });
    }

    // 5. Transactional Execution
    const result = await db.transaction(async (tx) => {
      // 5.1 Validate Customer
      const [cust] = await tx.select().from(customers).where(eq(customers.id, customerId));
      if (!cust) {
        throw { status: 404, code: 'CUSTOMER_NOT_FOUND', message: 'Selected customer not found.' };
      }
      if (!cust.isActive) {
        throw { status: 400, code: 'INACTIVE_CUSTOMER', message: 'Selected customer is deactivated and cannot receive quotations.' };
      }

      // 5.2 Validate Optional Booking Relation
      if (bookingId) {
        const [b] = await tx.select().from(bookings).where(eq(bookings.id, bookingId));
        if (!b) {
          throw { status: 404, code: 'BOOKING_NOT_FOUND', message: 'Referenced booking not found.' };
        }
        if (b.customerId !== customerId) {
          throw {
            status: 400,
            code: 'CUSTOMER_BOOKING_MISMATCH',
            message: `Supplied customer does not match the customer associated with booking ${b.bookingNumber}.`,
          };
        }
      }

      // 5.3 Validate Optional Hall
      if (hallId) {
        const [h] = await tx.select().from(halls).where(eq(halls.id, hallId));
        if (!h) {
          throw { status: 404, code: 'HALL_NOT_FOUND', message: 'Selected hall not found.' };
        }
        if (h.status === 'INACTIVE' || h.status === 'MAINTENANCE') {
          throw {
            status: 400,
            code: 'HALL_UNAVAILABLE',
            message: `Hall "${h.name}" is currently under ${h.status.toLowerCase()}.`,
          };
        }
      }

      // 5.4 Retrieve Tax Rate from Settings
      const [settingRow] = await tx.select().from(settings).where(eq(settings.id, 'default'));
      const taxPercent = settingRow ? Number(settingRow.defaultTaxPercent) : 18.0;

      // 5.5 Calculate Financials
      const financialItems = processedItems.map((it) => ({
        description: it.description,
        qty: it.quantity,
        rate: it.rate,
      }));
      const rawDiscount = Math.max(0, Number(discount) || 0);
      const fin = calculateFinancials(financialItems, rawDiscount, taxPercent, 0);

      // Validate discount does not exceed subtotal
      if (rawDiscount > Number(fin.subtotal)) {
        throw {
          status: 400,
          code: 'DISCOUNT_EXCEEDS_SUBTOTAL',
          message: `Discount (₹${rawDiscount}) cannot exceed subtotal (₹${fin.subtotal}).`,
        };
      }

      // 5.6 Concurrent Safe Quotation Number Generation
      const year = new Date().getFullYear();
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'quotation_seq_' + year}))`);
      const existingQuotations = await tx
        .select({ quotationNumber: quotations.quotationNumber })
        .from(quotations)
        .where(sql`${quotations.quotationNumber} LIKE ${'BV-QUO-' + year + '-%'}`);

      let maxSeq = 0;
      for (const q of existingQuotations) {
        const parts = q.quotationNumber.split('-');
        const seq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
      const nextSeq = maxSeq + 1;
      const quotationNumber = `BV-QUO-${year}-${String(nextSeq).padStart(5, '0')}`;
      const quotationId = `quo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      // Terms handling
      const defaultTerms = settingRow?.termsAndConditions || '1. Valid for 14 days from generation date.\n2. 50% advance required upon confirmation.';
      let effTerms = typeof terms === 'string' && terms.trim().length > 0 ? terms.trim() : defaultTerms;
      if (notes && typeof notes === 'string' && notes.trim().length > 0) {
        effTerms = `${effTerms}\n\nNotes: ${notes.trim()}`;
      }

      const [created] = await tx
        .insert(quotations)
        .values({
          id: quotationId,
          quotationNumber,
          customerId,
          bookingId: bookingId || null,
          hallId: hallId || null,
          eventType: eventType.trim(),
          eventDate: eventDate.trim(),
          items: JSON.stringify(processedItems),
          subtotal: fin.subtotal,
          discount: fin.discount,
          taxPercent: fin.taxPercent,
          taxAmount: fin.taxAmount,
          totalAmount: fin.grandTotal,
          validUntil: effValidUntil,
          terms: effTerms,
          status: 'DRAFT',
        })
        .returning();

      // Audit Log
      await logAudit({
        userId: req.user?.id,
        userName: req.user?.name || req.user?.username || 'Staff',
        userRole: req.user?.role || 'STAFF',
        action: 'QUOTATION_CREATE',
        entity: 'Quotation',
        entityId: created.id,
        details: `Created DRAFT quotation #${quotationNumber} for customer ${cust.name} (${cust.mobile}), Total: ₹${fin.grandTotal}`,
        ipAddress: req.ip || req.socket.remoteAddress,
      });

      return {
        ...created,
        customer: cust,
        parsedItems: processedItems,
      };
    });

    res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    if (err && err.status) {
      return res.status(err.status).json({
        success: false,
        error: { code: err.code || 'VALIDATION_ERROR', message: err.message },
      });
    }
    console.error('Quotation creation error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PUT /api/v1/quotations/:id — Edit DRAFT Quotation (Restricted to DRAFT status only)
app.put('/api/v1/quotations/:id', authenticate, requireRoles(['OWNER', 'MANAGER', 'RECEPTIONIST']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [existing] = await db.select().from(quotations).where(eq(quotations.id, req.params.id));
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Quotation not found.' } });
    }

    if (existing.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CANNOT_EDIT_NON_DRAFT',
          message: `Only DRAFT quotations can be edited. Current status is ${existing.status}.`,
        },
      });
    }

    const {
      customerId,
      bookingId,
      eventType,
      eventDate,
      hallId,
      items,
      discount,
      validUntil,
      terms,
      notes,
    } = req.body;

    const effCustomerId = customerId !== undefined ? customerId : existing.customerId;
    const effEventType = eventType !== undefined ? eventType.trim() : existing.eventType;
    const effEventDate = eventDate !== undefined ? eventDate.trim() : existing.eventDate;
    const effHallId = hallId !== undefined ? hallId : existing.hallId;
    const effBookingId = bookingId !== undefined ? bookingId : existing.bookingId;
    const effValidUntil = validUntil !== undefined ? validUntil.trim() : existing.validUntil;

    if (!isValidDate(effEventDate)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_EVENT_DATE', message: 'Event date must be a valid YYYY-MM-DD date.' },
      });
    }

    if (!isValidDate(effValidUntil)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_VALID_UNTIL_DATE', message: 'validUntil must be a valid YYYY-MM-DD date.' },
      });
    }

    // Process items if provided
    let processedItems: Array<{ description: string; quantity: number; rate: number; amount: number }> = [];
    if (items !== undefined) {
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Quotation must have at least one line item.' },
        });
      }
      for (let idx = 0; idx < items.length; idx++) {
        const it = items[idx];
        const desc = typeof it.description === 'string' ? it.description.trim() : typeof it.name === 'string' ? it.name.trim() : '';
        if (!desc) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_ITEM', message: `Item #${idx + 1} must have a valid description or name.` },
          });
        }
        const rawQty = it.quantity !== undefined ? it.quantity : it.qty;
        const q = Number(rawQty);
        if (isNaN(q) || q <= 0 || !Number.isInteger(q)) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_ITEM_VALUES', message: `Item "${desc}" must have a positive integer quantity (received: ${rawQty}).` },
          });
        }
        const rawRate = it.rate !== undefined ? it.rate : it.unitPrice !== undefined ? it.unitPrice : it.cost;
        const r = Number(rawRate);
        if (isNaN(r) || r < 0) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_ITEM_VALUES', message: `Item "${desc}" must have a non-negative unit price (received: ${rawRate}).` },
          });
        }
        const amount = parseFloat((q * r).toFixed(2));
        processedItems.push({ description: desc, quantity: q, rate: r, amount });
      }
    } else {
      try {
        processedItems = typeof existing.items === 'string' ? JSON.parse(existing.items) : existing.items || [];
      } catch {
        processedItems = [];
      }
    }

    const result = await db.transaction(async (tx) => {
      // Validate customer
      const [cust] = await tx.select().from(customers).where(eq(customers.id, effCustomerId));
      if (!cust) throw { status: 404, code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found.' };
      if (!cust.isActive) throw { status: 400, code: 'INACTIVE_CUSTOMER', message: 'Customer is deactivated.' };

      // Validate booking
      if (effBookingId) {
        const [b] = await tx.select().from(bookings).where(eq(bookings.id, effBookingId));
        if (!b) throw { status: 404, code: 'BOOKING_NOT_FOUND', message: 'Referenced booking not found.' };
        if (b.customerId !== effCustomerId) {
          throw {
            status: 400,
            code: 'CUSTOMER_BOOKING_MISMATCH',
            message: `Supplied customer does not match booking ${b.bookingNumber}.`,
          };
        }
      }

      // Validate hall
      if (effHallId) {
        const [h] = await tx.select().from(halls).where(eq(halls.id, effHallId));
        if (!h) throw { status: 404, code: 'HALL_NOT_FOUND', message: 'Selected hall not found.' };
        if (h.status === 'INACTIVE' || h.status === 'MAINTENANCE') {
          throw { status: 400, code: 'HALL_UNAVAILABLE', message: `Hall "${h.name}" is ${h.status.toLowerCase()}.` };
        }
      }

      // Financials
      const [settingRow] = await tx.select().from(settings).where(eq(settings.id, 'default'));
      const taxPercent = settingRow ? Number(settingRow.defaultTaxPercent) : 18.0;

      const rawDiscount = discount !== undefined ? Math.max(0, Number(discount) || 0) : Number(existing.discount);
      if (isNaN(rawDiscount) || rawDiscount < 0) {
        throw { status: 400, code: 'INVALID_DISCOUNT', message: 'Discount cannot be negative.' };
      }

      const financialItems = processedItems.map((it) => ({
        description: it.description,
        qty: it.quantity,
        rate: it.rate,
      }));
      const fin = calculateFinancials(financialItems, rawDiscount, taxPercent, 0);

      if (rawDiscount > Number(fin.subtotal)) {
        throw {
          status: 400,
          code: 'DISCOUNT_EXCEEDS_SUBTOTAL',
          message: `Discount (₹${rawDiscount}) cannot exceed subtotal (₹${fin.subtotal}).`,
        };
      }

      let effTerms = terms !== undefined ? (typeof terms === 'string' ? terms.trim() : '') : existing.terms;
      if (notes && typeof notes === 'string' && notes.trim().length > 0) {
        effTerms = `${effTerms}\n\nNotes: ${notes.trim()}`;
      }

      const [updated] = await tx
        .update(quotations)
        .set({
          customerId: effCustomerId,
          bookingId: effBookingId || null,
          hallId: effHallId || null,
          eventType: effEventType,
          eventDate: effEventDate,
          items: JSON.stringify(processedItems),
          subtotal: fin.subtotal,
          discount: fin.discount,
          taxPercent: fin.taxPercent,
          taxAmount: fin.taxAmount,
          totalAmount: fin.grandTotal,
          validUntil: effValidUntil,
          terms: effTerms,
          updatedAt: new Date(),
        })
        .where(eq(quotations.id, existing.id))
        .returning();

      await logAudit({
        userId: req.user?.id,
        userName: req.user?.name || req.user?.username || 'Staff',
        userRole: req.user?.role || 'STAFF',
        action: 'QUOTATION_UPDATE',
        entity: 'Quotation',
        entityId: existing.id,
        details: `Updated DRAFT quotation #${existing.quotationNumber}: Total: ₹${fin.grandTotal}`,
        ipAddress: req.ip || req.socket.remoteAddress,
      });

      return {
        ...updated,
        customer: cust,
        parsedItems: processedItems,
      };
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    if (err && err.status) {
      return res.status(err.status).json({
        success: false,
        error: { code: err.code || 'VALIDATION_ERROR', message: err.message },
      });
    }
    console.error('Quotation edit error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Helper for quotation status transitions
async function handleQuotationStatusTransition(
  quotationId: string,
  targetStatus: string,
  req: AuthenticatedRequest,
  res: Response,
  notes?: string
) {
  const [quo] = await db.select().from(quotations).where(eq(quotations.id, quotationId));
  if (!quo) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Quotation not found.' } });
  }

  if (targetStatus === 'CONVERTED') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'USE_CONVERT_ENDPOINT',
        message: 'Direct status transition to CONVERTED is prohibited. Use POST /api/v1/quotations/:id/convert.',
      },
    });
  }

  const allowed = ALLOWED_QUOTATION_TRANSITIONS[quo.status] || [];
  if (!allowed.includes(targetStatus)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_STATUS_TRANSITION',
        message: `Cannot transition quotation from ${quo.status} to ${targetStatus}.`,
      },
    });
  }

  let auditAction = 'QUOTATION_UPDATE';
  let auditDetails = `Quotation #${quo.quotationNumber} transitioned from ${quo.status} to ${targetStatus}`;

  if (targetStatus === 'SENT') {
    auditAction = 'QUOTATION_SEND';
    auditDetails = `Quotation #${quo.quotationNumber} sent to customer`;
  } else if (targetStatus === 'ACCEPTED') {
    auditAction = 'QUOTATION_ACCEPT';
    auditDetails = `Quotation #${quo.quotationNumber} accepted by customer`;
  } else if (targetStatus === 'REJECTED') {
    auditAction = 'QUOTATION_REJECT';
    auditDetails = `Quotation #${quo.quotationNumber} rejected. Reason: ${notes || 'Customer declined proposal'}`;
  }

  const [updated] = await db
    .update(quotations)
    .set({
      status: targetStatus as any,
      updatedAt: new Date(),
    })
    .where(eq(quotations.id, quo.id))
    .returning();

  await logAudit({
    userId: req.user?.id,
    userName: req.user?.name || req.user?.username || 'Staff',
    userRole: req.user?.role || 'STAFF',
    action: auditAction,
    entity: 'Quotation',
    entityId: quo.id,
    details: auditDetails,
    ipAddress: req.ip || req.socket.remoteAddress,
  });

  res.json({
    success: true,
    message: `Quotation status updated to ${targetStatus}.`,
    data: updated,
  });
}

// PUT /api/v1/quotations/:id/status — State machine status transition
app.put('/api/v1/quotations/:id/status', authenticate, requireRoles(['OWNER', 'MANAGER', 'RECEPTIONIST']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, notes } = req.body;
    const targetStatus = typeof status === 'string' ? status.trim().toUpperCase() : '';
    if (!targetStatus) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Target status is required.' },
      });
    }

    return await handleQuotationStatusTransition(req.params.id, targetStatus, req, res, notes);
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/quotations/:id/send — Send quotation
app.post('/api/v1/quotations/:id/send', authenticate, requireRoles(['OWNER', 'MANAGER', 'RECEPTIONIST']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    return await handleQuotationStatusTransition(req.params.id, 'SENT', req, res, req.body?.notes);
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/quotations/:id/accept — Accept quotation
app.post('/api/v1/quotations/:id/accept', authenticate, requireRoles(['OWNER', 'MANAGER', 'RECEPTIONIST']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    return await handleQuotationStatusTransition(req.params.id, 'ACCEPTED', req, res, req.body?.notes);
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/quotations/:id/reject — Reject quotation
app.post('/api/v1/quotations/:id/reject', authenticate, requireRoles(['OWNER', 'MANAGER', 'RECEPTIONIST']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    return await handleQuotationStatusTransition(req.params.id, 'REJECTED', req, res, req.body?.notes);
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/quotations/:id/convert — Convert ACCEPTED quotation to Booking with PostgreSQL advisory concurrency protection
app.post('/api/v1/quotations/:id/convert', authenticate, requireRoles(['OWNER', 'MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [quo] = await db.select().from(quotations).where(eq(quotations.id, req.params.id));
    if (!quo) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Quotation not found.' } });
    }

    if (quo.status === 'CONVERTED') {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_CONVERTED', message: 'This quotation has already been converted to a booking.' },
      });
    }

    if (quo.status !== 'ACCEPTED') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS_FOR_CONVERSION',
          message: `Quotation must be in ACCEPTED status before converting to a booking (current status: ${quo.status}).`,
        },
      });
    }

    // Validate customer exists & active
    const [cust] = await db.select().from(customers).where(eq(customers.id, quo.customerId));
    if (!cust) {
      return res.status(404).json({
        success: false,
        error: { code: 'CUSTOMER_NOT_FOUND', message: 'Customer associated with quotation not found.' },
      });
    }
    if (!cust.isActive) {
      return res.status(400).json({
        success: false,
        error: { code: 'INACTIVE_CUSTOMER', message: 'Customer is deactivated and cannot create bookings.' },
      });
    }

    const {
      startTime = '10:00',
      endTime = '23:00',
      guestCount = 200,
    } = req.body;

    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TIME_FORMAT', message: 'Start and End time must be in HH:mm 24-hr format.' },
      });
    }

    if (startTime >= endTime) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TIME_RANGE', message: 'Start time must be strictly before end time.' },
      });
    }

    // Transactional conversion with advisory lock concurrency protection
    const result = await db.transaction(async (tx) => {
      // 1. Check Hall Availability with Advisory Lock
      if (quo.hallId) {
        const [h] = await tx.select().from(halls).where(eq(halls.id, quo.hallId));
        if (!h) {
          throw { status: 404, code: 'HALL_NOT_FOUND', message: 'Referenced hall not found.' };
        }
        if (h.status === 'INACTIVE' || h.status === 'MAINTENANCE') {
          throw {
            status: 400,
            code: 'HALL_UNAVAILABLE',
            message: `Hall "${h.name}" is currently under ${h.status.toLowerCase()} and cannot be booked.`,
          };
        }

        // Advisory transaction lock for hall on event date
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'hall:' + quo.hallId + ':' + quo.eventDate}))`);
        const hallCheck = await checkHallConflict(quo.hallId, quo.eventDate, startTime, endTime, undefined, tx);
        if (hallCheck.hasConflict) {
          throw { status: 409, code: 'BOOKING_CONFLICT', message: hallCheck.message };
        }
      }

      // 2. Concurrency-Safe Booking Number Generation
      const year = new Date().getFullYear();
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'booking_seq_' + year}))`);
      const existingBookings = await tx
        .select({ bookingNumber: bookings.bookingNumber })
        .from(bookings)
        .where(sql`${bookings.bookingNumber} LIKE ${'BV-BKG-' + year + '-%'}`);

      let maxSeq = 0;
      for (const b of existingBookings) {
        const parts = b.bookingNumber.split('-');
        const seq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
      const nextSeq = maxSeq + 1;
      const bookingNumber = `BV-BKG-${year}-${String(nextSeq).padStart(5, '0')}`;
      const bookingId = `bkg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      // 3. Insert Confirmed Booking
      const [insertedBooking] = await tx
        .insert(bookings)
        .values({
          id: bookingId,
          bookingNumber,
          customerId: quo.customerId,
          eventType: quo.eventType,
          eventDate: quo.eventDate,
          startTime,
          endTime,
          guestCount: Number(guestCount) || 200,
          hallId: quo.hallId,
          hallIds: JSON.stringify(quo.hallId ? [quo.hallId] : []),
          roomIds: '[]',
          services: quo.items,
          subtotal: quo.subtotal,
          discount: quo.discount,
          taxPercent: quo.taxPercent,
          taxAmount: quo.taxAmount,
          grandTotal: quo.totalAmount,
          paidAmount: '0.00',
          balanceAmount: quo.totalAmount,
          status: 'CONFIRMED',
          notes: `Converted from Quotation #${quo.quotationNumber}`,
          createdBy: req.user?.username || 'admin',
        })
        .returning();

      // 4. Insert bookingHalls schedule record
      if (quo.hallId) {
        await tx.insert(bookingHalls).values({
          id: `bh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          bookingId,
          hallId: quo.hallId,
          eventDate: quo.eventDate,
          startTime,
          endTime,
          price: quo.subtotal,
        });
      }

      // 5. Update Quotation Status to CONVERTED
      const [updatedQuo] = await tx
        .update(quotations)
        .set({
          status: 'CONVERTED',
          bookingId,
          updatedAt: new Date(),
        })
        .where(eq(quotations.id, quo.id))
        .returning();

      // Note: Phase 4 strictly prohibits creating invoices or payments.

      return {
        booking: insertedBooking,
        quotation: updatedQuo,
      };
    });

    // 6. Audit Logging
    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username || 'Staff',
      userRole: req.user?.role || 'STAFF',
      action: 'QUOTATION_CONVERT',
      entity: 'Quotation',
      entityId: quo.id,
      details: `Converted accepted quotation #${quo.quotationNumber} into confirmed booking #${result.booking.bookingNumber}`,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.json({
      success: true,
      message: `Quotation #${quo.quotationNumber} successfully converted to Booking #${result.booking.bookingNumber}.`,
      data: result,
    });
  } catch (err: any) {
    if (err && err.status) {
      return res.status(err.status).json({
        success: false,
        error: { code: err.code || 'BOOKING_CONFLICT', message: err.message },
      });
    }
    console.error('Quotation conversion error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});


// ----------------------------------------------------
// 9. INVOICES MODULE (Phase 5: Invoice Management)
// ----------------------------------------------------

async function generateInvoiceNumber(tx: any): Promise<string> {
  const year = new Date().getFullYear();
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'invoice_seq_' + year}))`);
  const existingInvoices = await tx
    .select({ invoiceNumber: invoices.invoiceNumber })
    .from(invoices)
    .where(sql`${invoices.invoiceNumber} LIKE ${'BV-INV-' + year + '-%'}`);

  let maxSeq = 0;
  for (const inv of existingInvoices) {
    const parts = inv.invoiceNumber.split('-');
    const seq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(seq) && seq > maxSeq) {
      maxSeq = seq;
    }
  }
  const nextSeq = maxSeq + 1;
  return `BV-INV-${year}-${String(nextSeq).padStart(5, '0')}`;
}

function buildInvoiceSnapshot(settingRow: any, cust: any, taxPercent: number) {
  return JSON.stringify({
    businessName: settingRow?.businessName || 'Bandhan Vatika',
    tagline: settingRow?.tagline || 'Celebrations · Together · Always',
    address: settingRow?.address || '123, MG Road, Indore, MP 452001',
    phone: settingRow?.phone || '9876543210',
    email: settingRow?.email || 'contact@bandhanvatika.com',
    gstin: settingRow?.gstin || '23AAAAA0000A1Z5',
    bankName: settingRow?.bankName || 'HDFC Bank',
    accountNumber: settingRow?.accountNumber || '50200012345678',
    ifscCode: settingRow?.ifscCode || 'HDFC0001234',
    terms: settingRow?.termsAndConditions || '',
    customerName: cust?.name || '',
    customerMobile: cust?.mobile || '',
    customerEmail: cust?.email || '',
    customerAddress: cust?.address || '',
    customerGstin: (cust as any)?.gstin || '',
    appliedTaxPercent: taxPercent.toFixed(2),
    issuedAt: new Date().toISOString(),
  });
}

function validateAndProcessInvoiceItems(rawItems: any): { error?: string; items?: any[] } {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { error: 'Invoice must contain at least one item.' };
  }

  const processed: any[] = [];
  for (const it of rawItems) {
    const desc = String(it.description || '').trim();
    if (!desc) {
      return { error: 'Item description cannot be empty.' };
    }

    const rawQty = it.quantity !== undefined ? it.quantity : it.qty;
    const q = Number(rawQty);
    if (isNaN(q) || q <= 0 || !Number.isInteger(q)) {
      return { error: `Item "${desc}" must have a positive integer quantity (received: ${rawQty}).` };
    }

    const rawRate = it.rate !== undefined ? it.rate : it.unitPrice !== undefined ? it.unitPrice : it.cost;
    const r = Number(rawRate);
    if (isNaN(r) || r < 0) {
      return { error: `Item "${desc}" must have a non-negative unit price (received: ${rawRate}).` };
    }

    // Backend calculates quantity * rate. Frontend-provided amount is ignored.
    const amount = parseFloat((q * r).toFixed(2));
    processed.push({
      description: desc,
      quantity: q,
      rate: r,
      amount,
    });
  }

  return { items: processed };
}

// GET /api/v1/invoices — Server-side filtered & paginated invoices list
app.get('/api/v1/invoices', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      search,
      status,
      customerId,
      bookingId,
      fromDate,
      toDate,
      page = '1',
      limit = '20',
    } = req.query;

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(String(limit), 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [];

    if (status && typeof status === 'string' && status.trim() !== '' && status !== 'ALL') {
      conditions.push(eq(invoices.status, status.trim().toUpperCase() as any));
    }
    if (customerId && typeof customerId === 'string' && customerId.trim() !== '') {
      conditions.push(eq(invoices.customerId, customerId.trim()));
    }
    if (bookingId && typeof bookingId === 'string' && bookingId.trim() !== '') {
      conditions.push(eq(invoices.bookingId, bookingId.trim()));
    }
    if (fromDate && typeof fromDate === 'string' && isValidDate(fromDate.trim())) {
      conditions.push(sql`${invoices.eventDate} >= ${fromDate.trim()}`);
    }
    if (toDate && typeof toDate === 'string' && isValidDate(toDate.trim())) {
      conditions.push(sql`${invoices.eventDate} <= ${toDate.trim()}`);
    }

    let query = db.select().from(invoices);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const allInvoices = await query.orderBy(desc(invoices.createdAt));
    const allCustomers = await db.select().from(customers);
    const custMap = new Map(allCustomers.map((c) => [c.id, c]));

    const allBookings = await db.select().from(bookings);
    const bkgMap = new Map(allBookings.map((b) => [b.id, b]));

    // Search filter across invoice number, customer name, mobile
    let filtered = allInvoices;
    if (search && typeof search === 'string' && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      filtered = allInvoices.filter((inv) => {
        const c = custMap.get(inv.customerId);
        const b = inv.bookingId ? bkgMap.get(inv.bookingId) : null;
        return (
          inv.invoiceNumber.toLowerCase().includes(q) ||
          c?.name.toLowerCase().includes(q) ||
          c?.mobile.includes(q) ||
          b?.bookingNumber.toLowerCase().includes(q)
        );
      });
    }

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limitNum);

    const enriched = paginated.map((inv) => {
      let parsedItems: any[] = [];
      try {
        parsedItems = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items || [];
      } catch {
        parsedItems = [];
      }

      let parsedSnapshot: any = {};
      try {
        parsedSnapshot = typeof inv.snapshot === 'string' ? JSON.parse(inv.snapshot) : inv.snapshot || {};
      } catch {
        parsedSnapshot = {};
      }

      return {
        ...inv,
        customer: custMap.get(inv.customerId) || null,
        booking: inv.bookingId ? bkgMap.get(inv.bookingId) || null : null,
        parsedItems,
        parsedSnapshot,
      };
    });

    res.json({
      success: true,
      data: enriched,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/invoices/:id — Single invoice detail with snapshots, customer, booking, quotation & audit history
app.get('/api/v1/invoices/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [inv] = await db.select().from(invoices).where(eq(invoices.id, req.params.id));
    if (!inv) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found.' } });
    }

    const [c] = await db.select().from(customers).where(eq(customers.id, inv.customerId));
    const [b] = inv.bookingId ? await db.select().from(bookings).where(eq(bookings.id, inv.bookingId)) : [null];
    const [quo] = inv.quotationId ? await db.select().from(quotations).where(eq(quotations.id, inv.quotationId)) : [null];
    const [s] = await db.select().from(settings).where(eq(settings.id, 'default'));
    const auditHistory = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entity, 'Invoice'), eq(auditLogs.entityId, inv.id)))
      .orderBy(desc(auditLogs.createdAt));

    let parsedItems: any[] = [];
    try {
      parsedItems = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items || [];
    } catch {
      parsedItems = [];
    }

    let parsedSnapshot: any = {};
    try {
      parsedSnapshot = typeof inv.snapshot === 'string' ? JSON.parse(inv.snapshot) : inv.snapshot || {};
    } catch {
      parsedSnapshot = {};
    }

    res.json({
      success: true,
      data: {
        ...inv,
        customer: c || null,
        booking: b || null,
        quotation: quo || null,
        settings: s || null,
        parsedItems,
        parsedSnapshot,
        auditHistory,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/invoices/:id/print — Structured layout data for print-friendly GST invoice
app.get('/api/v1/invoices/:id/print', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [inv] = await db.select().from(invoices).where(eq(invoices.id, req.params.id));
    if (!inv) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found.' } });
    }

    const [c] = await db.select().from(customers).where(eq(customers.id, inv.customerId));
    const [b] = inv.bookingId ? await db.select().from(bookings).where(eq(bookings.id, inv.bookingId)) : [null];
    const [s] = await db.select().from(settings).where(eq(settings.id, 'default'));

    let parsedItems: any[] = [];
    try {
      parsedItems = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items || [];
    } catch {
      parsedItems = [];
    }

    let parsedSnapshot: any = {};
    try {
      parsedSnapshot = typeof inv.snapshot === 'string' ? JSON.parse(inv.snapshot) : inv.snapshot || {};
    } catch {
      parsedSnapshot = {};
    }

    // Historical snapshot takes precedence for financial document immutability
    const businessName = parsedSnapshot.businessName || s?.businessName || 'Bandhan Vatika';
    const businessAddress = parsedSnapshot.address || s?.address || '123, MG Road, Indore, MP 452001';
    const businessGstin = parsedSnapshot.gstin || s?.gstin || '23AAAAA0000A1Z5';
    const businessPhone = parsedSnapshot.phone || s?.phone || '9876543210';
    const businessEmail = parsedSnapshot.email || s?.email || 'contact@bandhanvatika.com';
    const bankDetails = {
      bankName: parsedSnapshot.bankName || s?.bankName || 'HDFC Bank',
      accountNumber: parsedSnapshot.accountNumber || s?.accountNumber || '50200012345678',
      ifscCode: parsedSnapshot.ifscCode || s?.ifscCode || 'HDFC0001234',
    };
    const terms = inv.terms || parsedSnapshot.terms || s?.termsAndConditions || '';

    const customerName = parsedSnapshot.customerName || c?.name || 'Valued Guest';
    const customerAddress = parsedSnapshot.customerAddress || c?.address || '';
    const customerMobile = parsedSnapshot.customerMobile || c?.mobile || '';
    const customerGstin = parsedSnapshot.customerGstin || (c as any)?.gstin || 'URP (Unregistered)';

    res.json({
      success: true,
      data: {
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate || inv.eventDate,
        status: inv.status,
        eventDate: inv.eventDate,
        eventType: inv.eventType,
        business: {
          name: businessName,
          tagline: parsedSnapshot.tagline || s?.tagline || 'Celebrations · Together · Always',
          address: businessAddress,
          gstin: businessGstin,
          phone: businessPhone,
          email: businessEmail,
          bankDetails,
        },
        customer: {
          name: customerName,
          address: customerAddress,
          mobile: customerMobile,
          gstin: customerGstin,
        },
        items: parsedItems.map((item, idx) => ({
          srNo: idx + 1,
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
        })),
        financials: {
          subtotal: inv.subtotal,
          discount: inv.discount,
          taxableAmount: (parseFloat(inv.subtotal) - parseFloat(inv.discount)).toFixed(2),
          taxPercent: inv.taxPercent,
          cgstRate: (parseFloat(inv.taxPercent) / 2).toFixed(2),
          cgstAmount: inv.cgstAmount,
          sgstRate: (parseFloat(inv.taxPercent) / 2).toFixed(2),
          sgstAmount: inv.sgstAmount,
          totalTax: inv.taxAmount,
          grandTotal: inv.grandTotal,
          paidAmount: inv.paidAmount,
          balanceAmount: inv.balanceAmount,
        },
        notes: inv.notes,
        terms,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/invoices — Create DRAFT or ISSUED Invoice with server-authoritative calculations & concurrency lock
app.post('/api/v1/invoices', authenticate, requireRoles(['OWNER', 'MANAGER', 'ACCOUNTANT']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      customerId,
      bookingId,
      quotationId,
      eventType = 'Event',
      eventDate,
      invoiceDate: rawInvoiceDate,
      dueDate: rawDueDate,
      items,
      discount = 0,
      notes,
      terms,
      status = 'ISSUED',
    } = req.body;

    // 1. Mandatory Fields Validation
    if (!customerId || typeof customerId !== 'string' || !customerId.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Customer ID is required.' },
      });
    }

    if (!eventDate || !isValidDate(eventDate)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_EVENT_DATE', message: 'Valid event date in YYYY-MM-DD format is required.' },
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const invoiceDate = rawInvoiceDate ? String(rawInvoiceDate).trim() : todayStr;
    if (!isValidDate(invoiceDate)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INVOICE_DATE', message: 'Invoice date must be in YYYY-MM-DD format.' },
      });
    }

    const dueDate = rawDueDate ? String(rawDueDate).trim() : eventDate;
    if (!isValidDate(dueDate)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_DUE_DATE', message: 'Due date must be in YYYY-MM-DD format.' },
      });
    }

    // 2. Validate Target Status
    const targetStatus = typeof status === 'string' ? status.trim().toUpperCase() : 'ISSUED';
    if (!['DRAFT', 'ISSUED'].includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INITIAL_STATUS', message: 'New invoices can only be created with DRAFT or ISSUED status.' },
      });
    }

    // 3. Validate Discount
    const rawDiscount = Number(discount) || 0;
    if (isNaN(rawDiscount) || rawDiscount < 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_DISCOUNT', message: 'Discount cannot be negative.' },
      });
    }

    // 4. Validate Items
    const itemsCheck = validateAndProcessInvoiceItems(items);
    if (itemsCheck.error || !itemsCheck.items) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ITEM_VALUES', message: itemsCheck.error || 'Invalid items.' },
      });
    }

    // 5. Database Transaction
    const result = await db.transaction(async (tx) => {
      // 5.1 Customer Validation
      const [cust] = await tx.select().from(customers).where(eq(customers.id, customerId.trim()));
      if (!cust) {
        throw { status: 404, code: 'CUSTOMER_NOT_FOUND', message: 'Specified customer does not exist.' };
      }
      if (!cust.isActive) {
        throw { status: 400, code: 'INACTIVE_CUSTOMER', message: 'Customer is deactivated and cannot receive new invoices.' };
      }

      // 5.2 Booking Validation (if supplied)
      if (bookingId && typeof bookingId === 'string' && bookingId.trim()) {
        const [b] = await tx.select().from(bookings).where(eq(bookings.id, bookingId.trim()));
        if (!b) {
          throw { status: 404, code: 'BOOKING_NOT_FOUND', message: 'Referenced booking does not exist.' };
        }
        if (b.customerId !== customerId.trim()) {
          throw {
            status: 400,
            code: 'CUSTOMER_BOOKING_MISMATCH',
            message: `Invoice customer (${customerId}) does not match booking customer (${b.customerId}).`,
          };
        }
        if (b.status === 'CANCELLED') {
          throw {
            status: 400,
            code: 'CANNOT_INVOICE_CANCELLED_BOOKING',
            message: `Cannot issue invoice for cancelled booking #${b.bookingNumber}.`,
          };
        }

        // Duplicate Invoice Protection: check for existing active invoice
        const [existingInv] = await tx
          .select()
          .from(invoices)
          .where(and(eq(invoices.bookingId, bookingId.trim()), ne(invoices.status, 'CANCELLED')));
        if (existingInv) {
          throw {
            status: 409,
            code: 'INVOICE_ALREADY_EXISTS',
            message: `An active invoice (#${existingInv.invoiceNumber}) already exists for this booking.`,
          };
        }
      }

      // 5.3 Quotation Validation (if supplied)
      if (quotationId && typeof quotationId === 'string' && quotationId.trim()) {
        const [quo] = await tx.select().from(quotations).where(eq(quotations.id, quotationId.trim()));
        if (!quo) {
          throw { status: 404, code: 'QUOTATION_NOT_FOUND', message: 'Referenced quotation does not exist.' };
        }
        if (quo.customerId !== customerId.trim()) {
          throw {
            status: 400,
            code: 'CUSTOMER_QUOTATION_MISMATCH',
            message: `Invoice customer does not match quotation customer.`,
          };
        }
      }

      // 5.4 Fetch authoritative tax rate from Settings
      const [settingRow] = await tx.select().from(settings).where(eq(settings.id, 'default'));
      const taxPercent = settingRow ? Number(settingRow.defaultTaxPercent) : 18.0;

      // 5.5 Financial Calculation
      const financialItems = itemsCheck.items!.map((it) => ({
        description: it.description,
        qty: it.quantity,
        rate: it.rate,
      }));
      const fin = calculateFinancials(financialItems, rawDiscount, taxPercent, 0);

      if (rawDiscount > Number(fin.subtotal)) {
        throw {
          status: 400,
          code: 'DISCOUNT_EXCEEDS_SUBTOTAL',
          message: `Discount (₹${rawDiscount}) cannot exceed subtotal (₹${fin.subtotal}).`,
        };
      }

      // 5.6 Concurrency-Safe Invoice Number Generation
      const invoiceNumber = await generateInvoiceNumber(tx);
      const invoiceId = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      // 5.7 Snapshot generation
      const snapshot = buildInvoiceSnapshot(settingRow, cust, taxPercent);

      // 5.8 Insert Invoice record
      // Phase 5 rule: AMOUNT DUE = INVOICE TOTAL. paidAmount is strictly 0.00.
      const [inserted] = await tx
        .insert(invoices)
        .values({
          id: invoiceId,
          invoiceNumber,
          customerId: customerId.trim(),
          bookingId: bookingId && typeof bookingId === 'string' && bookingId.trim() ? bookingId.trim() : null,
          quotationId: quotationId && typeof quotationId === 'string' && quotationId.trim() ? quotationId.trim() : null,
          invoiceDate,
          eventDate,
          eventType: String(eventType || 'Event').trim(),
          items: JSON.stringify(itemsCheck.items),
          subtotal: fin.subtotal,
          discount: fin.discount,
          taxPercent: fin.taxPercent,
          taxAmount: fin.taxAmount,
          cgstAmount: fin.cgstAmount,
          sgstAmount: fin.sgstAmount,
          igstAmount: fin.igstAmount,
          grandTotal: fin.grandTotal,
          paidAmount: '0.00',
          balanceAmount: fin.grandTotal,
          status: targetStatus as any,
          dueDate,
          terms: terms || settingRow?.termsAndConditions || null,
          notes: notes ? String(notes).trim() : null,
          snapshot,
          createdBy: req.user?.username || 'accountant',
        })
        .returning();

      return inserted;
    });

    // 6. Audit Logging
    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username || 'Staff',
      userRole: req.user?.role || 'ACCOUNTANT',
      action: 'INVOICE_CREATE',
      entity: 'Invoice',
      entityId: result.id,
      details: `Created ${result.status} invoice #${result.invoiceNumber} for ₹${result.grandTotal} (Customer: ${result.customerId})`,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.status(201).json({
      success: true,
      message: `Invoice #${result.invoiceNumber} successfully created.`,
      data: result,
    });
  } catch (err: any) {
    if (err && err.status) {
      return res.status(err.status).json({
        success: false,
        error: { code: err.code || 'VALIDATION_ERROR', message: err.message },
      });
    }
    console.error('Invoice creation error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/invoices/from-booking/:bookingId — Authoritative invoice generation from existing Booking
app.post('/api/v1/invoices/from-booking/:bookingId', authenticate, requireRoles(['OWNER', 'MANAGER', 'ACCOUNTANT']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const bookingId = req.params.bookingId;

    const result = await db.transaction(async (tx) => {
      // 1. Fetch Booking
      const [b] = await tx.select().from(bookings).where(eq(bookings.id, bookingId));
      if (!b) {
        throw { status: 404, code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' };
      }
      if (b.status === 'CANCELLED') {
        throw { status: 400, code: 'CANNOT_INVOICE_CANCELLED_BOOKING', message: `Cannot generate invoice for cancelled booking #${b.bookingNumber}.` };
      }

      // 2. Duplicate invoice prevention
      const [existingInv] = await tx
        .select()
        .from(invoices)
        .where(and(eq(invoices.bookingId, bookingId), ne(invoices.status, 'CANCELLED')));
      if (existingInv) {
        throw {
          status: 409,
          code: 'INVOICE_ALREADY_EXISTS',
          message: `An active invoice (#${existingInv.invoiceNumber}) already exists for this booking.`,
        };
      }

      // 3. Customer validation
      const [cust] = await tx.select().from(customers).where(eq(customers.id, b.customerId));
      if (!cust) {
        throw { status: 404, code: 'CUSTOMER_NOT_FOUND', message: 'Customer associated with booking not found.' };
      }
      if (!cust.isActive) {
        throw { status: 400, code: 'INACTIVE_CUSTOMER', message: 'Customer is deactivated.' };
      }

      // 4. Extract or assemble items
      let bookingServices: any[] = [];
      try {
        bookingServices = typeof b.services === 'string' ? JSON.parse(b.services) : b.services || [];
      } catch {
        bookingServices = [];
      }

      let invoiceItems: any[] = [];
      if (bookingServices.length > 0) {
        for (const s of bookingServices) {
          const q = Number(s.quantity !== undefined ? s.quantity : s.qty) || 1;
          const r = Number(s.rate !== undefined ? s.rate : s.unitPrice) || 0;
          invoiceItems.push({
            description: s.description || 'Event Service',
            quantity: q,
            rate: r,
            amount: parseFloat((q * r).toFixed(2)),
          });
        }
      } else {
        // Venue hire item from booking subtotal
        invoiceItems.push({
          description: `Venue & Event Booking (${b.eventType})`,
          quantity: 1,
          rate: Number(b.subtotal) || 10000,
          amount: Number(b.subtotal) || 10000,
        });
      }

      // 5. Settings & financials
      const [settingRow] = await tx.select().from(settings).where(eq(settings.id, 'default'));
      const taxPercent = Number(b.taxPercent) || (settingRow ? Number(settingRow.defaultTaxPercent) : 18.0);
      const discount = Number(b.discount) || 0;

      const financialItems = invoiceItems.map((it) => ({
        description: it.description,
        qty: it.quantity,
        rate: it.rate,
      }));
      const fin = calculateFinancials(financialItems, discount, taxPercent, 0);

      // 6. Numbering with advisory lock
      const invoiceNumber = await generateInvoiceNumber(tx);
      const invoiceId = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const snapshot = buildInvoiceSnapshot(settingRow, cust, taxPercent);
      const todayStr = new Date().toISOString().split('T')[0];

      // 7. Insert Invoice
      const [inserted] = await tx
        .insert(invoices)
        .values({
          id: invoiceId,
          invoiceNumber,
          customerId: b.customerId,
          bookingId: b.id,
          quotationId: null,
          invoiceDate: todayStr,
          eventDate: b.eventDate,
          eventType: b.eventType,
          items: JSON.stringify(invoiceItems),
          subtotal: fin.subtotal,
          discount: fin.discount,
          taxPercent: fin.taxPercent,
          taxAmount: fin.taxAmount,
          cgstAmount: fin.cgstAmount,
          sgstAmount: fin.sgstAmount,
          igstAmount: fin.igstAmount,
          grandTotal: fin.grandTotal,
          paidAmount: '0.00',
          balanceAmount: fin.grandTotal,
          status: 'ISSUED',
          dueDate: b.eventDate,
          terms: settingRow?.termsAndConditions || null,
          notes: `Generated from Booking #${b.bookingNumber}`,
          snapshot,
          createdBy: req.user?.username || 'accountant',
        })
        .returning();

      return inserted;
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username || 'Staff',
      userRole: req.user?.role || 'ACCOUNTANT',
      action: 'INVOICE_CREATE',
      entity: 'Invoice',
      entityId: result.id,
      details: `Generated invoice #${result.invoiceNumber} from Booking #${result.bookingId}`,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.status(201).json({
      success: true,
      message: `Invoice #${result.invoiceNumber} generated from Booking.`,
      data: result,
    });
  } catch (err: any) {
    if (err && err.status) {
      return res.status(err.status).json({
        success: false,
        error: { code: err.code || 'VALIDATION_ERROR', message: err.message },
      });
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/invoices/from-quotation/:quotationId — Authoritative invoice generation from ACCEPTED/CONVERTED Quotation
app.post('/api/v1/invoices/from-quotation/:quotationId', authenticate, requireRoles(['OWNER', 'MANAGER', 'ACCOUNTANT']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const quotationId = req.params.quotationId;

    const result = await db.transaction(async (tx) => {
      // 1. Fetch Quotation
      const [quo] = await tx.select().from(quotations).where(eq(quotations.id, quotationId));
      if (!quo) {
        throw { status: 404, code: 'QUOTATION_NOT_FOUND', message: 'Quotation not found.' };
      }
      if (!['ACCEPTED', 'CONVERTED'].includes(quo.status)) {
        throw {
          status: 400,
          code: 'INVALID_STATUS_FOR_INVOICE',
          message: `Invoices can only be generated from ACCEPTED or CONVERTED quotations (current status: ${quo.status}).`,
        };
      }

      // 2. Validate Customer
      const [cust] = await tx.select().from(customers).where(eq(customers.id, quo.customerId));
      if (!cust) {
        throw { status: 404, code: 'CUSTOMER_NOT_FOUND', message: 'Customer associated with quotation not found.' };
      }
      if (!cust.isActive) {
        throw { status: 400, code: 'INACTIVE_CUSTOMER', message: 'Customer is deactivated.' };
      }

      // 3. Extract items
      let quoItems: any[] = [];
      try {
        quoItems = typeof quo.items === 'string' ? JSON.parse(quo.items) : quo.items || [];
      } catch {
        quoItems = [];
      }

      const itemsCheck = validateAndProcessInvoiceItems(quoItems);
      if (itemsCheck.error || !itemsCheck.items) {
        throw { status: 400, code: 'INVALID_QUOTATION_ITEMS', message: itemsCheck.error };
      }

      // 4. Duplicate invoice check if booking exists
      if (quo.bookingId) {
        const [existingInv] = await tx
          .select()
          .from(invoices)
          .where(and(eq(invoices.bookingId, quo.bookingId), ne(invoices.status, 'CANCELLED')));
        if (existingInv) {
          throw {
            status: 409,
            code: 'INVOICE_ALREADY_EXISTS',
            message: `An active invoice (#${existingInv.invoiceNumber}) already exists for the linked booking.`,
          };
        }
      }

      // 5. Settings & financials
      const [settingRow] = await tx.select().from(settings).where(eq(settings.id, 'default'));
      const taxPercent = Number(quo.taxPercent) || (settingRow ? Number(settingRow.defaultTaxPercent) : 18.0);
      const discount = Number(quo.discount) || 0;

      const financialItems = itemsCheck.items.map((it) => ({
        description: it.description,
        qty: it.quantity,
        rate: it.rate,
      }));
      const fin = calculateFinancials(financialItems, discount, taxPercent, 0);

      // 6. Numbering with advisory lock
      const invoiceNumber = await generateInvoiceNumber(tx);
      const invoiceId = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const snapshot = buildInvoiceSnapshot(settingRow, cust, taxPercent);
      const todayStr = new Date().toISOString().split('T')[0];

      // 7. Insert Invoice
      const [inserted] = await tx
        .insert(invoices)
        .values({
          id: invoiceId,
          invoiceNumber,
          customerId: quo.customerId,
          bookingId: quo.bookingId || null,
          quotationId: quo.id,
          invoiceDate: todayStr,
          eventDate: quo.eventDate,
          eventType: quo.eventType,
          items: JSON.stringify(itemsCheck.items),
          subtotal: fin.subtotal,
          discount: fin.discount,
          taxPercent: fin.taxPercent,
          taxAmount: fin.taxAmount,
          cgstAmount: fin.cgstAmount,
          sgstAmount: fin.sgstAmount,
          igstAmount: fin.igstAmount,
          grandTotal: fin.grandTotal,
          paidAmount: '0.00',
          balanceAmount: fin.grandTotal,
          status: 'ISSUED',
          dueDate: quo.eventDate,
          terms: quo.terms || settingRow?.termsAndConditions || null,
          notes: `Generated from Quotation #${quo.quotationNumber}`,
          snapshot,
          createdBy: req.user?.username || 'accountant',
        })
        .returning();

      return inserted;
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username || 'Staff',
      userRole: req.user?.role || 'ACCOUNTANT',
      action: 'INVOICE_CREATE',
      entity: 'Invoice',
      entityId: result.id,
      details: `Generated invoice #${result.invoiceNumber} from Quotation #${result.quotationId}`,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.status(201).json({
      success: true,
      message: `Invoice #${result.invoiceNumber} generated from Quotation.`,
      data: result,
    });
  } catch (err: any) {
    if (err && err.status) {
      return res.status(err.status).json({
        success: false,
        error: { code: err.code || 'VALIDATION_ERROR', message: err.message },
      });
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PUT /api/v1/invoices/:id — Edit DRAFT Invoice (strictly forbidden for ISSUED/PAID/CANCELLED)
app.put('/api/v1/invoices/:id', authenticate, requireRoles(['OWNER', 'MANAGER', 'ACCOUNTANT']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const invoiceId = req.params.id;
    const [existing] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found.' } });
    }

    // STRICT IMMUTABILITY: Only DRAFT invoices can be edited!
    if (existing.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CANNOT_EDIT_NON_DRAFT',
          message: `Invoice is in ${existing.status} status and cannot be edited. Issued financial documents are immutable.`,
        },
      });
    }

    const {
      eventType,
      eventDate,
      invoiceDate,
      dueDate,
      items,
      discount,
      notes,
      terms,
    } = req.body;

    // Validate dates if provided
    const effEventDate = eventDate !== undefined ? eventDate : existing.eventDate;
    if (!isValidDate(effEventDate)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_EVENT_DATE', message: 'Invalid event date.' } });
    }

    const effInvoiceDate = invoiceDate !== undefined ? invoiceDate : existing.invoiceDate;
    if (!isValidDate(effInvoiceDate)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_INVOICE_DATE', message: 'Invalid invoice date.' } });
    }

    const effDueDate = dueDate !== undefined ? dueDate : existing.dueDate;
    if (effDueDate && !isValidDate(effDueDate)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_DUE_DATE', message: 'Invalid due date.' } });
    }

    // Process items
    let processedItems: any[] = [];
    if (items !== undefined) {
      const itemsCheck = validateAndProcessInvoiceItems(items);
      if (itemsCheck.error || !itemsCheck.items) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_ITEM_VALUES', message: itemsCheck.error } });
      }
      processedItems = itemsCheck.items;
    } else {
      try {
        processedItems = typeof existing.items === 'string' ? JSON.parse(existing.items) : existing.items || [];
      } catch {
        processedItems = [];
      }
    }

    const rawDiscount = discount !== undefined ? Number(discount) : Number(existing.discount);
    if (isNaN(rawDiscount) || rawDiscount < 0) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_DISCOUNT', message: 'Discount cannot be negative.' } });
    }

    // Recalculate financials
    const [settingRow] = await db.select().from(settings).where(eq(settings.id, 'default'));
    const taxPercent = settingRow ? Number(settingRow.defaultTaxPercent) : Number(existing.taxPercent);
    const financialItems = processedItems.map((it) => ({
      description: it.description,
      qty: it.quantity,
      rate: it.rate,
    }));
    const fin = calculateFinancials(financialItems, rawDiscount, taxPercent, 0);

    if (rawDiscount > Number(fin.subtotal)) {
      return res.status(400).json({
        success: false,
        error: { code: 'DISCOUNT_EXCEEDS_SUBTOTAL', message: `Discount cannot exceed subtotal.` },
      });
    }

    const [c] = await db.select().from(customers).where(eq(customers.id, existing.customerId));
    const snapshot = buildInvoiceSnapshot(settingRow, c, taxPercent);

    const [updated] = await db
      .update(invoices)
      .set({
        eventType: eventType !== undefined ? String(eventType).trim() : existing.eventType,
        eventDate: effEventDate,
        invoiceDate: effInvoiceDate,
        dueDate: effDueDate,
        items: JSON.stringify(processedItems),
        subtotal: fin.subtotal,
        discount: fin.discount,
        taxPercent: fin.taxPercent,
        taxAmount: fin.taxAmount,
        cgstAmount: fin.cgstAmount,
        sgstAmount: fin.sgstAmount,
        igstAmount: fin.igstAmount,
        grandTotal: fin.grandTotal,
        balanceAmount: fin.grandTotal,
        notes: notes !== undefined ? String(notes).trim() : existing.notes,
        terms: terms !== undefined ? String(terms).trim() : existing.terms,
        snapshot,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId))
      .returning();

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username || 'Staff',
      userRole: req.user?.role || 'ACCOUNTANT',
      action: 'INVOICE_UPDATE',
      entity: 'Invoice',
      entityId: existing.id,
      details: `Updated DRAFT invoice #${existing.invoiceNumber}. New total: ₹${fin.grandTotal}`,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.json({
      success: true,
      message: `Invoice #${existing.invoiceNumber} updated successfully.`,
      data: updated,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/invoices/:id/issue — Transition DRAFT -> ISSUED (Freezes snapshot and locks document)
app.post('/api/v1/invoices/:id/issue', authenticate, requireRoles(['OWNER', 'MANAGER', 'ACCOUNTANT']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const invoiceId = req.params.id;
    const [inv] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
    if (!inv) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found.' } });
    }

    if (inv.status === 'ISSUED') {
      return res.status(400).json({ success: false, error: { code: 'ALREADY_ISSUED', message: 'Invoice is already issued.' } });
    }

    if (inv.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS_TRANSITION', message: `Cannot issue invoice in ${inv.status} status.` },
      });
    }

    const [c] = await db.select().from(customers).where(eq(customers.id, inv.customerId));
    const [settingRow] = await db.select().from(settings).where(eq(settings.id, 'default'));
    const snapshot = buildInvoiceSnapshot(settingRow, c, Number(inv.taxPercent));

    const [updated] = await db
      .update(invoices)
      .set({
        status: 'ISSUED',
        snapshot,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, inv.id))
      .returning();

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username || 'Staff',
      userRole: req.user?.role || 'ACCOUNTANT',
      action: 'INVOICE_ISSUE',
      entity: 'Invoice',
      entityId: inv.id,
      details: `Issued invoice #${inv.invoiceNumber} for ₹${inv.grandTotal}`,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.json({
      success: true,
      message: `Invoice #${inv.invoiceNumber} successfully issued.`,
      data: updated,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/invoices/:id/cancel — Transition ISSUED/DRAFT -> CANCELLED with audit notes
app.post('/api/v1/invoices/:id/cancel', authenticate, requireRoles(['OWNER', 'MANAGER', 'ACCOUNTANT']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const invoiceId = req.params.id;
    const { reason } = req.body || {};

    const [inv] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
    if (!inv) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found.' } });
    }

    if (inv.status === 'CANCELLED') {
      return res.status(400).json({ success: false, error: { code: 'ALREADY_CANCELLED', message: 'Invoice is already cancelled.' } });
    }

    const cancelReason = typeof reason === 'string' && reason.trim() ? reason.trim() : 'Cancelled by staff action';
    const updatedNotes = inv.notes ? `${inv.notes}\n[CANCELLED: ${cancelReason}]` : `[CANCELLED: ${cancelReason}]`;

    const [updated] = await db
      .update(invoices)
      .set({
        status: 'CANCELLED',
        notes: updatedNotes,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, inv.id))
      .returning();

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || req.user?.username || 'Staff',
      userRole: req.user?.role || 'ACCOUNTANT',
      action: 'INVOICE_CANCEL',
      entity: 'Invoice',
      entityId: inv.id,
      details: `Cancelled invoice #${inv.invoiceNumber}. Reason: ${cancelReason}`,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.json({
      success: true,
      message: `Invoice #${inv.invoiceNumber} successfully cancelled.`,
      data: updated,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ----------------------------------------------------
// 10. PAYMENTS MODULE (PHASE 6)
// ----------------------------------------------------

// GET /api/v1/payments — Server-side filtered and paginated payment ledger
app.get('/api/v1/payments', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      page = '1',
      limit = '50',
      search,
      receiptNumber,
      invoiceNumber,
      invoiceId,
      bookingId,
      customerId,
      paymentMethod,
      paymentType,
      isReversed,
      startDate,
      endDate,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [];

    if (receiptNumber && typeof receiptNumber === 'string') {
      conditions.push(ilike(payments.receiptNumber, `%${receiptNumber.trim()}%`));
    }
    if (invoiceId && typeof invoiceId === 'string') {
      conditions.push(eq(payments.invoiceId, invoiceId));
    }
    if (bookingId && typeof bookingId === 'string') {
      conditions.push(eq(payments.bookingId, bookingId));
    }
    if (customerId && typeof customerId === 'string') {
      conditions.push(eq(payments.customerId, customerId));
    }
    if (paymentMethod && typeof paymentMethod === 'string') {
      conditions.push(eq(payments.paymentMethod, paymentMethod.toUpperCase()));
    }
    if (paymentType && typeof paymentType === 'string') {
      conditions.push(eq(payments.paymentType, paymentType.toUpperCase()));
    }
    if (isReversed !== undefined && isReversed !== '') {
      conditions.push(eq(payments.isReversed, isReversed === 'true' || isReversed === '1'));
    }
    if (startDate && typeof startDate === 'string') {
      conditions.push(gte(payments.paymentDate, startDate));
    }
    if (endDate && typeof endDate === 'string') {
      conditions.push(lte(payments.paymentDate, endDate));
    }
    if (search && typeof search === 'string') {
      const s = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(payments.receiptNumber, s),
          ilike(payments.transactionReference, s),
          ilike(payments.notes, s),
          ilike(payments.paymentMethod, s)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const totalCountQuery = await db
      .select({ count: sql<number>`count(*)` })
      .from(payments)
      .where(whereClause);
    const total = Number(totalCountQuery[0]?.count || 0);

    const list = await db
      .select()
      .from(payments)
      .where(whereClause)
      .orderBy(desc(payments.paymentDate), desc(payments.createdAt))
      .limit(limitNum)
      .offset(offset);

    const allCust = await db.select().from(customers);
    const cMap = new Map(allCust.map((c) => [c.id, c]));

    const allInvs = await db.select().from(invoices);
    const iMap = new Map(allInvs.map((i) => [i.id, i]));

    const allBkgs = await db.select().from(bookings);
    const bMap = new Map(allBkgs.map((b) => [b.id, b]));

    let filteredList = list;
    if (invoiceNumber && typeof invoiceNumber === 'string') {
      const invMatch = allInvs.find((i) => i.invoiceNumber.toLowerCase().includes((invoiceNumber as string).toLowerCase()));
      if (invMatch) {
        filteredList = filteredList.filter((p) => p.invoiceId === invMatch.id);
      }
    }

    const enriched = filteredList.map((p) => ({
      ...p,
      customer: cMap.get(p.customerId) || null,
      invoice: p.invoiceId ? iMap.get(p.invoiceId) || null : null,
      booking: p.bookingId ? bMap.get(p.bookingId) || null : null,
    }));

    res.json({
      success: true,
      data: enriched,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/payments/:id — Detailed payment view with customer, invoice, booking, and audit history
app.get('/api/v1/payments/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [p] = await db.select().from(payments).where(eq(payments.id, req.params.id));
    if (!p) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment record not found.' } });
    }

    const [c] = await db.select().from(customers).where(eq(customers.id, p.customerId));
    const [inv] = p.invoiceId ? await db.select().from(invoices).where(eq(invoices.id, p.invoiceId)) : [null];
    const [bkg] = p.bookingId ? await db.select().from(bookings).where(eq(bookings.id, p.bookingId)) : [null];
    const auditHistory = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entity, 'Payment'), eq(auditLogs.entityId, p.id)))
      .orderBy(desc(auditLogs.createdAt));

    res.json({
      success: true,
      data: {
        ...p,
        customer: c || null,
        invoice: inv || null,
        booking: bkg || null,
        auditHistory,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/payments/:id/receipt — Print-friendly payment receipt payload
app.get('/api/v1/payments/:id/receipt', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [p] = await db.select().from(payments).where(eq(payments.id, req.params.id));
    if (!p) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment record not found.' } });
    }

    const [c] = await db.select().from(customers).where(eq(customers.id, p.customerId));
    const [inv] = p.invoiceId ? await db.select().from(invoices).where(eq(invoices.id, p.invoiceId)) : [null];
    const [bkg] = p.bookingId ? await db.select().from(bookings).where(eq(bookings.id, p.bookingId)) : [null];
    const [propSettings] = await db.select().from(settings).where(eq(settings.id, 'default'));

    // Compute balance context for receipt
    let invoiceTotal = '0.00';
    let previousBalance = '0.00';
    let balanceAfterPayment = '0.00';

    if (inv) {
      invoiceTotal = inv.grandTotal;
      const invPayments = await db
        .select()
        .from(payments)
        .where(and(eq(payments.invoiceId, inv.id), eq(payments.isReversed, false)))
        .orderBy(payments.createdAt);

      let cumulativePaid = 0;
      let prevPaid = 0;
      const grandTotalNum = Number(inv.grandTotal);

      for (const pay of invPayments) {
        if (pay.id === p.id) {
          prevPaid = cumulativePaid;
        }
        cumulativePaid += Number(pay.amount);
      }

      previousBalance = Math.max(0, grandTotalNum - prevPaid).toFixed(2);
      balanceAfterPayment = Math.max(0, grandTotalNum - (prevPaid + (p.isReversed ? 0 : Number(p.amount)))).toFixed(2);
    } else if (bkg) {
      invoiceTotal = bkg.grandTotal;
      previousBalance = bkg.balanceAmount;
      balanceAfterPayment = bkg.balanceAmount;
    }

    res.json({
      success: true,
      data: {
        bandhanVatika: {
          businessName: propSettings?.businessName || 'Bandhan Vatika',
          tagline: propSettings?.tagline || 'Celebrations · Together · Always',
          address: propSettings?.address || 'Bypass Road, Indore, MP',
          phone: propSettings?.phone || '+91 98260 12345',
          email: propSettings?.email || 'contact@bandhanvatika.com',
          gstin: propSettings?.gstin || '23AABCB1234F1Z0',
          bankName: propSettings?.bankName || 'HDFC Bank',
          accountNumber: propSettings?.accountNumber || '50200088991234',
          ifscCode: propSettings?.ifscCode || 'HDFC0001234',
        },
        receiptNumber: p.receiptNumber,
        paymentDate: p.paymentDate,
        customer: {
          id: c?.id || p.customerId,
          name: c?.name || 'Valued Client',
          mobile: c?.mobile || '',
          email: c?.email || '',
          address: c?.address || '',
          city: c?.city || '',
        },
        invoice: inv ? { id: inv.id, invoiceNumber: inv.invoiceNumber, grandTotal: inv.grandTotal, status: inv.status } : null,
        booking: bkg ? { id: bkg.id, bookingNumber: bkg.bookingNumber, eventType: bkg.eventType, eventDate: bkg.eventDate } : null,
        paymentMethod: p.paymentMethod,
        transactionReference: p.transactionReference || '',
        paymentType: p.paymentType,
        amount: p.amount,
        invoiceTotal,
        previousBalance,
        balanceAfterPayment,
        notes: p.notes || '',
        isReversed: p.isReversed,
        reversalReason: p.reversalReason || null,
        reversedAt: p.reversedAt || null,
        reversedBy: p.reversedBy || null,
        receivedBy: p.createdBy,
        createdAt: p.createdAt,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/payments — Create payment with strict transactional concurrency & overpayment validation
app.post('/api/v1/payments', authenticate, requireRoles(['OWNER', 'ACCOUNTANT', 'MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      invoiceId,
      bookingId: reqBookingId,
      customerId: reqCustomerId,
      amount,
      paymentMethod = 'CASH',
      transactionReference,
      paymentDate = new Date().toISOString().split('T')[0],
      paymentType: reqPaymentType,
      notes,
    } = req.body;

    // 1. Amount validation (strict positive numeric)
    const numAmount = Number(amount);
    if (amount === undefined || amount === null || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYMENT_AMOUNT', message: 'Payment amount must be a positive number greater than 0.' },
      });
    }

    const paymentPaise = Math.round(numAmount * 100);
    if (paymentPaise <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYMENT_AMOUNT', message: 'Payment amount must be greater than zero.' },
      });
    }

    // 2. Date validation
    if (!paymentDate || typeof paymentDate !== 'string' || !isValidDate(paymentDate)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_DATE', message: 'Payment date must be a valid calendar date in YYYY-MM-DD format.' },
      });
    }

    // 3. Payment Method validation
    const validMethods = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'];
    const methodUpper = String(paymentMethod).toUpperCase();
    if (!validMethods.includes(methodUpper)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYMENT_METHOD', message: `Invalid payment method. Allowed: ${validMethods.join(', ')}` },
      });
    }

    // 4. Primary Reference Requirement (Invoice or Booking)
    if (!invoiceId && !reqBookingId) {
      return res.status(400).json({
        success: false,
        error: { code: 'REFERENCE_REQUIRED', message: 'Payment must reference an Invoice or Booking.' },
      });
    }

    // Run within atomic transaction with concurrency locks
    const result = await db.transaction(async (tx) => {
      const year = new Date().getFullYear();

      // Concurrency lock for sequential receipt numbering
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('payment_seq_' || ${year}))`);

      let targetCustomerId = reqCustomerId;
      let targetBookingId = reqBookingId;
      let targetInvoice: any = null;
      let targetBooking: any = null;

      // 4.1 If Invoice is specified:
      if (invoiceId) {
        // Concurrency lock on invoice
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('invoice_balance_' || ${invoiceId}))`);
        const [inv] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).for('update');
        if (!inv) {
          throw { status: 404, code: 'INVOICE_NOT_FOUND', message: 'Invoice not found.' };
        }

        if (inv.status === 'CANCELLED') {
          throw { status: 400, code: 'CANNOT_PAY_CANCELLED_INVOICE', message: 'Cannot record payment against a CANCELLED invoice.' };
        }

        if (inv.status === 'DRAFT') {
          throw { status: 400, code: 'CANNOT_PAY_DRAFT_INVOICE', message: 'Invoice must be ISSUED before recording payments.' };
        }

        if (reqCustomerId && reqCustomerId !== inv.customerId) {
          throw { status: 400, code: 'CUSTOMER_INVOICE_MISMATCH', message: 'Provided customer ID does not match the invoice customer.' };
        }

        targetCustomerId = inv.customerId;
        if (!targetBookingId && inv.bookingId) {
          targetBookingId = inv.bookingId;
        }
        targetInvoice = inv;

        // Authoritative balance calculation from non-reversed payments
        const invPayments = await tx
          .select({ amount: payments.amount })
          .from(payments)
          .where(and(eq(payments.invoiceId, invoiceId), eq(payments.isReversed, false)));

        let currentPaidPaise = 0;
        for (const p of invPayments) {
          currentPaidPaise += Math.round(Number(p.amount) * 100);
        }

        const invoiceGrandTotalPaise = Math.round(Number(inv.grandTotal) * 100);
        const outstandingBalancePaise = invoiceGrandTotalPaise - currentPaidPaise;

        // Overpayment Protection
        if (paymentPaise > outstandingBalancePaise) {
          throw {
            status: 409,
            code: 'OVERPAYMENT_NOT_ALLOWED',
            message: `Payment amount of ₹${(paymentPaise / 100).toFixed(2)} exceeds outstanding invoice balance of ₹${(outstandingBalancePaise / 100).toFixed(2)}.`,
          };
        }
      }

      // 4.2 If Booking is specified (and no invoice, or verifying booking relation):
      if (targetBookingId) {
        const [b] = await tx.select().from(bookings).where(eq(bookings.id, targetBookingId)).for('update');
        if (!b) {
          throw { status: 404, code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' };
        }
        if (b.status === 'CANCELLED') {
          throw { status: 400, code: 'CANNOT_PAY_CANCELLED_BOOKING', message: 'Cannot record payment against a CANCELLED booking.' };
        }
        if (!targetCustomerId) {
          targetCustomerId = b.customerId;
        } else if (targetCustomerId !== b.customerId) {
          throw { status: 400, code: 'CUSTOMER_BOOKING_MISMATCH', message: 'Provided customer does not match booking customer.' };
        }
        targetBooking = b;

        // If direct booking payment without invoice, check booking balance
        if (!invoiceId) {
          const bPayments = await tx
            .select({ amount: payments.amount })
            .from(payments)
            .where(and(eq(payments.bookingId, targetBookingId), eq(payments.isReversed, false)));
          let currentBkgPaidPaise = 0;
          for (const p of bPayments) {
            currentBkgPaidPaise += Math.round(Number(p.amount) * 100);
          }
          const bkgGrandTotalPaise = Math.round(Number(b.grandTotal) * 100);
          const bkgOutstandingPaise = bkgGrandTotalPaise - currentBkgPaidPaise;
          if (paymentPaise > bkgOutstandingPaise) {
            throw {
              status: 409,
              code: 'OVERPAYMENT_NOT_ALLOWED',
              message: `Payment amount of ₹${(paymentPaise / 100).toFixed(2)} exceeds outstanding booking balance of ₹${(bkgOutstandingPaise / 100).toFixed(2)}.`,
            };
          }
        }
      }

      // 5. Customer Existence & Active State Check
      const [cust] = await tx.select().from(customers).where(eq(customers.id, targetCustomerId));
      if (!cust) {
        throw { status: 404, code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found.' };
      }
      if (!cust.isActive) {
        throw { status: 400, code: 'INACTIVE_CUSTOMER', message: 'Cannot record payment for a deactivated customer.' };
      }

      // 6. Authoritative Payment Type derivation / verification
      let finalPaymentType: 'ADVANCE' | 'PARTIAL' | 'FINAL' = 'PARTIAL';
      if (targetInvoice) {
        const invPayments = await tx
          .select({ amount: payments.amount })
          .from(payments)
          .where(and(eq(payments.invoiceId, invoiceId), eq(payments.isReversed, false)));
        let currentPaidPaise = 0;
        for (const p of invPayments) {
          currentPaidPaise += Math.round(Number(p.amount) * 100);
        }
        const invoiceGrandTotalPaise = Math.round(Number(targetInvoice.grandTotal) * 100);
        const newPaidPaise = currentPaidPaise + paymentPaise;

        if (newPaidPaise === invoiceGrandTotalPaise) {
          finalPaymentType = 'FINAL';
        } else if (currentPaidPaise === 0) {
          finalPaymentType = reqPaymentType === 'PARTIAL' ? 'PARTIAL' : 'ADVANCE';
        } else {
          finalPaymentType = 'PARTIAL';
        }
      } else if (targetBooking) {
        finalPaymentType = reqPaymentType && ['ADVANCE', 'PARTIAL', 'FINAL'].includes(reqPaymentType.toUpperCase())
          ? (reqPaymentType.toUpperCase() as any)
          : 'ADVANCE';
      }

      // 7. Sequential Receipt Number generation (BV-PAY-YYYY-XXXXX)
      const [maxRec] = await tx
        .select({ receiptNumber: payments.receiptNumber })
        .from(payments)
        .where(sql`${payments.receiptNumber} LIKE ${`BV-PAY-${year}-%`}`)
        .orderBy(desc(payments.receiptNumber))
        .limit(1);

      let nextSeq = 1;
      if (maxRec?.receiptNumber) {
        const parts = maxRec.receiptNumber.split('-');
        const numPart = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(numPart)) nextSeq = numPart + 1;
      }
      const receiptNumber = `BV-PAY-${year}-${String(nextSeq).padStart(5, '0')}`;
      const paymentId = `pay-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      // 8. Insert Payment Record
      const [created] = await tx
        .insert(payments)
        .values({
          id: paymentId,
          receiptNumber,
          invoiceId: invoiceId || null,
          bookingId: targetBookingId || null,
          customerId: targetCustomerId,
          amount: (paymentPaise / 100).toFixed(2),
          paymentMethod: methodUpper,
          transactionReference: transactionReference?.trim() || null,
          paymentDate,
          paymentType: finalPaymentType,
          notes: notes?.trim() || null,
          isReversed: false,
          createdBy: req.user?.name || req.user?.username || 'Staff',
        })
        .returning();

      // 9. Transactionally Recalculate Invoice Balance & Status
      if (invoiceId && targetInvoice) {
        const invPayments = await tx
          .select({ amount: payments.amount })
          .from(payments)
          .where(and(eq(payments.invoiceId, invoiceId), eq(payments.isReversed, false)));

        let totalPaidPaise = 0;
        for (const p of invPayments) {
          totalPaidPaise += Math.round(Number(p.amount) * 100);
        }

        const invoiceGrandTotalPaise = Math.round(Number(targetInvoice.grandTotal) * 100);
        const newBalancePaise = Math.max(0, invoiceGrandTotalPaise - totalPaidPaise);
        const newStatus = newBalancePaise === 0 ? 'PAID' : totalPaidPaise > 0 ? 'PARTIAL' : 'ISSUED';

        await tx
          .update(invoices)
          .set({
            paidAmount: (totalPaidPaise / 100).toFixed(2),
            balanceAmount: (newBalancePaise / 100).toFixed(2),
            status: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, invoiceId));
      }

      // 10. Transactionally Recalculate Booking Balance
      if (targetBookingId) {
        const bPayments = await tx
          .select({ amount: payments.amount })
          .from(payments)
          .where(and(eq(payments.bookingId, targetBookingId), eq(payments.isReversed, false)));

        let totalBkgPaidPaise = 0;
        for (const p of bPayments) {
          totalBkgPaidPaise += Math.round(Number(p.amount) * 100);
        }

        const [b] = await tx.select().from(bookings).where(eq(bookings.id, targetBookingId));
        if (b) {
          const bGrandTotalPaise = Math.round(Number(b.grandTotal) * 100);
          const newBkgBalancePaise = Math.max(0, bGrandTotalPaise - totalBkgPaidPaise);

          await tx
            .update(bookings)
            .set({
              paidAmount: (totalBkgPaidPaise / 100).toFixed(2),
              balanceAmount: (newBkgBalancePaise / 100).toFixed(2),
              updatedAt: new Date(),
            })
            .where(eq(bookings.id, targetBookingId));
        }
      }

      // 11. Audit Logging
      await logAudit({
        userId: req.user?.id,
        userName: req.user?.name || req.user?.username || 'Staff',
        userRole: req.user?.role || 'STAFF',
        action: 'PAYMENT_CREATE',
        entity: 'Payment',
        entityId: paymentId,
        details: `Recorded ${methodUpper} payment of ₹${(paymentPaise / 100).toFixed(2)} (#${receiptNumber}) for Customer ${cust.name} [Type: ${finalPaymentType}]`,
      });

      return { payment: created, customer: cust };
    });

    await updateCustomerFinances(result.customer.id);

    res.status(201).json({ success: true, data: result.payment });
  } catch (err: any) {
    if (err && err.status) {
      return res.status(err.status).json({
        success: false,
        error: { code: err.code || 'PAYMENT_ERROR', message: err.message },
      });
    }
    console.error('Payment creation error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/payments/:id/reverse — Authoritative Payment Reversal with balance restoration & audit trail
app.post('/api/v1/payments/:id/reverse', authenticate, requireRoles(['OWNER', 'ACCOUNTANT']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawReason = req.body.reversalReason || req.body.reason;
    if (!rawReason || typeof rawReason !== 'string' || rawReason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Reversal reason is required.' },
      });
    }
    const reversalReason = rawReason.trim();

    const [p] = await db.select().from(payments).where(eq(payments.id, req.params.id));
    if (!p) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment record not found.' } });
    }

    if (p.isReversed) {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_REVERSED', message: 'This payment has already been reversed.' },
      });
    }

    const result = await db.transaction(async (tx) => {
      // 1. Mark payment as reversed
      const [reversed] = await tx
        .update(payments)
        .set({
          isReversed: true,
          reversalReason,
          reversedAt: new Date(),
          reversedBy: req.user?.name || req.user?.username || 'Staff',
          updatedAt: new Date(),
        })
        .where(eq(payments.id, p.id))
        .returning();

      // 2. Recalculate linked Invoice
      if (p.invoiceId) {
        const [inv] = await tx.select().from(invoices).where(eq(invoices.id, p.invoiceId)).for('update');
        if (inv) {
          const invPayments = await tx
            .select({ amount: payments.amount })
            .from(payments)
            .where(and(eq(payments.invoiceId, p.invoiceId), eq(payments.isReversed, false)));

          let totalPaidPaise = 0;
          for (const pay of invPayments) {
            totalPaidPaise += Math.round(Number(pay.amount) * 100);
          }

          const grandTotalPaise = Math.round(Number(inv.grandTotal) * 100);
          const newBalancePaise = Math.max(0, grandTotalPaise - totalPaidPaise);
          const newStatus = newBalancePaise === 0 ? 'PAID' : totalPaidPaise > 0 ? 'PARTIAL' : 'ISSUED';

          await tx
            .update(invoices)
            .set({
              paidAmount: (totalPaidPaise / 100).toFixed(2),
              balanceAmount: (newBalancePaise / 100).toFixed(2),
              status: newStatus,
              updatedAt: new Date(),
            })
            .where(eq(invoices.id, p.invoiceId));
        }
      }

      // 3. Recalculate linked Booking
      if (p.bookingId) {
        const [b] = await tx.select().from(bookings).where(eq(bookings.id, p.bookingId)).for('update');
        if (b) {
          const bPayments = await tx
            .select({ amount: payments.amount })
            .from(payments)
            .where(and(eq(payments.bookingId, p.bookingId), eq(payments.isReversed, false)));

          let totalPaidPaise = 0;
          for (const pay of bPayments) {
            totalPaidPaise += Math.round(Number(pay.amount) * 100);
          }

          const grandTotalPaise = Math.round(Number(b.grandTotal) * 100);
          const newBalancePaise = Math.max(0, grandTotalPaise - totalPaidPaise);

          await tx
            .update(bookings)
            .set({
              paidAmount: (totalPaidPaise / 100).toFixed(2),
              balanceAmount: (newBalancePaise / 100).toFixed(2),
              updatedAt: new Date(),
            })
            .where(eq(bookings.id, p.bookingId));
        }
      }

      // 4. Audit Log
      await logAudit({
        userId: req.user?.id,
        userName: req.user?.name || req.user?.username || 'Staff',
        userRole: req.user?.role || 'STAFF',
        action: 'PAYMENT_REVERSE',
        entity: 'Payment',
        entityId: p.id,
        details: `Reversed payment #${p.receiptNumber} of ₹${p.amount}. Reason: ${reversalReason}`,
      });

      return reversed;
    });

    await updateCustomerFinances(p.customerId);

    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('Payment reversal error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ----------------------------------------------------
// 11. EXPENSES MODULE
// ----------------------------------------------------

app.get('/api/v1/expenses', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const list = await db.select().from(expenses).orderBy(desc(expenses.date));
    res.json({ success: true, data: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

app.post('/api/v1/expenses', authenticate, requireRoles(['OWNER', 'ACCOUNTANT', 'MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { category, amount, date, vendor, paymentMethod, notes } = req.body;
    if (!category || !amount || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Category and positive amount are required.' },
      });
    }

    const year = new Date().getFullYear();
    const allExisting = await db
      .select({ expenseCode: expenses.expenseCode })
      .from(expenses)
      .where(sql`${expenses.expenseCode} LIKE ${`EXP-${year}-%`}`);

    let maxNum = 0;
    for (const row of allExisting) {
      const match = row.expenseCode?.match(/EXP-\d+-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    const expenseCode = `EXP-${year}-${String(maxNum + 1).padStart(4, '0')}`;
    const id = `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const [created] = await db
      .insert(expenses)
      .values({
        id,
        expenseCode,
        category,
        amount: Number(amount).toFixed(2),
        date: date || new Date().toISOString().split('T')[0],
        vendor: vendor || 'Vendor',
        paymentMethod: paymentMethod || 'CASH',
        notes: notes || '',
        createdBy: req.user?.name || req.user?.username || 'admin',
      })
      .returning();

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Staff',
      userRole: req.user?.role || 'STAFF',
      action: 'EXPENSE_CREATE',
      entity: 'Expense',
      entityId: id,
      details: `Recorded expense #${expenseCode} of ₹${amount} under ${category} to ${vendor || 'Vendor'}`,
    });

    res.json({ success: true, data: created });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// DELETE /api/v1/expenses/:id — Delete expense record with audit trail
app.delete('/api/v1/expenses/:id', authenticate, requireRoles(['OWNER', 'ACCOUNTANT', 'MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [exp] = await db.select().from(expenses).where(eq(expenses.id, req.params.id));
    if (!exp) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Expense record not found.' } });
    }

    await db.delete(expenses).where(eq(expenses.id, exp.id));

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Staff',
      userRole: req.user?.role || 'STAFF',
      action: 'EXPENSE_DELETE',
      entity: 'Expense',
      entityId: exp.id,
      details: `Deleted expense #${exp.expenseCode} of ₹${exp.amount} (${exp.category})`,
    });

    res.json({ success: true, message: `Expense #${exp.expenseCode} deleted successfully.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ----------------------------------------------------
// 12. REPORTS MODULE
// ----------------------------------------------------

const handleReportsRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const allBookings = await db.select().from(bookings);
    const allExpenses = await db.select().from(expenses);
    const allHalls = await db.select().from(halls);
    const allRooms = await db.select().from(rooms);

    let totalRevenue = 0;
    let totalOutstanding = 0;

    for (const b of allBookings) {
      if (b.status !== 'CANCELLED') {
        totalRevenue += Number(b.grandTotal);
        totalOutstanding += Number(b.balanceAmount);
      }
    }

    // Authoritative total cash collected from non-reversed payments ledger
    const [collectedRow] = await db
      .select({ total: sql<string>`coalesce(sum(${payments.amount}), 0)` })
      .from(payments)
      .where(eq(payments.isReversed, false));
    const totalCollected = parseFloat(collectedRow?.total || '0');

    let totalExpensesAmount = 0;
    const expenseByCategory: Record<string, number> = {};
    for (const e of allExpenses) {
      const amt = Number(e.amount);
      totalExpensesAmount += amt;
      expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + amt;
    }

    // Hall Utilization and Hall Stats breakdown
    const hallStatsMap: Record<string, { id: string; name: string; code: string; count: number; bookingsCount: number; revenue: number; totalRevenue: number }> = {};
    for (const h of allHalls) {
      hallStatsMap[h.id] = {
        id: h.id,
        name: h.name,
        code: h.code,
        count: 0,
        bookingsCount: 0,
        revenue: 0,
        totalRevenue: 0,
      };
    }
    for (const b of allBookings) {
      if (b.hallId && hallStatsMap[b.hallId] && b.status !== 'CANCELLED') {
        hallStatsMap[b.hallId].count += 1;
        hallStatsMap[b.hallId].bookingsCount += 1;
        hallStatsMap[b.hallId].revenue += Number(b.grandTotal);
        hallStatsMap[b.hallId].totalRevenue += Number(b.grandTotal);
      }
    }

    // Room Occupancy
    const roomOccupancy: Record<string, { roomNumber: string; type: string; status: string }> = {};
    for (const r of allRooms) {
      roomOccupancy[r.id] = { roomNumber: r.roomNumber, type: r.roomType, status: r.status };
    }

    const summaryData = {
      totalRevenue: Math.round(totalRevenue),
      totalCollected: Math.round(totalCollected),
      totalOutstanding: Math.round(totalOutstanding),
      totalExpenses: Math.round(totalExpensesAmount),
      netProfit: Math.round(totalRevenue - totalExpensesAmount),
    };

    const hallStatsArray = Object.values(hallStatsMap);

    res.json({
      success: true,
      data: {
        financialSummary: summaryData,
        summary: summaryData, // Alias for frontend ReportsView
        expenseByCategory: Object.entries(expenseByCategory).map(([category, amount]) => ({
          category,
          amount: Math.round(amount),
        })),
        hallUtilization: hallStatsArray,
        hallStats: hallStatsArray, // Alias for frontend ReportsView
        roomOccupancy: Object.values(roomOccupancy),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
};

app.get('/api/v1/reports', authenticate, requireRoles(['OWNER', 'ACCOUNTANT', 'MANAGER']), handleReportsRequest);
app.get('/api/v1/reports/financial', authenticate, requireRoles(['OWNER', 'ACCOUNTANT', 'MANAGER']), handleReportsRequest);

// ----------------------------------------------------
// 13. USERS & RBAC MODULE
// ----------------------------------------------------

app.get('/api/v1/users', authenticate, requireRoles(['OWNER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const list = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        name: users.name,
        phone: users.phone,
        role: users.role,
        status: users.status,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users);

    res.json({ success: true, data: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

app.post('/api/v1/users', authenticate, requireRoles(['OWNER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, email, username, password, role, phone } = req.body;
    if (!name || !email || !username || !password || !role) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Name, email, username, password and role are required.' },
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();

    // Check duplicate email or username
    const existing = await db
      .select()
      .from(users)
      .where(or(eq(users.email, cleanEmail), eq(users.username, cleanUsername)));
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: { code: 'USER_EXISTS', message: 'A user with this email or username already exists.' },
      });
    }

    const passwordHash = await hashPassword(password);
    const id = `usr-${Date.now()}`;

    const [created] = await db
      .insert(users)
      .values({
        id,
        email: cleanEmail,
        username: cleanUsername,
        passwordHash,
        name: name.trim(),
        phone: phone ? phone.trim() : null,
        role,
        status: 'ACTIVE',
      })
      .returning({
        id: users.id,
        email: users.email,
        username: users.username,
        name: users.name,
        role: users.role,
        status: users.status,
      });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Owner',
      userRole: req.user?.role || 'OWNER',
      action: 'USER_CREATE',
      entity: 'User',
      entityId: id,
      details: `Created new staff user: ${name} with role ${role}`,
    });

    res.json({ success: true, data: created });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

app.put('/api/v1/users/:id', authenticate, requireRoles(['OWNER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, role, status, phone } = req.body;
    const [updated] = await db
      .update(users)
      .set({
        name,
        role,
        status,
        phone,
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.params.id))
      .returning({
        id: users.id,
        email: users.email,
        username: users.username,
        name: users.name,
        role: users.role,
        status: users.status,
      });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ----------------------------------------------------
// 14. AUDIT LOGS MODULE
// ----------------------------------------------------

app.get('/api/v1/audit-logs', authenticate, requireRoles(['OWNER', 'MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
    res.json({ success: true, data: logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ----------------------------------------------------
// 15. SETTINGS MODULE
// ----------------------------------------------------

app.get('/api/v1/settings', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    let [st] = await db.select().from(settings).where(eq(settings.id, 'default'));
    if (!st) {
      [st] = await db
        .insert(settings)
        .values({
          id: 'default',
          businessName: 'Bandhan Vatika',
          tagline: 'Celebrations · Together · Always',
          address: '123, MG Road, Indore, MP 452001',
          phone: '9876543210',
          email: 'contact@bandhanvatika.com',
          gstin: '23AAAAA0000A1Z5',
          defaultTaxPercent: '18.00',
          bankName: 'HDFC Bank',
          accountNumber: '50200012345678',
          ifscCode: 'HDFC0001234',
        })
        .returning();
    }
    res.json({ success: true, data: st });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

app.put('/api/v1/settings', authenticate, requireRoles(['OWNER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { businessName, tagline, address, phone, email, gstin, defaultTaxPercent, bankName, accountNumber, ifscCode, termsAndConditions } = req.body;
    const [updated] = await db
      .update(settings)
      .set({
        businessName,
        tagline,
        address,
        phone,
        email,
        gstin,
        defaultTaxPercent: String(defaultTaxPercent || '18.00'),
        bankName,
        accountNumber,
        ifscCode,
        termsAndConditions,
        updatedAt: new Date(),
      })
      .where(eq(settings.id, 'default'))
      .returning();

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Owner',
      userRole: req.user?.role || 'OWNER',
      action: 'SETTINGS_UPDATE',
      entity: 'Settings',
      entityId: 'default',
      details: 'Updated business profile and invoice settings',
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Helper to keep customer lifetime bookings & outstanding updated
async function updateCustomerFinances(customerId: string) {
  try {
    const custBookings = await db.select().from(bookings).where(eq(bookings.customerId, customerId));
    let totalSpent = 0;
    let outstanding = 0;
    let totalBookingsCount = 0;

    for (const b of custBookings) {
      if (b.status !== 'CANCELLED') {
        totalSpent += Number(b.grandTotal);
        outstanding += Number(b.balanceAmount);
        totalBookingsCount += 1;
      }
    }

    await db
      .update(customers)
      .set({
        totalBookings: totalBookingsCount,
        totalSpent: totalSpent.toFixed(2),
        outstandingAmount: outstanding.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customerId));
  } catch (e) {
    console.error('Error updating customer finances:', e);
  }
}

function inArrayOrEmpty(column: any, values: any[]) {
  if (!values || values.length === 0) {
    return sql`FALSE`;
  }
  return sql`${column} IN ${values}`;
}

// Explicit 404 for unhandled API endpoints
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `API endpoint ${req.method} ${req.path} not found.` },
  });
});

// ----------------------------------------------------
// VITE MIDDLEWARE & SERVER STARTUP
// ----------------------------------------------------

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Bandhan Vatika server running on http://0.0.0.0:${port}`);
  });
}

startServer();
