import React from 'react';
import { Booking, Customer, Settings } from '../types/index.ts';
import { BrandCrestImg } from './BrandLogo.tsx';
import { amountToIndianWords } from '../utils/numberToWords.ts';

export const OFFICIAL_SATTA_TERMS_HINDI = [
  'किसी कारण वश सट्टा रद्द होने पर अग्रीम राशी जब्त हो जायेगी',
  'उत्सव का दिनांक पुनः बदलने पर उपलब्धता देखी जायेगी',
  'तय कुल रकम का 30% अग्रीम के रूप में लिया जायेगा',
  'उत्सव की दिनांक से 5 दिन पहले कुल रकम का भुगतान करना होगा।',
  'उत्सव भवन के यत्र तत्र गंदगी फैलाने पर सफाई का खर्च सट्टेदार को देना होगा।',
  'किसी प्रकार का तोड़फोड़ या भारी नुकसान होने पर उसका वाजिब भुगतान सट्टेदार को करना होगा।',
  'उत्सव के दिन किसी भी विद्युत उपकरण के खराबी आने पर ठीक कराने का प्रयास किया जायेगा परन्तु नहीं होने पर उसकी जिम्मेदारी प्रबंधन पर नहीं होगी।',
];

export interface BookingSlipProps {
  booking: Partial<Booking> | any;
  customer?: Partial<Customer> | null;
  settings?: Partial<Settings> | null;
  advancePayment?: number | string;
  paymentMethod?: string;
  showPreviewInUI?: boolean;
}

export const BookingSlip: React.FC<BookingSlipProps> = ({
  booking,
  customer: propCustomer,
  settings: propSettings,
  advancePayment: propAdvance,
  paymentMethod: propMethod,
  showPreviewInUI = false,
}) => {
  if (!booking) return null;

  const customer = propCustomer || booking.customer || null;
  const settings = propSettings || null;

  // Booking particulars
  const bookingNumber = booking.bookingNumber || 'BV-BKG-XXXX';
  const bookingDate = booking.createdAt
    ? new Date(booking.createdAt).toLocaleDateString('en-GB')
    : new Date().toLocaleDateString('en-GB');
  const eventDate = booking.eventDate
    ? new Date(booking.eventDate).toLocaleDateString('en-GB')
    : '—';
  const eventType = booking.eventType || 'Banquet Celebration';
  const timings = booking.startTime && booking.endTime
    ? `${booking.startTime} - ${booking.endTime}`
    : 'Full Day / Evening Function';

  // Venue & Guests
  const hallName = booking.hall?.name || 'Grand Royal Banquet & Lawn';
  const guestCount = booking.guestCount || '—';

  // Parse items / services
  let parsedServices: any[] = [];
  if (Array.isArray(booking.services)) {
    parsedServices = booking.services;
  } else if (typeof booking.services === 'string') {
    try {
      parsedServices = JSON.parse(booking.services);
    } catch {
      parsedServices = [];
    }
  }

  // Financial reconciliation
  const grandTotal = Number(booking.grandTotal || 0);
  const paidAmount = propAdvance !== undefined
    ? Number(propAdvance)
    : Number(booking.paidAmount || 0);
  const balanceAmount = Math.max(0, grandTotal - paidAmount);
  const discount = Number(booking.discount || 0);
  const payMethod = propMethod || booking.payments?.[0]?.paymentMethod || 'UPI / Cash';

  const inWords = amountToIndianWords(grandTotal);

  return (
    <div className="booking-slip-wrapper font-sans text-stone-900 bg-white mx-auto print:m-0 print:p-0">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 5mm 8mm;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            background: white !important;
          }
          .booking-slip-wrapper {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
          }
        }
      `}</style>

      {/* Main Container with crisp royal green & gold border */}
      <div
        id="bandhan-booking-slip"
        className="border-[2.5px] border-[#14281D] rounded-xl p-3.5 sm:p-5 bg-white relative shadow-sm print:shadow-none space-y-3"
      >
        {/* =========================================================================
            1. HEADER: SHRI GANESHAY NAMAH + LOGO + VENUE DETAILS + TITLE BANNER
           ========================================================================= */}
        <div className="border-b-2 border-[#14281D] pb-2.5">
          {/* Top Line */}
          <div className="flex items-center justify-between text-[11px] font-bold text-stone-600 mb-1">
            <span className="font-mono text-stone-800">
              सट्टा सं०: <strong className="text-[#14281D] text-xs">{bookingNumber}</strong>
            </span>
            <span className="text-[#8B6B23] tracking-widest text-xs uppercase font-serif">
              ॥ श्री गणेशाय नमः ॥
            </span>
            <span className="text-stone-800">
              बुकिंग तिथि: <strong>{bookingDate}</strong>
            </span>
          </div>

          {/* Crest & Venue Name */}
          <div className="flex items-center justify-center gap-3 my-1">
            <BrandCrestImg className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-full border border-[#C5A059]/60" />
            <div className="text-center">
              <h1 className="text-2xl sm:text-3xl font-black tracking-wider text-[#14281D] uppercase leading-none font-serif">
                BANDHAN VATIKA
              </h1>
              <p className="text-[10px] sm:text-[11px] font-semibold text-[#8B6B23] tracking-wider mt-0.5 uppercase">
                A Complete Venue for Your Celebration • मैरेज हॉल, लॉन एवं बैंक्वेट
              </p>
              <p className="text-[10px] sm:text-[11px] text-stone-700 font-medium">
                {settings?.address || 'आरा-बक्सर मेन रोड, पकड़ीयावर, आर० के० ऐकेडमी स्कूल के ठीक सामने, चन्दवाँ, आरा (बिहार)'}
              </p>
              <p className="text-[10px] sm:text-[11px] font-bold text-[#14281D]">
                मो० नं० : 9431086933, 8409480911, 8789182989, 9015755799
              </p>
            </div>
          </div>

          {/* Title Banner - EXPLICITLY BOOKING SLIP */}
          <div className="mt-2 text-center">
            <div className="inline-block px-5 py-1 bg-[#14281D] text-[#F3E7C4] rounded-md font-bold text-xs sm:text-sm tracking-widest uppercase shadow-xs print:bg-[#14281D] print:text-[#F3E7C4]">
              BOOKING SLIP / सट्टा बुकिंग पर्ची
            </div>
            <div className="text-[9.5px] text-stone-500 font-medium tracking-wide mt-0.5">
              (सट्टा उत्सव आरक्षण एवं अग्रीम जमा रसीद • Official Booking Confirmation Voucher)
            </div>
          </div>
        </div>

        {/* =========================================================================
            2. CUSTOMER & EVENT PARTICULARS (2-Column Grid)
           ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          {/* Left: Customer Info */}
          <div className="p-2.5 rounded-lg border border-stone-200 bg-stone-50/70 space-y-1">
            <div className="text-[10px] font-bold text-[#8B6B23] uppercase tracking-wider pb-0.5 border-b border-stone-200">
              सट्टेदार / ग्राहक का विवरण (Patron Particulars)
            </div>
            <div className="flex items-baseline justify-between pt-0.5">
              <span className="text-stone-500 font-medium">नाम (Name):</span>
              <strong className="text-stone-900 text-xs">{customer?.name || '—'}</strong>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-stone-500 font-medium">मोबाइल (Mobile):</span>
              <span className="font-mono font-bold text-stone-900">
                {customer?.mobile ? `+91 ${customer.mobile}` : '—'}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-stone-500 font-medium">पता (Address):</span>
              <span className="text-stone-800 text-right truncate max-w-[180px]">
                {customer?.address || 'आरा, बिहार'}
              </span>
            </div>
            {customer?.customerCode && (
              <div className="flex items-baseline justify-between text-[10.5px]">
                <span className="text-stone-400">ग्राहक सं०:</span>
                <span className="font-mono text-stone-600">{customer.customerCode}</span>
              </div>
            )}
          </div>

          {/* Right: Event & Booking Details */}
          <div className="p-2.5 rounded-lg border border-stone-200 bg-stone-50/70 space-y-1">
            <div className="text-[10px] font-bold text-[#8B6B23] uppercase tracking-wider pb-0.5 border-b border-stone-200">
              उत्सव एवं स्थल विवरण (Event &amp; Venue Details)
            </div>
            <div className="flex items-baseline justify-between pt-0.5">
              <span className="text-stone-500 font-medium">उत्सव का प्रकार:</span>
              <strong className="text-[#14281D]">{eventType}</strong>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-stone-500 font-medium">उत्सव का दिनांक:</span>
              <span className="font-bold text-rose-800 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                {eventDate}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-stone-500 font-medium">समय / पाली (Shift):</span>
              <span className="text-stone-800 font-medium">{timings}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-stone-500 font-medium">आवंटित परिसर:</span>
              <strong className="text-stone-900">{hallName}</strong>
            </div>
            <div className="flex items-baseline justify-between text-[10.5px]">
              <span className="text-stone-500 font-medium">अतिथि संख्या:</span>
              <span className="font-semibold text-stone-800">{guestCount} व्यक्ति</span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            3. BOOKED SERVICES & PACKAGES
           ========================================================================= */}
        <div className="border border-stone-200 rounded-lg overflow-hidden text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#14281D] text-[#F3E7C4] text-[10px] font-bold uppercase tracking-wider">
                <th className="py-1.5 px-3">क्र०</th>
                <th className="py-1.5 px-3">शामिल सेवाएं / सुविधा विवरण (Services &amp; Facilities Booked)</th>
                <th className="py-1.5 px-3 text-center">मात्रा</th>
                <th className="py-1.5 px-3 text-right">दर (₹)</th>
                <th className="py-1.5 px-3 text-right">रकम (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 text-[11px]">
              {/* Hall booking line */}
              <tr className="bg-white">
                <td className="py-1.5 px-3 font-mono text-stone-500">1</td>
                <td className="py-1.5 px-3 font-semibold text-stone-900">
                  परिसर आरक्षण - {hallName} ({eventType})
                </td>
                <td className="py-1.5 px-3 text-center">1</td>
                <td className="py-1.5 px-3 text-right font-mono">
                  {booking.hallRentalPrice ? `₹${Number(booking.hallRentalPrice).toLocaleString('en-IN')}` : '—'}
                </td>
                <td className="py-1.5 px-3 text-right font-mono font-bold text-stone-900">
                  {booking.hallRentalPrice ? `₹${Number(booking.hallRentalPrice).toLocaleString('en-IN')}` : 'Included'}
                </td>
              </tr>

              {/* Dynamic services */}
              {parsedServices.length > 0 &&
                parsedServices.map((srv, idx) => (
                  <tr key={idx} className="bg-stone-50/50">
                    <td className="py-1.5 px-3 font-mono text-stone-500">{idx + 2}</td>
                    <td className="py-1.5 px-3 text-stone-800">{srv.name || srv.description}</td>
                    <td className="py-1.5 px-3 text-center font-mono">{srv.quantity || 1}</td>
                    <td className="py-1.5 px-3 text-right font-mono">
                      ₹{Number(srv.rate || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono font-bold text-stone-900">
                      ₹{Number(srv.amount || (srv.quantity || 1) * (srv.rate || 0)).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* =========================================================================
            4. FINANCIAL STATEMENT & ADVANCE RECONCILIATION
           ========================================================================= */}
        <div className="grid grid-cols-12 gap-3 items-stretch text-xs">
          {/* Left: Rupees in words */}
          <div className="col-span-7 p-2.5 rounded-lg border border-stone-200 bg-[#FAF8F5] flex flex-col justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[#8B6B23] uppercase tracking-wider block">
                कुल तय रकम (शब्दों में / Amount in Words):
              </span>
              <p className="font-serif font-bold text-[#14281D] text-xs leading-relaxed italic">
                {inWords}
              </p>
            </div>
            <div className="pt-2 mt-1 border-t border-stone-200 text-[10px] text-stone-600 flex items-center justify-between">
              <span>भुगतान माध्यम: <strong className="text-stone-900">{payMethod}</strong></span>
              <span className="text-emerald-700 font-semibold">✓ अग्रीम रसीद मान्य</span>
            </div>
          </div>

          {/* Right: Satta Ledger */}
          <div className="col-span-5 p-2.5 rounded-lg border-2 border-[#14281D] bg-stone-50 space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between text-stone-700">
              <span className="font-sans font-medium">कुल तय रकम (Total):</span>
              <span className="font-bold">₹{grandTotal.toLocaleString('en-IN')}</span>
            </div>

            {discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span className="font-sans">छूट (Discount):</span>
                <span>- ₹{discount.toLocaleString('en-IN')}</span>
              </div>
            )}

            <div className="flex justify-between py-1 border-y border-stone-300 font-bold text-emerald-800 bg-emerald-50/80 px-1 rounded">
              <span className="font-sans">अग्रीम जमा (Advance Paid):</span>
              <span>₹{paidAmount.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between font-bold text-rose-800 bg-rose-50/80 px-1 py-1 rounded border border-rose-200">
              <span className="font-sans">शेष बाकी रकम (Balance Due):</span>
              <span className="text-xs">₹{balanceAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            5. OFFICIAL 7 SATTA TERMS & CONDITIONS (सट्टा नियम व शर्तें)
           ========================================================================= */}
        <div className="p-2.5 sm:p-3 rounded-lg border border-amber-300 bg-amber-50/70 text-stone-800 text-[10.5px]">
          <div className="flex items-center justify-between pb-1 mb-1 border-b border-amber-300/80 font-bold text-amber-950">
            <span className="flex items-center space-x-1.5 text-xs">
              <span>📜</span>
              <span>नोट :- (सट्टा नियम व शर्तें / Official Terms &amp; Conditions)</span>
            </span>
            <span className="text-[9.5px] font-normal text-amber-800">बंधन वाटिका, पकड़ीयावर, चन्दवाँ, आरा</span>
          </div>

          <ol className="list-decimal list-inside space-y-0.5 sm:space-y-1 text-[10px] sm:text-[10.5px] leading-snug font-medium text-stone-800">
            {OFFICIAL_SATTA_TERMS_HINDI.map((rule, idx) => (
              <li key={idx} className="pl-0.5">
                <span className="text-stone-900">{rule}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* =========================================================================
            6. SIGNATURE BLOCK
           ========================================================================= */}
        <div className="pt-2 flex justify-between items-end text-xs">
          <div className="text-center space-y-1">
            <div className="w-40 border-b border-stone-500 h-6 mb-1" />
            <div className="font-bold text-stone-900 text-xs">ह० सट्टेदार</div>
            <div className="text-[9.5px] text-stone-500">(Patron / Customer Signature)</div>
          </div>

          <div className="text-center space-y-1">
            <div className="w-44 border-b border-stone-500 h-6 mb-1" />
            <div className="font-bold text-[#14281D] text-xs uppercase tracking-wider">
              ह० प्रबंधक
            </div>
            <div className="text-[9.5px] text-stone-500">For Bandhan Vatika (Manager)</div>
          </div>
        </div>

        {/* Footer verification note */}
        <div className="pt-1.5 border-t border-dashed border-stone-300 flex justify-between items-center text-[9px] text-stone-400">
          <span>कंप्यूटर जनित सट्टा बुकिंग पर्ची • Bandhan Vatika Reservation Ledger</span>
          <span>प्रमाणन कोड: BV-SLIP-{bookingNumber.replace('BV-BKG-', '')}</span>
        </div>
      </div>
    </div>
  );
};
