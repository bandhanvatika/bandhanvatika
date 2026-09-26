import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Header } from './components/Header.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { LoginView } from './views/LoginView.tsx';
import { DashboardView } from './views/DashboardView.tsx';
import { BookingsView } from './views/BookingsView.tsx';
import { CalendarView } from './views/CalendarView.tsx';
import { CustomersView } from './views/CustomersView.tsx';
import { HallsView } from './views/HallsView.tsx';
import { RoomsView } from './views/RoomsView.tsx';
import { QuotationsView } from './views/QuotationsView.tsx';
import { InvoicesView } from './views/InvoicesView.tsx';
import { PaymentsView } from './views/PaymentsView.tsx';
import { ExpensesView } from './views/ExpensesView.tsx';
import { ReportsView } from './views/ReportsView.tsx';
import { UsersView } from './views/UsersView.tsx';
import { AuditLogsView } from './views/AuditLogsView.tsx';
import { SettingsView } from './views/SettingsView.tsx';
import { CreateBookingModal } from './views/CreateBookingModal.tsx';
import { BrandLogo } from './components/BrandLogo.tsx';

const ROLE_ALLOWED_TABS: Record<string, string[]> = {
  OWNER: [
    'dashboard', 'bookings', 'calendar', 'customers',
    'halls', 'rooms',
    'quotations', 'invoices', 'payments', 'expenses', 'reports',
    'users', 'audit-logs', 'settings',
  ],
  MANAGER: [
    'dashboard', 'bookings', 'calendar', 'customers',
    'halls', 'rooms',
    'quotations', 'audit-logs',
  ],
  ACCOUNTANT: [
    'dashboard', 'bookings', 'customers',
    'quotations', 'invoices', 'payments', 'expenses', 'reports',
  ],
  RECEPTIONIST: [
    'dashboard', 'bookings', 'calendar', 'customers',
    'halls', 'rooms',
  ],
  STAFF: [
    'calendar',
  ],
};

const DEFAULT_TAB_FOR_ROLE: Record<string, string> = {
  OWNER: 'dashboard',
  MANAGER: 'dashboard',
  ACCOUNTANT: 'dashboard',
  RECEPTIONIST: 'dashboard',
  STAFF: 'calendar',
};

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const userRole = user?.role || 'STAFF';
  const allowedTabs = ROLE_ALLOWED_TABS[userRole] || ['calendar'];
  const defaultTab = DEFAULT_TAB_FOR_ROLE[userRole] || 'calendar';

  const [currentTab, setCurrentTab] = useState<string>(() => defaultTab);
  const [isOpenMobile, setIsOpenMobile] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Global New Booking Wizard Modal
  const [isBookingModalOpen, setIsBookingModalOpen] = useState<boolean>(false);
  const [bookingModalInitialDate, setBookingModalInitialDate] = useState<string | undefined>(undefined);
  const [bookingModalInitialPackage, setBookingModalInitialPackage] = useState<'STANDARD' | 'JEEVIKA'>('STANDARD');

  // Trigger reload key for refresh
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Synchronize currentTab if user or role changes
  React.useEffect(() => {
    if (user && !allowedTabs.includes(currentTab)) {
      setCurrentTab(defaultTab);
    }
  }, [user, userRole, allowedTabs, currentTab, defaultTab]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F4EE] flex items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-4 text-center">
          <BrandLogo variant="stacked" size="md" />
          <div className="flex items-center space-x-2 text-stone-500 text-xs font-semibold uppercase tracking-widest">
            <div className="animate-spin w-4 h-4 border-2 border-[#C5A059] border-t-transparent rounded-full" />
            <span>Loading Workspace...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const handleOpenNewBooking = (dateStr?: string, pkg?: 'STANDARD' | 'JEEVIKA') => {
    setBookingModalInitialDate(dateStr);
    setBookingModalInitialPackage(pkg || 'STANDARD');
    setIsBookingModalOpen(true);
  };

  const handleBookingSuccess = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const renderActiveView = () => {
    if (!allowedTabs.includes(currentTab)) {
      return (
        <div className="p-8 rounded-3xl bg-white border border-stone-200 text-center space-y-3 shadow-xs">
          <h3 className="text-lg font-bold font-brand text-[#14281D]">Access Restricted</h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto">
            Your account role ({user.role}) is restricted from accessing this module.
          </p>
          <button
            onClick={() => setCurrentTab(defaultTab)}
            className="px-4 py-2 bg-[#14281D] hover:bg-[#1f3c2b] text-[#F3E7C4] text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Go to {defaultTab === 'calendar' ? 'Schedule View' : 'Dashboard'}
          </button>
        </div>
      );
    }

    switch (currentTab) {
      case 'dashboard':
        return (
          <DashboardView
            key={`dash-${refreshKey}`}
            onOpenNewBooking={() => handleOpenNewBooking()}
            onNavigateTab={(tab) => setCurrentTab(tab)}
          />
        );
      case 'bookings':
        return (
          <BookingsView
            key={`bkg-${refreshKey}`}
            onOpenNewBooking={(dateStr, pkg) => handleOpenNewBooking(dateStr, pkg)}
            searchQuery={searchQuery}
          />
        );
      case 'calendar':
        return (
          <CalendarView
            key={`cal-${refreshKey}`}
            onOpenNewBookingWithDate={(dateStr) => handleOpenNewBooking(dateStr)}
            onSelectBookingId={(id) => {
              if (allowedTabs.includes('bookings')) {
                setCurrentTab('bookings');
              }
            }}
            onNavigateTab={(tab) => setCurrentTab(tab)}
          />
        );
      case 'customers':
        return <CustomersView key={`cust-${refreshKey}`} searchQuery={searchQuery} />;
      case 'halls':
        return <HallsView key={`hall-${refreshKey}`} />;
      case 'rooms':
        return <RoomsView key={`room-${refreshKey}`} />;
      case 'quotations':
        return <QuotationsView key={`quot-${refreshKey}`} searchQuery={searchQuery} />;
      case 'invoices':
        return <InvoicesView key={`inv-${refreshKey}`} searchQuery={searchQuery} />;
      case 'payments':
        return <PaymentsView key={`pay-${refreshKey}`} searchQuery={searchQuery} />;
      case 'expenses':
        return <ExpensesView key={`exp-${refreshKey}`} />;
      case 'reports':
        return <ReportsView key={`rep-${refreshKey}`} />;
      case 'users':
        return <UsersView key={`usr-${refreshKey}`} />;
      case 'audit-logs':
        return <AuditLogsView key={`aud-${refreshKey}`} />;
      case 'settings':
        return <SettingsView key={`set-${refreshKey}`} />;
      default:
        return (
          <CalendarView
            key={`cal-${refreshKey}`}
            onOpenNewBookingWithDate={(dateStr) => handleOpenNewBooking(dateStr)}
            onSelectBookingId={() => {}}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F4EE] flex">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        isOpenMobile={isOpenMobile}
        setIsOpenMobile={setIsOpenMobile}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <Header
          onOpenMobileMenu={() => setIsOpenMobile(true)}
          onOpenNewBooking={() => handleOpenNewBooking()}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {renderActiveView()}
        </main>
      </div>

      {/* Global 4-Step Booking Wizard Modal */}
      {isBookingModalOpen && (
        <CreateBookingModal
          isOpen={isBookingModalOpen}
          onClose={() => setIsBookingModalOpen(false)}
          onSuccess={handleBookingSuccess}
          initialDate={bookingModalInitialDate}
          initialPackage={bookingModalInitialPackage}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
