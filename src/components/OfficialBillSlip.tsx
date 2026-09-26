import React from 'react';
import { BrandCrestImg } from './BrandLogo.tsx';
import { amountToIndianWords } from '../utils/numberToWords.ts';

export interface OfficialBillItem {
  id?: string;
  description: string;
  quantity?: number;
  rate: number | string;
  amount: number | string;
}

export interface OfficialBillProps {
  billNumber?: string | number;
  date?: string;
  billType?: string; // 'FOOD BILL' | 'TAX INVOICE' | 'HOTEL & BANQUET BILL'
  customerName?: string;
  customerAddress?: string;
  customerMobile?: string;
  customerGstin?: string;
  items?: OfficialBillItem[];
  subtotal?: number;
  discount?: number;
  taxPercent?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  grandTotal?: number;
  paidAmount?: number;
  balanceAmount?: number;
  notes?: string;
  showTerms?: boolean;
}

export const OFFICIAL_TERMS_HINDI = [
  'किसी कारण वश सट्टा रद्द होने पर अग्रीम राशी जब्त हो जायेगी',
  'उत्सव का दिनांक पुनः बदलने पर उपलब्धता देखी जायेगी',
  'तय कुल रकम का 30% अग्रीम के रूप में लिया जायेगा',
  'उत्सव की दिनांक से 5 दिन पहले कुल रकम का भुगतान करना होगा।',
  'उत्सव भवन के यत्र तत्र गंदगी फैलाने पर सफाई का खर्च सट्टेदार को देना होगा।',
  'किसी प्रकार का तोड़फोड़ या भारी नुकसान होने पर उसका वाजिब भुगतान सट्टेदार को करना होगा।',
  'उत्सव के दिन किसी भी विद्युत उपकरण के खराबी आने पर ठीक कराने का प्रयास किया जायेगा परन्तु नहीं होने पर उसकी जिम्मेदारी प्रबंधन पर नहीं होगी।',
];

export const OfficialBillSlip: React.FC<OfficialBillProps> = ({
  billNumber = '118',
  date = new Date().toLocaleDateString('en-GB'),
  billType = 'FOOD BILL',
  customerName = '',
  customerAddress = '',
  customerMobile = '',
  items = [],
  subtotal,
  discount = 0,
  taxPercent = 5,
  cgstAmount,
  sgstAmount,
  grandTotal,
  paidAmount,
  balanceAmount,
  showTerms = true,
}) => {
  // Normalize items
  const cleanItems: OfficialBillItem[] = items.length > 0 ? items : [
    { description: 'Banquet & Food Catering Services', rate: subtotal || grandTotal || 0, amount: subtotal || grandTotal || 0 }
  ];

  // Calculations
  const calculatedSubtotal = subtotal !== undefined
    ? Number(subtotal)
    : cleanItems.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  const taxableValue = Math.max(0, calculatedSubtotal - (Number(discount) || 0));
  const effectiveTaxPercent = Number(taxPercent || 0);
  const halfTaxRate = (effectiveTaxPercent / 2).toFixed(1);

  const calculatedCgst = cgstAmount !== undefined
    ? Number(cgstAmount)
    : (taxableValue * (effectiveTaxPercent / 200));

  const calculatedSgst = sgstAmount !== undefined
    ? Number(sgstAmount)
    : (taxableValue * (effectiveTaxPercent / 200));

  const calculatedGrandTotal = grandTotal !== undefined
    ? Number(grandTotal)
    : Math.round(taxableValue + calculatedCgst + calculatedSgst);

  const inWords = amountToIndianWords(calculatedGrandTotal);

  // Pad items so the bill maintains that classic receipt paper proportion while staying on 1 page
  const minimumRows = Math.max(3, cleanItems.length);
  const emptyRowsCount = Math.max(0, minimumRows - cleanItems.length);

  return (
    <div className="official-bill-wrapper font-sans text-stone-900 bg-white mx-auto print:m-0 print:p-0">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 8mm;
          }
          body {
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .official-bill-wrapper {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
          }
        }
      `}</style>

      {/* Main Red Slip Container with dashed/double outline */}
      <div className="border-[2.5px] border-[#B91C1C] rounded-lg p-3 sm:p-4 bg-white relative shadow-sm print:shadow-none">
        
        {/* =========================================================================
            HEADER: HOTEL | FOOD BILL | GSTIN + TITLE + ADDRESS + PHONE
           ========================================================================= */}
        <div className="border-b-[2px] border-[#B91C1C] pb-3">
          {/* Top line banner */}
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-black tracking-wider text-[#B91C1C] uppercase mb-1">
            <span className="tracking-widest">HOTEL</span>
            <span className="bg-[#B91C1C] text-white px-3 py-0.5 rounded font-black tracking-widest text-[11px] print:bg-[#B91C1C] print:text-white">
              {billType}
            </span>
            <span className="font-mono">GSTIN- 10CNXPSO100F2ZC</span>
          </div>

          {/* Main Title Row with circular emblem on left */}
          <div className="flex items-center justify-center gap-3 my-1">
            <BrandCrestImg className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-full border border-[#B91C1C]/40" />
            <div className="text-center">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-wider text-[#B91C1C] uppercase leading-none font-serif">
                BANDHAN VATICA
              </h1>
              <p className="text-[11px] sm:text-xs font-bold text-[#B91C1C] tracking-wide mt-1 uppercase">
                PAKARIYABAR, CHANDWA, ARA
              </p>
              <p className="text-[11px] sm:text-xs font-bold text-[#B91C1C] tracking-tight">
                Mob.- 9431086933, 8789182989
              </p>
            </div>
          </div>
        </div>

        {/* =========================================================================
            CLIENT & BILL NUMBER INFO (Dotted Lines in authentic receipt style)
           ========================================================================= */}
        <div className="pt-3 pb-2 text-xs sm:text-sm">
          <div className="grid grid-cols-12 gap-2 items-start">
            {/* Left Column: Customer details */}
            <div className="col-span-8 space-y-1.5 text-[#B91C1C] font-semibold">
              {/* Name */}
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold shrink-0">Name</span>
                <div className="grow border-b border-dotted border-[#B91C1C] text-blue-900 font-bold px-1.5 font-sans truncate">
                  {customerName || <span className="opacity-0">.</span>}
                </div>
              </div>

              {/* Address */}
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold shrink-0">Address</span>
                <div className="grow border-b border-dotted border-[#B91C1C] text-blue-900 font-medium px-1.5 font-sans truncate">
                  {customerAddress || <span className="opacity-0">.</span>}
                </div>
              </div>

              {/* Mobile */}
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold shrink-0">Mob.</span>
                <div className="grow border-b border-dotted border-[#B91C1C] text-blue-900 font-bold px-1.5 font-mono truncate">
                  {customerMobile ? `+91 ${customerMobile}` : <span className="opacity-0">.</span>}
                </div>
              </div>
            </div>

            {/* Right Column: Bill No. & Date */}
            <div className="col-span-4 flex flex-col items-end space-y-1.5">
              {/* Bill No Box */}
              <div className="border-[1.5px] border-[#B91C1C] rounded px-3 py-1 bg-red-50/30 text-center w-full max-w-[150px]">
                <div className="text-[10px] uppercase font-bold text-[#B91C1C] leading-tight">Bill No.</div>
                <div className="text-base sm:text-lg font-black text-blue-900 font-mono tracking-wide leading-tight">
                  {billNumber}
                </div>
              </div>

              {/* Date */}
              <div className="flex items-baseline gap-1 text-[#B91C1C] font-bold text-xs w-full max-w-[150px] justify-between">
                <span>Date.</span>
                <span className="border-b border-dotted border-[#B91C1C] text-blue-900 font-bold px-1 font-mono grow text-right">
                  {date}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            PARTICULARS TABLE: Sl. | PARTICULARS | Rate | Amount
           ========================================================================= */}
        <div className="mt-2 border-[1.5px] border-[#B91C1C] rounded overflow-hidden">
          <table className="w-full border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b-[1.5px] border-[#B91C1C] text-[#B91C1C] font-black uppercase text-[11px] sm:text-xs">
                <th className="py-1.5 px-2 border-r-[1.5px] border-[#B91C1C] w-[8%] text-center">
                  SI.
                </th>
                <th className="py-1.5 px-3 border-r-[1.5px] border-[#B91C1C] w-[54%] text-center">
                  PARTICULARS
                </th>
                <th className="py-1.5 px-2 border-r-[1.5px] border-[#B91C1C] w-[18%] text-center">
                  Rate
                </th>
                <th className="py-1.5 px-2 w-[20%] text-center">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Actual line items */}
              {cleanItems.map((item, idx) => (
                <tr key={idx} className="border-b border-red-200/60 leading-relaxed">
                  <td className="py-1.5 px-2 border-r-[1.5px] border-[#B91C1C] text-center font-mono text-blue-900 font-bold align-top">
                    {idx + 1}
                  </td>
                  <td className="py-1.5 px-3 border-r-[1.5px] border-[#B91C1C] text-blue-950 font-semibold align-top whitespace-pre-line">
                    {item.description}
                    {item.quantity && item.quantity > 1 && (
                      <span className="text-[11px] text-stone-600 block">
                        Qty: {item.quantity}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 px-2 border-r-[1.5px] border-[#B91C1C] text-right font-mono text-blue-900 font-medium align-top">
                    {Number(item.rate) > 0 ? Number(item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono font-bold text-blue-950 align-top">
                    {Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}

              {/* Empty padding rows to preserve authentic height & vertical red dividers */}
              {Array.from({ length: emptyRowsCount }).map((_, i) => (
                <tr key={`empty-${i}`} className="h-6">
                  <td className="border-r-[1.5px] border-[#B91C1C] text-center">&nbsp;</td>
                  <td className="border-r-[1.5px] border-[#B91C1C]">&nbsp;</td>
                  <td className="border-r-[1.5px] border-[#B91C1C] text-right">&nbsp;</td>
                  <td className="text-right">&nbsp;</td>
                </tr>
              ))}

              {/* Total rows with red borders */}
              <tr className="border-t-[1.5px] border-[#B91C1C]">
                {/* Left cell with VISIT AGAIN stamp */}
                <td colSpan={2} rowSpan={4} className="border-r-[1.5px] border-[#B91C1C] p-3 text-center align-middle relative bg-red-50/20">
                  <div className="inline-block transform -rotate-12 border-2 border-dashed border-[#B91C1C] px-4 py-1.5 rounded-md">
                    <span className="text-base sm:text-lg font-black text-[#B91C1C] tracking-widest uppercase">
                      VISIT AGAIN
                    </span>
                  </div>
                </td>
                <td className="py-1 px-2 border-r-[1.5px] border-[#B91C1C] font-bold text-[#B91C1C] text-right text-xs uppercase">
                  TOTAL
                </td>
                <td className="py-1 px-2 text-right font-mono font-bold text-blue-900 text-xs">
                  {calculatedSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>

              <tr className="border-t border-red-300">
                <td className="py-1 px-2 border-r-[1.5px] border-[#B91C1C] font-semibold text-[#B91C1C] text-right text-xs">
                  SGST.......@{halfTaxRate}%
                </td>
                <td className="py-1 px-2 text-right font-mono font-bold text-blue-900 text-xs">
                  {calculatedSgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>

              <tr className="border-t border-red-300">
                <td className="py-1 px-2 border-r-[1.5px] border-[#B91C1C] font-semibold text-[#B91C1C] text-right text-xs">
                  CGST.......@{halfTaxRate}%
                </td>
                <td className="py-1 px-2 text-right font-mono font-bold text-blue-900 text-xs">
                  {calculatedCgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>

              <tr className="border-t-[1.5px] border-[#B91C1C] bg-red-50/30">
                <td className="py-1 px-2 border-r-[1.5px] border-[#B91C1C] font-black text-[#B91C1C] text-right text-xs uppercase">
                  G. TOTAL
                </td>
                <td className="py-1 px-2 text-right font-mono font-black text-blue-950 text-xs sm:text-sm">
                  {calculatedGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>

              {paidAmount !== undefined && Number(paidAmount) > 0 && (
                <tr className="border-t border-red-300">
                  <td className="py-0.5 px-2 border-r-[1.5px] border-[#B91C1C] font-bold text-emerald-800 text-right text-[11px]">
                    Paid / Received
                  </td>
                  <td className="py-0.5 px-2 text-right font-mono font-bold text-emerald-800 text-xs">
                    ₹{Number(paidAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              )}

              {balanceAmount !== undefined && Number(balanceAmount) > 0 && (
                <tr className="border-t border-red-300 bg-amber-50/40">
                  <td className="py-0.5 px-2 border-r-[1.5px] border-[#B91C1C] font-bold text-amber-900 text-right text-[11px]">
                    Balance Due
                  </td>
                  <td className="py-0.5 px-2 text-right font-mono font-bold text-amber-900 text-xs">
                    ₹{Number(balanceAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* =========================================================================
            FOOTER: Rupees in words + Thanking You + E.&O.E. + For : BANDHAN VATICA
           ========================================================================= */}
        <div className="mt-2 pt-1 text-xs text-[#B91C1C]">
          {/* Rupees In Words */}
          <div className="flex items-baseline gap-1">
            <span className="font-bold shrink-0">Rupees</span>
            <div className="grow border-b border-dotted border-[#B91C1C] text-blue-900 font-bold italic px-2 font-serif text-[11px] sm:text-xs">
              {inWords.replace('Rupees ', '').replace(' Only', '')}
            </div>
            <span className="font-bold shrink-0">Only</span>
            <span className="font-bold ml-4 tracking-wide text-xs">Thanking You</span>
          </div>

          {/* Bottom signatures */}
          <div className="flex justify-between items-end mt-3 pt-1">
            <div className="text-[10px] font-black tracking-wider text-[#B91C1C]">
              E.&amp;O.E.
            </div>
            <div className="text-right">
              <div className="h-5 border-b border-dotted border-[#B91C1C] w-44 mb-0.5" />
              <div className="font-bold text-[11px] uppercase tracking-wider text-[#B91C1C]">
                For : BANDHAN VATICA
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* =========================================================================
          OFFICIAL TERMS & CONDITIONS (हस्तलिखित 7 नियम व शर्तें)
         ========================================================================= */}
      {showTerms && (
        <div className="mt-2.5 p-3 border-[1.5px] border-stone-400 rounded-lg bg-stone-50/70 text-stone-800 text-xs">
          <div className="font-bold text-stone-900 text-xs pb-1 mb-1.5 border-b border-stone-300 flex items-center justify-between">
            <span>नोट :- (नियम व शर्तें / Terms &amp; Conditions)</span>
            <span className="text-[10px] font-normal text-stone-500">बंधन वाटिका, पकड़ीयावर, चन्दवाँ, आरा</span>
          </div>

          <ol className="list-decimal list-inside space-y-0.5 text-[10.5px] sm:text-[11px] leading-snug font-medium text-stone-800">
            {OFFICIAL_TERMS_HINDI.map((rule, idx) => (
              <li key={idx} className="pl-0.5">
                <span className="text-stone-900">{rule}</span>
              </li>
            ))}
          </ol>

          {/* Signatures at bottom of terms */}
          <div className="mt-3 pt-2 border-t border-dashed border-stone-300 flex justify-between items-end text-xs">
            <div className="text-center">
              <div className="h-5 border-b border-stone-500 w-36 mb-0.5" />
              <div className="font-bold text-stone-800 text-[11px]">ह० सट्टेदार</div>
              <div className="text-[9px] text-stone-500">(Customer Signature)</div>
            </div>

            <div className="text-center">
              <div className="h-5 border-b border-stone-500 w-36 mb-0.5" />
              <div className="font-bold text-stone-800 text-[11px]">ह० प्रबंधक</div>
              <div className="text-[9px] text-stone-500">For Bandhan Vatika</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
