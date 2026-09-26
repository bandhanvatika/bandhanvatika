import { db } from '../db/index.ts';
import { bookings, bookingHalls, bookingRooms, halls, rooms } from '../db/schema.ts';
import { eq, and } from 'drizzle-orm';

/**
 * Checks if two time ranges [start1, end1] and [start2, end2] overlap on the same date.
 * Times are formatted in 'HH:mm' 24-hr format.
 *
 * Business Rule: Boundary-touching is ALLOWED.
 * Example: 10:00-18:00 and 18:00-20:00 do NOT overlap because end1 === start2.
 * Overlap occurs strictly when start1 < end2 AND end1 > start2.
 */
export function timeOverlaps(start1: string, end1: string, start2: string, end2: string): boolean {
  return start1 < end2 && end1 > start2;
}

function normalizeDateRange(start: string, end: string): { start: string; end: string } {
  if (end <= start) {
    const d = new Date(start + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    return { start, end: d.toISOString().split('T')[0] };
  }
  return { start, end };
}

/**
 * Checks if two date intervals [start1, end1] and [start2, end2] overlap.
 * Dates are formatted in 'YYYY-MM-DD'.
 *
 * Hospitality standard: Check-out marks departure.
 * Half-open interval [checkIn, checkOut):
 * - 10 Oct -> 12 Oct and 12 Oct -> 14 Oct do NOT overlap.
 * - 10 Oct -> 12 Oct and 11 Oct -> 13 Oct OVERLAP.
 * - 10 Oct -> 12 Oct and 09 Oct -> 11 Oct OVERLAP.
 * - 10 Oct -> 12 Oct and 11 Oct -> 12 Oct OVERLAP.
 */
export function datesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const r1 = normalizeDateRange(start1, end1);
  const r2 = normalizeDateRange(start2, end2);
  return r1.start < r2.end && r1.end > r2.start;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  message?: string;
  conflictingBookingId?: string;
  conflictingBookingNumber?: string;
  conflictedResourceName?: string;
}

export async function checkHallConflict(
  hallId: string,
  eventDate: string,
  startTime: string,
  endTime: string,
  excludeBookingId?: string,
  dbInstance: any = db
): Promise<ConflictCheckResult> {
  // Check hall status first
  const [hall] = await dbInstance.select().from(halls).where(eq(halls.id, hallId));
  if (!hall) {
    return { hasConflict: true, message: `Hall ID ${hallId} not found.` };
  }
  if (hall.status === 'MAINTENANCE' || hall.status === 'INACTIVE') {
    return {
      hasConflict: true,
      message: `${hall.name} is currently under ${hall.status.toLowerCase()} and cannot be reserved.`,
    };
  }

  // Find all active bookings using this hall on the same date
  const hallBookings = await dbInstance
    .select({
      bookingId: bookingHalls.bookingId,
      hallId: bookingHalls.hallId,
      eventDate: bookingHalls.eventDate,
      startTime: bookingHalls.startTime,
      endTime: bookingHalls.endTime,
      bookingNumber: bookings.bookingNumber,
      status: bookings.status,
    })
    .from(bookingHalls)
    .innerJoin(bookings, eq(bookingHalls.bookingId, bookings.id))
    .where(
      and(
        eq(bookingHalls.hallId, hallId),
        eq(bookingHalls.eventDate, eventDate)
      )
    );

  for (const existing of hallBookings) {
    if (excludeBookingId && existing.bookingId === excludeBookingId) continue;
    if (existing.status === 'CANCELLED') continue;

    if (timeOverlaps(existing.startTime, existing.endTime, startTime, endTime)) {
      return {
        hasConflict: true,
        message: `Time slot conflict: ${hall.name} is already booked from ${existing.startTime} to ${existing.endTime} (Booking #${existing.bookingNumber}).`,
        conflictingBookingId: existing.bookingId,
        conflictingBookingNumber: existing.bookingNumber,
        conflictedResourceName: hall.name,
      };
    }
  }

  return { hasConflict: false };
}

export async function checkRoomConflict(
  roomId: string,
  checkInDate: string,
  checkOutDate: string,
  excludeBookingId?: string,
  dbInstance: any = db
): Promise<ConflictCheckResult> {
  const [room] = await dbInstance.select().from(rooms).where(eq(rooms.id, roomId));
  if (!room) {
    return { hasConflict: true, message: `Room ID ${roomId} not found.` };
  }
  if (room.status === 'MAINTENANCE' || room.status === 'BLOCKED') {
    return {
      hasConflict: true,
      message: `Room ${room.roomNumber} is currently ${room.status.toLowerCase()} and cannot be booked.`,
    };
  }

  const roomBookings = await dbInstance
    .select({
      bookingId: bookingRooms.bookingId,
      roomId: bookingRooms.roomId,
      checkInDate: bookingRooms.checkInDate,
      checkOutDate: bookingRooms.checkOutDate,
      bookingNumber: bookings.bookingNumber,
      status: bookings.status,
    })
    .from(bookingRooms)
    .innerJoin(bookings, eq(bookingRooms.bookingId, bookings.id))
    .where(eq(bookingRooms.roomId, roomId));

  for (const existing of roomBookings) {
    if (excludeBookingId && existing.bookingId === excludeBookingId) continue;
    if (existing.status === 'CANCELLED') continue;

    if (datesOverlap(existing.checkInDate, existing.checkOutDate, checkInDate, checkOutDate)) {
      return {
        hasConflict: true,
        message: `Date conflict: Room ${room.roomNumber} is already reserved from ${existing.checkInDate} to ${existing.checkOutDate} (Booking #${existing.bookingNumber}).`,
        conflictingBookingId: existing.bookingId,
        conflictingBookingNumber: existing.bookingNumber,
        conflictedResourceName: `Room ${room.roomNumber}`,
      };
    }
  }

  return { hasConflict: false };
}
