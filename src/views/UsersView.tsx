import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client.ts';
import { User, UserRole } from '../types/index.ts';
import { Modal } from '../components/Modal.tsx';
import { ShieldCheck, Plus, User as UserIcon, Lock, Phone, Mail, Shield, Edit2, CheckCircle2, XCircle, Camera, UploadCloud, Eye, Trash2, Download } from 'lucide-react';

export const UsersView: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Add User Modal
  const [showAdd, setShowAdd] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [idProofType, setIdProofType] = useState('Aadhaar Card');
  const [idProofNumber, setIdProofNumber] = useState('');
  const [idProofImage, setIdProofImage] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>('STAFF');
  const [saving, setSaving] = useState(false);

  // Edit User Modal
  const [showEdit, setShowEdit] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('STAFF');
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [editPhone, setEditPhone] = useState('');
  const [editIdProofType, setEditIdProofType] = useState('Aadhaar Card');
  const [editIdProofNumber, setEditIdProofNumber] = useState('');
  const [editIdProofImage, setEditIdProofImage] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // Staff ID View Modal
  const [viewStaffIdModal, setViewStaffIdModal] = useState<{ title: string; image: string; info: string } | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    const res = await apiRequest<User[]>('/users');
    if (res.success && res.data) setUsers(res.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, name, email, phone, role, idProofType, idProofNumber, idProofImage }),
    });
    setSaving(false);
    if (res.success) {
      setShowAdd(false);
      setUsername('');
      setPassword('');
      setName('');
      setEmail('');
      setPhone('');
      setIdProofType('Aadhaar Card');
      setIdProofNumber('');
      setIdProofImage(null);
      fetchUsers();
    } else {
      alert(res.error?.message || 'Failed to create staff account');
    }
  };

  const handleOpenEdit = (u: User) => {
    setEditUser(u);
    setEditName(u.name);
    setEditRole(u.role);
    setEditStatus(u.status as 'ACTIVE' | 'INACTIVE');
    setEditPhone(u.phone || '');
    setEditIdProofType(u.idProofType || 'Aadhaar Card');
    setEditIdProofNumber(u.idProofNumber || '');
    setEditIdProofImage(u.idProofImage || null);
    setShowEdit(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setUpdating(true);
    const res = await apiRequest(`/users/${editUser.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: editName,
        role: editRole,
        status: editStatus,
        phone: editPhone,
        idProofType: editIdProofType,
        idProofNumber: editIdProofNumber,
        idProofImage: editIdProofImage,
      }),
    });
    setUpdating(false);
    if (res.success) {
      setShowEdit(false);
      setEditUser(null);
      fetchUsers();
    } else {
      alert(res.error?.message || 'Failed to update user profile');
    }
  };

  const handleToggleStatus = async (u: User) => {
    const nextStatus = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (!confirm(`Are you sure you want to change @${u.username}'s status to ${nextStatus}?`)) return;
    const res = await apiRequest(`/users/${u.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: u.name,
        role: u.role,
        status: nextStatus,
        phone: u.phone,
      }),
    });
    if (res.success) {
      fetchUsers();
    } else {
      alert(res.error?.message || 'Failed to update user status');
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-stone-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold font-brand text-[#14281D]">Users & RBAC Roles</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Internal team credentials, granular operational permissions, and access status
          </p>
        </div>

        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center space-x-1.5 px-4 py-2.5 bg-[#14281D] hover:bg-[#1a3527] text-[#F3E7C4] text-xs font-bold rounded-xl transition-all shadow-xs"
        >
          <Plus className="w-4 h-4 text-[#C5A059]" />
          <span>Add Staff User</span>
        </button>
      </div>

      <div className="p-5 rounded-3xl bg-white border border-stone-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-stone-400 font-semibold">
            Loading system users...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Name</th>
                  <th className="py-3 px-3">Username</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Email & Mobile</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3">Last Login</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="py-3.5 px-3 font-bold text-stone-900">{u.name}</td>
                    <td className="py-3.5 px-3 font-mono text-stone-600">@{u.username}</td>
                    <td className="py-3.5 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#14281D]/5 text-[#14281D]">
                        <Shield className="w-2.5 h-2.5 mr-1 text-[#C5A059]" />
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-stone-600">
                      <div className="font-medium text-stone-800">{u.email}</div>
                      <div className="text-[11px] text-stone-400">{u.phone || '—'}</div>
                      {u.idProofType && u.idProofNumber ? (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-emerald-200/60">
                            ✓ {u.idProofType}: {u.idProofNumber}
                          </span>
                          {u.idProofImage ? (
                            <button
                              type="button"
                              onClick={() => setViewStaffIdModal({
                                title: `${u.name} - ${u.idProofType} Photo`,
                                image: u.idProofImage!,
                                info: `Role: ${u.role} · ${u.idProofType}: ${u.idProofNumber}`
                              })}
                              className="inline-flex items-center space-x-1 px-1.5 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded font-bold text-[10px] cursor-pointer transition-all"
                              title="Click to view staff ID Card photo"
                            >
                              <Eye className="w-2.5 h-2.5 text-emerald-800" />
                              <span>View ID Photo</span>
                            </button>
                          ) : (
                            <span className="text-[9px] text-stone-400 italic">(No ID photo)</span>
                          )}
                        </div>
                      ) : (
                        <div className="mt-1 inline-flex items-center text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] font-medium border border-amber-200/60">
                          ID Pending
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        u.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-stone-400 text-[11px]">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('en-IN') : 'Never'}
                    </td>
                    <td className="py-3.5 px-3 text-right space-x-1">
                      <button
                        onClick={() => handleOpenEdit(u)}
                        title="Edit User"
                        className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(u)}
                        title={u.status === 'ACTIVE' ? 'Deactivate User' : 'Activate User'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          u.status === 'ACTIVE'
                            ? 'text-amber-600 hover:bg-amber-50'
                            : 'text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        {u.status === 'ACTIVE' ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Staff Modal */}
      {showAdd && (
        <Modal
          isOpen={showAdd}
          onClose={() => setShowAdd(false)}
          title="Create Staff Account"
          subtitle="Provision new team member with role-based permissions"
          maxWidth="md"
        >
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Vikas Patidar"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Username *</label>
                <input
                  type="text"
                  required
                  placeholder="vikas"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Password *</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Assign Role *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold outline-none"
                >
                  <option value="STAFF">STAFF (View Schedule only)</option>
                  <option value="RECEPTIONIST">RECEPTIONIST (Desk & Bookings)</option>
                  <option value="ACCOUNTANT">ACCOUNTANT (Billing & Finance)</option>
                  <option value="MANAGER">MANAGER (Ops & Bookings)</option>
                  <option value="OWNER">OWNER (Full Admin Control)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Phone</label>
                <input
                  type="tel"
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Email *</label>
                <input
                  type="email"
                  required
                  placeholder="vikas@bandhanvatika.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Govt ID Type</label>
                <select
                  value={idProofType}
                  onChange={(e) => setIdProofType(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold outline-none"
                >
                  <option value="Aadhaar Card">Aadhaar Card (UIDAI)</option>
                  <option value="PAN Card">PAN Card</option>
                  <option value="Voter ID">Voter ID</option>
                  <option value="Driving License">Driving License</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Govt ID / Aadhaar Number</label>
              <input
                type="text"
                placeholder="e.g. 1234 5678 9012"
                value={idProofNumber}
                onChange={(e) => setIdProofNumber(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
              />
            </div>

            {/* Staff ID Photo Upload */}
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
              <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
                <Camera className="w-4 h-4 text-[#C5A059]" />
                <span>Upload Staff ID Card Photo (आधार / पैन की फ़ोटो)</span>
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
                            const maxDim = 1200;
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
                            setIdProofImage(canvas.toDataURL('image/jpeg', 0.82));
                          };
                          img.src = ev.target?.result as string;
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>

                {idProofImage ? (
                  <div className="flex items-center space-x-2.5">
                    <img
                      src={idProofImage}
                      alt="Staff ID Preview"
                      className="w-14 h-10 object-cover rounded-lg border-2 border-emerald-500 shadow-xs cursor-pointer hover:opacity-90"
                      onClick={() => setViewStaffIdModal({ title: `${name || 'Staff'} ID Preview`, image: idProofImage, info: `${idProofType}: ${idProofNumber}` })}
                      title="Click to preview full size"
                    />
                    <button
                      type="button"
                      onClick={() => setIdProofImage(null)}
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

            <div className="flex justify-end space-x-2 pt-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-[#14281D] hover:bg-[#1a3527] text-[#F3E7C4] text-xs font-bold shadow-xs"
              >
                {saving ? 'Creating...' : 'Provision Staff'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Staff Modal */}
      {showEdit && editUser && (
        <Modal
          isOpen={showEdit}
          onClose={() => {
            setShowEdit(false);
            setEditUser(null);
          }}
          title={`Edit @${editUser.username}`}
          subtitle="Update staff role, contact details, and account status"
          maxWidth="md"
        >
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Role *</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold outline-none"
                >
                  <option value="STAFF">STAFF (View Schedule only)</option>
                  <option value="RECEPTIONIST">RECEPTIONIST (Desk & Bookings)</option>
                  <option value="ACCOUNTANT">ACCOUNTANT (Billing & Finance)</option>
                  <option value="MANAGER">MANAGER (Ops & Bookings)</option>
                  <option value="OWNER">OWNER (Full Admin Control)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Account Status *</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold outline-none"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Phone</label>
                <input
                  type="tel"
                  placeholder="9876543210"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Govt ID Type</label>
                <select
                  value={editIdProofType}
                  onChange={(e) => setEditIdProofType(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold outline-none"
                >
                  <option value="Aadhaar Card">Aadhaar Card (UIDAI)</option>
                  <option value="PAN Card">PAN Card</option>
                  <option value="Voter ID">Voter ID</option>
                  <option value="Driving License">Driving License</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Govt ID / Aadhaar Number</label>
              <input
                type="text"
                placeholder="e.g. 1234 5678 9012"
                value={editIdProofNumber}
                onChange={(e) => setEditIdProofNumber(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
              />
            </div>

            {/* Edit Staff ID Photo Upload */}
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
              <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
                <Camera className="w-4 h-4 text-[#C5A059]" />
                <span>Upload Staff ID Card Photo (आधार / पैन की फ़ोटो)</span>
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
                            const maxDim = 1200;
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
                            setEditIdProofImage(canvas.toDataURL('image/jpeg', 0.82));
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
                      alt="Staff ID Preview"
                      className="w-14 h-10 object-cover rounded-lg border-2 border-emerald-500 shadow-xs cursor-pointer hover:opacity-90"
                      onClick={() => setViewStaffIdModal({ title: `${editName || 'Staff'} ID Preview`, image: editIdProofImage, info: `${editIdProofType}: ${editIdProofNumber}` })}
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

            <div className="flex justify-end space-x-2 pt-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => {
                  setShowEdit(false);
                  setEditUser(null);
                }}
                className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updating}
                className="px-4 py-2 rounded-xl bg-[#14281D] hover:bg-[#1a3527] text-[#F3E7C4] text-xs font-bold shadow-xs"
              >
                {updating ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Staff ID Full Photo Modal */}
      {viewStaffIdModal && (
        <Modal
          isOpen={!!viewStaffIdModal}
          onClose={() => setViewStaffIdModal(null)}
          title={viewStaffIdModal.title}
          subtitle={viewStaffIdModal.info}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className="max-h-[75vh] overflow-auto rounded-xl border border-stone-200 bg-stone-900/90 flex items-center justify-center p-2">
              <img
                src={viewStaffIdModal.image}
                alt={viewStaffIdModal.title}
                className="max-h-[70vh] w-auto object-contain rounded-lg shadow-2xl"
              />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-stone-200">
              <span className="text-xs text-stone-500 font-medium">
                Verified Staff Identity Document
              </span>
              <div className="flex items-center space-x-2">
                <a
                  href={viewStaffIdModal.image}
                  download="staff_id_proof.jpg"
                  className="px-3.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold flex items-center space-x-1.5 transition-all"
                >
                  <Download className="w-3.5 h-3.5 text-stone-600" />
                  <span>Download Photo</span>
                </a>
                <button
                  type="button"
                  onClick={() => setViewStaffIdModal(null)}
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

