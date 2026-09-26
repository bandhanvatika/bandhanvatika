import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client.ts';
import { Settings } from '../types/index.ts';
import { Settings as SettingsIcon, Save, Building, CreditCard, Sparkles, CheckCircle2 } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  // Form fields
  const [businessName, setBusinessName] = useState('');
  const [tagline, setTagline] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [defaultTaxPercent, setDefaultTaxPercent] = useState('18');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      const res = await apiRequest<Settings>('/settings');
      if (res.success && res.data) {
        setSettings(res.data);
        setBusinessName(res.data.businessName);
        setTagline(res.data.tagline || '');
        setAddress(res.data.address || '');
        setPhone(res.data.phone || '');
        setEmail(res.data.email || '');
        setGstin(res.data.gstin || '');
        setDefaultTaxPercent(res.data.defaultTaxPercent || '18');
        setBankName(res.data.bankName || '');
        setAccountNumber(res.data.accountNumber || '');
        setIfscCode(res.data.ifscCode || '');
        setTermsAndConditions(res.data.termsAndConditions || '');
      }
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await apiRequest('/settings', {
      method: 'PUT',
      body: JSON.stringify({
        businessName,
        tagline,
        address,
        phone,
        email,
        gstin,
        defaultTaxPercent,
        bankName,
        accountNumber,
        ifscCode,
        termsAndConditions,
      }),
    });
    setSaving(false);
    if (res.success) {
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 3000);
    } else {
      alert(res.error?.message || 'Failed to update settings');
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-xs text-stone-400 font-semibold">Loading configuration...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-stone-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold font-brand text-[#14281D]">Venue Profile & Settings</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Configure legal business information, invoice headers, and banking coordinates
          </p>
        </div>

        {successMsg && (
          <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Settings saved successfully!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Business Identity */}
        <div className="p-6 rounded-3xl bg-white border border-stone-200/80 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 text-stone-800 font-bold text-sm border-b border-stone-100 pb-3">
            <Building className="w-4 h-4 text-[#C5A059]" />
            <span>Business Entity & GST Information</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Company / Venue Name</label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold outline-none focus:border-[#C5A059]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Tagline</label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Registered Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Contact Phone Numbers</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9431086933, 8409480911, 9015755799"
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
              />
              <p className="text-[11px] text-stone-500 mt-1">Bandhan Vatika: 9431086933, 8409480911, 9015755799</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Contact Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">GSTIN Number</label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono font-bold outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Default GST Rate (%)</label>
              <input
                type="number"
                value={defaultTaxPercent}
                onChange={(e) => setDefaultTaxPercent(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold outline-none"
              />
            </div>
          </div>
        </div>

        {/* Banking Details */}
        <div className="p-6 rounded-3xl bg-white border border-stone-200/80 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 text-stone-800 font-bold text-sm border-b border-stone-100 pb-3">
            <CreditCard className="w-4 h-4 text-[#C5A059]" />
            <span>Bank Coordinates for Tax Invoices</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Bank Name</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Account Number</label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono font-bold outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">IFSC Code</label>
              <input
                type="text"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono font-bold outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Terms & Conditions</label>
            <textarea
              rows={3}
              value={termsAndConditions}
              onChange={(e) => setTermsAndConditions(e.target.value)}
              className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center space-x-2 px-6 py-3 rounded-xl bg-[#14281D] hover:bg-[#1a3527] text-[#F3E7C4] text-xs font-bold transition-all shadow-md"
          >
            <Save className="w-4 h-4 text-[#C5A059]" />
            <span>{saving ? 'Saving Changes...' : 'Save System Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
