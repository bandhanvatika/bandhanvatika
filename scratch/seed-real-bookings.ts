import { db } from '../src/db/index.ts';
import { bookings, customers, halls, rooms, payments, invoices } from '../src/db/schema.ts';
import { eq } from 'drizzle-orm';

async function seedRealWorldBookings() {
  const allHalls = await db.select().from(halls);
  const allCust = await db.select().from(customers);

  const grandHall = allHalls.find(h => h.code === 'HALL-A') || allHalls[0];
  const royalHall = allHalls.find(h => h.code === 'HALL-B') || allHalls[1] || allHalls[0];
  const gardenLawn = allHalls.find(h => h.code === 'LAWN-1') || allHalls[2] || allHalls[0];
  const partyHall = allHalls.find(h => h.code === 'HALL-C') || allHalls[3] || allHalls[0];

  const cust1 = allCust[0];
  const cust2 = allCust[1] || allCust[0];
  const cust3 = allCust[4] || allCust[0];

  const sampleBookings = [
    {
      id: `bkg-real-2026-09-28`,
      bookingNumber: `BV-BKG-2026-0928`,
      customerId: cust1.id,
      eventType: 'Kapoor Engagement Ceremony',
      eventDate: '2026-09-28',
      startTime: '11:00',
      endTime: '16:00',
      guestCount: 150,
      hallId: royalHall.id,
      hallIds: JSON.stringify([royalHall.id]),
      roomIds: JSON.stringify(['room-101']),
      services: JSON.stringify([
        { description: 'Royal Hall Rental (Day Slot)', quantity: 1, rate: 80000, amount: 80000 },
        { description: 'Royal Hi-Tea & Welcome Drinks', quantity: 150, rate: 450, amount: 67500 },
        { description: 'Floral Ring Ceremony Setup', quantity: 1, rate: 25000, amount: 25000 },
      ]),
      subtotal: '172500.00',
      discount: '5000.00',
      taxPercent: '18.00',
      taxAmount: '30150.00',
      grandTotal: '197650.00',
      paidAmount: '100000.00',
      balanceAmount: '97650.00',
      status: 'CONFIRMED' as const,
      notes: 'Stage backdrop with fresh orchids and acoustic sound setup.',
    },
    {
      id: `bkg-real-2026-09-30`,
      bookingNumber: `BV-BKG-2026-0930`,
      customerId: cust2.id,
      eventType: 'Annual Dealers Meet & Dinner',
      eventDate: '2026-09-30',
      startTime: '17:00',
      endTime: '23:00',
      guestCount: 200,
      hallId: grandHall.id,
      hallIds: JSON.stringify([grandHall.id]),
      roomIds: JSON.stringify([]),
      services: JSON.stringify([
        { description: 'Grand Ballroom Corporate Setup', quantity: 1, rate: 120000, amount: 120000 },
        { description: 'AV Production & 4K LED Screen', quantity: 1, rate: 35000, amount: 35000 },
        { description: 'Gala Dinner Buffet', quantity: 200, rate: 850, amount: 170000 },
      ]),
      subtotal: '325000.00',
      discount: '15000.00',
      taxPercent: '18.00',
      taxAmount: '55800.00',
      grandTotal: '365800.00',
      paidAmount: '200000.00',
      balanceAmount: '165800.00',
      status: 'CONFIRMED' as const,
      notes: 'Requires 2 cordless mics and podium branding.',
    },
    {
      id: `bkg-real-2026-10-18`,
      bookingNumber: `BV-BKG-2026-1018`,
      customerId: cust3.id,
      eventType: 'Sharma Grand Sangeet Night',
      eventDate: '2026-10-18',
      startTime: '18:00',
      endTime: '01:00',
      guestCount: 350,
      hallId: grandHall.id,
      hallIds: JSON.stringify([grandHall.id]),
      roomIds: JSON.stringify(['room-101', 'room-201', 'room-301']),
      services: JSON.stringify([
        { description: 'Grand Hall Sangeet Layout', quantity: 1, rate: 180000, amount: 180000 },
        { description: 'Concert Stage & DJ Sound Console', quantity: 1, rate: 65000, amount: 65000 },
        { description: 'Live Chaat & Multi-Cuisine Dinner', quantity: 350, rate: 950, amount: 332500 },
      ]),
      subtotal: '577500.00',
      discount: '25000.00',
      taxPercent: '18.00',
      taxAmount: '99450.00',
      grandTotal: '651950.00',
      paidAmount: '350000.00',
      balanceAmount: '301950.00',
      status: 'CONFIRMED' as const,
      notes: 'Bride & Groom special entry with cold pyro.',
    },
    {
      id: `bkg-real-2026-11-21`,
      bookingNumber: `BV-BKG-2026-1121`,
      customerId: cust1.id,
      eventType: 'Verma Royal Wedding & Reception',
      eventDate: '2026-11-21',
      startTime: '09:00',
      endTime: '23:30',
      guestCount: 600,
      hallId: gardenLawn.id,
      hallIds: JSON.stringify([gardenLawn.id, grandHall.id]),
      roomIds: JSON.stringify(['room-101', 'room-102', 'room-201', 'room-301']),
      services: JSON.stringify([
        { description: 'Garden Lawn + Grand Hall Combined Rental', quantity: 1, rate: 350000, amount: 350000 },
        { description: 'Grand Floral Mandap & Theme Decor', quantity: 1, rate: 150000, amount: 150000 },
        { description: 'Royal Wedding Banquet Dinner', quantity: 600, rate: 1100, amount: 660000 },
      ]),
      subtotal: '1160000.00',
      discount: '50000.00',
      taxPercent: '18.00',
      taxAmount: '199800.00',
      grandTotal: '1309800.00',
      paidAmount: '700000.00',
      balanceAmount: '609800.00',
      status: 'CONFIRMED' as const,
      notes: 'Peak Saya Muhurat wedding. Full property reserved.',
    },
  ];

  for (const b of sampleBookings) {
    const existing = await db.select().from(bookings).where(eq(bookings.id, b.id));
    if (existing.length === 0) {
      await db.insert(bookings).values(b);
      console.log(`Inserted real booking: ${b.bookingNumber} (${b.eventDate} - ${b.eventType})`);
    } else {
      console.log(`Booking already exists: ${b.bookingNumber}`);
    }
  }

  console.log('Real world bookings successfully seeded.');
  process.exit(0);
}

seedRealWorldBookings().catch((err) => {
  console.error(err);
  process.exit(1);
});
