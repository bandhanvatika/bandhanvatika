import React, { useState } from 'react';
import { Modal } from './Modal.tsx';
import { OfficialBillSlip } from './OfficialBillSlip.tsx';
import { BookingSlip } from './BookingSlip.tsx';
import { splitBookingIntoBills, SplitBillResult } from '../utils/gstClassifier.ts';
import { printElement } from '../utils/print.ts';
import { Printer, Utensils, Landmark, FileText, CheckCircle2, Layers } from 'lucide-react';

export interface DualBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: any;
  defaultTab?: 'FOOD' | 'BANQUET' | 'SLIP' | 'BOTH';
}

export const DualBillModal: React.FC<DualBillModalProps> = ({
  isOpen,
  onClose,
  booking,
  defaultTab = 'FOOD',
}) => {
  const [activeTab, setActiveTab] = useState<'FOOD' | 'BANQUET' | 'SLIP' | 'BOTH'>(defaultTab);

  if (!booking) return null;

  const customer = booking.customer || null;
  const customerName = customer?.name || booking.customerName || '';
  const customerAddress = customer?.address || booking.customerAddress || 'Pakariyabar, Chandwa, Ara (Bihar)';
  const customerMobile = customer?.mobile || booking.customerMobile || '';
  const customerGstin = (customer as any)?.gstin || '';

  const bookingNo = booking.bookingNumber || 'BV-BKG-XXXX';
  const cleanBillNo = bookingNo.replace('BV-BKG-', 'BKG-').replace('BV-INV-', 'INV-');
  const foodBillNo = `FD-${cleanBillNo}`;
  const banquetBillNo = `BQ-${cleanBillNo}`;

  const billDate = booking.eventDate
    ? new Date(booking.eventDate).toLocaleDateString('en-GB')
    : new Date().toLocaleDateString('en-GB');

  // Split booking into statutory dual GST bills
  const split: SplitBillResult = splitBookingIntoBills(booking);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Bandhan Vatika — Dual Billing & Satta Documents`}
      subtitle={`Booking #${bookingNo} | ${customerName ? customerName + ' | ' : ''}${billDate}`}
      maxWidth="5xl"
    >
      <div className="space-y-4">
        {/* =========================================================================
            1. STATUTORY GST NOTICE & SUMMARY RECONCILIATION
           ========================================================================= */}
        <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          {/* Food Bill Summary Card */}
          <div
            onClick={() => setActiveTab('FOOD')}
            className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
              activeTab === 'FOOD'
                ? 'bg-amber-50/80 border-amber-300 ring-1 ring-amber-400'
                : 'bg-white border-stone-200 hover:border-amber-200'
            }`}
          >
            <div className="flex items-center justify-between text-amber-900 font-bold text-[11px] uppercase mb-1">
              <span className="flex items-center gap-1">
                <Utensils className="w-3.5 h-3.5 text-amber-700" />
                1. Food Bill (खाद्य बिल)
              </span>
              <span className="bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-mono text-[10px]">
                5% GST (SAC 9963)
              </span>
            </div>
            <div className="flex justify-between items-baseline font-mono text-xs">
              <span className="text-stone-500">Subtotal: ₹{split.food.subtotal.toLocaleString('en-IN')}</span>
              <strong className="text-amber-950 font-bold">
                Total: ₹{split.food.grandTotal.toLocaleString('en-IN')}
              </strong>
            </div>
            <div className="text-[10px] text-stone-500 flex justify-between mt-0.5">
              <span>Paid: ₹{split.food.allocatedPaid.toLocaleString('en-IN')}</span>
              <span className="text-amber-800 font-semibold">
                Due: ₹{split.food.allocatedBalance.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Banquet Bill Summary Card */}
          <div
            onClick={() => setActiveTab('BANQUET')}
            className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
              activeTab === 'BANQUET'
                ? 'bg-rose-50/80 border-rose-300 ring-1 ring-rose-400'
                : 'bg-white border-stone-200 hover:border-rose-200'
            }`}
          >
            <div className="flex items-center justify-between text-[#B91C1C] font-bold text-[11px] uppercase mb-1">
              <span className="flex items-center gap-1">
                <Landmark className="w-3.5 h-3.5 text-[#B91C1C]" />
                2. Banquet Bill (हॉल व रूम)
              </span>
              <span className="bg-rose-100 text-[#B91C1C] px-1.5 py-0.2 rounded font-mono text-[10px]">
                18% GST (SAC 9972)
              </span>
            </div>
            <div className="flex justify-between items-baseline font-mono text-xs">
              <span className="text-stone-500">Subtotal: ₹{split.banquet.subtotal.toLocaleString('en-IN')}</span>
              <strong className="text-rose-950 font-bold">
                Total: ₹{split.banquet.grandTotal.toLocaleString('en-IN')}
              </strong>
            </div>
            <div className="text-[10px] text-stone-500 flex justify-between mt-0.5">
              <span>Paid: ₹{split.banquet.allocatedPaid.toLocaleString('en-IN')}</span>
              <span className="text-rose-800 font-semibold">
                Due: ₹{split.banquet.allocatedBalance.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Satta Booking Slip Summary Card */}
          <div
            onClick={() => setActiveTab('SLIP')}
            className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
              activeTab === 'SLIP'
                ? 'bg-emerald-50/80 border-emerald-400 ring-1 ring-emerald-500'
                : 'bg-white border-stone-200 hover:border-emerald-200'
            }`}
          >
            <div className="flex items-center justify-between text-emerald-950 font-bold text-[11px] uppercase mb-1">
              <span className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-emerald-800" />
                3. Satta Slip (सट्टा पर्ची)
              </span>
              <span className="bg-emerald-100 text-emerald-900 px-1.5 py-0.2 rounded font-mono text-[10px]">
                Celebration Contract
              </span>
            </div>
            <div className="flex justify-between items-baseline font-mono text-xs">
              <span className="text-stone-500">Agreed Package:</span>
              <strong className="text-emerald-950 font-bold">
                ₹{split.combined.totalGrandTotal.toLocaleString('en-IN')}
              </strong>
            </div>
            <div className="text-[10px] text-stone-500 flex justify-between mt-0.5">
              <span>Advance: ₹{split.combined.totalPaid.toLocaleString('en-IN')}</span>
              <span className="text-rose-700 font-bold">
                Balance: ₹{split.combined.totalBalance.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            2. TABS: FOOD BILL (5%) | BANQUET BILL (18%) | SATTA SLIP | BOTH BILLS
           ========================================================================= */}
        <div className="flex items-center justify-between border-b border-stone-200 pb-2">
          <div className="flex items-center space-x-1 sm:space-x-2">
            <button
              type="button"
              onClick={() => setActiveTab('FOOD')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'FOOD'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>🍽️ Food Bill (भोजन - 5% GST)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('BANQUET')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'BANQUET'
                  ? 'bg-[#B91C1C] text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Landmark className="w-3.5 h-3.5" />
              <span>🏛️ Banquet &amp; Rooms (18% GST)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('SLIP')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'SLIP'
                  ? 'bg-[#14281D] text-[#F3E7C4] shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>📜 Satta Booking Slip (सट्टा पर्ची)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('BOTH')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'BOTH'
                  ? 'bg-stone-800 text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>📑 Both Bills (दोनों बिल)</span>
            </button>
          </div>

          <div className="hidden sm:block text-[11px] text-stone-500 font-medium">
            {activeTab === 'FOOD' && '🔴 Red Booklet — Food & Catering @ 5% GST'}
            {activeTab === 'BANQUET' && '🔴 Red Booklet — Venue & Rooms @ 18% GST'}
            {activeTab === 'SLIP' && '📜 Official Satta Contract with 7 Hindi Terms'}
            {activeTab === 'BOTH' && '📑 Dual Red Booklet Bills (2 Pages)'}
          </div>
        </div>

        {/* =========================================================================
            3. DOCUMENT PREVIEW WORKSPACE
           ========================================================================= */}
        <div className="max-h-[68vh] overflow-y-auto rounded-xl border border-stone-200 p-2 sm:p-4 bg-stone-100">
          {/* TAB 1: FOOD BILL (5% GST) */}
          {activeTab === 'FOOD' && (
            <div id="bandhan-food-bill-preview">
              <OfficialBillSlip
                billNumber={foodBillNo}
                date={billDate}
                billType="FOOD BILL"
                customerName={customerName}
                customerAddress={customerAddress}
                customerMobile={customerMobile}
                customerGstin={customerGstin}
                items={split.food.items}
                subtotal={split.food.subtotal}
                discount={split.food.discount}
                taxPercent={split.food.taxPercent}
                cgstAmount={split.food.cgstAmount}
                sgstAmount={split.food.sgstAmount}
                grandTotal={split.food.grandTotal}
                paidAmount={split.food.allocatedPaid}
                balanceAmount={split.food.allocatedBalance}
                showTerms={false}
              />
            </div>
          )}

          {/* TAB 2: BANQUET BILL (18% GST) */}
          {activeTab === 'BANQUET' && (
            <div id="bandhan-banquet-bill-preview">
              <OfficialBillSlip
                billNumber={banquetBillNo}
                date={billDate}
                billType="HOTEL & BANQUET BILL"
                customerName={customerName}
                customerAddress={customerAddress}
                customerMobile={customerMobile}
                customerGstin={customerGstin}
                items={split.banquet.items}
                subtotal={split.banquet.subtotal}
                discount={split.banquet.discount}
                taxPercent={split.banquet.taxPercent}
                cgstAmount={split.banquet.cgstAmount}
                sgstAmount={split.banquet.sgstAmount}
                grandTotal={split.banquet.grandTotal}
                paidAmount={split.banquet.allocatedPaid}
                balanceAmount={split.banquet.allocatedBalance}
                showTerms={false}
              />
            </div>
          )}

          {/* TAB 3: SATTA BOOKING SLIP */}
          {activeTab === 'SLIP' && (
            <div id="bandhan-booking-slip-preview">
              <BookingSlip
                booking={booking}
                customer={customer}
                advancePayment={split.combined.totalPaid}
                showPreviewInUI={true}
              />
            </div>
          )}

          {/* TAB 4: BOTH BILLS SIDE-BY-SIDE OR SEQUENTIAL */}
          {activeTab === 'BOTH' && (
            <div id="bandhan-both-bills-preview" className="space-y-6">
              <div>
                <div className="text-center font-bold text-xs text-amber-900 bg-amber-100 py-1 rounded mb-2 uppercase tracking-wider">
                  Page 1: Food Bill (खाद्य बिल @ 5% GST)
                </div>
                <OfficialBillSlip
                  billNumber={foodBillNo}
                  date={billDate}
                  billType="FOOD BILL"
                  customerName={customerName}
                  customerAddress={customerAddress}
                  customerMobile={customerMobile}
                  customerGstin={customerGstin}
                  items={split.food.items}
                  subtotal={split.food.subtotal}
                  discount={split.food.discount}
                  taxPercent={split.food.taxPercent}
                  cgstAmount={split.food.cgstAmount}
                  sgstAmount={split.food.sgstAmount}
                  grandTotal={split.food.grandTotal}
                  paidAmount={split.food.allocatedPaid}
                  balanceAmount={split.food.allocatedBalance}
                  showTerms={false}
                />
              </div>

              {/* Page break element for printing */}
              <div className="page-break-between" />

              <div>
                <div className="text-center font-bold text-xs text-[#B91C1C] bg-rose-100 py-1 rounded mb-2 uppercase tracking-wider">
                  Page 2: Hotel &amp; Banquet Bill (हॉल व रूम बिल @ 18% GST)
                </div>
                <OfficialBillSlip
                  billNumber={banquetBillNo}
                  date={billDate}
                  billType="HOTEL & BANQUET BILL"
                  customerName={customerName}
                  customerAddress={customerAddress}
                  customerMobile={customerMobile}
                  customerGstin={customerGstin}
                  items={split.banquet.items}
                  subtotal={split.banquet.subtotal}
                  discount={split.banquet.discount}
                  taxPercent={split.banquet.taxPercent}
                  cgstAmount={split.banquet.cgstAmount}
                  sgstAmount={split.banquet.sgstAmount}
                  grandTotal={split.banquet.grandTotal}
                  paidAmount={split.banquet.allocatedPaid}
                  balanceAmount={split.banquet.allocatedBalance}
                  showTerms={false}
                />
              </div>
            </div>
          )}
        </div>

        {/* =========================================================================
            4. ACTION FOOTER: INSTANT PRINT BUTTONS
           ========================================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-200">
          <div className="flex items-center gap-1.5 text-xs text-stone-600 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Statutory Separated Indian GST Documents (भोजन 5% + हॉल 18%)</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Print Active Tab */}
            {activeTab === 'FOOD' && (
              <button
                type="button"
                onClick={() =>
                  printElement('bandhan-food-bill-preview', `Food_Bill_${foodBillNo}`)
                }
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#B91C1C] hover:bg-red-800 text-white text-xs font-bold shadow-xs cursor-pointer transition-all"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Food Bill (भोजन बिल प्रिंट करें - 5%)</span>
              </button>
            )}

            {activeTab === 'BANQUET' && (
              <button
                type="button"
                onClick={() =>
                  printElement('bandhan-banquet-bill-preview', `Banquet_Bill_${banquetBillNo}`)
                }
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#B91C1C] hover:bg-red-800 text-white text-xs font-bold shadow-xs cursor-pointer transition-all"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Banquet Bill (हॉल बिल प्रिंट करें - 18%)</span>
              </button>
            )}

            {activeTab === 'SLIP' && (
              <button
                type="button"
                onClick={() =>
                  printElement('bandhan-booking-slip-preview', `Booking_Slip_${bookingNo}`)
                }
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#14281D] hover:bg-[#1f3c2b] text-[#F3E7C4] text-xs font-bold shadow-xs cursor-pointer transition-all"
              >
                <Printer className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Print Satta Slip (सट्टा पर्ची प्रिंट करें)</span>
              </button>
            )}

            {/* Print Both Bills in one shot */}
            <button
              type="button"
              onClick={() => {
                if (activeTab !== 'BOTH') setActiveTab('BOTH');
                setTimeout(() => {
                  printElement('bandhan-both-bills-preview', `Dual_Bills_${cleanBillNo}`);
                }, 100);
              }}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold shadow-xs cursor-pointer transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Both Bills (दोनो बिल प्रिंट करें)</span>
            </button>

            {/* Quick Satta Slip Print if not on slip tab */}
            {activeTab !== 'SLIP' && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('SLIP');
                  setTimeout(() => {
                    printElement('bandhan-booking-slip-preview', `Booking_Slip_${bookingNo}`);
                  }, 100);
                }}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-[#14281D] hover:bg-[#1f3c2b] text-[#F3E7C4] text-xs font-bold cursor-pointer transition-all"
              >
                <FileText className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>सट्टा पर्ची</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold cursor-pointer transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
