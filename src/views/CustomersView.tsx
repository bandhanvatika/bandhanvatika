import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../api/client.ts';
import { Customer } from '../types/index.ts';
import { Modal } from '../components/Modal.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  CalendarCheck,
  Eye,
  Edit,
  AlertCircle,
  CreditCard,
  History,
  CheckCircle,
  UserX,
  UserCheck,
  FileText,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Building,
  Camera,
  UploadCloud,
  Trash2,
  Download,
} from 'lucide-react';

export interface CustomersViewProps {
  searchQuery?: string;
}

export const CustomersView: React.FC<CustomersViewProps> = ({ searchQuery = '' }) => {
  const { hasRole } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchQuery);

  useEffect(() => {
    if (searchQuery !== undefined) {
      setSearch(searchQuery);
    }
  }, [searchQuery]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 15;

  // Add Customer Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formMobile, setFormMobile] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('Ara');
  const [formIdProofType, setFormIdProofType] = useState('Aadhaar Card');
  const [formIdProofNumber, setFormIdProofNumber] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formIdProofImage, setFormIdProofImage] = useState<string | null>(null);
  const [mobileWarning, setMobileWarning] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit Customer Modal State
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('Ara');
  const [editIdProofType, setEditIdProofType] = useState('Aadhaar Card');
  const [editIdProofNumber, setEditIdProofNumber] = useState('');
  const [editIdProofImage, setEditIdProofImage] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editMobileWarning, setEditMobileWarning] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // ID Card Full Image View Modal
  const [viewIdImageModal, setViewIdImageModal] = useState<{ title: string; image: string; idInfo?: string } | null>(null);

  // Profile View Modal State
  const [profileCustomer, setProfileCustomer] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Deactivate/Activate Confirmation State
  const [confirmTarget, setConfirmTarget] = useState<{ customer: Customer; action: 'deactivate' | 'activate' } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const query = new URLSearchParams({
      search: search.trim(),
      status: statusFilter,
      page: String(page),
      limit: String(limit),
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    const res = await apiRequest<Customer[]>(`/customers?${query.toString()}`);
    if (res.success && res.data) {
      setCustomers(res.data);
      if (res.pagination) {
        setTotalPages(res.pagination.totalPages || 1);
        setTotalCount(res.pagination.total || 0);
      }
    }
    setLoading(false);
  }, [search, statusFilter, page]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Check duplicate mobile for Add form
  useEffect(() => {
    const clean = formMobile.trim().replace(/[\s\-\+]/g, '');
    if (clean.length < 10) {
      setMobileWarning(null);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await apiRequest(`/customers/check-mobile/${clean}`);
      if (res.exists) {
        setMobileWarning(`Duplicate warning: Customer "${res.customer.name}" (${res.customer.customerCode}) already uses this phone number.`);
      } else {
        setMobileWarning(null);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [formMobile]);

  // Check duplicate mobile for Edit form
  useEffect(() => {
    if (!editingCustomer) return;
    const clean = editMobile.trim().replace(/[\s\-\+]/g, '');
    if (clean.length < 10 || clean === editingCustomer.mobile) {
      setEditMobileWarning(null);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await apiRequest(`/customers/check-mobile/${clean}?excludeId=${editingCustomer.id}`);
      if (res.exists) {
        setEditMobileWarning(`Duplicate warning: Another customer "${res.customer.name}" (${res.customer.customerCode}) already uses this phone number.`);
      } else {
        setEditMobileWarning(null);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [editMobile, editingCustomer]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setFormError(null);

    const res = await apiRequest<Customer>('/customers', {
      method: 'POST',
      body: JSON.stringify({
        name: formName,
        mobile: formMobile,
        email: formEmail || undefined,
        address: formAddress || undefined,
        city: formCity || undefined,
        idProofType: formIdProofType || undefined,
        idProofNumber: formIdProofNumber || undefined,
        idProofImage: formIdProofImage || undefined,
        notes: formNotes || undefined,
      }),
    });

    setSubmitLoading(false);
    if (res.success && res.data) {
      setShowAddModal(false);
      resetAddForm();
      fetchCustomers();
    } else {
      setFormError(res.error?.message || 'Failed to register customer. Please check the inputs.');
    }
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setEditName(c.name);
    setEditMobile(c.mobile);
    setEditEmail(c.email || '');
    setEditAddress(c.address || '');
    setEditCity(c.city || 'Ara');
    setEditIdProofType(c.idProofType || 'Aadhaar Card');
    setEditIdProofNumber(c.idProofNumber || '');
    setEditIdProofImage(c.idProofImage || null);
    setEditNotes(c.notes || '');
    setEditError(null);
    setEditMobileWarning(null);
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;

    setEditLoading(true);
    setEditError(null);

    const res = await apiRequest<Customer>(`/customers/${editingCustomer.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: editName,
        mobile: editMobile,
        email: editEmail || null,
        address: editAddress || null,
        city: editCity || 'Ara',
        idProofType: editIdProofType || null,
        idProofNumber: editIdProofNumber || null,
        idProofImage: editIdProofImage || null,
        notes: editNotes || null,
      }),
    });

    setEditLoading(false);
    if (res.success) {
      setEditingCustomer(null);
      fetchCustomers();
    } else {
      setEditError(res.error?.message || 'Failed to update customer.');
    }
  };

  const handleToggleStatus = async () => {
    if (!confirmTarget) return;
    setActionLoading(true);

    const endpoint = confirmTarget.action === 'deactivate'
      ? `/customers/${confirmTarget.customer.id}`
      : `/customers/${confirmTarget.customer.id}/activate`;

    const method = confirmTarget.action === 'deactivate' ? 'DELETE' : 'POST';

    const res = await apiRequest(endpoint, { method });
    setActionLoading(false);
    setConfirmTarget(null);

    if (res.success) {
      fetchCustomers();
    }
  };

  const handleOpenProfile = async (id: string) => {
    setProfileLoading(true);
    const res = await apiRequest(`/customers/${id}`);
    setProfileLoading(false);
    if (res.success && res.data) {
      setProfileCustomer(res.data);
    }
  };

  const resetAddForm = () => {
    setFormName('');
    setFormMobile('');
    setFormEmail('');
    setFormAddress('');
    setFormCity('Ara');
    setFormIdProofType('Aadhaar Card');
    setFormIdProofNumber('');
    setFormIdProofImage(null);
    setFormNotes('');
    setMobileWarning(null);
    setFormError(null);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Top Banner & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-stone-200/80 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold font-brand text-[#14281D]">Customers Master Directory</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 text-xs font-bold font-mono">
              {totalCount} Total
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Client profiles, unique mobile identity, KYC credentials, and lifetime accounting
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Filter Toggle */}
          <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs">
            <button
              onClick={() => { setStatusFilter('active'); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                statusFilter === 'active'
                  ? 'bg-white text-[#14281D] shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => { setStatusFilter('inactive'); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                statusFilter === 'inactive'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Deactivated
            </button>
            <button
              onClick={() => { setStatusFilter('all'); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-[#14281D] shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              All
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search code, name, mobile, city..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-8 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059] w-64"
            />
          </div>

          {/* Add Customer Button */}
          {hasRole(['OWNER', 'MANAGER', 'RECEPTIONIST']) && (
            <button
              onClick={() => { resetAddForm(); setShowAddModal(true); }}
              className="flex items-center space-x-1.5 px-4 py-2 bg-[#14281D] hover:bg-[#1a3527] text-[#F3E7C4] text-xs font-bold rounded-xl transition-all shadow-xs"
            >
              <Plus className="w-4 h-4 text-[#C5A059]" />
              <span>Add Customer</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Table Card */}
      <div className="p-5 rounded-3xl bg-white border border-stone-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-stone-400 font-semibold animate-pulse">
            Loading customer records from PostgreSQL...
          </div>
        ) : customers.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 text-stone-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-stone-700">No customers found</p>
            <p className="text-xs text-stone-400 mt-1">
              {search ? 'Try clearing or changing your search criteria.' : 'Click "Add Customer" to register your first client.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Code</th>
                  <th className="py-3 px-3">Customer Name</th>
                  <th className="py-3 px-3">Mobile & Contact</th>
                  <th className="py-3 px-3">City / Address</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-center">Bookings</th>
                  <th className="py-3 px-3 text-right">Lifetime Spent</th>
                  <th className="py-3 px-3 text-right">Outstanding</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="py-3.5 px-3 font-mono font-bold text-stone-800">
                      {c.customerCode}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-stone-900">{c.name}</div>
                      {c.idProofType && c.idProofNumber && (
                        <div className="text-[10px] text-stone-500 flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="flex items-center space-x-1 text-stone-600">
                            <ShieldCheck className="w-3 h-3 text-[#C5A059]" />
                            <span>{c.idProofType}: {c.idProofNumber}</span>
                          </span>
                          {c.idProofImage ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewIdImageModal({
                                  title: `${c.name} - ${c.idProofType} Photo`,
                                  image: c.idProofImage!,
                                  idInfo: `${c.idProofType}: ${c.idProofNumber} (Code: ${c.customerCode})`,
                                });
                              }}
                              className="inline-flex items-center space-x-1 px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded font-semibold text-[10px] border border-emerald-200 cursor-pointer transition-all"
                              title="Click to view full Govt ID Card photo"
                            >
                              <Eye className="w-2.5 h-2.5 text-emerald-700" />
                              <span>View ID Card</span>
                            </button>
                          ) : (
                            <span className="text-[9px] text-stone-400 italic">(Photo not attached)</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-stone-600">
                      <div className="flex items-center space-x-1.5 font-medium">
                        <Phone className="w-3 h-3 text-[#C5A059]" />
                        <span className="font-mono">{c.mobile}</span>
                      </div>
                      {c.email && (
                        <div className="text-[11px] text-stone-400 mt-0.5 truncate max-w-[180px] flex items-center space-x-1">
                          <Mail className="w-2.5 h-2.5 text-stone-400" />
                          <span>{c.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-stone-700">
                      <div className="font-medium">{c.city || 'Ara'}</div>
                      {c.address && (
                        <div className="text-[11px] text-stone-400 truncate max-w-[200px]">
                          {c.address}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-3">
                      {c.isActive ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-stone-100 text-stone-500 border border-stone-200">
                          Deactivated
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-md bg-stone-100 font-bold text-stone-800 text-[11px] font-mono">
                        {c.totalBookings}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-stone-900 font-mono tabular-nums">
                      ₹{Number(c.totalSpent).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold font-mono tabular-nums">
                      {Number(c.outstandingAmount) === 0 ? (
                        <span className="text-emerald-600">₹0.00</span>
                      ) : (
                        <span className="text-amber-600">
                          ₹{Number(c.outstandingAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => handleOpenProfile(c.id)}
                          className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                          title="View Profile & Accounting"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {hasRole(['OWNER', 'MANAGER', 'RECEPTIONIST']) && (
                          <button
                            onClick={() => openEditModal(c)}
                            className="p-1.5 rounded-lg text-stone-500 hover:text-[#14281D] hover:bg-stone-100 transition-colors"
                            title="Edit Details"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {hasRole(['OWNER', 'MANAGER']) && (
                          c.isActive ? (
                            <button
                              onClick={() => setConfirmTarget({ customer: c, action: 'deactivate' })}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Deactivate Customer"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setConfirmTarget({ customer: c, action: 'activate' })}
                              className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                              title="Reactivate Customer"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-stone-100 text-xs text-stone-500">
            <div>
              Showing page <span className="font-bold text-stone-800">{page}</span> of{' '}
              <span className="font-bold text-stone-800">{totalPages}</span> ({totalCount} total records)
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Register New Customer"
          subtitle="Customer code and duplicate phone enforcement verified at server transaction"
          maxWidth="lg"
        >
          <form onSubmit={handleCreateCustomer} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Full Customer Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Verma"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={formMobile}
                  onChange={(e) => setFormMobile(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059] font-mono"
                />
                {mobileWarning && (
                  <p className="text-[11px] text-amber-700 mt-1 font-semibold flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                    <span>{mobileWarning}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="e.g. customer@example.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  City
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ara"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Postal Address
              </label>
              <input
                type="text"
                placeholder="e.g. 45-B, Vijay Nagar, AB Road"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  ID Proof Document
                </label>
                <select
                  value={formIdProofType}
                  onChange={(e) => setFormIdProofType(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
                >
                  <option value="Aadhaar Card">Aadhaar Card (आधार कार्ड)</option>
                  <option value="PAN Card">PAN Card (पैन कार्ड)</option>
                  <option value="Voter ID">Voter ID (मतदाता पहचान पत्र)</option>
                  <option value="Driving License">Driving License (ड्राइविंग लाइसेंस)</option>
                  <option value="Passport">Passport (पासपोर्ट)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  ID Proof Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. XXXX-XXXX-XXXX"
                  value={formIdProofNumber}
                  onChange={(e) => setFormIdProofNumber(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059] font-mono"
                />
              </div>
            </div>

            {/* ID Proof Image Upload */}
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
              <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
                <Camera className="w-4 h-4 text-[#C5A059]" />
                <span>Upload ID Card Photo (आधार / पैन / वोटर कार्ड की फ़ोटो)</span>
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="cursor-pointer px-3.5 py-2 bg-white hover:bg-stone-100 border border-stone-300 rounded-xl text-xs font-semibold text-stone-700 flex items-center space-x-2 transition-all shadow-2xs">
                  <UploadCloud className="w-4 h-4 text-[#C5A059]" />
                  <span>Choose Photo / Camera</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const img = new Image();
                          img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const maxDim = 900;
                            let w = img.width;
                            let h = img.height;
                            if (w > h) {
                              if (w > maxDim) { h = Math.round((h * maxDim) / w); w = maxDim; }
                            } else {
                              if (h > maxDim) { w = Math.round((w * maxDim) / h); h = maxDim; }
                            }
                            canvas.width = w;
                            canvas.height = h;
                            const ctx = canvas.getContext('2d');
                            ctx?.drawImage(img, 0, 0, w, h);
                            setFormIdProofImage(canvas.toDataURL('image/jpeg', 0.72));
                          };
                          img.src = ev.target?.result as string;
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>

                {formIdProofImage ? (
                  <div className="flex items-center space-x-2.5">
                    <img
                      src={formIdProofImage}
                      alt="ID Preview"
                      className="w-14 h-10 object-cover rounded-lg border-2 border-emerald-500 shadow-xs cursor-pointer hover:opacity-90"
                      onClick={() => setViewIdImageModal({ title: 'New Customer ID Preview', image: formIdProofImage })}
                      title="Click to preview full size"
                    />
                    <button
                      type="button"
                      onClick={() => setFormIdProofImage(null)}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center space-x-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove</span>
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] text-stone-400 italic">No photo attached yet</span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Internal Remarks & Notes
              </label>
              <textarea
                rows={2}
                placeholder="Special client requirements, referrals, or guest preferences..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-4 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitLoading}
                className="px-5 py-2 rounded-xl bg-[#14281D] hover:bg-[#1a3527] text-[#F3E7C4] text-xs font-bold shadow-xs disabled:opacity-50"
              >
                {submitLoading ? 'Registering...' : 'Register Customer'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <Modal
          isOpen={!!editingCustomer}
          onClose={() => setEditingCustomer(null)}
          title={`Edit Customer: ${editingCustomer.name}`}
          subtitle={`Master Code: ${editingCustomer.customerCode} · Server-side duplicate validation enforced`}
          maxWidth="lg"
        >
          <form onSubmit={handleUpdateCustomer} className="space-y-4">
            {editError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  required
                  value={editMobile}
                  onChange={(e) => setEditMobile(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059] font-mono"
                />
                {editMobileWarning && (
                  <p className="text-[11px] text-amber-700 mt-1 font-semibold flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                    <span>{editMobileWarning}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Address
              </label>
              <input
                type="text"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  ID Proof Document
                </label>
                <select
                  value={editIdProofType}
                  onChange={(e) => setEditIdProofType(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
                >
                  <option value="Aadhaar Card">Aadhaar Card (आधार कार्ड)</option>
                  <option value="PAN Card">PAN Card (पैन कार्ड)</option>
                  <option value="Voter ID">Voter ID (मतदाता पहचान पत्र)</option>
                  <option value="Driving License">Driving License (ड्राइविंग लाइसेंस)</option>
                  <option value="Passport">Passport (पासपोर्ट)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  ID Proof Number
                </label>
                <input
                  type="text"
                  value={editIdProofNumber}
                  onChange={(e) => setEditIdProofNumber(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059] font-mono"
                />
              </div>
            </div>

            {/* Edit ID Proof Image Upload */}
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
              <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
                <Camera className="w-4 h-4 text-[#C5A059]" />
                <span>Upload ID Card Photo (आधार / पैन / वोटर कार्ड की फ़ोटो)</span>
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="cursor-pointer px-3.5 py-2 bg-white hover:bg-stone-100 border border-stone-300 rounded-xl text-xs font-semibold text-stone-700 flex items-center space-x-2 transition-all shadow-2xs">
                  <UploadCloud className="w-4 h-4 text-[#C5A059]" />
                  <span>Choose Photo / Camera</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const img = new Image();
                          img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const maxDim = 900;
                            let w = img.width;
                            let h = img.height;
                            if (w > h) {
                              if (w > maxDim) { h = Math.round((h * maxDim) / w); w = maxDim; }
                            } else {
                              if (h > maxDim) { w = Math.round((w * maxDim) / h); h = maxDim; }
                            }
                            canvas.width = w;
                            canvas.height = h;
                            const ctx = canvas.getContext('2d');
                            ctx?.drawImage(img, 0, 0, w, h);
                            setEditIdProofImage(canvas.toDataURL('image/jpeg', 0.72));
                          };
                          img.src = ev.target?.result as string;
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>

                {editIdProofImage ? (
                  <div className="flex items-center space-x-2.5">
                    <img
                      src={editIdProofImage}
                      alt="ID Preview"
                      className="w-14 h-10 object-cover rounded-lg border-2 border-emerald-500 shadow-xs cursor-pointer hover:opacity-90"
                      onClick={() => setViewIdImageModal({ title: `${editName || 'Customer'} ID Preview`, image: editIdProofImage })}
                      title="Click to preview full size"
                    />
                    <button
                      type="button"
                      onClick={() => setEditIdProofImage(null)}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center space-x-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove</span>
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] text-stone-400 italic">No photo attached yet</span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Internal Remarks & Notes
              </label>
              <textarea
                rows={2}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-4 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setEditingCustomer(null)}
                className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editLoading}
                className="px-5 py-2 rounded-xl bg-[#14281D] hover:bg-[#1a3527] text-[#F3E7C4] text-xs font-bold shadow-xs disabled:opacity-50"
              >
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Customer Full Profile Modal */}
      {profileCustomer && (
        <Modal
          isOpen={!!profileCustomer}
          onClose={() => setProfileCustomer(null)}
          title={`Client Master: ${profileCustomer.name}`}
          subtitle={`Customer Code: ${profileCustomer.customerCode} · Registered ${new Date(profileCustomer.createdAt).toLocaleDateString('en-IN')}`}
          maxWidth="3xl"
        >
          <div className="space-y-6">
            {/* Quick KPI stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-[#FBF9F5] border border-stone-200 text-center">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Total Bookings</span>
                <p className="text-xl font-bold font-mono text-stone-900 mt-1">{profileCustomer.totalBookings}</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FBF9F5] border border-stone-200 text-center">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Lifetime Spent</span>
                <p className="text-xl font-bold font-mono text-[#14281D] mt-1 tabular-nums">
                  ₹{Number(profileCustomer.totalSpent).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FBF9F5] border border-stone-200 text-center">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Current Balance Due</span>
                <p className="text-xl font-bold font-mono text-amber-600 mt-1 tabular-nums">
                  ₹{Number(profileCustomer.outstandingAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Profile Information Card */}
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-3">
              <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">Identity & Contact Records</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-stone-400 font-medium">Mobile Number:</span>
                  <p className="font-mono font-bold text-stone-800">{profileCustomer.mobile}</p>
                </div>
                <div>
                  <span className="text-stone-400 font-medium">Email Address:</span>
                  <p className="font-medium text-stone-800">{profileCustomer.email || 'Not provided'}</p>
                </div>
                <div>
                  <span className="text-stone-400 font-medium">City & Address:</span>
                  <p className="font-medium text-stone-800">
                    {profileCustomer.address ? `${profileCustomer.address}, ` : ''}{profileCustomer.city || 'Ara'}
                  </p>
                </div>
                <div>
                  <span className="text-stone-400 font-medium">ID Proof:</span>
                  <p className="font-mono font-bold text-stone-800">
                    {profileCustomer.idProofType ? `${profileCustomer.idProofType}: ${profileCustomer.idProofNumber || 'N/A'}` : 'Not registered'}
                  </p>
                  {profileCustomer.idProofImage && (
                    <button
                      type="button"
                      onClick={() => setViewIdImageModal({
                        title: `${profileCustomer.name} - ${profileCustomer.idProofType || 'Govt ID'}`,
                        image: profileCustomer.idProofImage,
                        idInfo: `${profileCustomer.idProofType}: ${profileCustomer.idProofNumber} (Code: ${profileCustomer.customerCode})`
                      })}
                      className="mt-2 inline-flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-200 cursor-pointer transition-all"
                    >
                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
                      <span>View Uploaded ID Photo</span>
                    </button>
                  )}
                </div>
                {profileCustomer.notes && (
                  <div className="sm:col-span-2">
                    <span className="text-stone-400 font-medium">Internal Notes:</span>
                    <p className="text-stone-700 italic mt-0.5">{profileCustomer.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Bookings History */}
            <div>
              <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-2">Bookings History</h4>
              {!profileCustomer.bookings || profileCustomer.bookings.length === 0 ? (
                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-center text-xs text-stone-400">
                  No bookings registered for this customer yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {profileCustomer.bookings.map((b: any) => (
                    <div key={b.id} className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold font-mono text-stone-900">#{b.bookingNumber}</span> · {b.eventType} ({b.eventDate})
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="font-bold font-mono tabular-nums">
                          ₹{Number(b.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-stone-200 text-stone-700">
                          {b.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payments History */}
            <div>
              <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-2">Receipts & Payment Ledger</h4>
              {!profileCustomer.payments || profileCustomer.payments.length === 0 ? (
                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-center text-xs text-stone-400">
                  No payment records registered for this customer yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {profileCustomer.payments.map((p: any) => (
                    <div key={p.id} className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold font-mono text-stone-900">#{p.receiptNumber}</span> · {p.paymentMethod} on {p.paymentDate}
                      </div>
                      <span className="font-bold font-mono text-emerald-700 tabular-nums">
                        ₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation Modal for Deactivate / Activate */}
      {confirmTarget && (
        <Modal
          isOpen={!!confirmTarget}
          onClose={() => setConfirmTarget(null)}
          title={confirmTarget.action === 'deactivate' ? 'Deactivate Customer Record' : 'Reactivate Customer Record'}
          maxWidth="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-stone-600">
              Are you sure you want to {confirmTarget.action} customer{' '}
              <strong className="text-stone-900">{confirmTarget.customer.name}</strong> ({confirmTarget.customer.customerCode})?
              {confirmTarget.action === 'deactivate'
                ? ' This will mark their profile as inactive in directory listings.'
                : ' This will restore their active profile status.'}
            </p>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={actionLoading}
                className={`px-4 py-2 rounded-xl text-xs font-bold shadow-xs ${
                  confirmTarget.action === 'deactivate'
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-[#14281D] hover:bg-[#1a3527] text-[#F3E7C4]'
                }`}
              >
                {actionLoading ? 'Processing...' : confirmTarget.action === 'deactivate' ? 'Confirm Deactivation' : 'Confirm Activation'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Full-size ID Card Image Preview Modal */}
      {viewIdImageModal && (
        <Modal
          isOpen={!!viewIdImageModal}
          onClose={() => setViewIdImageModal(null)}
          title={viewIdImageModal.title}
          subtitle={viewIdImageModal.idInfo || 'Verified Customer Government ID Card'}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className="max-h-[75vh] overflow-auto rounded-xl border border-stone-200 bg-stone-900/90 flex items-center justify-center p-2">
              <img
                src={viewIdImageModal.image}
                alt={viewIdImageModal.title}
                className="max-h-[70vh] w-auto object-contain rounded-lg shadow-2xl"
              />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-stone-200">
              <span className="text-xs text-stone-500 font-medium">
                Official Document Preview
              </span>
              <div className="flex items-center space-x-2">
                <a
                  href={viewIdImageModal.image}
                  download="customer_id_proof.jpg"
                  className="px-3.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold flex items-center space-x-1.5 transition-all"
                >
                  <Download className="w-3.5 h-3.5 text-stone-600" />
                  <span>Download Photo</span>
                </a>
                <button
                  type="button"
                  onClick={() => setViewIdImageModal(null)}
                  className="px-4 py-1.5 rounded-xl bg-[#14281D] hover:bg-[#1a3527] text-[#F3E7C4] text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
