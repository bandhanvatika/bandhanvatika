import React, { useState } from 'react';
import {
  Menu,
  Search,
  Bell,
  Calendar,
  Plus,
  Shield,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { BrandLogo } from './BrandLogo.tsx';

interface HeaderProps {
  onOpenMobileMenu: () => void;
  onOpenNewBooking: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileMenu,
  onOpenNewBooking,
  searchQuery,
  setSearchQuery,
}) => {
  const { user, hasRole, logout } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);

  const todayStr = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  const notifications = [
    { id: 1, title: 'Upcoming Wedding', desc: 'Rahul Sharma in Grand Hall on 15 Nov', time: '1 hr ago' },
    { id: 2, title: 'Payment Received', desc: '₹1,80,000 for Engagement (Priya Mehta)', time: '3 hrs ago' },
    { id: 3, title: 'Balance Pending', desc: 'Invoice INV-2024-003 due in 7 days', time: 'Yesterday' },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200/80 px-4 sm:px-6 py-3 transition-all">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Mobile hamburger & Global Search */}
        <div className="flex items-center space-x-3 flex-1 max-w-lg">
          <button
            onClick={onOpenMobileMenu}
            className="p-2 rounded-xl text-stone-600 hover:bg-stone-100 lg:hidden"
            aria-label="Toggle Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="lg:hidden shrink-0">
            <BrandLogo variant="icon" size="sm" />
          </div>

          <div className="relative w-full">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search bookings, customers, invoices..."
              className="w-full pl-9 pr-4 py-2 bg-stone-100/70 hover:bg-stone-100 focus:bg-white text-xs sm:text-sm rounded-xl border border-stone-200 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 outline-none transition-all placeholder:text-stone-400"
            />
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Today Date Badge */}
          <div className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-stone-100 text-stone-600 text-xs font-medium border border-stone-200/60">
            <Calendar className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>{todayStr}</span>
          </div>

          {/* Quick "New Booking" Action */}
          {hasRole(['OWNER', 'MANAGER', 'RECEPTIONIST']) && (
            <button
              onClick={onOpenNewBooking}
              className="flex items-center space-x-1.5 px-3 sm:px-4 py-2 bg-[#14281D] hover:bg-[#1c3829] active:scale-95 text-[#F3E7C4] text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all border border-[#2d4d3b]"
            >
              <Plus className="w-4 h-4 text-[#C5A059]" />
              <span className="hidden sm:inline">New Booking</span>
              <span className="sm:hidden">Book</span>
            </button>
          )}

          {/* Notifications button */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></span>
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-stone-200 p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-100 px-2">
                  <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">System Alerts</span>
                  <span className="text-[10px] text-[#C5A059] font-medium bg-[#C5A059]/10 px-2 py-0.5 rounded-full">3 New</span>
                </div>
                <div className="space-y-1.5">
                  {notifications.map((n) => (
                    <div key={n.id} className="p-2 rounded-xl hover:bg-stone-50 transition-colors cursor-pointer text-left">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-semibold text-stone-800">{n.title}</span>
                        <span className="text-[10px] text-stone-400">{n.time}</span>
                      </div>
                      <p className="text-[11px] text-stone-500 mt-0.5 line-clamp-1">{n.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User Role Badge & Sign Out */}
          <div className="flex items-center space-x-2.5 pl-2 border-l border-stone-200">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-bold text-stone-800 leading-tight">{user?.name?.split(' ')[0]}</p>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-[#14281D]/10 text-[#14281D]">
                <Shield className="w-2.5 h-2.5 mr-0.5 text-[#C5A059]" />
                {user?.role}
              </span>
            </div>

            <button
              onClick={logout}
              title="Sign Out from Bandhan Vatika"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-rose-50 text-stone-600 hover:text-rose-700 border border-stone-200/80 hover:border-rose-200 text-xs font-bold transition-all active:scale-95 shadow-2xs"
            >
              <LogOut className="w-3.5 h-3.5 text-stone-500 hover:text-rose-600" />
              <span className="hidden md:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
