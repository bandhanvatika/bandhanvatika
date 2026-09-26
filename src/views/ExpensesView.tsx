import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client.ts';
import { Expense } from '../types/index.ts';
import { Modal } from '../components/Modal.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { Wallet, Plus, Trash2, DollarSign, Calendar, Tag } from 'lucide-react';

export const ExpensesView: React.FC = () => {
  const { hasRole } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Expense Modal
  const [showAdd, setShowAdd] = useState(false);
  const [category, setCategory] = useState('Decoration');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [vendor, setVendor] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchExpenses = async () => {
    setLoading(true);
    const res = await apiRequest<Expense[]>('/expenses');
    if (res.success && res.data) setExpenses(res.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await apiRequest('/expenses', {
      method: 'POST',
      body: JSON.stringify({ category, amount, date, vendor, paymentMethod, notes }),
    });
    setSaving(false);
    if (res.success) {
      setShowAdd(false);
      setAmount('');
      setVendor('');
      setNotes('');
      fetchExpenses();
    } else {
      alert(res.error?.message || 'Failed to record expense');
    }
  };

  const handleDeleteExpense = async (id: string, code: string) => {
    if (!window.confirm(`Are you sure you want to delete expense #${code}? This action will be recorded in audit logs.`)) return;
    const res = await apiRequest(`/expenses/${id}`, { method: 'DELETE' });
    if (res.success) {
      fetchExpenses();
    } else {
      alert(res.error?.message || 'Failed to delete expense');
    }
  };

  const totalExpense = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  // Categories breakdown
  const categoryTotals: Record<string, number> = {};
  expenses.forEach((e) => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + Number(e.amount);
  });

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-stone-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold font-brand text-[#14281D]">Venue Operational Expenses</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Vendor payments, fuel, decor procurement, and venue maintenance costs
          </p>
        </div>

        {hasRole(['OWNER', 'ACCOUNTANT', 'MANAGER']) && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-[#14281D] hover:bg-[#1a3527] text-[#F3E7C4] text-xs font-bold rounded-xl transition-all shadow-xs"
          >
            <Plus className="w-4 h-4 text-[#C5A059]" />
            <span>Record Expense</span>
          </button>
        )}
      </div>

      {/* Category Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[#14281D] text-[#FBF9F5]">
          <span className="text-[10px] font-bold uppercase text-stone-300">Total Expenses</span>
          <p className="text-lg font-bold font-brand text-[#E2C07D] mt-1">₹{totalExpense.toLocaleString('en-IN')}</p>
        </div>
        {Object.entries(categoryTotals).slice(0, 3).map(([cat, val]) => (
          <div key={cat} className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-stone-400">{cat}</span>
            <p className="text-lg font-bold font-brand text-stone-800 mt-1">₹{val.toLocaleString('en-IN')}</p>
          </div>
        ))}
      </div>

      {/* Expenses Table */}
      <div className="p-5 rounded-3xl bg-white border border-stone-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-stone-400 font-semibold">
            Loading expenses...
          </div>
        ) : expenses.length === 0 ? (
          <div className="py-12 text-center text-xs text-stone-400 font-semibold">
            No expenses recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Expense #</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Vendor / Payee</th>
                  <th className="py-3 px-3">Payment Mode</th>
                  <th className="py-3 px-3 text-right">Amount (₹)</th>
                  {hasRole(['OWNER', 'ACCOUNTANT', 'MANAGER']) && (
                    <th className="py-3 px-3 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-stone-900">{e.expenseCode}</td>
                    <td className="py-3 px-3 text-stone-600">{e.date}</td>
                    <td className="py-3 px-3">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-stone-100 font-semibold text-stone-800 text-[10px]">
                        {e.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-stone-900">{e.vendor}</td>
                    <td className="py-3 px-3 text-stone-600">{e.paymentMethod}</td>
                    <td className="py-3 px-3 text-right font-bold text-rose-700">
                      ₹{Number(e.amount).toLocaleString('en-IN')}
                    </td>
                    {hasRole(['OWNER', 'ACCOUNTANT', 'MANAGER']) && (
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(e.id, e.expenseCode)}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Expense"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <Modal
          isOpen={showAdd}
          onClose={() => setShowAdd(false)}
          title="Record Operating Expense"
          subtitle="Vendor disbursement or maintenance receipt"
          maxWidth="md"
        >
          <form onSubmit={handleAddExpense} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold outline-none"
                >
                  <option value="Decoration">Floral & Stage Decor</option>
                  <option value="Electricity">Electricity & Fuel/Diesel</option>
                  <option value="Catering">Catering Supplies</option>
                  <option value="Maintenance">Repairs & Maintenance</option>
                  <option value="Cleaning">Housekeeping & Cleaning</option>
                  <option value="Staff">Staff Wages / Labor</option>
                  <option value="Other">Other Operational</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 15000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-rose-700 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Expense Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold outline-none"
                >
                  <option value="UPI">UPI</option>
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CARD">Card</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Vendor / Payee Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Indore Floral Suppliers"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Notes / Description</label>
              <input
                type="text"
                placeholder="Details of expense..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
              />
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
                {saving ? 'Saving...' : 'Add Expense'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
