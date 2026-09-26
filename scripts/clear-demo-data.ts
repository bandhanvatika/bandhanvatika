import { db } from '../src/db/index.ts';
import {
  payments,
  invoices,
  quotations,
  bookingRooms,
  bookingHalls,
  bookings,
  expenses,
  customers,
  auditLogs,
} from '../src/db/schema.ts';

async function clearDemoData() {
  console.log('Initiating removal of all demo data from Bandhan Vatika database...');
  try {
    // Delete transactional records in foreign key dependency order
    await db.delete(payments);
    console.log('✓ Cleared all demo payments');

    await db.delete(invoices);
    console.log('✓ Cleared all demo invoices');

    await db.delete(quotations);
    console.log('✓ Cleared all demo quotations');

    await db.delete(bookingRooms);
    console.log('✓ Cleared all demo booking room allocations');

    await db.delete(bookingHalls);
    console.log('✓ Cleared all demo booking hall allocations');

    await db.delete(bookings);
    console.log('✓ Cleared all demo bookings');

    await db.delete(expenses);
    console.log('✓ Cleared all demo expenses');

    await db.delete(customers);
    console.log('✓ Cleared all demo customer profiles');

    await db.delete(auditLogs);
    console.log('✓ Cleared all demo audit logs');

    console.log('SUCCESS: All demo data has been completely removed from the software.');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing demo data:', error);
    process.exit(1);
  }
}

clearDemoData();
