import React from 'react';
import {
  LayoutDashboard,
  CalendarCheck,
  CalendarDays,
  Users,
  Landmark,
  BedDouble,
  FileText,
  ReceiptText,
  CreditCard,
  Wallet,
  BarChart3,
  ShieldCheck,
  History,
  Settings as SettingsIcon,
  LogOut,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { UserRole } from '../types/index.ts';
import { BrandLogo } from './BrandLogo.tsx';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  isOpenMobile,
  setIsOpenMobile,
}) => {
  const { user, logout, hasRole } = useAuth();

  const navSections = [
    {
      title: 'OPERATIONS',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['OWNER', 'MANAGER', 'ACCOUNTANT', 'RECEPTIONIST'] as UserRole[] },
        { id: 'bookings', label: 'Bookings', icon: CalendarCheck, roles: ['OWNER', 'MANAGER', 'ACCOUNTANT', 'RECEPTIONIST'] as UserRole[] },
        { id: 'calendar', label: user?.role === 'STAFF' ? 'Schedule View' : 'Booking Calendar', icon: CalendarDays, roles: ['OWNER', 'MANAGER', 'ACCOUNTANT', 'RECEPTIONIST', 'STAFF'] as UserRole[] },
        { id: 'customers', label: 'Customers', icon: Users, roles: ['OWNER', 'MANAGER', 'ACCOUNTANT', 'RECEPTIONIST'] as UserRole[] },
      ],
    },
    {
      title: 'PROPERTY ASSETS',
      items: [
        { id: 'halls', label: 'Halls & Lawns', icon: Landmark, roles: ['OWNER', 'MANAGER', 'RECEPTIONIST'] as UserRole[] },
        { id: 'rooms', label: 'Guest Rooms', icon: BedDouble, roles: ['OWNER', 'MANAGER', 'RECEPTIONIST'] as UserRole[] },
      ],
    },
    {
      title: 'BILLING & FINANCE',
      items: [
        { id: 'quotations', label: 'Quotations', icon: FileText, roles: ['OWNER', 'ACCOUNTANT', 'MANAGER'] as UserRole[] },
        { id: 'invoices', label: 'Invoices', icon: ReceiptText, roles: ['OWNER', 'ACCOUNTANT'] as UserRole[] },
        { id: 'payments', label: 'Payments', icon: CreditCard, roles: ['OWNER', 'ACCOUNTANT'] as UserRole[] },
        { id: 'expenses', label: 'Expenses', icon: Wallet, roles: ['OWNER', 'ACCOUNTANT'] as UserRole[] },
        { id: 'reports', label: 'Reports & P&L', icon: BarChart3, roles: ['OWNER', 'ACCOUNTANT'] as UserRole[] },
      ],
    },
    {
      title: 'ADMINISTRATION',
      items: [
        { id: 'users', label: 'Users & Roles', icon: ShieldCheck, roles: ['OWNER'] as UserRole[] },
        { id: 'audit-logs', label: 'Audit Logs', icon: History, roles: ['OWNER', 'MANAGER'] as UserRole[] },
        { id: 'settings', label: 'Settings', icon: SettingsIcon, roles: ['OWNER'] as UserRole[] },
      ],
    },
  ];

  const handleSelectTab = (id: string) => {
    setCurrentTab(id);
    setIsOpenMobile(false);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpenMobile(false)}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-[#14281D] text-stone-200 flex flex-col border-r border-[#264433] transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-[#264433] flex items-center justify-between bg-[#0F2016]">
          <BrandLogo variant="horizontal" theme="dark" size="md" />
          <button
            onClick={() => setIsOpenMobile(false)}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 lg:hidden cursor-pointer"
            aria-label="Close Sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navSections.map((section, idx) => {
            const filteredItems = section.items.filter((item) => hasRole(item.roles));
            if (filteredItems.length === 0) return null;

            return (
              <div key={idx} className="space-y-1">
                <div className="px-3 text-[10px] font-bold tracking-widest text-[#849B8D] uppercase mb-2">
                  {section.title}
                </div>
                {filteredItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectTab(item.id)}
                      className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                        isActive
                          ? 'bg-[#213F2F] text-[#F3E7C4] shadow-xs font-semibold border-l-4 border-[#C5A059]'
                          : 'text-stone-300 hover:bg-[#1A3325] hover:text-white'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-[#C5A059]' : 'text-[#849B8D]'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* User Card & Logout at bottom */}
        <div className="p-3 border-t border-[#264433] bg-[#0F2016]">
          <div className="flex items-center justify-between p-2 rounded-xl bg-[#172D21]">
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-[#C5A059]/20 text-[#E2C07D] border border-[#C5A059]/40 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                {user?.name ? user.name[0] : 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-stone-100 truncate">{user?.name || 'Staff'}</p>
                <div className="flex items-center space-x-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <p className="text-[10px] text-[#A3B8AC] tracking-wider uppercase">{user?.role}</p>
                </div>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-rose-300 hover:text-rose-200 bg-rose-950/30 hover:bg-rose-900/50 border border-rose-800/40 text-[11px] font-bold transition-colors shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
