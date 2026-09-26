import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client.ts';
import { Invoice, Customer, Booking, Settings } from '../types/index.ts';
import { Modal } from '../components/Modal.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { PrintReceipt, PrintReceiptData } from '../components/PrintReceipt.tsx';
import { printElement } from '../utils/print.ts';
import { BrandLogo } from '../components/BrandLogo.tsx';
import { OfficialBillSlip } from '../components/OfficialBillSlip.tsx';
import {
  ReceiptText,
  Plus,
  Printer,
  Eye,
  Sparkles,
  Building,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  Trash2,
  Send,
  Calendar,
  AlertCircle,
} from 'lucide-react';

interface InvoicesViewProps {
  onOpenPaymentForInvoice?: (invoice: Invoice) => void;
  searchQuery?: string;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({ onOpenPaymentForInvoice, searchQuery = '' }) => {
  const { hasRole } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState(searchQuery);
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    if (searchQuery !== undefined) {
      setSearch(searchQuery);
    }
  }, [searchQuery]);

  // View / Print Modal
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [billFormat, setBillFormat] = useState<'RED_BOOKLET' | 'STANDARD_TAX'>('RED_BOOKLET');
  const [printReceiptData, setPrintReceiptData] = useState<PrintReceiptData | null>(null);

  // Cancel Modal
  const [cancellingInvoice, setCancellingInvoice] = useState<Invoice | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // New Invoice Modal
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState<'MANUAL' | 'FROM_BOOKING'>('MANUAL');
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [eventType, setEventType] = useState('Wedding / Reception');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0]);
  const [items, setItems] = useState([
    { description: 'Hall Rental - Grand Royal Banquet', quantity: 1, rate: 200000, amount: 200000 },
    { description: 'Deluxe AC Guest Rooms (2 Nights)', quantity: 2, rate: 3500, amount: 7000 },
  ]);
  const [discount, setDiscount] = useState(0);
  const [taxPercent, setTaxPercent] = useState(5);
  const [initialStatus, setInitialStatus] = useState<'ISSUED' | 'DRAFT'>('ISSUED');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleApplyJeevikaTemplate = () => {
    const jeevikaCust = customers.find(
      (c) => c.name.toLowerCase().includes('jeevika') || c.customerCode?.toLowerCase().includes('jeevika')
    );
    if (jeevikaCust) {
      setCustomerId(jeevikaCust.id);
    }
    setEventType('Jeevika Staff Training (Food Program)');
    setTaxPercent(5);
    setDiscount(0);
    setItems([
      {
        description: '2-Day Staff Training (35 Persons x 2 Days = 70 Plates: Breakfast + Lunch + Dinner)',
        quantity: 70,
        rate: 514.29,
        amount: 36000,
      },
    ]);
    setNotes('Hall allocated complimentary for Jeevika Training program. Billing exclusively for food/catering with 5% GST.');
  };

  const fetchInvoices = async () => {
    setLoading(true);
    const query = new URLSearchParams();
    if (search.trim()) query.set('search', search.trim());
    if (statusFilter !== 'ALL') query.set('status', statusFilter);

    const [invRes, custRes, bkgRes, setRes] = await Promise.all([
      apiRequest<any>(`/invoices?${query.toString()}`),
      apiRequest<Customer[]>('/customers'),
      apiRequest<Booking[]>('/bookings'),
      apiRequest<Settings>('/settings'),
    ]);

    if (invRes.success && invRes.data) {
      setInvoices(Array.isArray(invRes.data) ? invRes.data : invRes.data.data || []);
    }
    if (custRes.success && custRes.data) {
      setCustomers(custRes.data);
      if (custRes.data.length > 0 && !customerId) setCustomerId(custRes.data[0].id);
    }
    if (bkgRes.success && bkgRes.data) {
      setBookings(bkgRes.data.filter((b) => b.status !== 'CANCELLED'));
    }
    if (setRes.success && setRes.data) setSettings(setRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchInvoices();
  }, [search, statusFilter]);

  const handleAddItem = () => {
    setItems([...items, { description: '', quantity: 1, rate: 0, amount: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, idx) => idx !== index));
    }
  };

  const handleItemChange = (index: number, field: string, val: any) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: val };
    const q = Number(item.quantity) || 0;
    const r = Number(item.rate) || 0;
    item.amount = parseFloat((q * r).toFixed(2));
    updated[index] = item;
    setItems(updated);
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (createMode === 'FROM_BOOKING') {
      if (!selectedBookingId) {
        setErrorMsg('Please select a booking.');
        return;
      }
      const res = await apiRequest(`/invoices/from-booking/${selectedBookingId}`, {
        method: 'POST',
      });
      if (res.success) {
        setShowCreate(false);
        fetchInvoices();
      } else {
        setErrorMsg(res.error?.message || 'Failed to generate invoice from booking.');
      }
      return;
    }

    const res = await apiRequest('/invoices', {
      method: 'POST',
      body: JSON.stringify({
        customerId,
        eventType,
        eventDate,
        dueDate,
        items,
        discount,
        taxPercent,
        notes,
        status: initialStatus,
      }),
    });

    if (res.success) {
      setShowCreate(false);
      fetchInvoices();
      if (res.data) {
        const cust = customers.find((c) => c.id === res.data.customerId);
        setActiveInvoice({ ...res.data, customer: cust });
      }
    } else {
      setErrorMsg(res.error?.message || 'Failed to create invoice.');
    }
  };

  const handleIssueDraft = async (invoiceId: string) => {
    if (!confirm('Are you sure you want to issue this invoice? Issued invoices are immutable.')) return;
    const res = await apiRequest(`/invoices/${invoiceId}/issue`, { method: 'POST' });
    if (res.success) {
      fetchInvoices();
    } else {
      alert(res.error?.message || 'Failed to issue invoice.');
    }
  };

  const handleCancelInvoice = async () => {
    if (!cancellingInvoice) return;
    const res = await apiRequest(`/invoices/${cancellingInvoice.id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: cancelReason }),
    });
    if (res.success) {
      setCancellingInvoice(null);
      setCancelReason('');
      fetchInvoices();
    } else {
      alert(res.error?.message || 'Failed to cancel invoice.');
    }
  };

  const handlePrint = () => {
    printElement('printable-invoice', `Invoice_${activeInvoice?.invoiceNumber || 'BV-INV'}`);
  };

  const handlePrintReceipt = (inv: Invoice) => {
    const bkg = bookings.find((b) => b.id === inv.bookingId);
    const recNum = `BV-REC-${inv.invoiceNumber}`;
    const data: PrintReceiptData = {
      receiptNumber: recNum,
      paymentDate: new Date().toISOString().split('T')[0],
      amount: inv.paidAmount || 0,
      paymentMethod: bkg?.payments?.[0]?.paymentMethod || 'BANK_TRANSFER',
      paymentType: Number(inv.balanceAmount) === 0 ? 'FINAL' : 'PARTIAL',
      transactionReference: bkg?.payments?.[0]?.transactionReference || null,
      notes: inv.notes,
      receivedBy: 'Bandhan Vatika Accounts',
      customer: inv.customer || bkg?.customer,
      booking: bkg,
      invoice: inv,
      paymentHistory: bkg?.payments || [],
      invoiceTotal: inv.grandTotal,
      balanceAfterPayment: inv.balanceAmount,
    };
    setPrintReceiptData(data);
    setTimeout(() => {
      printElement('bandhan-print-receipt', `Receipt_${recNum}`);
    }, 350);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-stone-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold font-brand text-[#14281D]">Tax Invoices & Billing</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            GST-compliant tax invoices, immutable snapshots, and printable vouchers
          </p>
        </div>

        {hasRole(['OWNER', 'ACCOUNTANT', 'MANAGER']) && (
          <button
            onClick={() => {
              setErrorMsg('');
              setShowCreate(true);
            }}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-[#14281D] hover:bg-[#1a3527] text-[#F3E7C4] text-xs font-bold rounded-xl transition-all shadow-xs"
          >
            <Plus className="w-4 h-4 text-[#C5A059]" />
            <span>Generate Invoice</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 p-4 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by invoice number, customer name, mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#14281D]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-stone-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-2 px-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold outline-none focus:border-[#14281D]"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">DRAFT</option>
            <option value="ISSUED">ISSUED</option>
            <option value="PARTIAL">PARTIAL</option>
            <option value="PAID">PAID</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="p-5 rounded-3xl bg-white border border-stone-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-stone-400 font-semibold">
            Loading invoices...
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-12 text-center text-xs text-stone-400 font-semibold">
            No invoices found matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Invoice #</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Invoice Date</th>
                  <th className="py-3 px-3">Event Date</th>
                  <th className="py-3 px-3 text-right">Grand Total (₹)</th>
                  <th className="py-3 px-3 text-right">Balance Due (₹)</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="py-3.5 px-3 font-mono font-bold text-stone-900">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-stone-900">{inv.customer?.name || (inv as any).parsedSnapshot?.customerName || 'Customer'}</div>
                      <div className="text-[11px] text-stone-400">{inv.customer?.mobile || (inv as any).parsedSnapshot?.customerMobile || ''}</div>
                    </td>
                    <td className="py-3.5 px-3 text-stone-600 font-mono text-[11px]">
                      {inv.invoiceDate || inv.createdAt?.split('T')[0]}
                    </td>
                    <td className="py-3.5 px-3 text-stone-600 font-mono text-[11px]">
                      {inv.eventDate}
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-stone-900">
                      ₹{Number(inv.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold">
                      {Number(inv.balanceAmount) === 0 ? (
                        <span className="text-emerald-600">₹0.00</span>
                      ) : (
                        <span className="text-amber-700">₹{Number(inv.balanceAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          inv.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : inv.status === 'PARTIAL'
                            ? 'bg-amber-100 text-amber-800'
                            : inv.status === 'ISSUED'
                            ? 'bg-blue-100 text-blue-800'
                            : inv.status === 'CANCELLED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right space-x-1 whitespace-nowrap">
                      {/* Print Payment Receipt */}
                      {Number(inv.paidAmount) > 0 && (
                        <button
                          onClick={() => handlePrintReceipt(inv)}
                          className="p-1.5 rounded-lg text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50"
                          title="Print Payment Receipt Voucher (A4)"
                        >
                          <ReceiptText className="w-4 h-4" />
                        </button>
                      )}

                      {/* View / Print button */}
                      <button
                        onClick={() => setActiveInvoice(inv)}
                        className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                        title="View / Print Tax Invoice"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Issue Draft button */}
                      {inv.status === 'DRAFT' && hasRole(['OWNER', 'ACCOUNTANT', 'MANAGER']) && (
                        <button
                          onClick={() => handleIssueDraft(inv.id)}
                          className="p-1.5 rounded-lg text-blue-600 hover:text-blue-900 hover:bg-blue-50"
                          title="Issue Invoice"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}

                      {/* Cancel button */}
                      {(inv.status === 'ISSUED' || inv.status === 'DRAFT') && hasRole(['OWNER', 'ACCOUNTANT', 'MANAGER']) && (
                        <button
                          onClick={() => setCancellingInvoice(inv)}
                          className="p-1.5 rounded-lg text-rose-600 hover:text-rose-900 hover:bg-rose-50"
                          title="Cancel Invoice"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* High-Fidelity Tax Invoice Print Modal */}
      {activeInvoice && (
        <Modal
          isOpen={!!activeInvoice}
          onClose={() => setActiveInvoice(null)}
          title={`Bandhan Vatika Official Bill #${activeInvoice.invoiceNumber}`}
          subtitle="Official Bandhan Vatika Bill / Invoice"
          maxWidth="4xl"
        >
          <div className="space-y-4">
            {/* Format Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between no-print bg-stone-100 p-2 rounded-xl gap-2">
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => setBillFormat('RED_BOOKLET')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    billFormat === 'RED_BOOKLET'
                      ? 'bg-[#B91C1C] text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <span>🔴</span>
                  <span>Official Bill (Booklet Format)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBillFormat('STANDARD_TAX')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    billFormat === 'STANDARD_TAX'
                      ? 'bg-[#14281D] text-[#F3E7C4] shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <span>📄</span>
                  <span>Standard A4 Tax Invoice</span>
                </button>
              </div>
              <span className="text-[11px] text-stone-500">
                {billFormat === 'RED_BOOKLET' ? '🔴 Exact physical red printed voucher' : 'Corporate multi-column format'}
              </span>
            </div>

            <div
              id="printable-invoice"
              className="bg-white p-2 sm:p-4 rounded-xl text-stone-900 font-sans"
            >
              {billFormat === 'RED_BOOKLET' ? (
                <OfficialBillSlip
                  billNumber={activeInvoice.invoiceNumber?.replace('BV-INV-', '') || activeInvoice.invoiceNumber}
                  date={
                    activeInvoice.invoiceDate
                      ? new Date(activeInvoice.invoiceDate).toLocaleDateString('en-GB')
                      : activeInvoice.createdAt
                      ? new Date(activeInvoice.createdAt).toLocaleDateString('en-GB')
                      : new Date().toLocaleDateString('en-GB')
                  }
                  billType="FOOD BILL"
                  customerName={(activeInvoice as any).parsedSnapshot?.customerName || activeInvoice.customer?.name || ''}
                  customerAddress={(activeInvoice as any).parsedSnapshot?.customerAddress || activeInvoice.customer?.address || 'Pakariyabar, Chandwa, Ara'}
                  customerMobile={(activeInvoice as any).parsedSnapshot?.customerMobile || activeInvoice.customer?.mobile || ''}
                  customerGstin={(activeInvoice as any).parsedSnapshot?.customerGstin || (activeInvoice.customer as any)?.gstin || ''}
                  items={
                    Array.isArray((activeInvoice as any).parsedItems || JSON.parse(activeInvoice.items || '[]'))
                      ? ((activeInvoice as any).parsedItems || JSON.parse(activeInvoice.items || '[]')).map((it: any) => ({
                          description: it.description || 'Service',
                          quantity: it.quantity || it.qty || 1,
                          rate: Number(it.rate || 0),
                          amount: Number(it.amount || 0),
                        }))
                      : []
                  }
                  subtotal={Number(activeInvoice.subtotal || 0)}
                  discount={Number(activeInvoice.discount || 0)}
                  taxPercent={Number(activeInvoice.taxPercent || 0)}
                  cgstAmount={Number(activeInvoice.cgstAmount || (Number(activeInvoice.taxAmount || 0) / 2))}
                  sgstAmount={Number(activeInvoice.sgstAmount || (Number(activeInvoice.taxAmount || 0) / 2))}
                  grandTotal={Number(activeInvoice.grandTotal || 0)}
                  paidAmount={Number(activeInvoice.paidAmount || 0)}
                  balanceAmount={Number(activeInvoice.balanceAmount || 0)}
                  notes={activeInvoice.notes || undefined}
                  showTerms={true}
                />
              ) : (
                <div className="bg-white p-6 sm:p-10 rounded-2xl border border-stone-200 text-stone-900 font-sans shadow-xs">
                  {/* Header: Company & Title */}
                  <div className="flex flex-col sm:flex-row justify-between items-start pb-6 border-b-2 border-stone-800 gap-4">
                    <div className="space-y-1">
                      <div className="text-[11px] font-bold text-[#8B6B23] tracking-widest uppercase">
                        ॥ श्री गणेशाय नमः ॥
                      </div>
                      <BrandLogo variant="print" />
                      <p className="text-xs text-stone-700 max-w-sm pt-1 font-medium leading-relaxed">
                        {(activeInvoice as any).parsedSnapshot?.address || settings?.address || 'पकड़ीयावर, चन्दवाँ, आरा (बिहार)'}
                      </p>
                      <p className="text-xs font-bold text-stone-800">
                        मो० नं० (Mob.) : 9431086933, 8789182989
                      </p>
                      <p className="text-xs font-mono font-bold text-[#14281D]">
                        GSTIN: {(activeInvoice as any).parsedSnapshot?.gstin || settings?.gstin || '10CNXPSO100F2ZC'}
                      </p>
                    </div>

                    <div className="text-right sm:self-start">
                      <div className="inline-block px-3 py-1 rounded bg-[#14281D] text-[#F3E7C4] text-xs font-bold uppercase tracking-widest mb-2">
                        Tax Invoice
                      </div>
                      <div className="text-sm font-bold font-mono text-stone-900">{activeInvoice.invoiceNumber}</div>
                      <div className="text-xs text-stone-500 mt-1">
                        Invoice Date: <span className="font-semibold text-stone-800">{activeInvoice.invoiceDate || activeInvoice.createdAt?.split('T')[0]}</span>
                      </div>
                      <div className="text-xs text-stone-500">
                        Event Date: <span className="font-semibold text-stone-800">{activeInvoice.eventDate}</span>
                      </div>
                      {activeInvoice.dueDate && (
                        <div className="text-xs text-stone-500">
                          Payment Due: <span className="font-semibold text-stone-800">{activeInvoice.dueDate}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Billed To Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-b border-stone-200 text-xs">
                    <div>
                      <span className="font-bold text-stone-400 uppercase tracking-wider text-[10px]">
                        Billed To (Customer):
                      </span>
                      <h4 className="text-sm font-bold text-stone-900 mt-0.5">
                        {(activeInvoice as any).parsedSnapshot?.customerName || activeInvoice.customer?.name || 'Valued Guest'}
                      </h4>
                      <p className="text-stone-600 mt-0.5">
                        {(activeInvoice as any).parsedSnapshot?.customerMobile || activeInvoice.customer?.mobile}
                      </p>
                      <p className="text-stone-500">
                        {(activeInvoice as any).parsedSnapshot?.customerAddress || activeInvoice.customer?.address || 'Ara, Bihar'}
                      </p>
                      <p className="text-stone-500 font-mono text-[11px] mt-0.5">
                        GSTIN: {(activeInvoice as any).parsedSnapshot?.customerGstin || (activeInvoice.customer as any)?.gstin || 'URP (Unregistered)'}
                      </p>
                    </div>

                    <div className="sm:text-right">
                      <span className="font-bold text-stone-400 uppercase tracking-wider text-[10px]">
                        Document Status:
                      </span>
                      <div className="mt-1">
                        <span
                          className={`inline-flex px-3 py-1 rounded-md text-xs font-black uppercase tracking-wider ${
                            activeInvoice.status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : activeInvoice.status === 'PARTIAL'
                              ? 'bg-amber-100 text-amber-800'
                              : activeInvoice.status === 'ISSUED'
                              ? 'bg-blue-100 text-blue-800'
                              : activeInvoice.status === 'CANCELLED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-stone-100 text-stone-800'
                          }`}
                        >
                          {activeInvoice.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div className="py-4">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b-2 border-stone-300 text-stone-600 font-bold uppercase text-[10px] tracking-wider">
                          <th className="py-2.5 px-2">#</th>
                          <th className="py-2.5 px-2">Particulars / Service Description</th>
                          <th className="py-2.5 px-2 text-center">Qty</th>
                          <th className="py-2.5 px-2 text-right">Rate (₹)</th>
                          <th className="py-2.5 px-2 text-right">Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200">
                        {((activeInvoice as any).parsedItems || JSON.parse(activeInvoice.items || '[]')).map((it: any, idx: number) => (
                          <tr key={idx}>
                            <td className="py-3 px-2 font-mono text-stone-400">{idx + 1}</td>
                            <td className="py-3 px-2 font-semibold text-stone-800">{it.description}</td>
                            <td className="py-3 px-2 text-center">{it.quantity || it.qty || 1}</td>
                            <td className="py-3 px-2 text-right font-mono">
                              ₹{Number(it.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-2 text-right font-bold font-mono text-stone-900">
                              ₹{Number(it.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Total Calculation & Bank Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 pt-4 border-t-2 border-stone-200 text-xs">
                    {/* Bank Account Info */}
                    <div className="sm:col-span-6 p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-1.5">
                      <div className="font-bold text-stone-800 uppercase tracking-wider text-[10px] flex items-center space-x-1">
                        <Building className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>Bank Transfer Details (NEFT/RTGS)</span>
                      </div>
                      <div className="text-stone-700">
                        <span className="text-stone-400">Bank:</span> {(activeInvoice as any).parsedSnapshot?.bankName || settings?.bankName || 'State Bank of India'}
                      </div>
                      <div className="text-stone-700">
                        <span className="text-stone-400">Account No:</span>{' '}
                        <span className="font-mono font-bold">{(activeInvoice as any).parsedSnapshot?.accountNumber || settings?.accountNumber || '50200012345678'}</span>
                      </div>
                      <div className="text-stone-700">
                        <span className="text-stone-400">IFSC Code:</span>{' '}
                        <span className="font-mono font-bold">{(activeInvoice as any).parsedSnapshot?.ifscCode || settings?.ifscCode || 'SBIN0001234'}</span>
                      </div>
                    </div>

                    {/* Subtotals & Balances */}
                    <div className="sm:col-span-6 space-y-1.5">
                      <div className="flex justify-between text-stone-600">
                        <span>Subtotal:</span>
                        <span className="font-mono font-semibold">₹{Number(activeInvoice.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      {Number(activeInvoice.discount) > 0 && (
                        <div className="flex justify-between text-emerald-700">
                          <span>Discount:</span>
                          <span className="font-mono font-semibold">- ₹{Number(activeInvoice.discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-stone-600">
                        <span>Taxable Value:</span>
                        <span className="font-mono font-semibold">
                          ₹{(Number(activeInvoice.subtotal) - Number(activeInvoice.discount)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-stone-500 text-[11px]">
                        <span>CGST ({(Number(activeInvoice.taxPercent) / 2).toFixed(1)}%):</span>
                        <span className="font-mono">₹{Number(activeInvoice.cgstAmount || (Number(activeInvoice.taxAmount) / 2).toFixed(2)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-stone-500 text-[11px]">
                        <span>SGST ({(Number(activeInvoice.taxPercent) / 2).toFixed(1)}%):</span>
                        <span className="font-mono">₹{Number(activeInvoice.sgstAmount || (Number(activeInvoice.taxAmount) / 2).toFixed(2)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-base font-black text-[#14281D] py-2 border-y-2 border-stone-800 font-brand">
                        <span>Grand Total:</span>
                        <span className="font-mono">₹{Number(activeInvoice.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>Total Paid:</span>
                        <span className="font-mono">₹{Number(activeInvoice.paidAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-amber-700 font-black text-sm">
                        <span>Balance Due:</span>
                        <span className="font-mono">₹{Number(activeInvoice.balanceAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Notes & Terms */}
                  {activeInvoice.notes && (
                    <div className="mt-4 p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                      <p className="font-bold text-stone-600 uppercase text-[10px]">Notes:</p>
                      <p className="text-stone-700 whitespace-pre-line mt-0.5">{activeInvoice.notes}</p>
                    </div>
                  )}

                  {/* Terms & Signature */}
                  <div className="mt-8 pt-4 border-t border-stone-200 flex flex-col sm:flex-row justify-between items-end gap-6 text-[10px] text-stone-500">
                    <div className="max-w-lg space-y-1.5 text-left">
                      <p className="font-bold text-stone-800 uppercase tracking-wider text-[11px]">
                        नियम व शर्तें (Terms & Conditions):
                      </p>
                      <ol className="list-decimal list-inside space-y-1 text-stone-700 text-[11px] leading-relaxed font-medium">
                        <li>किसी कारण वश सट्टा रद्द होने पर अग्रीम राशी जब्त हो जायेगी</li>
                        <li>उत्सव का दिनांक पुनः बदलने पर उपलब्धता देखी जायेगी</li>
                        <li>तय कुल रकम का 30% अग्रीम के रूप में लिया जायेगा</li>
                        <li>उत्सव की दिनांक से 5 दिन पहले कुल रकम का भुगतान करना होगा।</li>
                        <li>उत्सव भवन के यत्र तत्र गंदगी फैलाने पर सफाई का खर्च सट्टेदार को देना होगा।</li>
                        <li>किसी प्रकार का तोड़फोड़ या भारी नुकसान होने पर उसका वाजिब भुगतान सट्टेदार को करना होगा।</li>
                        <li>उत्सव के दिन किसी भी विद्युत उपकरण के खराबी आने पर ठीक कराने का प्रयास किया जायेगा परन्तु नहीं होने पर उसकी जिम्मेदारी प्रबंधन पर नहीं होगी।</li>
                      </ol>
                    </div>
                    <div className="text-center sm:text-right">
                      <div className="h-10 border-b border-stone-400 w-40 mb-1" />
                      <p className="font-bold text-stone-800">Authorized Signatory</p>
                      <p>{settings?.businessName || 'Bandhan Vatika'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Print & Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-200">
              <div className="text-xs text-stone-500">
                Current Print Format: <strong className="text-stone-800">{billFormat === 'RED_BOOKLET' ? '🔴 Official Bandhan Vatika Booklet Bill' : '📄 Standard Tax Invoice'}</strong>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {Number(activeInvoice.paidAmount) > 0 && (
                  <button
                    type="button"
                    onClick={() => handlePrintReceipt(activeInvoice)}
                    className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-[#F3E7C4] text-xs font-bold transition-all shadow-md"
                    title="Print Payment Receipt Voucher (A4)"
                  >
                    <ReceiptText className="w-4 h-4 text-[#C5A059]" />
                    <span>Print Payment Receipt</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePrint}
                  className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md ${
                    billFormat === 'RED_BOOKLET'
                      ? 'bg-[#B91C1C] hover:bg-[#991B1B] text-white'
                      : 'bg-[#14281D] hover:bg-[#1a3527] text-[#F3E7C4]'
                  }`}
                >
                  <Printer className="w-4 h-4" />
                  <span>Print {billFormat === 'RED_BOOKLET' ? 'Official Bill' : 'Tax Invoice'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInvoice(null)}
                  className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs font-semibold text-stone-800"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Cancel Invoice Modal */}
      {cancellingInvoice && (
        <Modal
          isOpen={!!cancellingInvoice}
          onClose={() => setCancellingInvoice(null)}
          title={`Cancel Invoice #${cancellingInvoice.invoiceNumber}`}
          subtitle="Provide a mandatory cancellation reason for audit purposes"
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 inline mr-1 text-amber-600" />
              Cancelling is irreversible. The invoice will be marked as CANCELLED in financial records.
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                Cancellation Reason
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Booking rescheduled, customer requested credit invoice..."
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#14281D] h-24"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-stone-200">
              <button
                onClick={() => setCancellingInvoice(null)}
                className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold"
              >
                Back
              </button>
              <button
                onClick={handleCancelInvoice}
                disabled={!cancelReason.trim()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create New Invoice Modal */}
      {showCreate && (
        <Modal
          isOpen={showCreate}
          onClose={() => setShowCreate(false)}
          title="Generate Tax Invoice"
          subtitle="Create a new GST invoice manually or directly from a confirmed Booking"
          maxWidth="2xl"
        >
          <form onSubmit={handleCreateInvoice} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold">
                {errorMsg}
              </div>
            )}

            {/* Mode selection */}
            <div className="flex rounded-xl bg-stone-100 p-1">
              <button
                type="button"
                onClick={() => setCreateMode('MANUAL')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  createMode === 'MANUAL' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500'
                }`}
              >
                Manual Invoice
              </button>
              <button
                type="button"
                onClick={() => setCreateMode('FROM_BOOKING')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  createMode === 'FROM_BOOKING' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500'
                }`}
              >
                From Existing Booking
              </button>
            </div>

            {createMode === 'FROM_BOOKING' ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                    Select Confirmed Booking
                  </label>
                  <select
                    value={selectedBookingId}
                    onChange={(e) => setSelectedBookingId(e.target.value)}
                    className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium outline-none"
                  >
                    <option value="">-- Choose Booking --</option>
                    {bookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        #{b.bookingNumber} — {b.customer?.name} ({b.eventType}, {b.eventDate}) — ₹{Number(b.grandTotal).toLocaleString('en-IN')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 1-Click Jeevika Preset Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-red-50/80 border border-red-200 rounded-xl gap-2">
                  <div className="text-xs text-[#B91C1C]">
                    ⚡ <strong>Jeevika Training Event?</strong> Hall is free (₹0), billed per food plate with 5% GST.
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyJeevikaTemplate}
                    className="px-3 py-1.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                  >
                    <span>🍽️</span>
                    <span>1-Click Fill Jeevika Food Bill</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Customer</label>
                    <select
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium outline-none"
                    >
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.mobile})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Event Type</label>
                    <input
                      type="text"
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value)}
                      placeholder="e.g. Wedding, Reception"
                      className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Event Date</label>
                    <input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Due Date</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
                    />
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-stone-700 uppercase">Itemized Particulars</label>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="text-xs font-bold text-[#14281D] hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add Item
                    </button>
                  </div>

                  {items.map((it, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Description"
                        value={it.description}
                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                        className="flex-3 p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
                      />
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={it.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        className="w-16 p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-center outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        placeholder="Rate"
                        value={it.rate}
                        onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                        className="w-24 p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-right outline-none"
                      />
                      <span className="w-24 text-right text-xs font-mono font-bold text-stone-700">
                        ₹{Number(it.amount).toLocaleString('en-IN')}
                      </span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-stone-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Discount (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                      className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase mb-1">GST Tax Rate</label>
                    <select
                      value={taxPercent}
                      onChange={(e) => setTaxPercent(Number(e.target.value))}
                      className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold outline-none"
                    >
                      <option value={5}>5% (Food &amp; Catering - e.g. Jeevika)</option>
                      <option value={18}>18% (Standard Banquet &amp; Rooms)</option>
                      <option value={12}>12% (Hotel Stay)</option>
                      <option value={0}>0% (Tax Exempt / Non-GST)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Initial Status</label>
                    <select
                      value={initialStatus}
                      onChange={(e) => setInitialStatus(e.target.value as any)}
                      className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold outline-none"
                    >
                      <option value="ISSUED">ISSUED (Official Tax Invoice)</option>
                      <option value="DRAFT">DRAFT (Editable Proposal)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes for customer..."
                    className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#14281D] hover:bg-[#1a3527] text-[#F3E7C4] text-xs font-bold shadow-xs"
              >
                {createMode === 'FROM_BOOKING' ? 'Generate from Booking' : initialStatus === 'DRAFT' ? 'Save as Draft' : 'Issue Invoice'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Official Receipt Preview & Print Modal */}
      {printReceiptData && (
        <Modal
          isOpen={!!printReceiptData}
          onClose={() => setPrintReceiptData(null)}
          title={`Official Receipt #${printReceiptData.receiptNumber}`}
          subtitle="Official Payment Voucher & Financial Record (A4)"
          maxWidth="3xl"
        >
          <div className="space-y-4">
            <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-stone-200 shadow-inner p-2 bg-stone-100">
              <PrintReceipt data={printReceiptData} showPreviewInUI={true} />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-stone-200 no-print">
              <button
                type="button"
                onClick={() => printElement('bandhan-print-receipt', `Receipt_${printReceiptData.receiptNumber}`)}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#14281D] hover:bg-[#1a3527] text-[#F3E7C4] text-xs font-bold shadow-xs cursor-pointer transition-all"
              >
                <Printer className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Print A4 Receipt</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintReceiptData(null)}
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
