import React from 'react';
import { Customer, Booking, Payment, Settings, Invoice } from '../types/index.ts';
import { BrandLogo } from './BrandLogo.tsx';
import { OfficialBillSlip, OfficialBillItem } from './OfficialBillSlip.tsx';

export interface PrintReceiptData {
  receiptNumber: string;
  paymentDate: string;
  amount: string | number;
  paymentMethod: string;
  paymentType?: 'ADVANCE' | 'PARTIAL' | 'FINAL' | string;
  transactionReference?: string | null;
  notes?: string | null;
  isReversed?: boolean;
  reversalReason?: string | null;
  reversedAt?: string | null;
  reversedBy?: string | null;
  receivedBy?: string;
  createdAt?: string;

  // Financial Context
  invoiceTotal?: string | number;
  previousBalance?: string | number;
  balanceAfterPayment?: string | number;
  showTerms?: boolean;

  // Associated entities
  customer?: Partial<Customer> | null;
  booking?: Partial<Booking> | null;
  invoice?: Partial<Invoice> | null;
  paymentHistory?: Array<Partial<Payment>>;
  settings?: Partial<Settings> | null;
  bandhanVatika?: {
    businessName?: string;
    tagline?: string;
    address?: string;
    phone?: string;
    email?: string;
    gstin?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
  } | null;
}

export interface PrintReceiptProps {
  /**
   * Direct structured props or consolidated data object
   */
  booking?: Partial<Booking> | null;
  invoice?: Partial<Invoice> | null;
  paymentHistory?: Array<Partial<Payment>>;
  currentPayment?: Partial<Payment> | null;
  customer?: Partial<Customer> | null;
  settings?: Partial<Settings> | null;

  /**
   * Consolidated data object (alternative)
   */
  data?: PrintReceiptData;

  /**
   * If true, also renders visually in the UI container (e.g. inside a modal preview).
   * If false (default), it is hidden on screen and only rendered when printing.
   */
  showPreviewInUI?: boolean;

  /**
   * Initial selected format: 'RED_BOOKLET' (default) or 'STANDARD_RECEIPT'
   */
  initialFormat?: 'RED_BOOKLET' | 'STANDARD_RECEIPT';

  /**
   * Explicitly toggle terms & conditions (defaults to true for bookings, false for pure bills/invoices)
   */
  showTerms?: boolean;
}

import { amountToIndianWords } from '../utils/numberToWords.ts';
export { amountToIndianWords };

export const PrintReceipt: React.FC<PrintReceiptProps> = ({
  booking: propBooking,
  invoice: propInvoice,
  paymentHistory: propPaymentHistory,
  currentPayment: propCurrentPayment,
  customer: propCustomer,
  settings: propSettings,
  data: propData,
  showPreviewInUI = false,
  initialFormat = 'RED_BOOKLET',
  showTerms: propShowTerms,
}) => {
  const [format, setFormat] = React.useState<'RED_BOOKLET' | 'STANDARD_RECEIPT'>(initialFormat);

  // Resolve effective entities from direct props or data bundle
  const booking = propBooking || propData?.booking || null;
  const invoice = propInvoice || propData?.invoice || null;

  // Determine if terms should be shown (booking gets terms by default, invoice receipt does not unless specified)
  const isBookingReceipt = Boolean(
    booking ||
    propData?.booking ||
    (propData as any)?.bookingId ||
    (propData as any)?.booking_id
  );
  const shouldShowTerms = propShowTerms !== undefined
    ? propShowTerms
    : propData?.showTerms !== undefined
    ? propData.showTerms
    : isBookingReceipt;
  const customer = propCustomer || propData?.customer || booking?.customer || invoice?.customer || null;
  const settings = propSettings || propData?.settings || null;
  const currentPay = propCurrentPayment || (propData ? {
    receiptNumber: propData.receiptNumber,
    paymentDate: propData.paymentDate,
    amount: String(propData.amount),
    paymentMethod: propData.paymentMethod as any,
    paymentType: (propData.paymentType || 'PARTIAL') as any,
    transactionReference: propData.transactionReference,
    notes: propData.notes,
    isReversed: propData.isReversed || false,
    reversalReason: propData.reversalReason,
    reversedAt: propData.reversedAt,
    reversedBy: propData.reversedBy,
    createdBy: propData.receivedBy || 'Accounts',
  } : null);

  const history: Array<Partial<Payment>> =
    propPaymentHistory ||
    propData?.paymentHistory ||
    (booking?.payments as Array<Partial<Payment>>) ||
    (currentPay ? [currentPay] : []);

  const biz = propData?.bandhanVatika || {
    businessName: settings?.businessName || 'Bandhan Vatika',
    tagline: settings?.tagline || 'A Complete Venue for Your Celebration',
    address: settings?.address || 'आरा-बक्सर मेन रोड, पकड़ीयावर, आर० के० ऐकेडमी स्कूल के ठीक सामने, चन्दवाँ, आरा (बिहार)',
    phone: settings?.phone || '9431086933, 8409480911, 9015755799',
    email: settings?.email || 'contact@bandhanvatika.com',
    gstin: settings?.gstin || '10CNXPSO100F2ZC',
    bankName: settings?.bankName || 'HDFC Bank',
    accountNumber: settings?.accountNumber || '50200012345678',
    ifscCode: settings?.ifscCode || 'HDFC0001234',
  };

  // Primary receipt numbers
  const activeReceiptNum = currentPay?.receiptNumber || propData?.receiptNumber || 'BV-PAY-2026-XXXX';
  const activePaymentDate = currentPay?.paymentDate || propData?.paymentDate || new Date().toISOString().split('T')[0];
  const activeAmount = currentPay ? Number(currentPay.amount || 0) : propData ? Number(propData.amount || 0) : 0;
  const amountWords = amountToIndianWords(activeAmount);

  // Financial reconciliation
  const grandTotal = invoice?.grandTotal !== undefined
    ? Number(invoice.grandTotal)
    : booking?.grandTotal !== undefined
    ? Number(booking.grandTotal)
    : propData?.invoiceTotal !== undefined
    ? Number(propData.invoiceTotal)
    : activeAmount;

  // Cumulative paid amount calculation from valid non-reversed history
  let totalPaidToDate = 0;
  if (history && history.length > 0) {
    for (const p of history) {
      if (!p.isReversed) {
        totalPaidToDate += Number(p.amount || 0);
      }
    }
  } else {
    totalPaidToDate = activeAmount;
  }

  const outstandingBalance = Math.max(0, grandTotal - totalPaidToDate);

  // Build items for the official red booklet bill slip
  let billSlipItems: OfficialBillItem[] = [];

  // 1. Check if invoice items exist
  if (invoice?.items) {
    try {
      const parsed = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
      if (Array.isArray(parsed) && parsed.length > 0) {
        billSlipItems = parsed.map((it: any) => ({
          description: it.description || 'Banquet & Food Service',
          quantity: it.quantity || it.qty || 1,
          rate: Number(it.rate || it.amount || 0),
          amount: Number(it.amount || 0),
        }));
      }
    } catch {
      // fallback
    }
  }

  // 2. If no invoice items, extract from booking
  if (billSlipItems.length === 0 && booking) {
    const bAny = booking as any;
    if (bAny.hallRentalPrice && Number(bAny.hallRentalPrice) > 0) {
      billSlipItems.push({
        description: `Banquet Hall (${booking.hall?.name || 'Grand Hall'}) - ${booking.eventType || 'Celebration'}`,
        rate: Number(bAny.hallRentalPrice),
        amount: Number(bAny.hallRentalPrice),
      });
    }

    if (booking.guestCount && Number(booking.guestCount) > 0 && Number(bAny.platePrice || 0) > 0) {
      const foodAmt = Number(booking.guestCount) * Number(bAny.platePrice);
      billSlipItems.push({
        description: `Food Catering (${booking.guestCount} Persons @ ₹${Number(bAny.platePrice).toLocaleString('en-IN')}/plate)`,
        quantity: Number(booking.guestCount),
        rate: Number(bAny.platePrice),
        amount: foodAmt,
      });
    }

    if (bAny.extraServicesPrice && Number(bAny.extraServicesPrice) > 0) {
      billSlipItems.push({
        description: 'Decoration & Stage Setup Facilities',
        rate: Number(bAny.extraServicesPrice),
        amount: Number(bAny.extraServicesPrice),
      });
    }
  }

  // 3. Fallback: payment description
  if (billSlipItems.length === 0) {
    const desc = booking?.eventType
      ? `${booking.eventType} Celebration (${currentPay?.paymentType || propData?.paymentType || 'Payment'} Received)`
      : currentPay?.notes || propData?.notes || `Payment Voucher #${activeReceiptNum}`;
    billSlipItems = [
      {
        description: desc,
        rate: activeAmount > 0 ? activeAmount : grandTotal,
        amount: activeAmount > 0 ? activeAmount : grandTotal,
      },
    ];
  }

  const cleanBillNo = activeReceiptNum
    .replace(/^BV-REC-INV-/, 'INV-')
    .replace(/^BV-REC-BV-BKG-/, 'BKG-')
    .replace(/^BV-REC-/, '') || '118';

  const billSubtotal = invoice?.subtotal !== undefined
    ? Number(invoice.subtotal)
    : (booking?.subtotal !== undefined ? Number(booking.subtotal) : grandTotal);

  const billTaxPercent = invoice?.taxPercent !== undefined
    ? Number(invoice.taxPercent)
    : (booking?.taxPercent !== undefined ? Number(booking.taxPercent) : 5);

  const billCgst = invoice?.cgstAmount !== undefined
    ? Number(invoice.cgstAmount)
    : (invoice?.taxAmount ? Number(invoice.taxAmount) / 2 : undefined);

  const billSgst = invoice?.sgstAmount !== undefined
    ? Number(invoice.sgstAmount)
    : (invoice?.taxAmount ? Number(invoice.taxAmount) / 2 : undefined);

  return (
    <div className="w-full">
      {/* Format Selector Bar (visible only in UI preview) */}
      {showPreviewInUI && (
        <div className="no-print mb-3 p-2.5 rounded-2xl bg-white border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setFormat('RED_BOOKLET')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                format === 'RED_BOOKLET'
                  ? 'bg-[#B91C1C] text-white shadow-xs'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
              }`}
            >
              <span>🔴</span>
              <span>Official Bill (लाल बुकलेट बिल)</span>
            </button>
            <button
              type="button"
              onClick={() => setFormat('STANDARD_RECEIPT')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                format === 'STANDARD_RECEIPT'
                  ? 'bg-[#14281D] text-[#F3E7C4] shadow-xs'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
              }`}
            >
              <span>📄</span>
              <span>Standard A4 Receipt</span>
            </button>
          </div>
          <span className="text-[11px] text-stone-500 font-medium">
            {format === 'RED_BOOKLET' ? '🔴 Physical Red Booklet format with 7 handwritten terms' : 'Standard multi-column payment voucher'}
          </span>
        </div>
      )}

      {/* Target Container for Printing */}
      <div
        id="bandhan-print-receipt"
        className={`print-receipt-container font-sans bg-white text-stone-900 ${
          showPreviewInUI ? 'block' : 'hidden print:block'
        }`}
        style={{
          width: '100%',
          maxWidth: '210mm',
          margin: '0 auto',
        }}
      >
        {format === 'RED_BOOKLET' ? (
          <OfficialBillSlip
            billNumber={cleanBillNo}
            date={activePaymentDate}
            billType={booking?.eventType?.toLowerCase().includes('jeevika') ? 'FOOD BILL' : 'HOTEL / FOOD BILL'}
            customerName={customer?.name || ''}
            customerAddress={customer?.address || 'Pakariyabar, Chandwa, Ara'}
            customerMobile={customer?.mobile || ''}
            customerGstin={(customer as any)?.gstin || ''}
            items={billSlipItems}
            subtotal={billSubtotal}
            discount={Number(invoice?.discount || booking?.discount || 0)}
            taxPercent={billTaxPercent}
            cgstAmount={billCgst}
            sgstAmount={billSgst}
            grandTotal={grandTotal}
            paidAmount={totalPaidToDate}
            balanceAmount={outstandingBalance}
            showTerms={shouldShowTerms}
          />
        ) : (
          <div className="p-8 sm:p-10 border border-stone-300 print:border-none print:p-0 space-y-5">
        {/* =========================================================================
            1. HEADER: BRAND CREST & VENUE PARTICULARS
           ========================================================================= */}
        <div className="flex justify-between items-start pb-5 border-b-2 border-[#14281D]">
          <div className="space-y-1 max-w-[65%]">
            <div className="text-[11px] font-bold text-[#8B6B23] tracking-widest uppercase">
              ॥ श्री गणेशाय नमः ॥
            </div>
            <BrandLogo variant="print" />
            <p className="text-[11px] text-stone-700 leading-relaxed font-medium">
              {biz.address}
            </p>
            <div className="flex flex-wrap gap-x-4 text-[11px] text-stone-800 pt-0.5 font-bold">
              <span>Mob. : 9431086933, 8409480911, 9015755799</span>
            </div>
          </div>

          <div className="text-right space-y-2">
            <div className="inline-block px-3 py-1 bg-[#14281D] text-[#F3E7C4] font-brand font-bold text-xs uppercase tracking-widest rounded-md print:bg-stone-900 print:text-white">
              OFFICIAL RECEIPT
            </div>
            <div className="space-y-0.5 text-xs">
              <div className="font-mono font-bold text-stone-900 text-sm">
                #{activeReceiptNum}
              </div>
              <div className="text-stone-500 text-[11px]">
                <strong>Date:</strong> {activePaymentDate}
              </div>
              <div className="text-[10px] text-stone-400">
                Time: {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            {currentPay?.isReversed && (
              <div className="inline-block px-2.5 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 font-bold text-[10px] uppercase rounded tracking-wider">
                CANCELLED / REVERSED
              </div>
            )}
          </div>
        </div>

        {/* =========================================================================
            2. CUSTOMER & BOOKING / EVENT DETAILS (2-Column Grid)
           ========================================================================= */}
        <div className="grid grid-cols-2 gap-4 bg-stone-50 print:bg-stone-50/90 p-4 rounded-xl border border-stone-200 text-xs">
          {/* Left Column: Customer Information */}
          <div className="space-y-1.5 pr-2 border-r border-stone-200">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
              RECEIVED WITH THANKS FROM:
            </span>
            <div className="font-bold text-sm text-[#14281D]">
              {customer?.name || 'Valued Patron'}
            </div>
            {customer?.mobile && (
              <div className="text-stone-600">
                <span className="text-stone-400">Mobile:</span> +91 {customer.mobile}
              </div>
            )}
            {customer?.email && (
              <div className="text-stone-600">
                <span className="text-stone-400">Email:</span> {customer.email}
              </div>
            )}
            {customer?.address && (
              <div className="text-stone-600 text-[11px] leading-tight">
                <span className="text-stone-400">Address:</span> {customer.address}, {customer.city || 'Ara'}
              </div>
            )}
            {customer?.customerCode && (
              <div className="text-[10px] text-stone-500 font-mono">
                Customer ID: {customer.customerCode}
              </div>
            )}
          </div>

          {/* Right Column: Booking & Invoice Reference */}
          <div className="space-y-1.5 pl-2">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
              EVENT & BOOKING DETAILS:
            </span>
            {booking ? (
              <>
                <div className="font-bold text-sm text-stone-900">
                  {booking.eventType || 'Banquet Celebration'}
                </div>
                <div className="text-stone-600">
                  <span className="text-stone-400">Booking #:</span>{' '}
                  <span className="font-mono font-semibold">{booking.bookingNumber}</span>
                </div>
                <div className="text-stone-600">
                  <span className="text-stone-400">Event Date:</span>{' '}
                  <strong>{booking.eventDate}</strong>
                  {booking.startTime && booking.endTime && (
                    <span className="text-stone-500 text-[11px]"> ({booking.startTime} - {booking.endTime})</span>
                  )}
                </div>
                {booking.hall && (
                  <div className="text-stone-600 text-[11px]">
                    <span className="text-stone-400">Venue Allocated:</span> {booking.hall.name}
                  </div>
                )}
                {booking.guestCount && (
                  <div className="text-stone-500 text-[11px]">
                    <span className="text-stone-400">Guests Expected:</span> {booking.guestCount}
                  </div>
                )}
              </>
            ) : invoice ? (
              <>
                <div className="font-bold text-sm text-stone-900">
                  {invoice.eventType || 'Event Function'}
                </div>
                <div className="text-stone-600">
                  <span className="text-stone-400">Against Invoice #:</span>{' '}
                  <span className="font-mono font-semibold">{invoice.invoiceNumber}</span>
                </div>
                <div className="text-stone-600">
                  <span className="text-stone-400">Event Date:</span> {invoice.eventDate}
                </div>
              </>
            ) : (
              <div className="text-stone-500 italic text-[11px]">
                Direct customer account credit & reservation deposit.
              </div>
            )}

            {invoice?.invoiceNumber && booking && (
              <div className="text-[10px] text-stone-500">
                <span className="text-stone-400">Linked Tax Invoice:</span> {invoice.invoiceNumber}
              </div>
            )}
          </div>
        </div>

        {/* =========================================================================
            3. CURRENT PAYMENT TRANSACTION HIGHLIGHT
           ========================================================================= */}
        {currentPay && (
          <div className="border border-stone-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#14281D] text-[#F3E7C4] text-[10px] font-bold uppercase tracking-wider print:bg-stone-800 print:text-white">
                  <th className="p-3">Payment Stage / Purpose</th>
                  <th className="p-3">Payment Mode</th>
                  <th className="p-3">Transaction Reference / UTR</th>
                  <th className="p-3 text-right">Amount Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                <tr className="bg-white">
                  <td className="p-3 font-semibold text-stone-900">
                    {currentPay.paymentType === 'ADVANCE'
                      ? 'Initial Booking Advance Deposit'
                      : currentPay.paymentType === 'FINAL'
                      ? 'Final Balance Settlement'
                      : 'Installment Payment / Running Credit'}
                  </td>
                  <td className="p-3 font-medium text-stone-800">
                    {currentPay.paymentMethod}
                  </td>
                  <td className="p-3 font-mono text-stone-700">
                    {currentPay.transactionReference || '—'}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-sm text-[#14281D]">
                    ₹{Number(currentPay.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* =========================================================================
            4. PAYMENT HISTORY / COMPLETE INSTALLMENT SCHEDULE
           ========================================================================= */}
        {history && history.length > 1 && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between items-center text-[10px] font-bold text-stone-500 uppercase tracking-wider">
              <span>Complete Payment History & Installment Schedule</span>
              <span>{history.length} Transactions Recorded</span>
            </div>
            <div className="border border-stone-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-100 text-stone-700 text-[10px] font-bold uppercase tracking-wider">
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Receipt #</th>
                    <th className="p-2.5">Mode</th>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5">Reference / UTR</th>
                    <th className="p-2.5 text-right">Amount</th>
                    <th className="p-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 font-mono text-[11px]">
                  {history.map((p, idx) => (
                    <tr
                      key={p.id || idx}
                      className={p.receiptNumber === activeReceiptNum ? 'bg-amber-50/50 font-bold' : 'bg-white'}
                    >
                      <td className="p-2.5">{p.paymentDate}</td>
                      <td className="p-2.5 font-bold text-stone-900">{p.receiptNumber}</td>
                      <td className="p-2.5 font-sans font-medium">{p.paymentMethod}</td>
                      <td className="p-2.5 font-sans">{p.paymentType || 'PARTIAL'}</td>
                      <td className="p-2.5 text-stone-500">{p.transactionReference || '—'}</td>
                      <td className="p-2.5 text-right font-bold text-stone-900">
                        ₹{Number(p.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2.5 text-center">
                        {p.isReversed ? (
                          <span className="text-[9px] font-bold text-rose-700 uppercase">Reversed</span>
                        ) : (
                          <span className="text-[9px] font-bold text-emerald-700 uppercase">Received</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            5. AMOUNT IN WORDS & FINANCIAL SUMMARY BLOCK
           ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start pt-1">
          {/* Left: Amount in words */}
          <div className="md:col-span-7 space-y-2.5">
            <div className="p-3.5 bg-[#FAF7F0] border border-[#E8DCC0] rounded-xl text-xs space-y-1">
              <span className="text-[10px] font-bold text-[#8B6B23] uppercase tracking-wider block">
                CURRENT AMOUNT RECEIVED IN WORDS:
              </span>
              <p className="font-serif font-bold text-[#14281D] text-xs leading-relaxed italic">
                {amountWords}
              </p>
            </div>

            {currentPay?.notes && (
              <div className="text-[11px] text-stone-600 bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                <span className="font-bold text-stone-700">Remarks / Note:</span> {currentPay.notes}
              </div>
            )}

            {currentPay?.isReversed && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                <div className="font-bold uppercase text-[10px] tracking-wider text-rose-900">
                  Payment Reversal Notice
                </div>
                <div><strong>Reason:</strong> {currentPay.reversalReason || 'Transaction cancelled'}</div>
                <div className="text-[10px] text-rose-600">
                  Reversed by {currentPay.reversedBy || 'Accounts'} on{' '}
                  {currentPay.reversedAt ? new Date(currentPay.reversedAt).toLocaleDateString('en-IN') : 'N/A'}
                </div>
              </div>
            )}
          </div>

          {/* Right: Comprehensive Financial Balance Ledger */}
          <div className="md:col-span-5 bg-stone-50 border border-stone-200 rounded-xl p-3.5 text-xs space-y-2 font-mono">
            <div className="flex justify-between text-stone-600">
              <span>Total Contract Value:</span>
              <span>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="flex justify-between text-stone-600">
              <span>Total Paid to Date:</span>
              <span className="font-bold text-emerald-800">
                ₹{totalPaidToDate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-y-2 border-[#14281D] text-sm font-bold text-[#14281D]">
              <span>Current Voucher:</span>
              <span>₹{activeAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="flex justify-between text-xs font-bold text-stone-800 pt-0.5">
              <span>Outstanding Balance Due:</span>
              <span className={outstandingBalance === 0 ? 'text-emerald-700 font-extrabold' : 'text-rose-700'}>
                {outstandingBalance === 0
                  ? '₹0.00 (PAID IN FULL)'
                  : `₹${outstandingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
              </span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            6. TERMS & BANK REMITTANCE COORDINATES
           ========================================================================= */}
        <div className="pt-2 border-t border-stone-200 grid grid-cols-2 gap-4 text-[10px] text-stone-500 leading-tight">
          {shouldShowTerms ? (
            <div className="space-y-1">
              <span className="font-bold text-stone-800 uppercase tracking-wider block text-[11px]">
                नोट :- (नियम व शर्तें / Terms & Conditions):
              </span>
              <ol className="list-decimal list-inside space-y-1 text-stone-700 font-medium text-[10.5px] leading-relaxed">
                <li>किसी कारण वश सट्टा रद्द होने पर अग्रीम राशी जब्त हो जायेगी</li>
                <li>उत्सव का दिनांक पुनः बदलने पर उपलब्धता देखी जायेगी</li>
                <li>तय कुल रकम का 30% अग्रीम के रूप में लिया जायेगा</li>
                <li>उत्सव की दिनांक से 5 दिन पहले कुल रकम का भुगतान करना होगा।</li>
                <li>उत्सव भवन के यत्र तत्र गंदगी फैलाने पर सफाई का खर्च सट्टेदार को देना होगा।</li>
                <li>किसी प्रकार का तोड़फोड़ या भारी नुकसान होने पर उसका वाजिब भुगतान सट्टेदार को करना होगा।</li>
                <li>उत्सव के दिन किसी भी विद्युत उपकरण के खराबी आने पर ठीक कराने का प्रयास किया जायेगा परन्तु नहीं होने पर उसकी जिम्मेदारी प्रबंधन पर नहीं होगी।</li>
              </ol>
            </div>
          ) : (
            <div className="space-y-1">
              <span className="font-black text-[#14281D] uppercase tracking-wider block text-xs">
                Thank You!
              </span>
              <p className="text-stone-600 text-xs font-medium">
                Thank you for choosing Bandhan Vatika. Visit Again!
              </p>
            </div>
          )}

          <div className="space-y-1 bg-stone-50 p-2.5 rounded-lg border border-stone-200 font-mono text-[10px]">
            <span className="font-bold text-stone-700 uppercase tracking-wider font-sans block">
              Official Bank Details for Remittance:
            </span>
            <div><strong>Bank:</strong> {biz.bankName}</div>
            <div><strong>A/C No:</strong> {biz.accountNumber}</div>
            <div><strong>IFSC Code:</strong> {biz.ifscCode}</div>
          </div>
        </div>

        {/* =========================================================================
            7. AUTHORIZED SIGNATORY & VERIFICATION FOOTER
           ========================================================================= */}
        <div className="pt-8 flex justify-between items-end text-xs">
          <div className="space-y-1 text-left">
            <div className="text-[10px] text-stone-400">
              Received & Processed By:
            </div>
            <div className="font-bold text-stone-800 text-xs">
              {currentPay?.createdBy || propData?.receivedBy || 'Authorized Desk Officer'}
            </div>
            <div className="text-[9px] text-stone-400 font-mono">
              Bandhan Vatika Accounts Department
            </div>
          </div>

          <div className="text-center space-y-2">
            <div className="w-48 h-12 border-b border-stone-400 flex items-end justify-center pb-1">
              <span className="text-[9px] text-stone-300 italic">Official Seal & Signature</span>
            </div>
            <div className="font-brand font-bold text-xs text-[#14281D] tracking-wider uppercase">
              For Bandhan Vatika
            </div>
            <div className="text-[9px] text-stone-400">
              Authorized Signatory
            </div>
          </div>
        </div>

        {/* Security Stamp / Computer Generated Notice */}
        <div className="pt-3 border-t border-dashed border-stone-200 flex justify-between items-center text-[9px] text-stone-400">
          <div>
            System Generated Payment Voucher • Ref: BV-REC-{activeReceiptNum}
          </div>
          <div>
            Bandhan Vatika Management System • Verification: AUTH-{Date.now().toString().slice(-8)}
          </div>
        </div>
      </div>
        )}
      </div>
    </div>
  );
};
