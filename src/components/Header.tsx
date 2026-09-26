import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  Search,
  Bell,
  Calendar,
  Plus,
  Shield,
  LogOut,
  CheckCircle2,
  AlertCircle,
  CalendarCheck,
  CheckCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { BrandLogo } from './BrandLogo.tsx';
import { apiRequest } from '../api/client.ts';

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
  const [notifications, setNotifications] = useState<any[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await apiRequest('/notifications');
      if (res.success && Array.isArray(res.data)) {
        setNotifications(res.data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Close notifications on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const todayStr = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

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
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (!showNotifications) fetchNotifications();
              }}
              className="relative p-2 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-88 bg-white rounded-2xl shadow-xl border border-stone-200 p-3.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-stone-100 px-1">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">System Alerts</span>
                    {unreadCount > 0 ? (
                      <span className="text-[10px] text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/60">
                        {unreadCount} New
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                        Up to date
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[11px] text-[#8C6D2E] hover:text-[#14281D] font-medium flex items-center space-x-1 transition-colors"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Mark read</span>
                    </button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div className="py-6 px-4 text-center">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2.5 border border-emerald-100">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-stone-800">All Caught Up</p>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      No pending alerts or notifications. All venue schedules & balances are up to date.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-2.5 rounded-xl transition-colors cursor-pointer text-left flex items-start space-x-2.5 ${
                          n.unread ? 'bg-amber-50/60 hover:bg-amber-50 border border-amber-100/80' : 'hover:bg-stone-50'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {n.type === 'UPCOMING' ? (
                            <div className="w-7 h-7 rounded-lg bg-[#14281D]/10 text-[#14281D] flex items-center justify-center">
                              <CalendarCheck className="w-3.5 h-3.5 text-[#C5A059]" />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                              <AlertCircle className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-1">
                            <span className="text-xs font-bold text-stone-800 truncate">{n.title}</span>
                            <span className="text-[10px] text-stone-400 whitespace-nowrap shrink-0">{n.time}</span>
                          </div>
                          <p className="text-[11px] text-stone-500 mt-0.5 leading-snug line-clamp-2">{n.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
