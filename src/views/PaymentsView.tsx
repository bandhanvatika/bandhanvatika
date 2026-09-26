import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client.ts';
import { Payment, Customer, Booking, Invoice } from '../types/index.ts';
import { Modal } from '../components/Modal.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { PrintReceipt } from '../components/PrintReceipt.tsx';
import { printElement } from '../utils/print.ts';
import { CreditCard, Plus, RotateCcw, Printer, Eye, CheckCircle2, AlertCircle, Search, Filter } from 'lucide-react';

export interface PaymentsViewProps {
  searchQuery?: string;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({ searchQuery = '' }) => {
  const { hasRole } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState(searchQuery);
  const [filterMethod, setFilterMethod] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    if (searchQuery !== undefined) {
      setSearchTerm(searchQuery);
    }
  }, [searchQuery]);

  // Record Payment Modal
  const [showRecord, setShowRecord] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER'>('UPI');
  const [paymentType, setPaymentType] = useState<'ADVANCE' | 'PARTIAL' | 'FINAL'>('PARTIAL');
  const [transactionReference, setTransactionReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  // Reverse Modal
  const [reversalTarget, setReversalTarget] = useState<Payment | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [reversing, setReversing] = useState(false);
  const [reversalError, setReversalError] = useState<string | null>(null);

  // View Receipt Modal
  const [activeReceipt, setActiveReceipt] = useState<any | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  const fetchPayments = async () => {
    setLoading(true);
    const [pRes, cRes, bRes, iRes] = await Promise.all([
      apiRequest<any>('/payments?limit=100'),
      apiRequest<Customer[]>('/customers'),
      apiRequest<Booking[]>('/bookings'),
      apiRequest<Invoice[]>('/invoices'),
    ]);
    if (pRes.success && pRes.data) {
      const pList = Array.isArray(pRes.data) ? pRes.data : pRes.data.data || [];
      setPayments(pList);
    }
    if (cRes.success && cRes.data) {
      setCustomers(cRes.data);
      if (cRes.data.length > 0 && !customerId) setCustomerId(cRes.data[0].id);
    }
    if (bRes.success && bRes.data) setBookings(bRes.data);
    if (iRes.success && iRes.data) setInvoices(iRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleOpenReceipt = async (p: Payment) => {
    setLoadingReceipt(true);
    const res = await apiRequest<any>(`/payments/${p.id}/receipt`);
    setLoadingReceipt(false);
    if (res.success && res.data) {
      setActiveReceipt(res.data);
    } else {
      setActiveReceipt(p);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setRecordError(null);
    const res = await apiRequest('/payments', {
      method: 'POST',
      body: JSON.stringify({
        customerId,
        bookingId: bookingId || undefined,
        invoiceId: invoiceId || undefined,
        amount,
        paymentMethod,
        paymentType,
        paymentDate,
        transactionReference: transactionReference || undefined,
        notes: notes || undefined,
      }),
    });
    setSubmitting(false);
    if (res.success) {
      setShowRecord(false);
      setAmount('');
      setTransactionReference('');
      setNotes('');
      fetchPayments();
    } else {
      setRecordError(res.error?.message || 'Payment recording failed');
    }
  };

  const handleReversePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalTarget || !reversalReason.trim()) return;
    setReversing(true);
    setReversalError(null);
    const res = await apiRequest(`/payments/${reversalTarget.id}/reverse`, {
      method: 'POST',
      body: JSON.stringify({ reversalReason: reversalReason.trim() }),
    });
    setReversing(false);
    if (res.success) {
      setReversalTarget(null);
      setReversalReason('');
      fetchPayments();
    } else {
      setReversalError(res.error?.message || 'Reversal failed');
    }
  };

  // Filtered customer bookings and invoices
  const customerInvoices = invoices.filter(
    (inv) => inv.customerId === customerId && inv.status !== 'CANCELLED' && inv.status !== 'DRAFT'
  );
  const customerBookings = bookings.filter((b) => b.customerId === customerId && b.status !== 'CANCELLED');

  // Filter payments
  const filteredPayments = payments.filter((p) => {
    const matchesSearch =
      !searchTerm ||
      p.receiptNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.transactionReference?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesMethod = !filterMethod || p.paymentMethod === filterMethod;
    const matchesType = !filterType || p.paymentType === filterType;
    const matchesStatus =
      !filterStatus ||
      (filterStatus === 'ACTIVE' && !p.isReversed) ||
      (filterStatus === 'REVERSED' && p.isReversed);

    return matchesSearch && matchesMethod && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-stone-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold font-brand text-[#14281D]">Payment Ledger & Receipts</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Internal financial register for advance deposits, installments, and final balance settlements
          </p>
        </div>

        {hasRole(['OWNER', 'ACCOUNTANT', 'MANAGER']) && (
          <button
            onClick={() => {
              setRecordError(null);
              setShowRecord(true);
            }}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-[#14281D] hover:bg-[#1a3527] text-[#F3E7C4] text-xs font-bold rounded-xl transition-all shadow-xs"
          >
            <Plus className="w-4 h-4 text-[#C5A059]" />
            <span>Record Payment</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white border border-stone-200/80 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search by receipt #, customer, reference..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
          />
        </div>

        <select
          value={filterMethod}
          onChange={(e) => setFilterMethod(e.target.value)}
          className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
        >
          <option value="">All Payment Methods</option>
          <option value="UPI">UPI</option>
          <option value="CASH">Cash</option>
          <option value="CARD">Card</option>
          <option value="BANK_TRANSFER">Bank Transfer</option>
          <option value="CHEQUE">Cheque</option>
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
        >
          <option value="">All Payment Types</option>
          <option value="ADVANCE">Advance</option>
          <option value="PARTIAL">Partial</option>
          <option value="FINAL">Final Settlement</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Valid (Active)</option>
          <option value="REVERSED">Reversed</option>
        </select>
      </div>

      {/* Payments Table */}
      <div className="p-5 rounded-3xl bg-white border border-stone-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-stone-400 font-semibold">
            Loading payments ledger...
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="py-12 text-center text-xs text-stone-400 font-semibold">
            No payments match your filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Receipt #</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Mode</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Ref / Invoice</th>
                  <th className="py-3 px-3 text-right">Amount (₹)</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredPayments.map((p) => (
                  <tr
                    key={p.id}
                    className={`transition-colors ${
                      p.isReversed ? 'bg-rose-50/40 text-stone-400 opacity-80' : 'hover:bg-stone-50/80'
                    }`}
                  >
                    <td className="py-3.5 px-3 font-mono font-bold text-stone-900">
                      {p.receiptNumber}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-semibold text-stone-900">{p.customer?.name || 'Client'}</div>
                      <div className="text-[10px] text-stone-500 font-mono">{p.customer?.mobile}</div>
                    </td>
                    <td className="py-3.5 px-3 text-stone-600 whitespace-nowrap">{p.paymentDate}</td>
                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded-md bg-stone-100 font-bold text-[10px] text-stone-700">
                        {p.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          p.paymentType === 'ADVANCE'
                            ? 'bg-amber-100 text-amber-800'
                            : p.paymentType === 'FINAL'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {p.paymentType || 'PARTIAL'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-[11px] text-stone-600">
                      {p.invoice ? (
                        <span className="text-stone-900 font-semibold">{p.invoice.invoiceNumber}</span>
                      ) : p.transactionReference ? (
                        <span>{p.transactionReference}</span>
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-stone-900">
                      ₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      {p.isReversed ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                          Reversed
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                          Valid
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => handleOpenReceipt(p)}
                          className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
                          title="View & Print Receipt"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {!p.isReversed && hasRole(['OWNER', 'ACCOUNTANT']) && (
                          <button
                            onClick={() => {
                              setReversalTarget(p);
                              setReversalReason('');
                              setReversalError(null);
                            }}
                            className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Reverse Payment"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {showRecord && (
        <Modal
          isOpen={showRecord}
          onClose={() => setShowRecord(false)}
          title="Record Customer Payment"
          subtitle="Deposit receipt and invoice balance settlement"
          maxWidth="md"
        >
          <form onSubmit={handleRecordPayment} className="space-y-4">
            {recordError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{recordError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Customer *</label>
              <select
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  setInvoiceId('');
                  setBookingId('');
                }}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium outline-none"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.mobile}) — Outstanding: ₹{Number(c.outstandingAmount || 0).toLocaleString('en-IN')}
                  </option>
                ))}
              </select>
            </div>

            {customerInvoices.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Link to Invoice</label>
                <select
                  value={invoiceId}
                  onChange={(e) => {
                    const selId = e.target.value;
                    setInvoiceId(selId);
                    const inv = customerInvoices.find((i) => i.id === selId);
                    if (inv) {
                      setAmount(inv.balanceAmount);
                      if (inv.bookingId) setBookingId(inv.bookingId);
                    }
                  }}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
                >
                  <option value="">Direct / Booking Payment (No invoice)</option>
                  {customerInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      #{inv.invoiceNumber} - Total: ₹{Number(inv.grandTotal).toLocaleString('en-IN')} [Due: ₹{Number(inv.balanceAmount).toLocaleString('en-IN')}]
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!invoiceId && customerBookings.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Link to Booking</label>
                <select
                  value={bookingId}
                  onChange={(e) => {
                    setBookingId(e.target.value);
                    const b = customerBookings.find((item) => item.id === e.target.value);
                    if (b) setAmount(b.balanceAmount);
                  }}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
                >
                  <option value="">No linked booking</option>
                  {customerBookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      #{b.bookingNumber} - {b.eventType} ({b.eventDate}) [Balance: ₹{Number(b.balanceAmount).toLocaleString('en-IN')}]
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  placeholder="e.g. 50000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-emerald-700 outline-none focus:border-[#C5A059]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Payment Method *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold outline-none"
                >
                  <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                  <option value="CARD">Credit / Debit Card</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Payment Type</label>
                <select
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value as any)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
                >
                  <option value="ADVANCE">Advance Deposit</option>
                  <option value="PARTIAL">Partial Installment</option>
                  <option value="FINAL">Final Settlement</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Payment Date *</label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                Transaction Reference / UTR Number
              </label>
              <input
                type="text"
                placeholder="e.g. UTR-4123891024 or Cheque #102938"
                value={transactionReference}
                onChange={(e) => setTransactionReference(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Internal Notes</label>
              <input
                type="text"
                placeholder="Remarks or internal reference"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setShowRecord(false)}
                className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-[#14281D] hover:bg-[#1a3527] text-[#F3E7C4] text-xs font-bold shadow-xs"
              >
                {submitting ? 'Recording...' : 'Generate Receipt'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Reverse Payment Modal */}
      {reversalTarget && (
        <Modal
          isOpen={!!reversalTarget}
          onClose={() => setReversalTarget(null)}
          title={`Reverse Payment #${reversalTarget.receiptNumber}`}
          subtitle="Strict financial reversal with audit trail"
          maxWidth="md"
        >
          <form onSubmit={handleReversePayment} className="space-y-4">
            {reversalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{reversalError}</span>
              </div>
            )}

            <div className="p-3 rounded-xl bg-amber-50 text-amber-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                Reversing this payment of ₹{Number(reversalTarget.amount).toLocaleString('en-IN')} will restore the outstanding balance on linked documents.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                Mandatory Reversal Reason *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Reason for payment reversal (e.g. Cheque bounce, duplicate transaction, incorrect amount)..."
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setReversalTarget(null)}
                className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reversing}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs"
              >
                {reversing ? 'Reversing...' : 'Confirm Reversal'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* View Receipt Voucher Modal */}
      {activeReceipt && (
        <Modal
          isOpen={!!activeReceipt}
          onClose={() => setActiveReceipt(null)}
          title={`Receipt Voucher #${activeReceipt.receiptNumber || activeReceipt.receipt_number}`}
          subtitle="Official Money Receipt Voucher"
          maxWidth="3xl"
        >
          <div className="space-y-4">
            <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-stone-200 shadow-inner p-2 bg-stone-100">
              <PrintReceipt data={activeReceipt} showPreviewInUI={true} />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-stone-200 no-print">
              <button
                type="button"
                onClick={() => printElement('bandhan-print-receipt', `Receipt_${activeReceipt.receiptNumber || activeReceipt.receipt_number}`)}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#14281D] hover:bg-[#1a3527] text-[#F3E7C4] text-xs font-bold shadow-xs cursor-pointer transition-all"
              >
                <Printer className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Print Bill / Receipt</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveReceipt(null)}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold cursor-pointer transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
