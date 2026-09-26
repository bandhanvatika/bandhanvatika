import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client.ts';
import { BarChart3, TrendingUp, DollarSign, Printer, Landmark, Sparkles } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo.tsx';

export const ReportsView: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      const res = await apiRequest('/reports/financial');
      if (res.success && res.data) {
        setData(res.data);
      } else {
        const fallbackRes = await apiRequest('/reports');
        if (fallbackRes.success && fallbackRes.data) {
          setData(fallbackRes.data);
        }
      }
      setLoading(false);
    };
    fetchReport();
  }, []);

  if (loading) {
    return <div className="py-12 text-center text-xs text-stone-400 font-semibold">Generating business analytics...</div>;
  }

  const s = data?.summary || data?.financialSummary || {
    totalRevenue: 0,
    totalCollected: 0,
    totalOutstanding: 0,
    totalExpenses: 0,
    netProfit: 0,
  };

  const hallStats = data?.hallStats || data?.hallUtilization || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-stone-200/80 shadow-xs">
        <div className="flex items-center space-x-4">
          <BrandLogo variant="icon" size="md" />
          <div>
            <h2 className="text-xl font-bold font-brand text-[#14281D]">Executive Financial Analytics</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Bandhan Vatika P&L statement, venue occupancy performance, and collection audit
            </p>
          </div>
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center space-x-1.5 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-xl transition-all shadow-xs"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print Executive Summary</span>
        </button>
      </div>

      {/* P&L Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-stone-400">Total Billed</span>
          <p className="text-xl font-bold font-brand text-stone-900 mt-1">₹{Number(s.totalRevenue).toLocaleString('en-IN')}</p>
          <span className="text-[10px] text-stone-400">Gross contract value</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-emerald-600">Collected Cash</span>
          <p className="text-xl font-bold font-brand text-emerald-700 mt-1">₹{Number(s.totalCollected).toLocaleString('en-IN')}</p>
          <span className="text-[10px] text-stone-400">Realized inflows</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-amber-600">Receivables</span>
          <p className="text-xl font-bold font-brand text-amber-600 mt-1">₹{Number(s.totalOutstanding).toLocaleString('en-IN')}</p>
          <span className="text-[10px] text-stone-400">Due before events</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-rose-600">Expenses</span>
          <p className="text-xl font-bold font-brand text-rose-700 mt-1">₹{Number(s.totalExpenses).toLocaleString('en-IN')}</p>
          <span className="text-[10px] text-stone-400">Operating overhead</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#14281D] text-[#FBF9F5] shadow-md border border-[#2D4D3A]">
          <span className="text-[10px] font-bold uppercase text-[#C5A059]">Net Profit</span>
          <p className="text-xl font-bold font-brand text-[#E2C07D] mt-1">₹{Number(s.netProfit).toLocaleString('en-IN')}</p>
          <span className="text-[10px] text-stone-300">Revenue minus expenses</span>
        </div>
      </div>

      {/* Hall Utilization breakdown */}
      <div className="p-6 rounded-3xl bg-white border border-stone-200/80 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-bold font-brand text-[#14281D]">Banquet & Lawn Utilization</h3>
          <p className="text-xs text-stone-500 mt-0.5">Booking density and revenue contribution per property venue</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {hallStats.map((h: any) => (
            <div key={h.id} className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm text-stone-900">{h.name}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-200">{h.code}</span>
              </div>
              <div className="flex justify-between text-xs text-stone-600">
                <span>Bookings:</span>
                <span className="font-bold text-stone-900">{h.bookingsCount}</span>
              </div>
              <div className="flex justify-between text-xs text-stone-600">
                <span>Total Generated:</span>
                <span className="font-bold text-[#14281D]">₹{Number(h.totalRevenue).toLocaleString('en-IN')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
