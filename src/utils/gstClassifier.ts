/**
 * BANDHAN VATIKA — GST TAX CLASSIFIER & DUAL BILL SPLITTER
 *
 * Implements Indian GST statutory rates for Marriage Garden & Banquet Operations:
 * 1. Food & Catering Services (SAC 9963): 5% GST (2.5% CGST + 2.5% SGST)
 * 2. Banquet Hall & Venue Rentals (SAC 9972): 18% GST (9% CGST + 9% SGST)
 * 3. Hotel Accommodations & Rooms (SAC 9963): 12% GST (or 18% if > ₹7,500/night)
 */

export interface LineItem {
  id?: string;
  name?: string;
  description: string;
  quantity?: number;
  qty?: number;
  rate: number;
  amount: number;
  category?: 'FOOD' | 'BANQUET' | 'ROOM';
  taxPercent?: number;
  sacCode?: string;
}

export interface SplitBillResult {
  hasFood: boolean;
  hasBanquet: boolean;

  // 1. Food Bill (5% GST)
  food: {
    items: LineItem[];
    subtotal: number;
    discount: number;
    taxable: number;
    taxPercent: number;
    cgstPercent: number;
    sgstPercent: number;
    cgstAmount: number;
    sgstAmount: number;
    taxAmount: number;
    grandTotal: number;
    allocatedPaid: number;
    allocatedBalance: number;
    sacCode: string;
  };

  // 2. Banquet & Venue Bill (18% GST)
  banquet: {
    items: LineItem[];
    subtotal: number;
    discount: number;
    taxable: number;
    taxPercent: number;
    cgstPercent: number;
    sgstPercent: number;
    cgstAmount: number;
    sgstAmount: number;
    taxAmount: number;
    grandTotal: number;
    allocatedPaid: number;
    allocatedBalance: number;
    sacCode: string;
  };

  // 3. Overall Combined Reconciliation
  combined: {
    totalSubtotal: number;
    totalDiscount: number;
    totalTaxable: number;
    totalTax: number;
    totalGrandTotal: number;
    totalPaid: number;
    totalBalance: number;
  };
}

/**
 * Checks if a service description is a Food / Catering item
 */
export function isFoodService(name: string = ''): boolean {
  const n = name.toLowerCase();
  return (
    n.includes('catering') ||
    n.includes('food') ||
    n.includes('buffet') ||
    n.includes('plate') ||
    n.includes('dinner') ||
    n.includes('lunch') ||
    n.includes('breakfast') ||
    n.includes('snack') ||
    n.includes('tea') ||
    n.includes('coffee') ||
    n.includes('beverage') ||
    n.includes('khana') ||
    n.includes('bhojan') ||
    n.includes('sweet') ||
    n.includes('mithai') ||
    n.includes('rasoi') ||
    n.includes('halwai')
  );
}

/**
 * Splits any booking's items into Food Bill (5% GST) and Banquet & Rooms Bill (18% GST)
 */
export function splitBookingIntoBills(
  booking: any,
  options?: {
    customFoodTax?: number;
    customBanquetTax?: number;
  }
): SplitBillResult {
  const foodTaxPercent = options?.customFoodTax ?? 5;
  const banquetTaxPercent = options?.customBanquetTax ?? 18;

  const foodItems: LineItem[] = [];
  const banquetItems: LineItem[] = [];

  // 1. Process Hall Rental (Banquet @ 18%)
  const hallRental = Number(booking.hallRentalPrice || (booking.hall && !booking.waiveHallFee ? booking.hall.basePrice : 0));
  if (hallRental > 0) {
    banquetItems.push({
      description: `Venue Rental — ${booking.hall?.name || 'Grand Banquet Hall & Lawn'} (${booking.eventType || 'Celebration'})`,
      quantity: 1,
      rate: hallRental,
      amount: hallRental,
      category: 'BANQUET',
      taxPercent: banquetTaxPercent,
      sacCode: '997212',
    });
  }

  // 2. Process Guest Rooms (Rooms @ 18% / 12%)
  const roomCost = Number(booking.roomCost || 0);
  if (roomCost > 0) {
    banquetItems.push({
      description: `Guest Accommodation / AC Deluxe Rooms`,
      quantity: 1,
      rate: roomCost,
      amount: roomCost,
      category: 'ROOM',
      taxPercent: banquetTaxPercent,
      sacCode: '996311',
    });
  }

  // 3. Process Services & Add-ons
  let rawServices: any[] = [];
  if (Array.isArray(booking.services)) {
    rawServices = booking.services;
  } else if (typeof booking.services === 'string') {
    try {
      rawServices = JSON.parse(booking.services);
    } catch {
      rawServices = [];
    }
  }

  for (const s of rawServices) {
    const desc = s.name || s.description || 'Banquet Service';
    const qty = Number(s.quantity || s.qty || 1);
    const rate = Number(s.rate || 0);
    const amount = Number(s.amount || qty * rate);

    if (isFoodService(desc)) {
      foodItems.push({
        description: desc,
        quantity: qty,
        rate,
        amount,
        category: 'FOOD',
        taxPercent: foodTaxPercent,
        sacCode: '996331',
      });
    } else {
      banquetItems.push({
        description: desc,
        quantity: qty,
        rate,
        amount,
        category: 'BANQUET',
        taxPercent: banquetTaxPercent,
        sacCode: '997212',
      });
    }
  }

  // If no food items were found, provide fallback if event has catering
  if (foodItems.length === 0 && booking.guestCount && booking.platePrice) {
    const amt = Number(booking.guestCount) * Number(booking.platePrice);
    foodItems.push({
      description: `Standard Food Catering (${booking.guestCount} Guests @ ₹${booking.platePrice}/plate)`,
      quantity: Number(booking.guestCount),
      rate: Number(booking.platePrice),
      amount: amt,
      category: 'FOOD',
      taxPercent: foodTaxPercent,
      sacCode: '996331',
    });
  }

  // Fallback if everything is empty
  if (foodItems.length === 0 && banquetItems.length === 0) {
    banquetItems.push({
      description: `${booking.eventType || 'Banquet'} Celebration Facilities & Tariff`,
      quantity: 1,
      rate: Number(booking.grandTotal || 0),
      amount: Number(booking.grandTotal || 0),
      category: 'BANQUET',
      taxPercent: banquetTaxPercent,
      sacCode: '997212',
    });
  }

  // Subtotals
  const foodSubtotal = foodItems.reduce((sum, it) => sum + it.amount, 0);
  const banquetSubtotal = banquetItems.reduce((sum, it) => sum + it.amount, 0);
  const totalSubtotal = foodSubtotal + banquetSubtotal;

  // Proportional discount distribution
  const totalDiscount = Math.min(totalSubtotal, Math.max(0, Number(booking.discount || 0)));
  let foodDiscount = 0;
  let banquetDiscount = 0;
  if (totalSubtotal > 0 && totalDiscount > 0) {
    foodDiscount = Math.round((foodSubtotal / totalSubtotal) * totalDiscount);
    banquetDiscount = Math.max(0, totalDiscount - foodDiscount);
  }

  const foodTaxable = Math.max(0, foodSubtotal - foodDiscount);
  const banquetTaxable = Math.max(0, banquetSubtotal - banquetDiscount);
  const totalTaxable = foodTaxable + banquetTaxable;

  // Taxes
  const foodTaxAmount = Math.round((foodTaxable * foodTaxPercent) / 100);
  const foodCgst = Math.floor(foodTaxAmount / 2);
  const foodSgst = foodTaxAmount - foodCgst;
  const foodGrandTotal = foodTaxable + foodTaxAmount;

  const banquetTaxAmount = Math.round((banquetTaxable * banquetTaxPercent) / 100);
  const banquetCgst = Math.floor(banquetTaxAmount / 2);
  const banquetSgst = banquetTaxAmount - banquetCgst;
  const banquetGrandTotal = banquetTaxable + banquetTaxAmount;

  const totalGrandTotal = foodGrandTotal + banquetGrandTotal;
  const totalPaid = Number(booking.paidAmount !== undefined ? booking.paidAmount : (booking.advancePayment || 0));

  // Proportional allocation of advance payment
  let foodAllocatedPaid = 0;
  let banquetAllocatedPaid = 0;
  if (totalGrandTotal > 0 && totalPaid > 0) {
    foodAllocatedPaid = Math.min(foodGrandTotal, Math.round((foodGrandTotal / totalGrandTotal) * totalPaid));
    banquetAllocatedPaid = Math.max(0, totalPaid - foodAllocatedPaid);
  }

  const foodBalance = Math.max(0, foodGrandTotal - foodAllocatedPaid);
  const banquetBalance = Math.max(0, banquetGrandTotal - banquetAllocatedPaid);

  const hasFood = foodSubtotal > 0;
  const hasBanquet = banquetSubtotal > 0;

  return {
    hasFood,
    hasBanquet,
    food: {
      items: foodItems,
      subtotal: foodSubtotal,
      discount: foodDiscount,
      taxable: foodTaxable,
      taxPercent: foodTaxPercent,
      cgstPercent: foodTaxPercent / 2,
      sgstPercent: foodTaxPercent / 2,
      cgstAmount: foodCgst,
      sgstAmount: foodSgst,
      taxAmount: foodTaxAmount,
      grandTotal: foodGrandTotal,
      allocatedPaid: foodAllocatedPaid,
      allocatedBalance: foodBalance,
      sacCode: '996331',
    },
    banquet: {
      items: banquetItems,
      subtotal: banquetSubtotal,
      discount: banquetDiscount,
      taxable: banquetTaxable,
      taxPercent: banquetTaxPercent,
      cgstPercent: banquetTaxPercent / 2,
      sgstPercent: banquetTaxPercent / 2,
      cgstAmount: banquetCgst,
      sgstAmount: banquetSgst,
      taxAmount: banquetTaxAmount,
      grandTotal: banquetGrandTotal,
      allocatedPaid: banquetAllocatedPaid,
      allocatedBalance: banquetBalance,
      sacCode: '997212',
    },
    combined: {
      totalSubtotal,
      totalDiscount,
      totalTaxable,
      totalTax: foodTaxAmount + banquetTaxAmount,
      totalGrandTotal,
      totalPaid,
      totalBalance: Math.max(0, totalGrandTotal - totalPaid),
    },
  };
}
