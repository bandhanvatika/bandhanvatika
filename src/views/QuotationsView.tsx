import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../api/client.ts';
import { Quotation, Customer, Hall } from '../types/index.ts';
import { Modal } from '../components/Modal.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { BrandLogo } from '../components/BrandLogo.tsx';
import { printElement } from '../utils/print.ts';
import {
  FileText,
  Plus,
  CheckCircle,
  XCircle,
  Send,
  ArrowRight,
  Printer,
  Eye,
  Edit3,
  Search,
  Calendar,
  Building,
  User,
  Trash2,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface QuotationItemInput {
  description: string;
  quantity: number;
  rate: number;
}

export interface QuotationsViewProps {
  searchQuery?: string;
}

export const QuotationsView: React.FC<QuotationsViewProps> = ({ searchQuery = '' }) => {
  const { hasRole } = useAuth();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination
  const [search, setSearch] = useState(searchQuery);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');

  useEffect(() => {
    if (searchQuery !== undefined) {
      setSearch(searchQuery);
    }
  }, [searchQuery]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Create Modal
  const [showCreate, setShowCreate] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [eventType, setEventType] = useState('Wedding Reception');
  const [eventDate, setEventDate] = useState(
    new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0]
  );
  const [hallId, setHallId] = useState('');
  const [items, setItems] = useState<QuotationItemInput[]>([
    { description: 'Grand Vatika Royal Lawn & Banquet Tariff', quantity: 1, rate: 250000 },
    { description: 'Executive Bridal Suites (2 Days)', quantity: 2, rate: 8000 },
    { description: 'Mandapam & Stage Floral Decoration', quantity: 1, rate: 50000 },
  ]);
  const [discount, setDiscount] = useState<number>(0);
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0]
  );
  const [terms, setTerms] = useState(
    '1. 50% advance required upon booking confirmation.\n2. Balance payable 7 days prior to the event.\n3. Subject to venue availability at the time of conversion.'
  );
  const [notes, setNotes] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [newRate, setNewRate] = useState('');

  // Edit Modal (for DRAFT only)
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [editCustomerId, setEditCustomerId] = useState('');
  const [editEventType, setEditEventType] = useState('');
  const [editEventDate, setEditEventDate] = useState('');
  const [editHallId, setEditHallId] = useState('');
  const [editItems, setEditItems] = useState<QuotationItemInput[]>([]);
  const [editDiscount, setEditDiscount] = useState<number>(0);
  const [editValidUntil, setEditValidUntil] = useState('');
  const [editTerms, setEditTerms] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editNewDesc, setEditNewDesc] = useState('');
  const [editNewQty, setEditNewQty] = useState('1');
  const [editNewRate, setEditNewRate] = useState('');

  // View / Print Voucher Modal
  const [viewQuotation, setViewQuotation] = useState<any | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Status Action Modal (Reject / Convert)
  const [rejectingQuotationId, setRejectingQuotationId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const [convertingQuotation, setConvertingQuotation] = useState<Quotation | null>(null);
  const [convertStartTime, setConvertStartTime] = useState('10:00');
  const [convertEndTime, setConvertEndTime] = useState('23:00');
  const [convertGuestCount, setConvertGuestCount] = useState(250);

  // Fetch Quotations list
  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    const queryParams = new URLSearchParams({
      page: String(page),
      limit: '15',
      search,
      status: statusFilter,
      customerId: customerFilter,
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    });

    const res = await apiRequest<Quotation[]>(`/quotations?${queryParams.toString()}`);
    if (res.success && res.data) {
      setQuotations(res.data);
      if (res.pagination) {
        setTotalPages(res.pagination.totalPages || 1);
        setTotalCount(res.pagination.total || 0);
      }
    }
    setLoading(false);
  }, [page, search, statusFilter, customerFilter, startDate, endDate]);

  // Initial load for customers & halls
  useEffect(() => {
    const initMasterData = async () => {
      const [cRes, hRes] = await Promise.all([
        apiRequest<Customer[]>('/customers'),
        apiRequest<Hall[]>('/halls'),
      ]);
      if (cRes.success && cRes.data) {
        setCustomers(cRes.data);
        if (cRes.data.length > 0 && !customerId) setCustomerId(cRes.data[0].id);
      }
      if (hRes.success && hRes.data) {
        setHalls(hRes.data);
      }
    };
    initMasterData();
  }, []);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  // View quotation details
  const handleOpenView = async (quotationId: string) => {
    setViewLoading(true);
    const res = await apiRequest<any>(`/quotations/${quotationId}`);
    if (res.success && res.data) {
      setViewQuotation(res.data);
    } else {
      alert(res.error?.message || 'Failed to fetch quotation details');
    }
    setViewLoading(false);
  };

  // Add Item to Create
  const handleAddItem = () => {
    if (!newDesc.trim() || !newRate) return;
    const q = Math.max(1, parseInt(newQty, 10) || 1);
    const r = Math.max(0, parseFloat(newRate) || 0);
    setItems([...items, { description: newDesc.trim(), quantity: q, rate: r }]);
    setNewDesc('');
    setNewQty('1');
    setNewRate('');
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Add Item to Edit
  const handleAddEditItem = () => {
    if (!editNewDesc.trim() || !editNewRate) return;
    const q = Math.max(1, parseInt(editNewQty, 10) || 1);
    const r = Math.max(0, parseFloat(editNewRate) || 0);
    setEditItems([...editItems, { description: editNewDesc.trim(), quantity: q, rate: r }]);
    setEditNewDesc('');
    setEditNewQty('1');
    setEditNewRate('');
  };

  const handleRemoveEditItem = (index: number) => {
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  // Create Quotation Submit
  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      alert('Please add at least one line item to the quotation.');
      return;
    }

    const payload = {
      customerId,
      eventType,
      eventDate,
      hallId: hallId || null,
      items,
      discount: Number(discount) || 0,
      validUntil,
      terms,
      notes,
    };

    const res = await apiRequest('/quotations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.success) {
      setShowCreate(false);
      fetchQuotations();
    } else {
      alert(res.error?.message || 'Failed to create quotation');
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (q: Quotation) => {
    let parsed: QuotationItemInput[] = [];
    try {
      const raw = typeof q.items === 'string' ? JSON.parse(q.items) : q.items;
      parsed = Array.isArray(raw)
        ? raw.map((it: any) => ({
            description: it.description || it.name || '',
            quantity: Number(it.quantity || it.qty || 1),
            rate: Number(it.rate || it.unitPrice || it.cost || 0),
          }))
        : [];
    } catch {
      parsed = [];
    }

    setEditingQuotation(q);
    setEditCustomerId(q.customerId);
    setEditEventType(q.eventType);
    setEditEventDate(q.eventDate);
    setEditHallId(q.hallId || '');
    setEditItems(parsed);
    setEditDiscount(Number(q.discount) || 0);
    setEditValidUntil(q.validUntil);
    setEditTerms(q.terms || '');
    setEditNotes('');
  };

  // Save Edit Submit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuotation) return;
    if (editItems.length === 0) {
      alert('Quotation must contain at least one line item.');
      return;
    }

    const payload = {
      customerId: editCustomerId,
      eventType: editEventType,
      eventDate: editEventDate,
      hallId: editHallId || null,
      items: editItems,
      discount: Number(editDiscount) || 0,
      validUntil: editValidUntil,
      terms: editTerms,
      notes: editNotes,
    };

    const res = await apiRequest(`/quotations/${editingQuotation.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    if (res.success) {
      setEditingQuotation(null);
      fetchQuotations();
      if (viewQuotation?.id === editingQuotation.id) {
        handleOpenView(editingQuotation.id);
      }
    } else {
      alert(res.error?.message || 'Failed to update quotation');
    }
  };

  // Status transitions
  const handleTransitionStatus = async (
    quotationId: string,
    targetStatus: 'SENT' | 'ACCEPTED' | 'REJECTED',
    notesVal?: string
  ) => {
    const res = await apiRequest(`/quotations/${quotationId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: targetStatus, notes: notesVal }),
    });

    if (res.success) {
      fetchQuotations();
      if (viewQuotation?.id === quotationId) {
        handleOpenView(quotationId);
      }
    } else {
      alert(res.error?.message || `Failed to update status to ${targetStatus}`);
    }
  };

  // Convert to Booking Submit
  const handleConvertToBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertingQuotation) return;

    const res = await apiRequest(`/quotations/${convertingQuotation.id}/convert`, {
      method: 'POST',
      body: JSON.stringify({
        startTime: convertStartTime,
        endTime: convertEndTime,
        guestCount: convertGuestCount,
      }),
    });

    if (res.success) {
      alert(`Quotation converted to Booking successfully!`);
      setConvertingQuotation(null);
      fetchQuotations();
      if (viewQuotation?.id === convertingQuotation.id) {
        handleOpenView(convertingQuotation.id);
      }
    } else {
      alert(res.error?.message || 'Conversion failed. Please verify venue availability.');
    }
  };

  // Calculations for Create Modal
  const createSubtotal = items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const createTaxable = Math.max(0, createSubtotal - (Number(discount) || 0));
  const createTaxAmount = Math.round(createTaxable * 0.18);
  const createGrandTotal = createTaxable + createTaxAmount;

  // Calculations for Edit Modal
  const editSubtotal = editItems.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const editTaxable = Math.max(0, editSubtotal - (Number(editDiscount) || 0));
  const editTaxAmount = Math.round(editTaxable * 0.18);
  const editGrandTotal = editTaxable + editTaxAmount;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-stone-100 text-stone-700 border-stone-200';
      case 'SENT':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'ACCEPTED':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'REJECTED':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'CONVERTED':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      default:
        return 'bg-stone-100 text-stone-700 border-stone-200';
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-stone-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold font-brand text-[#14281D]">Quotation Management</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F4EDE2] text-[#8C6D3B]">
              Phase 4
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Formal pricing proposals, state transitions (Draft → Sent → Accepted → Converted) & venue booking conversions
          </p>
        </div>

        {hasRole(['OWNER', 'MANAGER', 'RECEPTIONIST']) && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-[#14281D] hover:bg-[#1a3527] text-[#F3E7C4] text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Create Proposal</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs border-b border-stone-100">
          {(['ALL', 'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CONVERTED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-[#14281D] text-[#F3E7C4]'
                  : 'bg-stone-50 hover:bg-stone-100 text-stone-600'
              }`}
            >
              {st === 'ALL' ? 'All Quotations' : st}
            </button>
          ))}
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search quotation #, customer, mobile, event..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>

          <div>
            <select
              value={customerFilter}
              onChange={(e) => {
                setCustomerFilter(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl outline-none"
            >
              <option value="ALL">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.mobile})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl outline-none text-stone-600"
              title="Event Date From"
            />
            <span className="text-stone-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl outline-none text-stone-600"
              title="Event Date To"
            />
          </div>

          <div className="flex items-center justify-end text-xs text-stone-500 font-medium">
            Total records: <span className="font-bold text-stone-900 ml-1">{totalCount}</span>
          </div>
        </div>
      </div>

      {/* Quotations Table */}
      <div className="bg-white rounded-3xl border border-stone-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-stone-400">Loading quotations...</div>
        ) : quotations.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <FileText className="w-10 h-10 text-stone-300 mx-auto" />
            <div className="text-sm font-bold text-stone-700">No Quotations Found</div>
            <p className="text-xs text-stone-400 max-w-sm mx-auto">
              No quotation proposals match your filter criteria. Create a new quotation to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50/75 border-b border-stone-200/80 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Quotation #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Event Details</th>
                  <th className="py-3 px-4">Event Date</th>
                  <th className="py-3 px-4">Valid Until</th>
                  <th className="py-3 px-4 text-right">Subtotal</th>
                  <th className="py-3 px-4 text-right">Total (₹)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {quotations.map((q) => (
                  <tr key={q.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-stone-900">
                      {q.quotationNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-stone-900">{q.customer?.name || 'Customer'}</div>
                      <div className="text-[11px] text-stone-400">{q.customer?.mobile}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-stone-800">{q.eventType}</div>
                      {q.hall && (
                        <div className="text-[10px] text-stone-500 font-medium">{q.hall.name}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-stone-700 font-medium">
                      {q.eventDate}
                    </td>
                    <td className="py-3.5 px-4 text-stone-500">
                      {q.validUntil}
                    </td>
                    <td className="py-3.5 px-4 text-right text-stone-600 font-mono">
                      ₹{Number(q.subtotal).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-stone-900 font-mono">
                      ₹{Number(q.totalAmount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusBadge(
                          q.status
                        )}`}
                      >
                        {q.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center space-x-1">
                        {/* View & Print */}
                        <button
                          onClick={() => handleOpenView(q.id)}
                          className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                          title="View & Print Voucher"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Edit DRAFT */}
                        {q.status === 'DRAFT' && hasRole(['OWNER', 'MANAGER', 'RECEPTIONIST']) && (
                          <button
                            onClick={() => handleOpenEdit(q)}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Edit Draft Quotation"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Send Proposal (DRAFT -> SENT) */}
                        {q.status === 'DRAFT' && hasRole(['OWNER', 'MANAGER', 'RECEPTIONIST']) && (
                          <button
                            onClick={() => handleTransitionStatus(q.id, 'SENT')}
                            className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold transition-colors"
                            title="Send quotation to customer"
                          >
                            Send
                          </button>
                        )}

                        {/* Accept / Reject (SENT -> ACCEPTED / REJECTED) */}
                        {q.status === 'SENT' && hasRole(['OWNER', 'MANAGER', 'RECEPTIONIST']) && (
                          <>
                            <button
                              onClick={() => handleTransitionStatus(q.id, 'ACCEPTED')}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition-colors"
                              title="Customer accepted proposal"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => {
                                setRejectingQuotationId(q.id);
                                setRejectionReason('');
                              }}
                              className="px-2 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-[11px] font-bold transition-colors"
                              title="Customer rejected proposal"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {/* Convert to Booking (ACCEPTED -> CONVERTED) */}
                        {q.status === 'ACCEPTED' && hasRole(['OWNER', 'MANAGER']) && (
                          <button
                            onClick={() => setConvertingQuotation(q)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-colors shadow-xs"
                            title="Convert to Confirmed Venue Booking"
                          >
                            Convert to Booking
                          </button>
                        )}

                        {/* Converted indicator */}
                        {q.status === 'CONVERTED' && (
                          <span className="text-[11px] font-medium text-emerald-700 px-2 py-1">
                            Converted
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-stone-100 text-xs">
            <span className="text-stone-500">
              Page {page} of {totalPages} ({totalCount} quotations)
            </span>
            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1.5 rounded-lg border border-stone-200 disabled:opacity-30 hover:bg-stone-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1.5 rounded-lg border border-stone-200 disabled:opacity-30 hover:bg-stone-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {showCreate && (
        <Modal
          isOpen={showCreate}
          onClose={() => setShowCreate(false)}
          title="Create Quotation Proposal"
          subtitle="Itemized venue & services price estimate"
          maxWidth="2xl"
        >
          <form onSubmit={handleCreateQuotation} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Customer <span className="text-rose-500">*</span>
                </label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium outline-none"
                  required
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.mobile})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Event Type <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  placeholder="e.g. Wedding, Reception, Sangeet"
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Event Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Associated Hall (Optional)
                </label>
                <select
                  value={hallId}
                  onChange={(e) => setHallId(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium outline-none"
                >
                  <option value="">No Hall Assigned (General Proposal)</option>
                  {halls.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.code}) — ₹{Number(h.basePrice).toLocaleString('en-IN')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-stone-700 uppercase">
                Itemized Services & Venue Rates <span className="text-rose-500">*</span>
              </label>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs"
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-stone-800">{item.description}</div>
                      <div className="text-[11px] text-stone-400">
                        Qty: {item.quantity} × ₹{item.rate.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="font-bold text-stone-900 font-mono">
                        ₹{(item.quantity * item.rate).toLocaleString('en-IN')}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-stone-400 hover:text-rose-600 transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Item Row */}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Service / room / catering description"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="flex-1 p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
                />
                <input
                  type="number"
                  min="1"
                  placeholder="Qty"
                  value={newQty}
                  onChange={(e) => setNewQty(e.target.value)}
                  className="w-16 p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none text-center"
                />
                <input
                  type="number"
                  min="0"
                  placeholder="₹ Rate"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  className="w-24 p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none text-right font-mono"
                />
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Discount, Validity & Terms */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Special Discount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  max={createSubtotal}
                  value={discount}
                  onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Valid Until <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                Internal Notes / Special Requests (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. VIP setup, requested early stage preparation"
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
              />
            </div>

            {/* Financial Summary */}
            <div className="p-4 rounded-2xl bg-[#14281D] text-[#FBF9F5] space-y-1.5 text-xs">
              <div className="flex justify-between text-stone-300">
                <span>Subtotal ({items.length} items)</span>
                <span className="font-mono">₹{createSubtotal.toLocaleString('en-IN')}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-rose-300">
                  <span>Special Discount</span>
                  <span className="font-mono">-₹{Number(discount).toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between text-stone-300">
                <span>GST (18% applied server-side)</span>
                <span className="font-mono">₹{createTaxAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between font-bold text-base text-[#E2C07D] pt-2 border-t border-white/10">
                <span>Total Proposal Estimate</span>
                <span className="font-mono">₹{createGrandTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>

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
                className="px-5 py-2.5 rounded-xl bg-[#14281D] hover:bg-[#1a3527] text-[#F3E7C4] text-xs font-bold shadow-sm"
              >
                Generate Quotation (Draft)
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* EDIT MODAL (DRAFT ONLY) */}
      {editingQuotation && (
        <Modal
          isOpen={!!editingQuotation}
          onClose={() => setEditingQuotation(null)}
          title={`Edit Quotation #${editingQuotation.quotationNumber}`}
          subtitle="Modifying DRAFT quotation details & items"
          maxWidth="2xl"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Customer
                </label>
                <select
                  value={editCustomerId}
                  onChange={(e) => setEditCustomerId(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium outline-none"
                  required
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.mobile})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Event Type
                </label>
                <input
                  type="text"
                  value={editEventType}
                  onChange={(e) => setEditEventType(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Event Date
                </label>
                <input
                  type="date"
                  value={editEventDate}
                  onChange={(e) => setEditEventDate(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Hall
                </label>
                <select
                  value={editHallId}
                  onChange={(e) => setEditHallId(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium outline-none"
                >
                  <option value="">No Hall Assigned</option>
                  {halls.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-stone-700 uppercase">
                Line Items
              </label>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {editItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs"
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-stone-800">{item.description}</div>
                      <div className="text-[11px] text-stone-400">
                        Qty: {item.quantity} × ₹{item.rate.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="font-bold text-stone-900 font-mono">
                        ₹{(item.quantity * item.rate).toLocaleString('en-IN')}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveEditItem(idx)}
                        className="text-stone-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Service / Room description"
                  value={editNewDesc}
                  onChange={(e) => setEditNewDesc(e.target.value)}
                  className="flex-1 p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
                />
                <input
                  type="number"
                  min="1"
                  placeholder="Qty"
                  value={editNewQty}
                  onChange={(e) => setEditNewQty(e.target.value)}
                  className="w-16 p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none text-center"
                />
                <input
                  type="number"
                  min="0"
                  placeholder="₹ Rate"
                  value={editNewRate}
                  onChange={(e) => setEditNewRate(e.target.value)}
                  className="w-24 p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none text-right font-mono"
                />
                <button
                  type="button"
                  onClick={handleAddEditItem}
                  className="px-3 py-2 bg-stone-800 text-white rounded-xl text-xs font-bold"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Discount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  max={editSubtotal}
                  value={editDiscount}
                  onChange={(e) => setEditDiscount(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Valid Until
                </label>
                <input
                  type="date"
                  value={editValidUntil}
                  onChange={(e) => setEditValidUntil(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
                  required
                />
              </div>
            </div>

            {/* Financial Summary */}
            <div className="p-4 rounded-2xl bg-[#14281D] text-[#FBF9F5] space-y-1.5 text-xs">
              <div className="flex justify-between text-stone-300">
                <span>Subtotal</span>
                <span className="font-mono">₹{editSubtotal.toLocaleString('en-IN')}</span>
              </div>
              {editDiscount > 0 && (
                <div className="flex justify-between text-rose-300">
                  <span>Special Discount</span>
                  <span className="font-mono">-₹{Number(editDiscount).toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between text-stone-300">
                <span>GST (18%)</span>
                <span className="font-mono">₹{editTaxAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between font-bold text-base text-[#E2C07D] pt-2 border-t border-white/10">
                <span>Total Proposal Value</span>
                <span className="font-mono">₹{editGrandTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setEditingQuotation(null)}
                className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#14281D] hover:bg-[#1a3527] text-[#F3E7C4] text-xs font-bold shadow-sm"
              >
                Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* REJECTION REASON MODAL */}
      {rejectingQuotationId && (
        <Modal
          isOpen={!!rejectingQuotationId}
          onClose={() => setRejectingQuotationId(null)}
          title="Reject Quotation Proposal"
          subtitle="Record customer decline reason"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <p className="text-stone-600">
              Are you sure you want to mark this quotation as REJECTED? Rejected quotations cannot be converted into bookings.
            </p>
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                Decline Reason / Notes
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Budget constraints, date changed, chose alternative venue"
                rows={3}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl outline-none"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setRejectingQuotationId(null)}
                className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleTransitionStatus(rejectingQuotationId, 'REJECTED', rejectionReason);
                  setRejectingQuotationId(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* CONVERT TO BOOKING MODAL */}
      {convertingQuotation && (
        <Modal
          isOpen={!!convertingQuotation}
          onClose={() => setConvertingQuotation(null)}
          title="Convert Quotation to Confirmed Booking"
          subtitle={`Proposal #${convertingQuotation.quotationNumber} for ${convertingQuotation.customer?.name}`}
          maxWidth="md"
        >
          <form onSubmit={handleConvertToBooking} className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Venue Availability Verification</span>
              </div>
              <p className="text-[11px] text-amber-700">
                Converting this proposal will execute a transactional availability check on {convertingQuotation.eventDate} and generate an official reservation contract.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Start Time
                </label>
                <input
                  type="text"
                  value={convertStartTime}
                  onChange={(e) => setConvertStartTime(e.target.value)}
                  placeholder="10:00"
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl outline-none font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  End Time
                </label>
                <input
                  type="text"
                  value={convertEndTime}
                  onChange={(e) => setConvertEndTime(e.target.value)}
                  placeholder="23:00"
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl outline-none font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                Expected Guest Count
              </label>
              <input
                type="number"
                min="1"
                value={convertGuestCount}
                onChange={(e) => setConvertGuestCount(Number(e.target.value))}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl outline-none font-mono"
                required
              />
            </div>

            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1 text-stone-600">
              <div className="flex justify-between">
                <span>Event Date:</span>
                <span className="font-bold text-stone-800">{convertingQuotation.eventDate}</span>
              </div>
              <div className="flex justify-between">
                <span>Contract Value:</span>
                <span className="font-bold text-stone-900 font-mono">
                  ₹{Number(convertingQuotation.totalAmount).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setConvertingQuotation(null)}
                className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
              >
                Execute Conversion
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* VIEW & PRINT PROPOSAL VOUCHER MODAL */}
      {viewQuotation && (
        <Modal
          isOpen={!!viewQuotation}
          onClose={() => setViewQuotation(null)}
          title={`Quotation #${viewQuotation.quotationNumber}`}
          subtitle="Formal Event Estimate & Terms"
          maxWidth="3xl"
        >
          <div className="space-y-4">
            {/* Printable Voucher Paper */}
            <div
              id="quotation-print-voucher"
              className="border border-stone-300 rounded-2xl p-8 bg-white space-y-6 text-stone-800 font-sans shadow-sm print:m-0 print:p-0 print:border-none"
            >
              {/* Header */}
              <div className="flex justify-between items-start pb-6 border-b-2 border-stone-800">
                <div>
                  <div className="text-[11px] font-bold text-[#8B6B23] tracking-widest uppercase mb-1">
                    ॥ श्री गणेशाय नमः ॥
                  </div>
                  <BrandLogo variant="print" />
                  <p className="text-xs text-stone-700 mt-2 font-medium leading-relaxed">
                    {viewQuotation.settings?.address || 'आरा-बक्सर मेन रोड, पकड़ीयावर, आर० के० ऐकेडमी स्कूल के ठीक सामने, चन्दवाँ, आरा (बिहार)'}
                  </p>
                  <p className="text-xs font-bold text-stone-800">
                    मो० नं० (Mob.) : 9431086933, 8409480911, 9015755799
                  </p>
                  <p className="text-xs text-stone-500">
                    GSTIN: <span className="font-mono font-semibold">{viewQuotation.settings?.gstin || '10AAAAA0000A1Z5'}</span>
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <div className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-stone-100 text-stone-800 border border-stone-200">
                    {viewQuotation.status}
                  </div>
                  <div className="text-sm font-bold font-mono text-stone-900">
                    {viewQuotation.quotationNumber}
                  </div>
                  <div className="text-xs text-stone-500">
                    Date:{' '}
                    {new Date(viewQuotation.createdAt || Date.now()).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                  <div className="text-xs font-semibold text-rose-700">
                    Valid Until: {viewQuotation.validUntil}
                  </div>
                </div>
              </div>

              {/* Prepared For & Event Summary */}
              <div className="grid grid-cols-2 gap-6 p-4 rounded-xl bg-stone-50/80 border border-stone-200/80 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                    Prepared For (Customer)
                  </span>
                  <div className="text-sm font-bold text-stone-900">{viewQuotation.customer?.name}</div>
                  <div className="text-stone-600 font-medium">{viewQuotation.customer?.mobile}</div>
                  {viewQuotation.customer?.email && (
                    <div className="text-stone-500">{viewQuotation.customer?.email}</div>
                  )}
                  {viewQuotation.customer?.address && (
                    <div className="text-stone-500 mt-1">{viewQuotation.customer?.address}</div>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                    Event Specifications
                  </span>
                  <div className="text-sm font-bold text-stone-900">{viewQuotation.eventType}</div>
                  <div className="text-stone-700 font-medium">Event Date: {viewQuotation.eventDate}</div>
                  {viewQuotation.hall && (
                    <div className="text-stone-600">Reserved Venue: {viewQuotation.hall.name}</div>
                  )}
                  {viewQuotation.booking && (
                    <div className="text-emerald-700 font-medium">
                      Converted Booking #{viewQuotation.booking.bookingNumber}
                    </div>
                  )}
                </div>
              </div>

              {/* Itemized Table */}
              <div>
                <table className="w-full text-left text-xs">
                  <thead className="border-b-2 border-stone-300 text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5">Item Description</th>
                      <th className="py-2.5 text-center w-16">Qty</th>
                      <th className="py-2.5 text-right w-28">Rate (₹)</th>
                      <th className="py-2.5 text-right w-32">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {(viewQuotation.parsedItems || []).map((it: any, idx: number) => {
                      const desc = it.description || it.name;
                      const q = Number(it.quantity || it.qty || 1);
                      const r = Number(it.rate || it.unitPrice || it.cost || 0);
                      const amt = Number(it.amount || q * r);
                      return (
                        <tr key={idx} className="hover:bg-stone-50/50">
                          <td className="py-2.5 text-stone-900 font-medium">{desc}</td>
                          <td className="py-2.5 text-center text-stone-600">{q}</td>
                          <td className="py-2.5 text-right font-mono text-stone-600">
                            ₹{r.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 text-right font-mono font-bold text-stone-900">
                            ₹{amt.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Financial Calculation Box */}
              <div className="flex justify-end pt-2">
                <div className="w-72 space-y-2 text-xs">
                  <div className="flex justify-between text-stone-600">
                    <span>Subtotal:</span>
                    <span className="font-mono font-medium">
                      ₹{Number(viewQuotation.subtotal).toLocaleString('en-IN')}
                    </span>
                  </div>

                  {Number(viewQuotation.discount) > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Discount:</span>
                      <span className="font-mono font-medium">
                        -₹{Number(viewQuotation.discount).toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-stone-600">
                    <span>GST ({Number(viewQuotation.taxPercent)}%):</span>
                    <span className="font-mono font-medium">
                      ₹{Number(viewQuotation.taxAmount).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm font-bold text-stone-900 pt-2 border-t-2 border-stone-800">
                    <span>Grand Total:</span>
                    <span className="font-mono text-[#14281D]">
                      ₹{Number(viewQuotation.totalAmount).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Terms and Conditions */}
              <div className="pt-4 border-t border-stone-200 text-[11px] text-stone-700 space-y-1.5">
                <div className="font-bold uppercase tracking-wider text-stone-800 text-[11px]">
                  नियम व शर्तें (Terms & Conditions)
                </div>
                <ol className="list-decimal list-inside space-y-1 text-stone-700 leading-relaxed font-medium text-[11px]">
                  <li>निश्चित समय या दिन पर उत्सव भवन की आवश्यकता न रहने पर एडवांस वापस नहीं होगा।</li>
                  <li>तय सट्टा का एक तिहाई (1/3) एडवांस देय होगा।</li>
                  <li>उत्सव भवन में साफ-सफाई एवं सामान के टूटने-फूटने की जिम्मेवारी ग्राहक की होगी।</li>
                  <li>इन्ट्री से 5 दिन पहले पूरी रकम चुकता करना अनिवार्य है।</li>
                  <li>सभी तरह की गाड़ियां भाड़े पर उचित मूल्य पर उपलब्ध हैं।</li>
                </ol>
              </div>

              {/* Signature Block */}
              <div className="pt-8 border-t border-stone-200 grid grid-cols-2 gap-8 text-xs text-stone-500">
                <div>
                  <div className="h-10"></div>
                  <div className="border-t border-stone-300 pt-1 text-center font-semibold">
                    Authorized Signatory (Bandhan Vatika)
                  </div>
                </div>
                <div>
                  <div className="h-10"></div>
                  <div className="border-t border-stone-300 pt-1 text-center font-semibold">
                    Client Acceptance (Sign & Date)
                  </div>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="flex items-center space-x-2">
                {/* Print button */}
                <button
                  type="button"
                  onClick={() => printElement('quotation-print-voucher', `Quotation_${viewQuotation.quotationNumber}`)}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs font-semibold text-stone-800 transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Voucher</span>
                </button>

                {/* Edit if DRAFT */}
                {viewQuotation.status === 'DRAFT' && hasRole(['OWNER', 'MANAGER', 'RECEPTIONIST']) && (
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenEdit(viewQuotation);
                    }}
                    className="flex items-center space-x-1 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Draft</span>
                  </button>
                )}

                {/* Send if DRAFT */}
                {viewQuotation.status === 'DRAFT' && hasRole(['OWNER', 'MANAGER', 'RECEPTIONIST']) && (
                  <button
                    type="button"
                    onClick={() => handleTransitionStatus(viewQuotation.id, 'SENT')}
                    className="flex items-center space-x-1 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Proposal</span>
                  </button>
                )}

                {/* Accept if SENT */}
                {viewQuotation.status === 'SENT' && hasRole(['OWNER', 'MANAGER', 'RECEPTIONIST']) && (
                  <button
                    type="button"
                    onClick={() => handleTransitionStatus(viewQuotation.id, 'ACCEPTED')}
                    className="flex items-center space-x-1 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Mark Accepted</span>
                  </button>
                )}

                {/* Convert if ACCEPTED */}
                {viewQuotation.status === 'ACCEPTED' && hasRole(['OWNER', 'MANAGER']) && (
                  <button
                    type="button"
                    onClick={() => {
                      setConvertingQuotation(viewQuotation);
                    }}
                    className="flex items-center space-x-1 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Convert to Booking</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setViewQuotation(null)}
                className="px-4 py-2 rounded-xl bg-[#14281D] text-[#F3E7C4] text-xs font-bold hover:bg-[#1a3527] transition-colors"
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
export default QuotationsView;
