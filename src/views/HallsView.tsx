import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../api/client.ts';
import { Hall } from '../types/index.ts';
import { Modal } from '../components/Modal.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Landmark,
  Users,
  DollarSign,
  Edit,
  Plus,
  Search,
  AlertCircle,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Wrench,
  Eye,
} from 'lucide-react';

const COMMON_AMENITIES = [
  'Central AC',
  'Grand Stage',
  'Bridal Green Room',
  'Valet Parking',
  'Ambient LED Lighting',
  'Generator Backup (100%)',
  'Acoustic Sound System',
  'Mandap Setup Area',
  'Dining Hall Setup',
  'Lawn Buffet Spread',
];

export const HallsView: React.FC = () => {
  const { hasRole } = useAuth();
  const [halls, setHalls] = useState<Hall[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'>('ALL');

  // Create Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('Banquet Hall');
  const [formCapacity, setFormCapacity] = useState('300');
  const [formBasePrice, setFormBasePrice] = useState('150000');
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'>('ACTIVE');
  const [formAmenities, setFormAmenities] = useState<string[]>(['Central AC', 'Grand Stage', 'Valet Parking']);
  const [formCustomAmenity, setFormCustomAmenity] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit Modal State
  const [editingHall, setEditingHall] = useState<Hall | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [editCapacity, setEditCapacity] = useState('200');
  const [editBasePrice, setEditBasePrice] = useState('100000');
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'>('ACTIVE');
  const [editAmenities, setEditAmenities] = useState<string[]>([]);
  const [editCustomAmenity, setEditCustomAmenity] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Quick Status Confirmation State
  const [statusTarget, setStatusTarget] = useState<{ hall: Hall; newStatus: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' } | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // View Modal State
  const [viewingHall, setViewingHall] = useState<Hall | null>(null);

  const fetchHalls = useCallback(async () => {
    setLoading(true);
    const query = new URLSearchParams({
      search: search.trim(),
      status: statusFilter,
    });
    const res = await apiRequest<Hall[]>(`/halls?${query.toString()}`);
    if (res.success && res.data) {
      setHalls(res.data);
    }
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => {
    fetchHalls();
  }, [fetchHalls]);

  const resetAddForm = () => {
    setFormCode('');
    setFormName('');
    setFormType('Banquet Hall');
    setFormCapacity('300');
    setFormBasePrice('150000');
    setFormStatus('ACTIVE');
    setFormAmenities(['Central AC', 'Grand Stage', 'Valet Parking']);
    setFormCustomAmenity('');
    setFormDescription('');
    setAddError(null);
  };

  const handleCreateHall = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError(null);

    const res = await apiRequest<Hall>('/halls', {
      method: 'POST',
      body: JSON.stringify({
        code: formCode,
        name: formName,
        type: formType,
        capacity: Number(formCapacity),
        basePrice: formBasePrice,
        status: formStatus,
        amenities: formAmenities,
        description: formDescription || undefined,
      }),
    });

    setAddLoading(false);
    if (res.success) {
      setShowAddModal(false);
      resetAddForm();
      fetchHalls();
    } else {
      setAddError(res.error?.message || 'Failed to create venue hall. Check parameters.');
    }
  };

  const openEditModal = (h: Hall) => {
    setEditingHall(h);
    setEditCode(h.code);
    setEditName(h.name);
    setEditType(h.type);
    setEditCapacity(String(h.capacity));
    setEditBasePrice(String(h.basePrice));
    setEditStatus(h.status);
    try {
      setEditAmenities(JSON.parse(h.amenities || '[]'));
    } catch {
      setEditAmenities([]);
    }
    setEditCustomAmenity('');
    setEditDescription(h.description || '');
    setEditError(null);
  };

  const handleUpdateHall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHall) return;

    setEditLoading(true);
    setEditError(null);

    const res = await apiRequest<Hall>(`/halls/${editingHall.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        code: editCode,
        name: editName,
        type: editType,
        capacity: Number(editCapacity),
        basePrice: editBasePrice,
        status: editStatus,
        amenities: editAmenities,
        description: editDescription || null,
      }),
    });

    setEditLoading(false);
    if (res.success) {
      setEditingHall(null);
      fetchHalls();
    } else {
      setEditError(res.error?.message || 'Failed to update venue hall.');
    }
  };

  const handleApplyStatusChange = async () => {
    if (!statusTarget) return;
    setStatusLoading(true);

    const res = await apiRequest(`/halls/${statusTarget.hall.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: statusTarget.newStatus }),
    });

    setStatusLoading(false);
    setStatusTarget(null);
    if (res.success) {
      fetchHalls();
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
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-stone-200/80 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold font-brand text-[#14281D]">Halls & Lawns Master</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 text-xs font-bold font-mono">
              {halls.length} Venues
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Banquet hall architecture, guest seating capacities, tariff definitions, and maintenance scheduling
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Filter */}
          <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs">
            {(['ALL', 'ACTIVE', 'INACTIVE', 'MAINTENANCE'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  statusFilter === s
                    ? 'bg-white text-[#14281D] shadow-xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search hall name, code, type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059] w-60"
            />
          </div>

          {/* Add Hall Button */}
          {hasRole(['OWNER', 'MANAGER']) && (
            <button
              onClick={() => { resetAddForm(); setShowAddModal(true); }}
              className="flex items-center space-x-1.5 px-4 py-2 bg-[#14281D] hover:bg-[#1a3527] text-[#F3E7C4] text-xs font-bold rounded-xl transition-all shadow-xs"
            >
              <Plus className="w-4 h-4 text-[#C5A059]" />
              <span>Add Venue Hall</span>
            </button>
          )}
        </div>
      </div>

      {/* Venues Grid */}
      {loading ? (
        <div className="p-16 text-center text-xs text-stone-400 font-semibold animate-pulse bg-white rounded-3xl border border-stone-200">
          Loading venue configurations from PostgreSQL...
        </div>
      ) : halls.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-stone-200">
          <Landmark className="w-10 h-10 text-stone-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-stone-700">No venue halls found</p>
          <p className="text-xs text-stone-400 mt-1">Adjust search filter or add a venue.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {halls.map((h) => {
            let amenities: string[] = [];
            try {
              amenities = JSON.parse(h.amenities || '[]');
            } catch {
              amenities = [];
            }

            return (
              <div
                key={h.id}
                className="p-6 rounded-3xl bg-white border border-stone-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-[#14281D] text-[#C5A059] flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                        <Landmark className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-base font-bold text-stone-900">{h.name}</h3>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200">
                            {h.code}
                          </span>
                        </div>
                        <p className="text-xs text-stone-500 font-medium">{h.type}</p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border ${
                        h.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : h.status === 'MAINTENANCE'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-stone-100 text-stone-600 border-stone-200'
                      }`}
                    >
                      {h.status}
                    </span>
                  </div>

                  <p className="text-xs text-stone-600 mt-4 line-clamp-2 leading-relaxed">
                    {h.description || 'Master air-conditioned banquet hall with royal lighting, bridal suite, and catering access.'}
                  </p>

                  {/* Specs Grid */}
                  <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-stone-100">
                    <div className="flex items-center space-x-2 text-xs">
                      <Users className="w-4 h-4 text-[#C5A059]" />
                      <span className="font-semibold text-stone-800 font-mono">{h.capacity} Guests Capacity</span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs">
                      <DollarSign className="w-4 h-4 text-[#C5A059]" />
                      <span className="font-bold text-[#14281D] font-mono tabular-nums">
                        ₹{Number(h.basePrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })} / slot
                      </span>
                    </div>
                  </div>

                  {/* Amenities Tags */}
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {amenities.map((a, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-[#FBF9F5] text-stone-700 text-[10px] font-medium border border-stone-200/60"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-4 mt-5 border-t border-stone-100 flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setViewingHall(h)}
                      className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 text-xs font-semibold"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </button>
                  </div>

                  {hasRole(['OWNER', 'MANAGER']) && (
                    <div className="flex items-center space-x-1.5">
                      {h.status !== 'MAINTENANCE' ? (
                        <button
                          onClick={() => setStatusTarget({ hall: h, newStatus: 'MAINTENANCE' })}
                          className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-amber-700 hover:bg-amber-50 text-xs font-semibold"
                          title="Mark Maintenance"
                        >
                          <Wrench className="w-3 h-3" />
                          <span>Maintenance</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setStatusTarget({ hall: h, newStatus: 'ACTIVE' })}
                          className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 text-xs font-semibold"
                          title="Restore Active"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Make Active</span>
                        </button>
                      )}

                      <button
                        onClick={() => openEditModal(h)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Edit Tariff</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Hall Modal */}
      {showAddModal && (
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Add New Venue Hall"
          subtitle="Configure banquet hall capacity, slot tariff, and amenity profile"
          maxWidth="lg"
        >
          <form onSubmit={handleCreateHall} className="space-y-4">
            {addError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Hall Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HALL-D"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059] font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Hall / Lawn Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Crystal Ballroom"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Venue Type *
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
                >
                  <option value="Banquet Hall">Banquet Hall</option>
                  <option value="Open Air Lawn">Open Air Lawn</option>
                  <option value="Mini Hall">Mini Hall</option>
                  <option value="Poolside Pavilion">Poolside Pavilion</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Guest Capacity *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 500"
                  value={formCapacity}
                  onChange={(e) => setFormCapacity(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059] font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Base Price (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="e.g. 200000"
                  value={formBasePrice}
                  onChange={(e) => setFormBasePrice(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059] font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Operational Status
              </label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as any)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
              >
                <option value="ACTIVE">ACTIVE — Available for booking slots</option>
                <option value="INACTIVE">INACTIVE — Hidden from standard availability</option>
                <option value="MAINTENANCE">MAINTENANCE — Under renovation / upkeep</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Amenities & Infrastructure
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {COMMON_AMENITIES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleAmenity(formAmenities, setFormAmenities, item)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
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
                Venue Description & Features
              </label>
              <textarea
                rows={2}
                placeholder="Architectural features, stage dimensions, decor guidelines..."
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
                {addLoading ? 'Creating Venue...' : 'Register Venue Hall'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Hall Modal */}
      {editingHall && (
        <Modal
          isOpen={!!editingHall}
          onClose={() => setEditingHall(null)}
          title={`Edit Venue: ${editingHall.name}`}
          subtitle={`Venue Code: ${editingHall.code} · PostgreSQL Decimal tariff integrity enforced`}
          maxWidth="lg"
        >
          <form onSubmit={handleUpdateHall} className="space-y-4">
            {editError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Hall Code *
                </label>
                <input
                  type="text"
                  required
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059] font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Hall Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Type *
                </label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
                >
                  <option value="Banquet Hall">Banquet Hall</option>
                  <option value="Open Air Lawn">Open Air Lawn</option>
                  <option value="Mini Hall">Mini Hall</option>
                  <option value="Poolside Pavilion">Poolside Pavilion</option>
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
                  Base Price (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={editBasePrice}
                  onChange={(e) => setEditBasePrice(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059] font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Operational Status
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as any)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Amenities & Infrastructure
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {COMMON_AMENITIES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleAmenity(editAmenities, setEditAmenities, item)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
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
                onClick={() => setEditingHall(null)}
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

      {/* Details View Modal */}
      {viewingHall && (
        <Modal
          isOpen={!!viewingHall}
          onClose={() => setViewingHall(null)}
          title={`Venue Specification: ${viewingHall.name}`}
          subtitle={`Code: ${viewingHall.code} · ${viewingHall.type}`}
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-[#FBF9F5] border border-stone-200">
                <span className="text-[10px] font-bold text-stone-400 uppercase">Max Seating</span>
                <p className="text-lg font-bold font-mono text-stone-900 mt-0.5">{viewingHall.capacity} Guests</p>
              </div>
              <div className="p-3 rounded-2xl bg-[#FBF9F5] border border-stone-200">
                <span className="text-[10px] font-bold text-stone-400 uppercase">Base Tariff / Slot</span>
                <p className="text-lg font-bold font-mono text-[#14281D] mt-0.5 tabular-nums">
                  ₹{Number(viewingHall.basePrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-stone-500">Status:</span>
                <span className="font-bold">{viewingHall.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Architecture Type:</span>
                <span className="font-semibold text-stone-800">{viewingHall.type}</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">Installed Amenities</h4>
              <div className="flex flex-wrap gap-1.5">
                {JSON.parse(viewingHall.amenities || '[]').map((a: string, i: number) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-800 text-xs font-medium">
                    {a}
                  </span>
                ))}
              </div>
            </div>

            {viewingHall.description && (
              <div>
                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">Description</h4>
                <p className="text-xs text-stone-600 leading-relaxed bg-stone-50 p-3 rounded-xl border border-stone-200">
                  {viewingHall.description}
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
          title={`Confirm Status: ${statusTarget.hall.name}`}
          maxWidth="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-stone-600">
              Are you sure you want to change status of{' '}
              <strong className="text-stone-900">{statusTarget.hall.name}</strong> ({statusTarget.hall.code}) to{' '}
              <strong className="text-amber-700">{statusTarget.newStatus}</strong>?
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
