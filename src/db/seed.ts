import bcrypt from 'bcryptjs';
import { db } from './index.ts';
import { users, halls, rooms, settings } from './schema.ts';

export async function seedDatabase() {
  try {
    // 1. Settings (Default Organization Profile)
    const existingSettings = await db.select().from(settings);
    if (existingSettings.length === 0) {
      await db.insert(settings).values({
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
        termsAndConditions: '1. 50% advance required for confirmation.\n2. Balance due 7 days before event date.\n3. Outside catering only with prior permission.\n4. Fireworks prohibited inside premises.',
      });
    }

    // 2. Default Administrative and Staff User Accounts
    const existingUsers = await db.select().from(users);
    if (existingUsers.length === 0) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      const managerHash = await bcrypt.hash('manager123', 10);
      const acctHash = await bcrypt.hash('accountant123', 10);
      const recepHash = await bcrypt.hash('reception123', 10);
      const staffHash = await bcrypt.hash('staff123', 10);

      await db.insert(users).values([
        {
          id: 'usr-owner-001',
          email: 'admin@bandhanvatika.com',
          username: 'admin',
          passwordHash,
          name: 'Rinki Sinha (Owner)',
          phone: '9876543210',
          role: 'OWNER',
          status: 'ACTIVE',
        },
        {
          id: 'usr-mgr-002',
          email: 'manager@bandhanvatika.com',
          username: 'manager',
          passwordHash: managerHash,
          name: 'Vikram Joshi (Manager)',
          phone: '9822334455',
          role: 'MANAGER',
          status: 'ACTIVE',
        },
        {
          id: 'usr-acct-003',
          email: 'accountant@bandhanvatika.com',
          username: 'accountant',
          passwordHash: acctHash,
          name: 'Sunil Agrawal (Accountant)',
          phone: '9711223344',
          role: 'ACCOUNTANT',
          status: 'ACTIVE',
        },
        {
          id: 'usr-recep-004',
          email: 'reception@bandhanvatika.com',
          username: 'reception',
          passwordHash: recepHash,
          name: 'Pooja Tiwari (Receptionist)',
          phone: '9655443322',
          role: 'RECEPTIONIST',
          status: 'ACTIVE',
        },
        {
          id: 'usr-staff-005',
          email: 'staff@bandhanvatika.com',
          username: 'staff',
          passwordHash: staffHash,
          name: 'Ramesh Kumar (Staff)',
          phone: '9544332211',
          role: 'STAFF',
          status: 'ACTIVE',
        },
      ]);
    }

    // 3. Physical Master Venues (Halls & Lawns)
    const existingHalls = await db.select().from(halls);
    if (existingHalls.length === 0) {
      await db.insert(halls).values([
        {
          id: 'hall-grand',
          code: 'HALL-A',
          name: 'Grand Hall',
          type: 'Banquet Hall',
          capacity: 500,
          basePrice: '200000.00',
          status: 'ACTIVE',
          amenities: JSON.stringify(['AC', 'Parking', 'Stage', 'Dining']),
          description: 'Spacious air-conditioned royal ballroom with crystal chandeliers and integrated audio system.',
        },
        {
          id: 'hall-royal',
          code: 'HALL-B',
          name: 'Royal Hall',
          type: 'Banquet Hall',
          capacity: 300,
          basePrice: '150000.00',
          status: 'ACTIVE',
          amenities: JSON.stringify(['AC', 'Parking', 'Stage', 'Dining']),
          description: 'Mid-sized elegant hall perfect for engagements, sangeet, and corporate conferences.',
        },
        {
          id: 'hall-garden',
          code: 'LAWN-1',
          name: 'Garden Lawn',
          type: 'Open Air Lawn',
          capacity: 800,
          basePrice: '250000.00',
          status: 'ACTIVE',
          amenities: JSON.stringify(['Open Air', 'Lighting', 'Decor Friendly', 'Parking']),
          description: 'Expansive lush green open lawn with fairy light canopies and wide stage access for grand celebrations.',
        },
        {
          id: 'hall-party',
          code: 'HALL-C',
          name: 'Party Hall',
          type: 'Mini Hall',
          capacity: 150,
          basePrice: '80000.00',
          status: 'ACTIVE',
          amenities: JSON.stringify(['AC', 'Music', 'LED Screen', 'Dining']),
          description: 'Cozy and stylish venue equipped with LED backdrop, disco lights, and sound system for birthdays and anniversaries.',
        },
      ]);
    }

    // 4. Physical Master Rooms
    const existingRooms = await db.select().from(rooms);
    if (existingRooms.length === 0) {
      await db.insert(rooms).values([
        {
          id: 'room-101',
          roomNumber: '101',
          roomType: 'Deluxe Room',
          isAc: true,
          capacity: 2,
          pricePerNight: '3500.00',
          status: 'AVAILABLE',
          amenities: JSON.stringify(['AC', 'TV', 'Attached Bath', 'WiFi']),
          description: 'Premium King bed room on 1st floor with balcony view and dressing vanity.',
        },
        {
          id: 'room-102',
          roomNumber: '102',
          roomType: 'Deluxe Room',
          isAc: true,
          capacity: 2,
          pricePerNight: '3500.00',
          status: 'AVAILABLE',
          amenities: JSON.stringify(['AC', 'TV', 'Attached Bath', 'WiFi']),
          description: 'Comfortable double room with 24-hr hot water and high-speed WiFi.',
        },
        {
          id: 'room-201',
          roomNumber: '201',
          roomType: 'Family Room',
          isAc: true,
          capacity: 4,
          pricePerNight: '5500.00',
          status: 'AVAILABLE',
          amenities: JSON.stringify(['AC', 'TV', 'Attached Bath', 'WiFi']),
          description: 'Spacious suite with 2 Queen beds, sitting area, and mini-fridge for families.',
        },
        {
          id: 'room-301',
          roomNumber: '301',
          roomType: 'Suite Room',
          isAc: true,
          capacity: 4,
          pricePerNight: '8000.00',
          status: 'AVAILABLE',
          amenities: JSON.stringify(['AC', 'TV', 'Attached Bath', 'WiFi']),
          description: 'Bridal preparation suite with dressing mirror room, luxury lounge, and master bathroom.',
        },
      ]);
    }

    // NOTE: All demo customers, bookings, quotations, invoices, payments, expenses, and demo audit logs have been removed for clean production state.
    console.log('System master initialization complete (Demo transactional data omitted).');
  } catch (err) {
    console.error('Error in master database initialization:', err);
  }
}
