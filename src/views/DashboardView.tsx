import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client.ts';
import {
  CalendarCheck,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Clock,
  Landmark,
  ArrowUpRight,
  Plus,
  Receipt,
  CreditCard,
  Users,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  BedDouble,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

interface DashboardViewProps {
  onOpenNewBooking: () => void;
  onNavigateTab: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenNewBooking,
  onNavigateTab,
}) => {
  const { user, hasRole } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      const res = await apiRequest('/dashboard');
      if (res.success && res.data) {
        setData(res.data);
      }
      setLoading(false);
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin w-8 h-8 border-3 border-[#C5A059] border-t-transparent rounded-full" />
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-widest">
            Loading Bandhan Vatika Dashboard...
          </span>
        </div>
      </div>
    );
  }

  const stats = data?.stats || {
    totalBookings: 0,
    confirmedBookings: 0,
    totalRevenue: 0,
    pendingPayments: 0,
  };

  const upcomingBookings = data?.upcomingBookings || [];
  const monthlyRevenue = data?.monthlyRevenue || [];

  const maxRevenue = Math.max(...monthlyRevenue.map((m: any) => m.amount), 200000);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-[#14281D] via-[#1A3325] to-[#14281D] text-[#FBF9F5] shadow-lg border border-[#2D4D3A] relative overflow-hidden">
        <div className="absolute right-0 top-0 -mr-10 -mt-10 w-64 h-64 rounded-full bg-[#C5A059]/10 blur-2xl pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-[#C5A059]/20 text-[#E2C07D] text-[10px] font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3 h-3 text-[#E2C07D]" />
            <span>Bandhan Vatika Hospitality Suite</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-brand tracking-wide text-[#F3E7C4]">
            Welcome back, {user?.name || 'Administrator'}
          </h1>
          <p className="text-xs sm:text-sm text-stone-300 mt-1 max-w-xl">
            A Complete Venue for Your Celebration — Everything you need under one roof, from the ceremony to the stay. Easy road access on Ara-Buxar Main Road.
          </p>
        </div>

        {hasRole(['OWNER', 'MANAGER', 'RECEPTIONIST']) && (
          <div className="relative z-10 flex items-center space-x-2.5">
            <button
              onClick={onOpenNewBooking}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-[#C5A059] hover:bg-[#b89146] text-[#14281D] font-bold text-xs uppercase tracking-wider shadow-md transition-all active:scale-95"
            >
              <Plus className="w-4 h-4 text-[#14281D]" />
              <span>Book Venue</span>
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards Row (from screenshot) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Bookings */}
        <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Total Bookings</span>
            <div className="w-9 h-9 rounded-xl bg-[#14281D]/10 text-[#14281D] flex items-center justify-center">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black font-brand text-[#14281D]">{stats.totalBookings}</span>
            {stats.totalBookings > 0 ? (
              <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center">
                <TrendingUp className="w-3 h-3 mr-0.5" /> Active
              </span>
            ) : (
              <span className="text-[11px] font-medium text-stone-400 bg-stone-100 px-2 py-0.5 rounded-md">
                0 Active
              </span>
            )}
          </div>
          <p className="text-[11px] text-stone-400 mt-1">Across all halls & lawns</p>
        </div>

        {/* Confirmed Bookings */}
        <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Confirmed Bookings</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black font-brand text-[#14281D]">{stats.confirmedBookings}</span>
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
              Active Slots
            </span>
          </div>
          <p className="text-[11px] text-stone-400 mt-1">Scheduled & locked events</p>
        </div>

        {/* Role-based Financial / Operational Cards */}
        {hasRole(['OWNER', 'ACCOUNTANT']) ? (
          <>
            {/* Total Revenue */}
            <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Total Revenue</span>
                <div className="w-9 h-9 rounded-xl bg-[#C5A059]/15 text-[#9E7C38] flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-2xl font-black font-brand text-[#14281D]">
                  ₹{Number(stats.totalRevenue).toLocaleString('en-IN')}
                </span>
                <span className="text-[11px] font-semibold text-stone-500">Gross</span>
              </div>
              <p className="text-[11px] text-stone-400 mt-1">Total booked billing value</p>
            </div>

            {/* Pending Payments */}
            <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Pending Balance</span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-2xl font-black font-brand text-amber-600">
                  ₹{Number(stats.pendingPayments).toLocaleString('en-IN')}
                </span>
                <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                  Receivables
                </span>
              </div>
              <p className="text-[11px] text-stone-400 mt-1">To be collected on event days</p>
            </div>
          </>
        ) : (
          <>
            {/* Halls & Lawns Count */}
            <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Venues Available</span>
                <div className="w-9 h-9 rounded-xl bg-[#14281D]/10 text-[#14281D] flex items-center justify-center">
                  <Landmark className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-2xl font-black font-brand text-[#14281D]">{data?.hallsCount || 4}</span>
                <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                  Active Venues
                </span>
              </div>
              <p className="text-[11px] text-stone-400 mt-1">4 Halls (3 AC, 1 Non-AC) · Up to 400</p>
            </div>

            {/* Guest Rooms Count */}
            <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Guest Rooms</span>
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                  <BedDouble className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-2xl font-black font-brand text-[#14281D]">{data?.roomsCount || 10}</span>
                <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                  Rooms Ready
                </span>
              </div>
              <p className="text-[11px] text-stone-400 mt-1">10 Rooms (6 AC, 4 Non-AC)</p>
            </div>
          </>
        )}
      </div>

      {/* Center Grid: Monthly Revenue Chart + Quick Navigation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Monthly Revenue Chart for Finance / Operational status for Ops */}
        {hasRole(['OWNER', 'ACCOUNTANT']) ? (
          <div className="lg:col-span-8 p-6 rounded-3xl bg-white border border-stone-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-bold font-brand text-[#14281D]">Monthly Revenue Trend</h3>
                <p className="text-xs text-stone-500 mt-0.5">Financial trajectory across 2024 calendar months</p>
              </div>
              <span className="text-xs font-bold text-[#14281D] bg-[#14281D]/5 px-2.5 py-1 rounded-lg">
                FY 2024-25
              </span>
            </div>

            {/* Bar Visualizer */}
            <div className="h-48 flex items-end justify-between gap-2 pt-6 pb-2 border-b border-stone-100">
              {monthlyRevenue.map((item: any, idx: number) => {
                const heightPct = Math.round((item.amount / maxRevenue) * 100);
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                    <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-stone-900 text-white text-[10px] font-bold py-1 px-1.5 rounded-md pointer-events-none whitespace-nowrap z-20">
                      ₹{(item.amount / 1000).toFixed(0)}k
                    </div>
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full max-w-[28px] rounded-t-lg transition-all duration-300 ${
                        item.month === 'Nov' || item.month === 'Dec'
                          ? 'bg-gradient-to-t from-[#C5A059] to-[#E2C07D] shadow-xs'
                          : 'bg-stone-200 group-hover:bg-[#14281D]/70'
                      }`}
                    />
                    <span className="text-[10px] font-semibold text-stone-400 mt-2">{item.month}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-4 text-xs text-stone-500">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#C5A059]"></span>
                <span>Peak Wedding Months (Nov - Dec)</span>
              </div>
              <button
                onClick={() => onNavigateTab('reports')}
                className="text-[#14281D] font-bold hover:underline flex items-center"
              >
                <span>View full financial report</span>
                <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
              </button>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-8 p-6 rounded-3xl bg-white border border-stone-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold font-brand text-[#14281D]">Desk & Event Operations</h3>
                <p className="text-xs text-stone-500 mt-0.5">Live venue status, upcoming functions, and guest check-ins</p>
              </div>
              <button
                onClick={() => onNavigateTab('calendar')}
                className="text-xs font-bold text-[#14281D] bg-[#14281D]/5 hover:bg-[#14281D]/10 px-3 py-1.5 rounded-xl transition-all flex items-center"
              >
                <span>View Full Schedule</span>
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/60">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Today's Focus</span>
                <p className="font-bold text-sm text-[#14281D] mt-1">Venue Preparation & Guest Welcome</p>
                <p className="text-xs text-stone-500 mt-0.5">Ensure air conditioning and catering arrangements are finalized 2 hours before events.</p>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/60">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Desk Duty</span>
                <p className="font-bold text-sm text-emerald-950 mt-1">Guest Check-in & ID Verification</p>
                <p className="text-xs text-emerald-700 mt-0.5">Collect ID proofs for room allotment and maintain event register.</p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Venue Status & Actions (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-5 rounded-3xl bg-white border border-stone-200/80 shadow-xs">
            <h3 className="text-sm font-bold font-brand text-[#14281D] mb-3">Venue Portfolio</h3>
            <div className="space-y-2.5">
              <div
                onClick={() => onNavigateTab('halls')}
                className="p-3 rounded-xl bg-stone-50 hover:bg-stone-100 transition-colors flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#14281D] text-[#C5A059] flex items-center justify-center font-bold text-xs">
                    <Landmark className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-stone-800">4 Halls (3 AC, 1 Non-AC)</h5>
                    <p className="text-[10px] text-stone-400">Capacity up to 400 · Stage setup area</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400" />
              </div>

              <div
                onClick={() => onNavigateTab('rooms')}
                className="p-3 rounded-xl bg-stone-50 hover:bg-stone-100 transition-colors flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#C5A059]/20 text-[#8C6D2E] flex items-center justify-center font-bold text-xs">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-stone-800">10 Guest Rooms (6 AC, 4 Non-AC)</h5>
                    <p className="text-[10px] text-stone-400">Accommodates families & bridal stay</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400" />
              </div>

              <div
                onClick={() => onNavigateTab('calendar')}
                className="p-3 rounded-xl bg-stone-50 hover:bg-stone-100 transition-colors flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    <CalendarCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-stone-800">Booking Calendar</h5>
                    <p className="text-[10px] text-stone-400">Month, Week & Day schedule</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400" />
              </div>
            </div>
          </div>

          {/* Quick Invoice & Payment Card */}
          <div className="p-5 rounded-3xl bg-[#14281D] text-[#FBF9F5] shadow-md border border-[#2D4D3A]">
            <h4 className="text-sm font-bold font-brand text-[#E2C07D]">Quick Actions</h4>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                onClick={() => onNavigateTab('invoices')}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-left transition-colors"
              >
                <Receipt className="w-4 h-4 text-[#C5A059] mb-1" />
                <span className="text-xs font-semibold block text-stone-200">Invoices</span>
                <span className="text-[10px] text-stone-400">Print & Bill</span>
              </button>
              <button
                onClick={() => onNavigateTab('payments')}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-left transition-colors"
              >
                <CreditCard className="w-4 h-4 text-[#C5A059] mb-1" />
                <span className="text-xs font-semibold block text-stone-200">Payments</span>
                <span className="text-[10px] text-stone-400">Record Advance</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Upcoming Bookings Table (Matching uploaded design!) */}
      <div className="p-6 rounded-3xl bg-white border border-stone-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold font-brand text-[#14281D]">Upcoming Bookings</h3>
            <p className="text-xs text-stone-500 mt-0.5">Recently confirmed events and venue allocations</p>
          </div>
          <button
            onClick={() => onNavigateTab('bookings')}
            className="text-xs font-bold text-[#14281D] hover:underline flex items-center"
          >
            <span>View All Bookings</span>
            <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-stone-200 text-stone-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3">Booking #</th>
                <th className="py-3 px-3">Customer</th>
                <th className="py-3 px-3">Event Type</th>
                <th className="py-3 px-3">Venue</th>
                <th className="py-3 px-3">Date & Time</th>
                {hasRole(['OWNER', 'ACCOUNTANT']) ? (
                  <>
                    <th className="py-3 px-3 text-right">Total (₹)</th>
                    <th className="py-3 px-3 text-right">Balance Due (₹)</th>
                  </>
                ) : (
                  <th className="py-3 px-3 text-center">Expected Guests</th>
                )}
                <th className="py-3 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {upcomingBookings.map((b: any) => {
                const isPaid = Number(b.balanceAmount) === 0;
                return (
                  <tr key={b.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="py-3.5 px-3 font-mono font-bold text-stone-800">
                      {b.bookingNumber}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-stone-900">{b.customerName}</div>
                      <div className="text-[11px] text-stone-400">{b.customerPhone}</div>
                    </td>
                    <td className="py-3.5 px-3 font-medium text-stone-700">
                      {b.eventType}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-[#14281D]/5 text-[#14281D] font-semibold text-[11px]">
                        {b.hallName}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-stone-600">
                      <div>{b.eventDate}</div>
                      <div className="text-[10px] text-stone-400">{b.startTime} - {b.endTime}</div>
                    </td>
                    {hasRole(['OWNER', 'ACCOUNTANT']) ? (
                      <>
                        <td className="py-3.5 px-3 text-right font-bold text-stone-900">
                          ₹{Number(b.grandTotal || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5 px-3 text-right font-bold">
                          {isPaid ? (
                            <span className="text-emerald-600">₹0</span>
                          ) : (
                            <span className="text-amber-600">₹{Number(b.balanceAmount || 0).toLocaleString('en-IN')}</span>
                          )}
                        </td>
                      </>
                    ) : (
                      <td className="py-3.5 px-3 text-center font-bold text-stone-800">
                        {b.guestCount || '—'}
                      </td>
                    )}
                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          b.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.status === 'CONFIRMED'
                            ? 'bg-blue-100 text-blue-800'
                            : b.status === 'SCHEDULED'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
