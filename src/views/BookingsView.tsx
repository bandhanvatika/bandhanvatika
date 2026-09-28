import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../api/client.ts';
import { Booking, Hall, Room } from '../types/index.ts';
import { Modal } from '../components/Modal.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { PrintReceipt } from '../components/PrintReceipt.tsx';
import { printElement } from '../utils/print.ts';
import {
  CalendarCheck,
  Search,
  Filter,
  Plus,
  Eye,
  CheckCircle,
  XCircle,
  ChevronDown,
  Sparkles,
  AlertCircle,
  Clock,
  Landmark,
  User,
  Phone,
  Edit2,
  Calendar,
  History,
  Trash2,
  ArrowRight,
  ShieldAlert,
  Printer,
  Receipt,
} from 'lucide-react';

interface BookingsViewProps {
  onOpenNewBooking: (dateStr?: string, pkg?: 'STANDARD' | 'JEEVIKA') => void;
  onSelectBookingForInvoice?: (booking: Booking) => void;
  onSelectBookingForPayment?: (booking: Booking) => void;
  searchQuery?: string;
}

export const BookingsView: React.FC<BookingsViewProps> = ({
  onOpenNewBooking,
  searchQuery = '',
}) => {
  const { hasRole, user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [hallsList, setHallsList] = useState<Hall[]>([]);
  const [roomsList, setRoomsList] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedHall, setSelectedHall] = useState<string>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [localSearch, setLocalSearch] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Selected Booking for Full Detail View
  const [detailBooking, setDetailBooking] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [printReceiptData, setPrintReceiptData] = useState<any | null>(null);

  // Status Transition Modal
  const [statusTransitionModal, setStatusTransitionModal] = useState<Booking | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [transitionNotes, setTransitionNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Cancellation Modal
  const [cancelModalBooking, setCancelModalBooking] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Edit Booking Modal State
  const [editBookingModal, setEditBookingModal] = useState<any | null>(null);
  const [editEventType, setEditEventType] = useState('');
  const [editEventDate, setEditEventDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editGuestCount, setEditGuestCount] = useState(100);
  const [editHallId, setEditHallId] = useState('');
  const [editRoomIds, setEditRoomIds] = useState<string[]>([]);
  const [editCheckInDate, setEditCheckInDate] = useState('');
  const [editCheckOutDate, setEditCheckOutDate] = useState('');
  const [editDiscount, setEditDiscount] = useState(0);
  const [editNotes, setEditNotes] = useState('');
  const [editServices, setEditServices] = useState<Array<{ name: string; quantity: number; rate: number; amount: number }>>([]);
  const [newEditServiceName, setNewEditServiceName] = useState('');
  const [newEditServiceQty, setNewEditServiceQty] = useState('1');
  const [newEditServiceRate, setNewEditServiceRate] = useState('');
  const [editAvailabilityChecking, setEditAvailabilityChecking] = useState(false);
  const [editAvailabilityResult, setEditAvailabilityResult] = useState<{ available: boolean; message?: string } | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const fetchBookings = async () => {
    setLoading(true);
    const [bRes, hRes, rRes] = await Promise.all([
      apiRequest<any>('/bookings?limit=100'),
      apiRequest<Hall[]>('/halls'),
      apiRequest<Room[]>('/rooms'),
    ]);
    if (bRes.success && bRes.data) {
      // Handles both array or { data: Booking[] } format
      const list = Array.isArray(bRes.data) ? bRes.data : bRes.data.data || [];
      setBookings(list);
    }
    if (hRes.success && hRes.data) setHallsList(hRes.data);
    if (rRes.success && rRes.data) setRoomsList(rRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const openBookingDetail = async (b: Booking) => {
    setLoadingDetail(true);
    const res = await apiRequest<any>(`/bookings/${b.id}`);
    setLoadingDetail(false);
    if (res.success && res.data) {
      setDetailBooking(res.data);
    } else {
      setDetailBooking(b);
    }
  };

  const openEditModal = async (b: any) => {
    setEditError(null);
    let full = b;
    if (!b.services || !b.bookingRooms) {
      const res = await apiRequest<any>(`/bookings/${b.id}`);
      if (res.success && res.data) full = res.data;
    }

    setEditBookingModal(full);
    setEditEventType(full.eventType);
    setEditEventDate(full.eventDate);
    setEditStartTime(full.startTime);
    setEditEndTime(full.endTime);
    setEditGuestCount(full.guestCount);
    setEditHallId(full.hallId || '');
    setEditDiscount(Number(full.discount) || 0);
    setEditNotes(full.notes || '');

    // Rooms
    const rIds = full.roomIds ? (typeof full.roomIds === 'string' ? JSON.parse(full.roomIds) : full.roomIds) : [];
    setEditRoomIds(rIds);
    if (full.bookingRooms && full.bookingRooms.length > 0) {
      setEditCheckInDate(full.bookingRooms[0].checkInDate || full.eventDate);
      setEditCheckOutDate(full.bookingRooms[0].checkOutDate || full.eventDate);
    } else {
      setEditCheckInDate(full.eventDate);
      const nextDay = new Date(`${full.eventDate}T00:00:00Z`);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      setEditCheckOutDate(nextDay.toISOString().split('T')[0]);
    }

    // Services
    let parsed: any[] = [];
    if (Array.isArray(full.services)) {
      parsed = full.services;
    } else if (typeof full.services === 'string') {
      try {
        parsed = JSON.parse(full.services);
      } catch {
        parsed = [];
      }
    }
    setEditServices(
      parsed.map((s) => ({
        name: s.name,
        quantity: Number(s.quantity) || 1,
        rate: Number(s.rate) || Number(s.cost) || 0,
        amount: (Number(s.quantity) || 1) * (Number(s.rate) || Number(s.cost) || 0),
      }))
    );
  };

  // Recheck availability when editing hall, dates or rooms
  useEffect(() => {
    if (!editBookingModal || !editHallId || !editEventDate || !editStartTime || !editEndTime || editStartTime >= editEndTime) {
      return;
    }

    const checkEditAvailability = async () => {
      setEditAvailabilityChecking(true);
      const res = await apiRequest('/bookings/check-availability', {
        method: 'POST',
        body: JSON.stringify({
          hallId: editHallId,
          eventDate: editEventDate,
          startTime: editStartTime,
          endTime: editEndTime,
          roomIds: editRoomIds,
          checkInDate: editCheckInDate || editEventDate,
          checkOutDate: editCheckOutDate || editEventDate,
          excludeBookingId: editBookingModal.id,
        }),
      });
      setEditAvailabilityChecking(false);
      if (res.available) {
        setEditAvailabilityResult({ available: true, message: 'Venue and selected rooms are free and ready!' });
      } else {
        setEditAvailabilityResult({ available: false, message: res.message || 'Scheduling conflict detected.' });
      }
    };
    checkEditAvailability();
  }, [editBookingModal, editHallId, editRoomIds, editEventDate, editStartTime, editEndTime, editCheckInDate, editCheckOutDate]);

  const handleSaveEdit = async () => {
    if (!editBookingModal) return;
    if (editStartTime >= editEndTime) {
      setEditError('Start time must be strictly before End time.');
      return;
    }
    if (editAvailabilityResult && !editAvailabilityResult.available) {
      setEditError('Cannot save booking: scheduling conflict exists with another booking.');
      return;
    }

    setEditLoading(true);
    setEditError(null);

    const res = await apiRequest(`/bookings/${editBookingModal.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        eventType: editEventType,
        eventDate: editEventDate,
        startTime: editStartTime,
        endTime: editEndTime,
        guestCount: editGuestCount,
        hallId: editHallId,
        roomIds: editRoomIds,
        checkInDate: editRoomIds.length > 0 ? editCheckInDate : undefined,
        checkOutDate: editRoomIds.length > 0 ? editCheckOutDate : undefined,
        services: editServices,
        discount: editDiscount,
        notes: editNotes,
      }),
    });

    setEditLoading(false);
    if (res.success) {
      setEditBookingModal(null);
      fetchBookings();
      if (detailBooking?.id === editBookingModal.id) {
        openBookingDetail(editBookingModal);
      }
    } else {
      setEditError(res.error?.message || 'Failed to update booking.');
    }
  };

  const activeSearch = searchQuery || localSearch;

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (selectedStatus !== 'ALL' && b.status !== selectedStatus) return false;
      if (selectedHall !== 'ALL' && b.hallId !== selectedHall) return false;
      if (startDate && b.eventDate < startDate) return false;
      if (endDate && b.eventDate > endDate) return false;

      if (activeSearch.trim()) {
        const q = activeSearch.toLowerCase();
        const matchNumber = b.bookingNumber.toLowerCase().includes(q);
        const matchCustomer = b.customer?.name?.toLowerCase().includes(q);
        const matchPhone = b.customer?.mobile?.includes(q);
        const matchEvent = b.eventType?.toLowerCase().includes(q);
        if (!matchNumber && !matchCustomer && !matchPhone && !matchEvent) return false;
      }
      return true;
    });
  }, [bookings, selectedStatus, selectedHall, startDate, endDate, activeSearch]);

  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage) || 1;
  const paginatedBookings = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredBookings.slice(start, start + itemsPerPage);
  }, [filteredBookings, currentPage, itemsPerPage]);

  const handleStatusChange = async () => {
    if (!statusTransitionModal || !newStatus) return;
    setActionLoading(true);
    setActionError(null);
    const res = await apiRequest(`/bookings/${statusTransitionModal.id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus, notes: transitionNotes }),
    });
    setActionLoading(false);
    if (res.success) {
      setStatusTransitionModal(null);
      fetchBookings();
      if (detailBooking?.id === statusTransitionModal.id) {
        openBookingDetail(statusTransitionModal);
      }
    } else {
      setActionError(res.error?.message || 'Status transition failed.');
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelModalBooking) return;
    setActionLoading(true);
    setActionError(null);
    const res = await apiRequest(`/bookings/${cancelModalBooking.id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: cancelReason }),
    });
    setActionLoading(false);
    if (res.success) {
      setCancelModalBooking(null);
      setCancelReason('');
      fetchBookings();
      if (detailBooking?.id === cancelModalBooking.id) {
        setDetailBooking(null);
      }
    } else {
      setActionError(res.error?.message || 'Cancellation failed.');
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-stone-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold font-brand text-[#14281D]">Bookings Engine</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Total {filteredBookings.length} reservations matching current operational filters
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {hasRole(['OWNER', 'MANAGER', 'RECEPTIONIST']) && (
            <>
              <button
                type="button"
                onClick={() => onOpenNewBooking?.(undefined, 'JEEVIKA')}
                className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-[#B91C1C] border border-red-200 text-xs font-bold transition-all shadow-xs cursor-pointer"
                title="1-Click JEEViKA Training & Food Booking (जीविका)"
              >
                <span>🌾</span>
                <span>New JEEViKA Booking</span>
              </button>

              <button
                onClick={() => onOpenNewBooking?.()}
                className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#14281D] hover:bg-[#1a3527] text-[#F3E7C4] text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#C5A059]" />
                <span>Create New Booking</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="flex flex-col gap-3">
        {/* Status Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'CONFIRMED', 'SCHEDULED', 'IN_PROGRESS', 'POSTPONED', 'COMPLETED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => {
                setSelectedStatus(st);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                selectedStatus === st
                  ? 'bg-[#14281D] text-[#F3E7C4] shadow-xs'
                  : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Date Ranges, Hall Filter & Search */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Hall Filter */}
          <select
            value={selectedHall}
            onChange={(e) => {
              setSelectedHall(e.target.value);
              setCurrentPage(1);
            }}
            className="p-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 outline-none"
          >
            <option value="ALL">All Venues</option>
            {hallsList.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>

          {/* Date range */}
          <div className="flex items-center space-x-1 bg-white border border-stone-200 rounded-xl px-2 py-1 text-xs">
            <span className="text-[10px] text-stone-400 font-bold uppercase">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs outline-none bg-transparent"
            />
            <span className="text-[10px] text-stone-400 font-bold uppercase ml-1">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs outline-none bg-transparent"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-[10px] text-rose-500 hover:underline ml-1 font-semibold"
              >
                Clear
              </button>
            )}
          </div>

          {/* Local Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search booking #, client, event..."
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-8 pr-3 py-2 bg-white border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
            />
          </div>
        </div>
      </div>

      {/* Bookings Table Card */}
      <div className="p-5 rounded-3xl bg-white border border-stone-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-stone-400 font-semibold">
            Loading reservations...
          </div>
        ) : paginatedBookings.length === 0 ? (
          <div className="py-12 text-center text-xs text-stone-400 font-semibold">
            No bookings matching the selected criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Booking #</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Event</th>
                  <th className="py-3 px-3">Venue</th>
                  <th className="py-3 px-3">Date & Slot</th>
                  <th className="py-3 px-3 text-right">Total (₹)</th>
                  <th className="py-3 px-3 text-right">Balance (₹)</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {paginatedBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-[#14281D]">
                      {b.bookingNumber}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-stone-900">{b.customer?.name || 'Customer'}</div>
                      <div className="text-[11px] text-stone-400">{b.customer?.mobile}</div>
                    </td>
                    <td className="py-3 px-3 font-semibold text-stone-800">
                      {b.eventType}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-[#14281D]/5 text-[#14281D] font-semibold text-[11px]">
                        {b.hall?.name || 'Grand Hall'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-stone-600">
                      <div>{b.eventDate}</div>
                      <div className="text-[10px] text-stone-400">{b.startTime} - {b.endTime}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-stone-900">
                      ₹{Number(b.grandTotal).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-right font-bold">
                      {Number(b.balanceAmount) === 0 ? (
                        <span className="text-emerald-600">₹0</span>
                      ) : (
                        <span className="text-amber-600">₹{Number(b.balanceAmount).toLocaleString('en-IN')}</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          b.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.status === 'CONFIRMED'
                            ? 'bg-blue-100 text-blue-800'
                            : b.status === 'SCHEDULED'
                            ? 'bg-purple-100 text-purple-800'
                            : b.status === 'IN_PROGRESS'
                            ? 'bg-amber-100 text-amber-800'
                            : b.status === 'POSTPONED'
                            ? 'bg-orange-100 text-orange-800'
                            : b.status === 'CANCELLED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right space-x-1 whitespace-nowrap">
                      {/* View Details */}
                      <button
                        onClick={() => openBookingDetail(b)}
                        title="View Full Booking Dossier"
                        className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Edit Booking */}
                      {hasRole(['OWNER', 'MANAGER', 'RECEPTIONIST']) &&
                        b.status !== 'CANCELLED' &&
                        b.status !== 'COMPLETED' && (
                          <button
                            onClick={() => openEditModal(b)}
                            title="Edit Booking & Schedule"
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}

                      {/* Status Transition */}
                      {hasRole(['OWNER', 'MANAGER', 'RECEPTIONIST']) &&
                        b.status !== 'CANCELLED' &&
                        b.status !== 'COMPLETED' && (
                          <button
                            onClick={() => {
                              setStatusTransitionModal(b);
                              setNewStatus(b.status);
                              setTransitionNotes('');
                            }}
                            title="Update Status Workflow"
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        )}

                      {/* Cancel Booking */}
                      {hasRole(['OWNER', 'MANAGER']) &&
                        b.status !== 'CANCELLED' &&
                        b.status !== 'COMPLETED' && (
                          <button
                            onClick={() => {
                              setCancelModalBooking(b);
                              setCancelReason('');
                              setActionError(null);
                            }}
                            title="Cancel Booking & Release Slot"
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 mt-3 border-t border-stone-100 text-xs text-stone-500">
                <div>
                  Showing page {currentPage} of {totalPages} ({filteredBookings.length} total)
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded-lg border border-stone-200 disabled:opacity-40 hover:bg-stone-50 font-semibold"
                  >
                    Previous
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1 rounded-lg border border-stone-200 disabled:opacity-40 hover:bg-stone-50 font-semibold"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* COMPREHENSIVE BOOKING DETAILS MODAL */}
      {detailBooking && (
        <Modal
          isOpen={!!detailBooking}
          onClose={() => setDetailBooking(null)}
          title={`Booking Dossier #${detailBooking.bookingNumber}`}
          subtitle={`${detailBooking.eventType} on ${detailBooking.eventDate} (Asia/Kolkata)`}
          maxWidth="3xl"
        >
          <div className="space-y-5">
            {/* Status & Timing Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-stone-100 border border-stone-200 text-xs">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-stone-700">Status:</span>
                <span
                  className={`px-2 py-0.5 rounded-md font-bold uppercase text-[10px] ${
                    detailBooking.status === 'COMPLETED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : detailBooking.status === 'CANCELLED'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {detailBooking.status}
                </span>
              </div>
              <div className="text-stone-500">
                Created by <strong className="text-stone-800">{detailBooking.createdBy || 'Staff'}</strong> on{' '}
                {new Date(detailBooking.createdAt).toLocaleDateString('en-IN')}
              </div>
            </div>

            {/* Customer & Venue Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-stone-50 border border-stone-200">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                  Client Information
                </span>
                <h4 className="font-bold text-sm text-stone-900">{detailBooking.customer?.name}</h4>
                <p className="text-xs text-stone-600">Mobile: {detailBooking.customer?.mobile}</p>
                {detailBooking.customer?.email && (
                  <p className="text-xs text-stone-600">Email: {detailBooking.customer?.email}</p>
                )}
                <p className="text-xs text-stone-500">
                  Address: {detailBooking.customer?.address || 'Ara'}, {detailBooking.customer?.city || 'Bihar'}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                  Venue & Schedule
                </span>
                <h4 className="font-bold text-sm text-[#14281D]">{detailBooking.hall?.name || 'Grand Hall'}</h4>
                <p className="text-xs text-stone-600">
                  Date: {detailBooking.eventDate} ({detailBooking.startTime} - {detailBooking.endTime})
                </p>
                <p className="text-xs text-stone-500">Expected Guests: {detailBooking.guestCount}</p>
              </div>
            </div>

            {/* Venue & Hall Charges */}
            {(detailBooking.hall || (detailBooking.bookingHalls && detailBooking.bookingHalls.length > 0)) && (
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-2">
                  Venue & Hall Rental Charges
                </span>
                <div className="space-y-1.5 text-xs">
                  {detailBooking.bookingHalls && detailBooking.bookingHalls.length > 0 ? (
                    detailBooking.bookingHalls.map((bh: any, idx: number) => {
                      const hallInfo = hallsList.find((h) => h.id === bh.hallId) || detailBooking.hall;
                      return (
                        <div key={bh.id || idx} className="flex justify-between items-center p-2 rounded-lg bg-white border border-stone-200">
                          <div>
                            <span className="font-semibold text-stone-900">
                              Venue Rental: {hallInfo?.name || 'Primary Hall'}
                            </span>
                            <span className="text-[11px] text-stone-500 ml-2">
                              ({bh.startTime || detailBooking.startTime} - {bh.endTime || detailBooking.endTime})
                            </span>
                          </div>
                          <span className="font-bold text-stone-800">
                            ₹{Number(bh.price || hallInfo?.basePrice || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      );
                    })
                  ) : detailBooking.hall ? (
                    <div className="flex justify-between items-center p-2 rounded-lg bg-white border border-stone-200">
                      <div>
                        <span className="font-semibold text-stone-900">
                          Venue Rental: {detailBooking.hall.name}
                        </span>
                        <span className="text-[11px] text-stone-500 ml-2">
                          ({detailBooking.startTime} - {detailBooking.endTime})
                        </span>
                      </div>
                      <span className="font-bold text-stone-800">
                        ₹{Number(detailBooking.hall.basePrice || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* Allocated Rooms */}
            {detailBooking.bookingRooms && detailBooking.bookingRooms.length > 0 && (
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-2">
                  Allocated Guest Rooms ({detailBooking.bookingRooms.length})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {detailBooking.bookingRooms.map((br: any) => (
                    <div key={br.id} className="p-2.5 rounded-xl bg-white border border-stone-200 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-stone-900">Room {br.room?.roomNumber || br.roomId}</div>
                        <div className="text-[11px] text-stone-500">
                          {br.checkInDate} to {br.checkOutDate}
                        </div>
                      </div>
                      <span className="font-bold text-stone-800">₹{Number(br.price).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Itemized Services Breakdown */}
            {detailBooking.services && (Array.isArray(detailBooking.services) ? detailBooking.services.length > 0 : true) && (
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-2">
                  Itemized Additional Services
                </span>
                <div className="space-y-1.5 text-xs">
                  {(Array.isArray(detailBooking.services)
                    ? detailBooking.services
                    : JSON.parse(detailBooking.services || '[]')
                  ).map((s: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center p-2 rounded-lg bg-white border border-stone-200">
                      <div>
                        <span className="font-semibold text-stone-900">{s.name}</span>
                        {s.quantity && s.rate && (
                          <span className="text-[11px] text-stone-500 ml-2">
                            (Qty: {s.quantity} × ₹{s.rate})
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-stone-800">
                        ₹{(s.amount || s.cost || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Financial Ledger Breakdown */}
            {(() => {
              const hallTotal = detailBooking.bookingHalls && detailBooking.bookingHalls.length > 0
                ? detailBooking.bookingHalls.reduce((sum: number, bh: any) => sum + Number(bh.price || 0), 0)
                : Number(detailBooking.hall?.basePrice || 0);
              const roomsTotal = detailBooking.bookingRooms && detailBooking.bookingRooms.length > 0
                ? detailBooking.bookingRooms.reduce((sum: number, br: any) => sum + Number(br.price || 0), 0)
                : 0;
              const servicesList = Array.isArray(detailBooking.services)
                ? detailBooking.services
                : JSON.parse(detailBooking.services || '[]');
              const servicesTotal = servicesList.reduce((sum: number, s: any) => sum + Number(s.amount || s.cost || 0), 0);

              return (
                <div className="p-4 rounded-2xl bg-[#14281D] text-[#FBF9F5] space-y-2">
                  <span className="text-[10px] font-bold text-[#E2C07D] uppercase tracking-wider block mb-1">
                    Financial Summary Breakdown
                  </span>
                  {hallTotal > 0 && (
                    <div className="flex justify-between text-xs text-stone-300">
                      <span>Venue Rental ({detailBooking.hall?.name || 'Hall'})</span>
                      <span>₹{hallTotal.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {roomsTotal > 0 && (
                    <div className="flex justify-between text-xs text-stone-300">
                      <span>Rooms Accommodation ({detailBooking.bookingRooms.length} rooms)</span>
                      <span>₹{roomsTotal.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {servicesTotal > 0 && (
                    <div className="flex justify-between text-xs text-stone-300">
                      <span>Additional Services Total</span>
                      <span>₹{servicesTotal.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs font-bold text-stone-200 pt-1 border-t border-white/10">
                    <span>Subtotal</span>
                    <span>₹{Number(detailBooking.subtotal).toLocaleString('en-IN')}</span>
                  </div>
                  {Number(detailBooking.discount) > 0 && (
                    <div className="flex justify-between text-xs text-emerald-400">
                      <span>Discount</span>
                      <span>- ₹{Number(detailBooking.discount).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {Number(detailBooking.taxAmount) > 0 && (
                    <div className="flex justify-between text-xs text-stone-300">
                      <span>GST ({detailBooking.taxPercent}%)</span>
                      <span>+ ₹{Number(detailBooking.taxAmount).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-[#E2C07D] pt-2 border-t border-white/10 font-brand">
                    <span>Grand Total</span>
                    <span>₹{Number(detailBooking.grandTotal).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-xs text-emerald-300 font-semibold">
                    <span>Amount Paid</span>
                    <span>₹{Number(detailBooking.paidAmount).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-xs text-rose-300 font-bold">
                    <span>Balance Due</span>
                    <span>₹{Number(detailBooking.balanceAmount).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              );
            })()}

            {/* Payments List for this booking */}
            {detailBooking.payments && detailBooking.payments.length > 0 && (
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                  Recorded Payments & Receipts ({detailBooking.payments.length})
                </span>
                <div className="space-y-2">
                  {detailBooking.payments.map((p: any) => (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl bg-white border border-stone-200 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-stone-900">#{p.receiptNumber}</span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                            {p.paymentMethod}
                          </span>
                          {p.isReversed && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-[10px]">
                              REVERSED
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-stone-500">
                          Date: {p.paymentDate} {p.transactionReference ? `• Ref: ${p.transactionReference}` : ''}
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <span className="font-bold text-sm text-[#14281D]">
                          ₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const data = {
                              receiptNumber: p.receiptNumber,
                              paymentDate: p.paymentDate,
                              amount: p.amount,
                              paymentMethod: p.paymentMethod,
                              paymentType: p.paymentType || 'PARTIAL',
                              transactionReference: p.transactionReference,
                              notes: p.notes,
                              isReversed: p.isReversed,
                              reversalReason: p.reversalReason,
                              receivedBy: p.createdBy,
                              customer: detailBooking.customer,
                              booking: detailBooking,
                              invoiceTotal: detailBooking.grandTotal,
                              balanceAfterPayment: detailBooking.balanceAmount,
                              showTerms: true,
                            };
                            setPrintReceiptData(data);
                            setTimeout(() => {
                              printElement('bandhan-print-receipt', `Receipt_${p.receiptNumber}`);
                            }, 350);
                          }}
                          className="p-1.5 rounded-lg bg-stone-100 hover:bg-[#14281D] hover:text-[#F3E7C4] text-stone-700 transition-colors cursor-pointer"
                          title="View & Print Official Receipt"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Booking Notes */}
            {detailBooking.notes && (
              <div className="p-3 rounded-xl bg-stone-100 text-xs text-stone-700">
                <span className="font-bold block text-stone-900 mb-0.5">Booking Notes:</span>
                {detailBooking.notes}
              </div>
            )}

            {/* Audit Trail for this booking */}
            {detailBooking.auditLogs && detailBooking.auditLogs.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-2">
                  Audit History
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto text-[11px]">
                  {detailBooking.auditLogs.map((log: any) => (
                    <div key={log.id} className="p-2 rounded-lg bg-white border border-stone-200 flex justify-between items-start">
                      <div>
                        <span className="font-bold text-stone-800">{log.action}: </span>
                        <span className="text-stone-600">{log.details}</span>
                      </div>
                      <span className="text-[10px] text-stone-400 shrink-0 ml-2">
                        {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Official Terms & Conditions (सट्टा नियम व शर्तें) */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/70 border border-amber-200/90 text-xs space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-amber-200/80 text-amber-950 font-bold">
                <span className="flex items-center space-x-1.5 text-xs font-bold">
                  <span>📜</span>
                  <span>नोट :- (नियम व शर्तें / Terms &amp; Conditions)</span>
                </span>
                <span className="text-[10px] font-normal text-amber-800">बंधन वाटिका, पकड़ीयावर, चन्दवाँ, आरा</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-stone-800 font-medium">
                <li>किसी कारण वश सट्टा रद्द होने पर अग्रीम राशी जब्त हो जायेगी</li>
                <li>उत्सव का दिनांक पुनः बदलने पर उपलब्धता देखी जायेगी</li>
                <li>तय कुल रकम का 30% अग्रीम के रूप में लिया जायेगा</li>
                <li>उत्सव की दिनांक से 5 दिन पहले कुल रकम का भुगतान करना होगा।</li>
                <li>उत्सव भवन के यत्र तत्र गंदगी फैलाने पर सफाई का खर्च सट्टेदार को देना होगा।</li>
                <li>किसी प्रकार का तोड़फोड़ या भारी नुकसान होने पर उसका वाजिब भुगतान सट्टेदार को करना होगा।</li>
                <li>उत्सव के दिन किसी भी विद्युत उपकरण के खराबी आने पर ठीक कराने का प्रयास किया जायेगा परन्तु नहीं होने पर उसकी जिम्मेदारी प्रबंधन पर नहीं होगी।</li>
              </ol>
            </div>

            {/* Action Bar inside details */}
            <div className="flex items-center justify-between pt-2 border-t border-stone-200">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const recNum = detailBooking.bookingNumber ? `BV-REC-${detailBooking.bookingNumber}` : 'BV-REC-SUMMARY';
                    const data = {
                      receiptNumber: recNum,
                      paymentDate: new Date().toISOString().split('T')[0],
                      amount: detailBooking.paidAmount || 0,
                      paymentMethod: detailBooking.payments?.[0]?.paymentMethod || 'BANK_TRANSFER',
                      paymentType: Number(detailBooking.balanceAmount) === 0 ? 'FINAL' : 'PARTIAL',
                      transactionReference: detailBooking.payments?.[0]?.transactionReference || null,
                      notes: detailBooking.notes,
                      receivedBy: 'Accounts Officer',
                      customer: detailBooking.customer,
                      booking: detailBooking,
                      paymentHistory: detailBooking.payments || [],
                      invoiceTotal: detailBooking.grandTotal,
                      balanceAfterPayment: detailBooking.balanceAmount,
                      showTerms: true,
                    };
                    setPrintReceiptData(data);
                    setTimeout(() => {
                      printElement('bandhan-print-receipt', `Receipt_${recNum}`);
                    }, 350);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-[#14281D] hover:bg-[#1a3527] text-[#F3E7C4] text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer"
                  title="Print Official Booking & Payment Receipt (A4)"
                >
                  <Printer className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span>Print Receipt</span>
                </button>

                {hasRole(['OWNER', 'MANAGER', 'RECEPTIONIST']) &&
                  detailBooking.status !== 'CANCELLED' &&
                  detailBooking.status !== 'COMPLETED' && (
                    <button
                      onClick={() => {
                        openEditModal(detailBooking);
                        setDetailBooking(null);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs font-bold flex items-center space-x-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Booking</span>
                    </button>
                  )}

                {hasRole(['OWNER', 'MANAGER']) &&
                  detailBooking.status !== 'CANCELLED' &&
                  detailBooking.status !== 'COMPLETED' && (
                    <button
                      onClick={() => {
                        setCancelModalBooking(detailBooking);
                        setCancelReason('');
                        setDetailBooking(null);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold flex items-center space-x-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancel Booking</span>
                    </button>
                  )}
              </div>

              <button
                onClick={() => setDetailBooking(null)}
                className="px-4 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-xs font-semibold text-stone-800"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* CONTROLLED STATUS TRANSITION MODAL */}
      {statusTransitionModal && (
        <Modal
          isOpen={!!statusTransitionModal}
          onClose={() => setStatusTransitionModal(null)}
          title={`Update Status: #${statusTransitionModal.bookingNumber}`}
          subtitle="Enforcing strict business state transitions"
          maxWidth="md"
        >
          <div className="space-y-4">
            {actionError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {actionError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Current Status
              </label>
              <div className="p-2.5 rounded-xl bg-stone-100 font-bold text-stone-800 text-xs">
                {statusTransitionModal.status}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Target Status
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold outline-none focus:border-[#C5A059]"
              >
                {statusTransitionModal.status === 'CONFIRMED' && (
                  <>
                    <option value="CONFIRMED">CONFIRMED</option>
                    <option value="SCHEDULED">SCHEDULED (Event Finalized)</option>
                    <option value="IN_PROGRESS">IN_PROGRESS (Event Underway)</option>
                    <option value="POSTPONED">POSTPONED</option>
                    {hasRole(['OWNER', 'MANAGER']) && <option value="CANCELLED">CANCELLED</option>}
                  </>
                )}
                {statusTransitionModal.status === 'SCHEDULED' && (
                  <>
                    <option value="SCHEDULED">SCHEDULED</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="COMPLETED">COMPLETED (Event Finished)</option>
                    <option value="POSTPONED">POSTPONED</option>
                    {hasRole(['OWNER', 'MANAGER']) && <option value="CANCELLED">CANCELLED</option>}
                  </>
                )}
                {statusTransitionModal.status === 'IN_PROGRESS' && (
                  <>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="COMPLETED">COMPLETED</option>
                    {hasRole(['OWNER', 'MANAGER']) && <option value="CANCELLED">CANCELLED</option>}
                  </>
                )}
                {statusTransitionModal.status === 'POSTPONED' && (
                  <>
                    <option value="POSTPONED">POSTPONED</option>
                    <option value="CONFIRMED">CONFIRMED</option>
                    <option value="SCHEDULED">SCHEDULED</option>
                    {hasRole(['OWNER', 'MANAGER']) && <option value="CANCELLED">CANCELLED</option>}
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Status Change Note
              </label>
              <input
                type="text"
                placeholder="Reason or operational remark..."
                value={transitionNotes}
                onChange={(e) => setTransitionNotes(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setStatusTransitionModal(null)}
                className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleStatusChange}
                className="px-4 py-2 rounded-xl bg-[#14281D] hover:bg-[#1f3c2b] text-[#F3E7C4] text-xs font-bold shadow-xs"
              >
                {actionLoading ? 'Updating...' : 'Save Status Change'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* EXPLICIT CANCELLATION MODAL */}
      {cancelModalBooking && (
        <Modal
          isOpen={!!cancelModalBooking}
          onClose={() => setCancelModalBooking(null)}
          title={`Cancel Booking: #${cancelModalBooking.bookingNumber}`}
          subtitle="This action releases the hall and room reservation slot immediately"
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
              <span>
                Cancelling this booking will preserve the audit record while freeing up the date slot for new bookings.
              </span>
            </div>

            {actionError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {actionError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Cancellation Reason *
              </label>
              <textarea
                rows={3}
                required
                placeholder="Reason requested by customer or management decision..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setCancelModalBooking(null)}
                className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold"
              >
                Dismiss
              </button>
              <button
                type="button"
                disabled={actionLoading || !cancelReason.trim()}
                onClick={handleConfirmCancel}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
              >
                {actionLoading ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* CONTROLLED EDIT BOOKING MODAL */}
      {editBookingModal && (
        <Modal
          isOpen={!!editBookingModal}
          onClose={() => setEditBookingModal(null)}
          title={`Edit Booking #${editBookingModal.bookingNumber}`}
          subtitle="Modifying schedule, venue, rooms or financial items"
          maxWidth="3xl"
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {editError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{editError}</span>
              </div>
            )}

            {/* Event & Schedule */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-stone-50 border border-stone-200">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">Event Type</label>
                <input
                  type="text"
                  value={editEventType}
                  onChange={(e) => setEditEventType(e.target.value)}
                  className="w-full p-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">Event Date</label>
                <input
                  type="date"
                  value={editEventDate}
                  onChange={(e) => setEditEventDate(e.target.value)}
                  className="w-full p-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">Start Time</label>
                <input
                  type="time"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  className="w-full p-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">End Time</label>
                <input
                  type="time"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                  className="w-full p-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">Expected Guests</label>
                <input
                  type="number"
                  min="1"
                  value={editGuestCount}
                  onChange={(e) => setEditGuestCount(Number(e.target.value))}
                  className="w-full p-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold outline-none"
                />
              </div>
            </div>

            {/* Venue & Conflict Check */}
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Primary Venue / Hall
              </label>
              <select
                value={editHallId}
                onChange={(e) => setEditHallId(e.target.value)}
                className="w-full p-2.5 bg-white border border-stone-200 rounded-xl text-xs font-semibold outline-none focus:border-[#C5A059]"
              >
                {hallsList.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.type} · Capacity: {h.capacity} · ₹{Number(h.basePrice).toLocaleString('en-IN')})
                  </option>
                ))}
              </select>
            </div>

            {/* Room Dates & Selection */}
            <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                  Guest Rooms ({editRoomIds.length} Selected)
                </span>
                <span className="text-[11px] text-stone-500">
                  Select room dates [check-in, check-out)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">Check-in</label>
                  <input
                    type="date"
                    value={editCheckInDate}
                    onChange={(e) => setEditCheckInDate(e.target.value)}
                    className="w-full p-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">Check-out</label>
                  <input
                    type="date"
                    value={editCheckOutDate}
                    onChange={(e) => setEditCheckOutDate(e.target.value)}
                    className="w-full p-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-36 overflow-y-auto p-1">
                {roomsList.map((r) => {
                  const isSelected = editRoomIds.includes(r.id);
                  return (
                    <div
                      key={r.id}
                      onClick={() => {
                        if (isSelected) setEditRoomIds(editRoomIds.filter((id) => id !== r.id));
                        else setEditRoomIds([...editRoomIds, r.id]);
                      }}
                      className={`p-2 rounded-xl border text-center cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#14281D] bg-[#14281D] text-[#F3E7C4]'
                          : 'border-stone-200 bg-white hover:border-stone-300'
                      }`}
                    >
                      <div className="text-xs font-bold">Room {r.roomNumber}</div>
                      <div className="text-[10px] opacity-75">{r.roomType}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Availability Status */}
            <div className="p-3 rounded-xl border text-xs">
              {editAvailabilityChecking ? (
                <div className="flex items-center space-x-2 text-stone-500">
                  <span className="animate-spin w-3.5 h-3.5 border-2 border-[#C5A059] border-t-transparent rounded-full" />
                  <span>Re-checking calendar availability...</span>
                </div>
              ) : editAvailabilityResult?.available ? (
                <div className="flex items-center space-x-2 text-emerald-700 bg-emerald-50 p-2 rounded-lg font-medium">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{editAvailabilityResult.message}</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-rose-700 bg-rose-50 p-2 rounded-lg font-medium">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{editAvailabilityResult?.message || 'Scheduling collision detected.'}</span>
                </div>
              )}
            </div>

            {/* Discount & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">Discount (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={editDiscount}
                  onChange={(e) => setEditDiscount(Math.max(0, Number(e.target.value)))}
                  className="w-full p-2 bg-white border border-stone-200 rounded-xl text-xs font-bold outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">Notes</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full p-2 bg-white border border-stone-200 rounded-xl text-xs outline-none"
                />
              </div>
            </div>

            {/* Save Buttons */}
            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setEditBookingModal(null)}
                className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={editLoading || editAvailabilityResult?.available === false}
                onClick={handleSaveEdit}
                className="px-5 py-2 rounded-xl bg-[#14281D] hover:bg-[#1f3c2b] text-[#F3E7C4] text-xs font-bold shadow-xs disabled:opacity-50"
              >
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
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
                <span>Print Bill / Receipt</span>
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
