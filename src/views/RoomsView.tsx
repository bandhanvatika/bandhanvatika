import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../api/client.ts';
import { Room } from '../types/index.ts';
import { Modal } from '../components/Modal.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  BedDouble,
  Users,
  DollarSign,
  Edit,
  Plus,
  Search,
  AlertCircle,
  Wind,
  Wrench,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  Brush,
  Ban,
  Clock,
  Info,
} from 'lucide-react';

const ROOM_STATUS_CONFIG = {
  AVAILABLE: { label: 'Available', color: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
  RESERVED: { label: 'Reserved', color: 'bg-blue-50 text-blue-800 border-blue-200', icon: Clock },
  OCCUPIED: { label: 'Occupied', color: 'bg-purple-50 text-purple-800 border-purple-200', icon: BedDouble },
  CLEANING: { label: 'Cleaning', color: 'bg-amber-50 text-amber-800 border-amber-200', icon: Brush },
  MAINTENANCE: { label: 'Maintenance', color: 'bg-rose-50 text-rose-800 border-rose-200', icon: Wrench },
  BLOCKED: { label: 'Blocked', color: 'bg-stone-100 text-stone-700 border-stone-300', icon: Ban },
};

const COMMON_ROOM_AMENITIES = [
  'Split AC',
  'King Size Bed',
  'En-Suite Bathroom',
  'Bridal Wardrobe & Mirror',
  'Geyser / Hot Water',
  'High-Speed Wi-Fi',
  'Smart TV',
  'Balcony View',
  'Mini Refrigerator',
  'Electric Kettle & Tea Kit',
];

export const RoomsView: React.FC = () => {
  const { hasRole } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [acFilter, setAcFilter] = useState<'ALL' | 'AC' | 'NON_AC'>('ALL');

  // Add Room Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [formRoomNumber, setFormRoomNumber] = useState('');
  const [formRoomType, setFormRoomType] = useState('Deluxe Room');
  const [formIsAc, setFormIsAc] = useState(true);
  const [formCapacity, setFormCapacity] = useState('2');
  const [formPricePerNight, setFormPricePerNight] = useState('3500');
  const [formStatus, setFormStatus] = useState<Room['status']>('AVAILABLE');
  const [formAmenities, setFormAmenities] = useState<string[]>(['Split AC', 'King Size Bed', 'En-Suite Bathroom']);
  const [formCustomAmenity, setFormCustomAmenity] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit Room Modal State
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editRoomNumber, setEditRoomNumber] = useState('');
  const [editRoomType, setEditRoomType] = useState('');
  const [editIsAc, setEditIsAc] = useState(true);
  const [editCapacity, setEditCapacity] = useState('2');
  const [editPricePerNight, setEditPricePerNight] = useState('3500');
  const [editStatus, setEditStatus] = useState<Room['status']>('AVAILABLE');
  const [editAmenities, setEditAmenities] = useState<string[]>([]);
  const [editCustomAmenity, setEditCustomAmenity] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Quick Status Modal State
  const [statusTarget, setStatusTarget] = useState<{ room: Room; newStatus: Room['status'] } | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // View Room Modal
  const [viewingRoom, setViewingRoom] = useState<Room | null>(null);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    const query = new URLSearchParams({
      search: search.trim(),
      status: statusFilter,
    });
    if (acFilter === 'AC') query.set('isAc', 'true');
    if (acFilter === 'NON_AC') query.set('isAc', 'false');

    const res = await apiRequest<Room[]>(`/rooms?${query.toString()}`);
    if (res.success && res.data) {
      setRooms(res.data);
    }
    setLoading(false);
  }, [search, statusFilter, acFilter]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const resetAddForm = () => {
    setFormRoomNumber('');
    setFormRoomType('Deluxe Room');
    setFormIsAc(true);
    setFormCapacity('2');
    setFormPricePerNight('3500');
    setFormStatus('AVAILABLE');
    setFormAmenities(['Split AC', 'King Size Bed', 'En-Suite Bathroom']);
    setFormCustomAmenity('');
    setFormDescription('');
    setAddError(null);
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError(null);

    const res = await apiRequest<Room>('/rooms', {
      method: 'POST',
      body: JSON.stringify({
        roomNumber: formRoomNumber,
        roomType: formRoomType,
        isAc: formIsAc,
        capacity: Number(formCapacity),
        pricePerNight: formPricePerNight,
        status: formStatus,
        amenities: formAmenities,
        description: formDescription || undefined,
      }),
    });

    setAddLoading(false);
    if (res.success) {
      setShowAddModal(false);
      resetAddForm();
      fetchRooms();
    } else {
      setAddError(res.error?.message || 'Failed to create room. Please verify parameters.');
    }
  };

  const openEditModal = (r: Room) => {
    setEditingRoom(r);
    setEditRoomNumber(r.roomNumber);
    setEditRoomType(r.roomType);
    setEditIsAc(r.isAc);
    setEditCapacity(String(r.capacity));
    setEditPricePerNight(String(r.pricePerNight));
    setEditStatus(r.status);
    try {
      setEditAmenities(JSON.parse(r.amenities || '[]'));
    } catch {
      setEditAmenities([]);
    }
    setEditCustomAmenity('');
    setEditDescription(r.description || '');
    setEditError(null);
  };

  const handleUpdateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom) return;

    setEditLoading(true);
    setEditError(null);

    const res = await apiRequest<Room>(`/rooms/${editingRoom.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        roomNumber: editRoomNumber,
        roomType: editRoomType,
        isAc: editIsAc,
        capacity: Number(editCapacity),
        pricePerNight: editPricePerNight,
        status: editStatus,
        amenities: editAmenities,
        description: editDescription || null,
      }),
    });

    setEditLoading(false);
    if (res.success) {
      setEditingRoom(null);
      fetchRooms();
    } else {
      setEditError(res.error?.message || 'Failed to update room.');
    }
  };

  const handleApplyStatusChange = async () => {
    if (!statusTarget) return;
    setStatusLoading(true);

    const res = await apiRequest(`/rooms/${statusTarget.room.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: statusTarget.newStatus }),
    });

    setStatusLoading(false);
    setStatusTarget(null);
    if (res.success) {
      fetchRooms();
    }
  };

  const toggleAmenity = (list: string[], setList: (val: string[]) => void, item: string) => {
    if (list.includes(item)) {
      setList(list.filter((x) => x !== item));
    } else {
      setList([...list, item]);
    }
  };

  const addCustomAmenity = (list: string[], setList: (val: string[]) => void, item: string, clearFn: () => void) => {
    const trimmed = item.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
      clearFn();
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-stone-200/80 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold font-brand text-[#14281D]">Guest Accommodation Rooms</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 text-xs font-bold font-mono">
              {rooms.length} Units
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Bridal dressing suites, family quarters, tariffs, and housekeeping statuses
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* AC Filter */}
          <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs">
            <button
              onClick={() => setAcFilter('ALL')}
              className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                acFilter === 'ALL' ? 'bg-white text-[#14281D] shadow-xs' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              All AC
            </button>
            <button
              onClick={() => setAcFilter('AC')}
              className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                acFilter === 'AC' ? 'bg-white text-sky-700 shadow-xs' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              AC Only
            </button>
            <button
              onClick={() => setAcFilter('NON_AC')}
              className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                acFilter === 'NON_AC' ? 'bg-white text-stone-700 shadow-xs' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Non-AC
            </button>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
          >
            <option value="ALL">All Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="RESERVED">Reserved</option>
            <option value="OCCUPIED">Occupied</option>
            <option value="CLEANING">Cleaning</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="BLOCKED">Blocked</option>
          </select>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search room # or type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059] w-48"
            />
          </div>

          {/* Add Room Button */}
          {hasRole(['OWNER', 'MANAGER', 'RECEPTIONIST']) && (
            <button
              onClick={() => { resetAddForm(); setShowAddModal(true); }}
              className="flex items-center space-x-1.5 px-4 py-2 bg-[#14281D] hover:bg-[#1a3527] text-[#F3E7C4] text-xs font-bold rounded-xl transition-all shadow-xs"
            >
              <Plus className="w-4 h-4 text-[#C5A059]" />
              <span>Add Room</span>
            </button>
          )}
        </div>
      </div>

      {/* Advisory Notice */}
      <div className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-800">
        <Info className="w-4 h-4 text-amber-600 shrink-0" />
        <span>
          <strong>Operational Note:</strong> Room status indicates physical housekeeping/occupancy condition and does not substitute for event booking date interval reservation checks.
        </span>
      </div>

      {/* Rooms Grid */}
      {loading ? (
        <div className="p-16 text-center text-xs text-stone-400 font-semibold animate-pulse bg-white rounded-3xl border border-stone-200">
          Loading accommodation records from PostgreSQL...
        </div>
      ) : rooms.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-stone-200">
          <BedDouble className="w-10 h-10 text-stone-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-stone-700">No rooms found</p>
          <p className="text-xs text-stone-400 mt-1">Adjust search or filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {rooms.map((r) => {
            let amenities: string[] = [];
            try {
              amenities = JSON.parse(r.amenities || '[]');
            } catch {
              amenities = [];
            }

            const cfg = ROOM_STATUS_CONFIG[r.status] || ROOM_STATUS_CONFIG.AVAILABLE;
            const StatusIcon = cfg.icon;

            return (
              <div
                key={r.id}
                className="p-5 rounded-3xl bg-white border border-stone-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center font-bold text-sm">
                        <BedDouble className="w-5 h-5 text-[#C5A059]" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-stone-900 font-mono">Room {r.roomNumber}</h3>
                        <p className="text-[11px] text-stone-500 font-medium">{r.roomType}</p>
                      </div>
                    </div>

                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border flex items-center space-x-1 ${cfg.color}`}
                    >
                      <StatusIcon className="w-2.5 h-2.5" />
                      <span>{cfg.label}</span>
                    </span>
                  </div>

                  {/* Specs */}
                  <div className="space-y-2 mt-4 pt-3 border-t border-stone-100 text-xs">
                    <div className="flex justify-between text-stone-600">
                      <span>Climate</span>
                      <span className="font-semibold text-stone-900 flex items-center">
                        <Wind className="w-3 h-3 mr-1 text-sky-500" />
                        {r.isAc ? 'Air Conditioned' : 'Non-AC'}
                      </span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>Capacity</span>
                      <span className="font-semibold text-stone-900 font-mono">{r.capacity} Guests</span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>Tariff / Night</span>
                      <span className="font-bold text-[#14281D] font-mono tabular-nums">
                        ₹{Number(r.pricePerNight).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Amenities */}
                  <div className="flex flex-wrap gap-1 mt-3">
                    {amenities.slice(0, 3).map((a, i) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.5 rounded bg-stone-50 text-stone-600 text-[9px] font-medium border border-stone-200/50"
                      >
                        {a}
                      </span>
                    ))}
                    {amenities.length > 3 && (
                      <span className="px-1.5 py-0.5 rounded bg-stone-50 text-stone-400 text-[9px] font-medium">
                        +{amenities.length - 3}
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="pt-3 mt-4 border-t border-stone-100 flex items-center justify-between">
                  <button
                    onClick={() => setViewingRoom(r)}
                    className="text-stone-500 hover:text-stone-800 text-[11px] font-semibold"
                  >
                    View Details
                  </button>

                  {hasRole(['OWNER', 'MANAGER', 'RECEPTIONIST']) && (
                    <div className="flex items-center space-x-1">
                      <select
                        value={r.status}
                        onChange={(e) => setStatusTarget({ room: r, newStatus: e.target.value as any })}
                        className="text-[10px] font-bold p-1 bg-stone-100 rounded-lg border border-stone-200 outline-none"
                      >
                        <option value="AVAILABLE">Available</option>
                        <option value="RESERVED">Reserved</option>
                        <option value="OCCUPIED">Occupied</option>
                        <option value="CLEANING">Cleaning</option>
                        <option value="MAINTENANCE">Maintenance</option>
                        <option value="BLOCKED">Blocked</option>
                      </select>

                      <button
                        onClick={() => openEditModal(r)}
                        className="p-1 rounded-lg text-stone-500 hover:text-[#14281D] hover:bg-stone-100"
                        title="Edit Room"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Room Modal */}
      {showAddModal && (
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Add Guest Room Unit"
          subtitle="Unique room number and night tariff validation enforced server-side"
          maxWidth="md"
        >
          <form onSubmit={handleCreateRoom} className="space-y-4">
            {addError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Room Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 105"
                  value={formRoomNumber}
                  onChange={(e) => setFormRoomNumber(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059] font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Room Type *
                </label>
                <select
                  value={formRoomType}
                  onChange={(e) => setFormRoomType(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
                >
                  <option value="Deluxe Room">Deluxe Room</option>
                  <option value="Family Room">Family Room</option>
                  <option value="Suite Room">Suite Room</option>
                  <option value="Bridal Suite">Bridal Suite</option>
                  <option value="Standard Room">Standard Room</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Air Conditioning
                </label>
                <select
                  value={formIsAc ? 'true' : 'false'}
                  onChange={(e) => setFormIsAc(e.target.value === 'true')}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
                >
                  <option value="true">AC Room</option>
                  <option value="false">Non-AC</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Capacity *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formCapacity}
                  onChange={(e) => setFormCapacity(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059] font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Tariff / Night (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="3500"
                  value={formPricePerNight}
                  onChange={(e) => setFormPricePerNight(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059] font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Housekeeping Status
              </label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as any)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
              >
                <option value="AVAILABLE">AVAILABLE — Inspected & Ready for Guests</option>
                <option value="RESERVED">RESERVED — Holding for Checked-in Party</option>
                <option value="OCCUPIED">OCCUPIED — Currently in use</option>
                <option value="CLEANING">CLEANING — Housekeeping sanitization</option>
                <option value="MAINTENANCE">MAINTENANCE — Repair in progress</option>
                <option value="BLOCKED">BLOCKED — Temporarily unavailable</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Room Amenities
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {COMMON_ROOM_AMENITIES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleAmenity(formAmenities, setFormAmenities, item)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-medium border transition-colors ${
                      formAmenities.includes(item)
                        ? 'bg-[#14281D] text-[#F3E7C4] border-[#14281D]'
                        : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Add custom amenity..."
                  value={formCustomAmenity}
                  onChange={(e) => setFormCustomAmenity(e.target.value)}
                  className="flex-1 p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
                />
                <button
                  type="button"
                  onClick={() => addCustomAmenity(formAmenities, setFormAmenities, formCustomAmenity, () => setFormCustomAmenity(''))}
                  className="px-3 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold"
                >
                  Add
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Room Description
              </label>
              <textarea
                rows={2}
                placeholder="Bed specifications, view, location notes..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
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
                disabled={addLoading}
                className="px-5 py-2 rounded-xl bg-[#14281D] hover:bg-[#1a3527] text-[#F3E7C4] text-xs font-bold shadow-xs disabled:opacity-50"
              >
                {addLoading ? 'Creating Room...' : 'Register Room'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Room Modal */}
      {editingRoom && (
        <Modal
          isOpen={!!editingRoom}
          onClose={() => setEditingRoom(null)}
          title={`Edit Room #${editingRoom.roomNumber}`}
          subtitle="PostgreSQL Decimal validation & audit logging active"
          maxWidth="md"
        >
          <form onSubmit={handleUpdateRoom} className="space-y-4">
            {editError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Room Number *
                </label>
                <input
                  type="text"
                  required
                  value={editRoomNumber}
                  onChange={(e) => setEditRoomNumber(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059] font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Room Type *
                </label>
                <select
                  value={editRoomType}
                  onChange={(e) => setEditRoomType(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
                >
                  <option value="Deluxe Room">Deluxe Room</option>
                  <option value="Family Room">Family Room</option>
                  <option value="Suite Room">Suite Room</option>
                  <option value="Bridal Suite">Bridal Suite</option>
                  <option value="Standard Room">Standard Room</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Air Conditioning
                </label>
                <select
                  value={editIsAc ? 'true' : 'false'}
                  onChange={(e) => setEditIsAc(e.target.value === 'true')}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
                >
                  <option value="true">AC Room</option>
                  <option value="false">Non-AC</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Capacity *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={editCapacity}
                  onChange={(e) => setEditCapacity(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059] font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Price / Night (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={editPricePerNight}
                  onChange={(e) => setEditPricePerNight(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059] font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Housekeeping Status
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as any)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
              >
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="RESERVED">RESERVED</option>
                <option value="OCCUPIED">OCCUPIED</option>
                <option value="CLEANING">CLEANING</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
                <option value="BLOCKED">BLOCKED</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Amenities
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {COMMON_ROOM_AMENITIES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleAmenity(editAmenities, setEditAmenities, item)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-medium border transition-colors ${
                      editAmenities.includes(item)
                        ? 'bg-[#14281D] text-[#F3E7C4] border-[#14281D]'
                        : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Add custom amenity..."
                  value={editCustomAmenity}
                  onChange={(e) => setEditCustomAmenity(e.target.value)}
                  className="flex-1 p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
                />
                <button
                  type="button"
                  onClick={() => addCustomAmenity(editAmenities, setEditAmenities, editCustomAmenity, () => setEditCustomAmenity(''))}
                  className="px-3 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold"
                >
                  Add
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Description
              </label>
              <textarea
                rows={2}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-4 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setEditingRoom(null)}
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

      {/* View Room Modal */}
      {viewingRoom && (
        <Modal
          isOpen={!!viewingRoom}
          onClose={() => setViewingRoom(null)}
          title={`Room Specification: #${viewingRoom.roomNumber}`}
          subtitle={`${viewingRoom.roomType} · ${viewingRoom.isAc ? 'Air Conditioned' : 'Non-AC'}`}
          maxWidth="sm"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-[#FBF9F5] border border-stone-200">
                <span className="text-[10px] font-bold text-stone-400 uppercase">Tariff / Night</span>
                <p className="text-lg font-bold font-mono text-[#14281D] mt-0.5 tabular-nums">
                  ₹{Number(viewingRoom.pricePerNight).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-[#FBF9F5] border border-stone-200">
                <span className="text-[10px] font-bold text-stone-400 uppercase">Guest Capacity</span>
                <p className="text-lg font-bold font-mono text-stone-900 mt-0.5">{viewingRoom.capacity} Guests</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-stone-500">Housekeeping Status:</span>
                <span className="font-bold">{viewingRoom.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">AC Specification:</span>
                <span className="font-semibold text-stone-800">{viewingRoom.isAc ? 'Split AC Installed' : 'Non-AC'}</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">Amenities</h4>
              <div className="flex flex-wrap gap-1.5">
                {JSON.parse(viewingRoom.amenities || '[]').map((a: string, i: number) => (
                  <span key={i} className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-800 text-xs font-medium">
                    {a}
                  </span>
                ))}
              </div>
            </div>

            {viewingRoom.description && (
              <div>
                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">Notes</h4>
                <p className="text-xs text-stone-600 bg-stone-50 p-2.5 rounded-xl border border-stone-200">
                  {viewingRoom.description}
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Status Confirmation Modal */}
      {statusTarget && (
        <Modal
          isOpen={!!statusTarget}
          onClose={() => setStatusTarget(null)}
          title={`Confirm Status: Room ${statusTarget.room.roomNumber}`}
          maxWidth="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-stone-600">
              Are you sure you want to change housekeeping status of{' '}
              <strong className="text-stone-900">Room {statusTarget.room.roomNumber}</strong> from{' '}
              <span className="font-semibold">{statusTarget.room.status}</span> to{' '}
              <strong className="text-[#14281D]">{statusTarget.newStatus}</strong>?
            </p>
            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setStatusTarget(null)}
                className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyStatusChange}
                disabled={statusLoading}
                className="px-4 py-2 rounded-xl bg-[#14281D] hover:bg-[#1a3527] text-[#F3E7C4] text-xs font-bold shadow-xs disabled:opacity-50"
              >
                {statusLoading ? 'Updating...' : 'Confirm Status Change'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
