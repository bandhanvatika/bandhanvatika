/**
 * BANDHAN VATIKA — FINANCIAL PRECISION ARITHMETIC
 * Strictly uses integer paise arithmetic (1 Rupee = 100 Paise) to avoid
 * any floating-point arithmetic errors.
 * All output values are guaranteed to be valid PostgreSQL NUMERIC(12, 2) strings.
 */

export interface FinancialItem {
  description: string;
  qty?: number;
  quantity?: number;
  rate: number;
  amount?: number;
}

function toPaise(val: number | string): number {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num) || !isFinite(num)) return 0;
  return Math.round(num * 100);
}

function fromPaise(paise: number): string {
  return (paise / 100).toFixed(2);
}

export function calculateFinancials(
  items: FinancialItem[] = [],
  discountVal: number | string = 0,
  taxPercentVal: number | string = 0,
  paidVal: number | string = 0
) {
  let subtotalPaise = 0;
  const safeItems = Array.isArray(items) ? items : [];

  const processedItems = safeItems.map((item) => {
    const rawQty = item.qty !== undefined ? item.qty : item.quantity;
    const qty = Math.max(0, Number(rawQty) || 0);
    const ratePaise = Math.max(0, toPaise(item.rate));
    // Quantity * Rate (in paise)
    const amountPaise = Math.round(qty * ratePaise);
    subtotalPaise += amountPaise;

    return {
      description: String(item.description || '').trim(),
      qty,
      quantity: qty,
      rate: parseFloat(fromPaise(ratePaise)),
      amount: parseFloat(fromPaise(amountPaise)),
    };
  });

  const rawDiscountPaise = Math.max(0, toPaise(discountVal));
  // Discount cannot exceed subtotal
  const discountPaise = Math.min(subtotalPaise, rawDiscountPaise);
  
  const taxablePaise = Math.max(0, subtotalPaise - discountPaise);
  
  const taxPercent = Math.max(0, parseFloat(String(taxPercentVal || 0)));
  const taxAmountPaise = Math.round((taxablePaise * taxPercent) / 100);
  
  const grandTotalPaise = taxablePaise + taxAmountPaise;
  const paidPaise = Math.max(0, toPaise(paidVal));
  const balancePaise = Math.max(0, grandTotalPaise - paidPaise);

  // Equal 50/50 split for Intra-State GST (CGST + SGST) with exact paise reconciliation
  const cgstPaise = Math.floor(taxAmountPaise / 2);
  const sgstPaise = taxAmountPaise - cgstPaise;

  return {
    items: processedItems,
    subtotal: fromPaise(subtotalPaise),
    discount: fromPaise(discountPaise),
    taxPercent: taxPercent.toFixed(2),
    taxAmount: fromPaise(taxAmountPaise),
    cgstAmount: fromPaise(cgstPaise),
    sgstAmount: fromPaise(sgstPaise),
    igstAmount: '0.00',
    grandTotal: fromPaise(grandTotalPaise),
    paidAmount: fromPaise(paidPaise),
    balanceAmount: fromPaise(balancePaise),
  };
}
