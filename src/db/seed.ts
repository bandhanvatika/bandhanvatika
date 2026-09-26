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
        tagline: 'A Complete Venue for Your Celebration',
        address: 'Pakariyabar, Chandwa, Ara (Bihar)',
        phone: '9431086933, 8789182989',
        email: 'contact@bandhanvatika.com',
        gstin: '10CNXPSO100F2ZC',
        defaultTaxPercent: '5.00',
        bankName: 'State Bank of India',
        accountNumber: '50200012345678',
        ifscCode: 'SBIN0001234',
        termsAndConditions: '1. किसी कारण वश सट्टा रद्द होने पर अग्रीम राशी जब्त हो जायेगी\n2. उत्सव का दिनांक पुनः बदलने पर उपलब्धता देखी जायेगी\n3. तय कुल रकम का 30% अग्रीम के रूप में लिया जायेगा\n4. उत्सव की दिनांक से 5 दिन पहले कुल रकम का भुगतान करना होगा।\n5. उत्सव भवन के यत्र तत्र गंदगी फैलाने पर सफाई का खर्च सट्टेदार को देना होगा।\n6. किसी प्रकार का तोड़फोड़ या भारी नुकसान होने पर उसका वाजिब भुगतान सट्टेदार को करना होगा।\n7. उत्सव के दिन किसी भी विद्युत उपकरण के खराबी आने पर ठीक कराने का प्रयास किया जायेगा परन्तु नहीं होने पर उसकी जिम्मेदारी प्रबंधन पर नहीं होगी।',
      });
    }

    // 2. Default Administrative and Staff User Accounts
    const existingUsers = await db.select().from(users);
    if (existingUsers.length === 0) {
      const passwordHash = await bcrypt.hash('SRKP@1977', 10);
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
          name: 'Rinki Sanjay Sinha (Owner)',
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

    // 3. Physical Master Venues: 4 Halls (3 AC, 1 Non-AC) — Capacity up to 400 guests
    const existingHalls = await db.select().from(halls);
    if (existingHalls.length === 0) {
      await db.insert(halls).values([
        {
          id: 'hall-grand',
          code: 'HALL-A',
          name: 'Grand Banquet Hall (AC)',
          type: 'Banquet Hall',
          capacity: 400,
          basePrice: '180000.00',
          status: 'ACTIVE',
          amenities: JSON.stringify(['AC', 'Stage Setup Area', 'Catering Available', 'Decoration Available', 'Parking Support', 'Easy Road Access']),
          description: 'Spacious AC banquet hall with stage setup area, crystal chandeliers, in-house catering, and capacity up to 400 guests on Ara-Buxar Main Road.',
        },
        {
          id: 'hall-royal',
          code: 'HALL-B',
          name: 'Royal Celebration Hall (AC)',
          type: 'Banquet Hall',
          capacity: 250,
          basePrice: '120000.00',
          status: 'ACTIVE',
          amenities: JSON.stringify(['AC', 'Stage Setup Area', 'Catering Available', 'Decoration Available', 'Parking Support']),
          description: 'Mid-sized elegant AC banquet hall with stage setup area and full catering support for weddings, sangeet, and engagements.',
        },
        {
          id: 'hall-party',
          code: 'HALL-C',
          name: 'Shagun Banquet Hall (AC)',
          type: 'Mini Banquet',
          capacity: 150,
          basePrice: '75000.00',
          status: 'ACTIVE',
          amenities: JSON.stringify(['AC', 'Stage Setup Area', 'Catering Available', 'Music & Lights']),
          description: 'Cozy and stylish AC hall equipped for ring ceremonies, anniversaries, and family functions.',
        },
        {
          id: 'hall-utsav',
          code: 'HALL-D',
          name: 'Utsav Hall (Non-AC)',
          type: 'Banquet Hall',
          capacity: 200,
          basePrice: '50000.00',
          status: 'ACTIVE',
          amenities: JSON.stringify(['Non-AC', 'Stage Setup Area', 'Catering Available', 'Parking Support']),
          description: 'Spacious naturally-ventilated non-AC banquet hall with stage area, catering space, and parking support.',
        },
      ]);
    }

    // 4. Physical Master Rooms: 10 Guest Rooms (6 AC, 4 Non-AC)
    const existingRooms = await db.select().from(rooms);
    if (existingRooms.length === 0) {
      await db.insert(rooms).values([
        // 6 AC Rooms
        {
          id: 'room-101',
          roomNumber: '101',
          roomType: 'Deluxe AC Room',
          isAc: true,
          capacity: 2,
          pricePerNight: '2500.00',
          status: 'AVAILABLE',
          amenities: JSON.stringify(['AC', 'Attached Bath', 'TV', 'Parking Support']),
          description: 'Air-conditioned deluxe guest room with attached bath on Ara-Buxar Main Road.',
        },
        {
          id: 'room-102',
          roomNumber: '102',
          roomType: 'Deluxe AC Room',
          isAc: true,
          capacity: 2,
          pricePerNight: '2500.00',
          status: 'AVAILABLE',
          amenities: JSON.stringify(['AC', 'Attached Bath', 'TV', 'Parking Support']),
          description: 'Air-conditioned deluxe guest room with comfortable bedding.',
        },
        {
          id: 'room-103',
          roomNumber: '103',
          roomType: 'Deluxe AC Room',
          isAc: true,
          capacity: 2,
          pricePerNight: '2500.00',
          status: 'AVAILABLE',
          amenities: JSON.stringify(['AC', 'Attached Bath', 'TV', 'Parking Support']),
          description: 'Air-conditioned deluxe room.',
        },
        {
          id: 'room-104',
          roomNumber: '104',
          roomType: 'Deluxe AC Room',
          isAc: true,
          capacity: 2,
          pricePerNight: '2500.00',
          status: 'AVAILABLE',
          amenities: JSON.stringify(['AC', 'Attached Bath', 'TV', 'Parking Support']),
          description: 'Air-conditioned deluxe room.',
        },
        {
          id: 'room-105',
          roomNumber: '105',
          roomType: 'Bridal Suite AC',
          isAc: true,
          capacity: 4,
          pricePerNight: '4000.00',
          status: 'AVAILABLE',
          amenities: JSON.stringify(['AC', 'Bridal Vanity', 'Attached Bath', 'Parking Support']),
          description: 'Air-conditioned luxury bridal preparation suite with dressing mirror.',
        },
        {
          id: 'room-106',
          roomNumber: '106',
          roomType: 'Family Suite AC',
          isAc: true,
          capacity: 4,
          pricePerNight: '3500.00',
          status: 'AVAILABLE',
          amenities: JSON.stringify(['AC', 'Attached Bath', 'TV', 'Family Seating']),
          description: 'Air-conditioned family suite room with extra beds.',
        },
        // 4 Non-AC Rooms
        {
          id: 'room-201',
          roomNumber: '201',
          roomType: 'Standard Non-AC Room',
          isAc: false,
          capacity: 2,
          pricePerNight: '1500.00',
          status: 'AVAILABLE',
          amenities: JSON.stringify(['Non-AC', 'Attached Bath', 'Fan', 'Parking Support']),
          description: 'Comfortable well-ventilated non-AC room with attached bath.',
        },
        {
          id: 'room-202',
          roomNumber: '202',
          roomType: 'Standard Non-AC Room',
          isAc: false,
          capacity: 2,
          pricePerNight: '1500.00',
          status: 'AVAILABLE',
          amenities: JSON.stringify(['Non-AC', 'Attached Bath', 'Fan', 'Parking Support']),
          description: 'Well-ventilated non-AC room with attached bath.',
        },
        {
          id: 'room-203',
          roomNumber: '203',
          roomType: 'Standard Non-AC Room',
          isAc: false,
          capacity: 2,
          pricePerNight: '1500.00',
          status: 'AVAILABLE',
          amenities: JSON.stringify(['Non-AC', 'Attached Bath', 'Fan', 'Parking Support']),
          description: 'Well-ventilated non-AC room with attached bath.',
        },
        {
          id: 'room-204',
          roomNumber: '204',
          roomType: 'Standard Non-AC Room',
          isAc: false,
          capacity: 2,
          pricePerNight: '1500.00',
          status: 'AVAILABLE',
          amenities: JSON.stringify(['Non-AC', 'Attached Bath', 'Fan', 'Parking Support']),
          description: 'Well-ventilated non-AC room with attached bath.',
        },
      ]);
    }

    // NOTE: All demo customers, bookings, quotations, invoices, payments, expenses, and demo audit logs have been removed for clean production state.
    console.log('System master initialization complete (Demo transactional data omitted).');
  } catch (err) {
    console.error('Error in master database initialization:', err);
  }
}
