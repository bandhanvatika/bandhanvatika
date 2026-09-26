import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../api/client.ts';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Landmark,
  Calendar as CalendarIcon,
  Sparkles,
  Clock,
  User,
  Phone,
  ArrowRight,
  Filter,
  List,
  Grid,
  CheckCircle,
  Tag,
  DollarSign,
  AlertCircle,
  Eye,
  CalendarCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { Modal } from '../components/Modal.tsx';

interface CalendarViewProps {
  onOpenNewBookingWithDate: (dateStr: string) => void;
  onSelectBookingId: (id: string) => void;
  onNavigateTab?: (tab: string) => void;
}

// Auspicious Hindu Wedding Saya / Muhurat Dates (Indian Banquet Reality)
const AUSPICIOUS_SAYA_DATES = new Set([
  // Nov 2026
  '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29',
  // Dec 2026
  '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-09', '2026-12-10', '2026-12-11', '2026-12-14', '2026-12-15',
  // Jan 2027
  '2027-01-16', '2027-01-17', '2027-01-18', '2027-01-21', '2027-01-22', '2027-01-26',
  // Feb 2027
  '2027-02-02', '2027-02-03', '2027-02-07', '2027-02-12', '2027-02-14', '2027-02-18', '2027-02-21',
]);

export const CalendarView: React.FC<CalendarViewProps> = ({
  onOpenNewBookingWithDate,
  onSelectBookingId,
  onNavigateTab,
}) => {
  const { user, hasRole } = useAuth();
  
  // Real world default: initialize to current date
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // View mode: Month Grid or Chronological Agenda List
  const [viewMode, setViewMode] = useState<'MONTH' | 'AGENDA'>('MONTH');
  
  // Venue Filter
  const [selectedHall, setSelectedHall] = useState<string>('ALL');
  
  // Modals
  const [selectedStaffEvent, setSelectedStaffEvent] = useState<any | null>(null);
  const [selectedBookingEvent, setSelectedBookingEvent] = useState<any | null>(null);

  const fetchCalendar = async () => {
    setLoading(true);
    const res = await apiRequest('/calendar');
    if (res.success && res.data) {
      setEvents(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCalendar();
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = parseInt(e.target.value, 10);
    setCurrentDate(new Date(year, newMonth, 1));
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = parseInt(e.target.value, 10);
    setCurrentDate(new Date(newYear, month, 1));
  };

  // Generate grid days
  const calendarCells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarCells.push(day);
  }

  // Filter events by selected venue
  const filteredEvents = useMemo(() => {
    if (selectedHall === 'ALL') return events;
    return events.filter((e) => e.hallCode === selectedHall);
  }, [events, selectedHall]);

  const getEventsForDay = (day: number) => {
    const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return filteredEvents.filter((e) => e.date === dayStr);
  };

  // Check if date has auspicious wedding saya
  const isAuspiciousDay = (dayStr: string) => {
    return AUSPICIOUS_SAYA_DATES.has(dayStr);
  };

  const hallColorClasses: Record<string, { pill: string }> = {
    'HALL-A': {
      pill: 'bg-[#14281D] text-[#F3E7C4] border-l-4 border-[#C5A059]',
    },
    'HALL-B': {
      pill: 'bg-stone-800 text-stone-100 border-l-4 border-stone-400',
    },
    'LAWN-1': {
      pill: 'bg-emerald-900 text-emerald-100 border-l-4 border-emerald-400',
    },
    'HALL-C': {
      pill: 'bg-purple-900 text-purple-100 border-l-4 border-purple-400',
    },
  };

  // When clicking ANY cell/day in the calendar
  const handleCellClick = (dateStr: string) => {
    if (hasRole(['OWNER', 'MANAGER', 'RECEPTIONIST'])) {
      onOpenNewBookingWithDate(dateStr);
    }
  };

  // When clicking an event badge on the calendar
  const handleEventClick = (e: React.MouseEvent, evt: any) => {
    e.stopPropagation(); // Prevent trigger of cell click
    if (hasRole(['OWNER', 'MANAGER', 'ACCOUNTANT', 'RECEPTIONIST'])) {
      setSelectedBookingEvent(evt);
    } else {
      setSelectedStaffEvent(evt);
    }
  };

  // Agenda view: sorted upcoming events
  const agendaEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredEvents]);

  const canCreateBooking = hasRole(['OWNER', 'MANAGER', 'RECEPTIONIST']);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Top Calendar Toolbar */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white border border-stone-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold font-brand text-[#14281D]">
              {user?.role === 'STAFF' ? 'Event Schedule' : 'Booking Calendar'}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#C5A059]/15 text-[#14281D] border border-[#C5A059]/30">
              {monthNames[month]} {year}
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            {canCreateBooking
              ? 'Click on any date to immediately launch a new booking reservation'
              : user?.role === 'STAFF'
              ? 'Operational schedule and venue timings for duty staff'
              : 'Visual venue occupancy and scheduled celebrations'}
          </p>
        </div>

        {/* Navigation & Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-stone-100 p-1 rounded-2xl border border-stone-200">
            <button
              onClick={() => setViewMode('MONTH')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                viewMode === 'MONTH'
                  ? 'bg-white text-[#14281D] shadow-2xs font-bold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Month</span>
            </button>
            <button
              onClick={() => setViewMode('AGENDA')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                viewMode === 'AGENDA'
                  ? 'bg-white text-[#14281D] shadow-2xs font-bold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Agenda</span>
            </button>
          </div>

          {/* Month & Year Selectors with Prev/Next */}
          <div className="flex items-center space-x-1 bg-stone-100 p-1 rounded-2xl border border-stone-200">
            <button
              onClick={prevMonth}
              title="Previous Month"
              className="p-1.5 rounded-xl hover:bg-white text-stone-700 hover:text-stone-900 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Month Select */}
            <select
              value={month}
              onChange={handleMonthChange}
              className="bg-transparent text-xs font-bold text-stone-800 px-2 py-1 outline-hidden cursor-pointer"
            >
              {monthNames.map((m, idx) => (
                <option key={m} value={idx}>
                  {m}
                </option>
              ))}
            </select>

            {/* Year Select */}
            <select
              value={year}
              onChange={handleYearChange}
              className="bg-transparent text-xs font-bold text-stone-800 px-2 py-1 outline-hidden cursor-pointer"
            >
              {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <button
              onClick={nextMonth}
              title="Next Month"
              className="p-1.5 rounded-xl hover:bg-white text-stone-700 hover:text-stone-900 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Today Button */}
          <button
            onClick={goToToday}
            className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-colors shadow-2xs"
          >
            Today
          </button>

          {/* Quick Book Button for Authorized Roles */}
          {canCreateBooking && (
            <button
              onClick={() => {
                const todayStr = new Date().toISOString().split('T')[0];
                onOpenNewBookingWithDate(todayStr);
              }}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-[#14281D] hover:bg-[#1a3325] text-[#F3E7C4] text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Booking</span>
            </button>
          )}
        </div>
      </div>

      {/* Venue Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-white border border-stone-200/80 shadow-2xs text-xs">
        <span className="font-bold text-stone-700 text-[11px] uppercase tracking-wider pl-1">
          Filter Venue:
        </span>
        <button
          onClick={() => setSelectedHall('ALL')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
            selectedHall === 'ALL'
              ? 'bg-[#14281D] text-[#F3E7C4] font-bold shadow-2xs'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          All Venues ({events.length})
        </button>
        <button
          onClick={() => setSelectedHall('HALL-A')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center space-x-1.5 ${
            selectedHall === 'HALL-A'
              ? 'bg-[#14281D] text-[#F3E7C4] font-bold ring-2 ring-[#C5A059]'
              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-[#C5A059]" />
          <span>Grand Hall (HALL-A)</span>
        </button>
        <button
          onClick={() => setSelectedHall('HALL-B')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center space-x-1.5 ${
            selectedHall === 'HALL-B'
              ? 'bg-stone-800 text-white font-bold ring-2 ring-stone-400'
              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-stone-600" />
          <span>Royal Hall (HALL-B)</span>
        </button>
        <button
          onClick={() => setSelectedHall('LAWN-1')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center space-x-1.5 ${
            selectedHall === 'LAWN-1'
              ? 'bg-emerald-900 text-emerald-100 font-bold ring-2 ring-emerald-400'
              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span>Garden Lawn (LAWN-1)</span>
        </button>
        <button
          onClick={() => setSelectedHall('HALL-C')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center space-x-1.5 ${
            selectedHall === 'HALL-C'
              ? 'bg-purple-900 text-purple-100 font-bold ring-2 ring-purple-400'
              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
          <span>Party Hall (HALL-C)</span>
        </button>
      </div>

      {/* VIEW MODE 1: Month Calendar Grid */}
      {viewMode === 'MONTH' ? (
        <div className="p-3 sm:p-6 rounded-2xl sm:rounded-3xl bg-white border border-stone-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto pb-2 -mx-1 px-1 sm:mx-0 sm:px-0">
            <div className="min-w-[560px] sm:min-w-0">
              {/* Days of week header */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2 pb-3 border-b border-stone-200 text-center">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                  <div
                    key={d}
                    className={`text-[11px] sm:text-xs font-extrabold uppercase tracking-wider ${
                      i === 0 ? 'text-rose-500' : 'text-stone-600'
                    }`}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar Day Cells */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mt-2">
                {calendarCells.map((day, idx) => {
                  if (day === null) {
                    return (
                      <div
                        key={`empty-${idx}`}
                        className="min-h-[90px] sm:min-h-[120px] bg-stone-50/50 rounded-xl sm:rounded-2xl border border-dashed border-stone-200/60"
                      />
                    );
                  }

                  const dayEvents = getEventsForDay(day);
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isToday =
                    new Date().getDate() === day &&
                    new Date().getMonth() === month &&
                    new Date().getFullYear() === year;
                  const hasSaya = isAuspiciousDay(dateStr);

                  return (
                    <div
                      key={`day-${day}`}
                      onClick={() => handleCellClick(dateStr)}
                      className={`group min-h-[90px] sm:min-h-[120px] p-1.5 sm:p-2 rounded-xl sm:rounded-2xl border transition-all flex flex-col justify-between select-none ${
                        canCreateBooking ? 'cursor-pointer' : ''
                      } ${
                        isToday
                          ? 'border-[#C5A059] bg-[#C5A059]/5 shadow-xs ring-1 ring-[#C5A059]/50'
                          : hasSaya
                          ? 'border-amber-300/80 bg-amber-50/20 hover:border-[#C5A059] hover:bg-stone-50'
                          : 'border-stone-200/80 hover:border-[#C5A059]/80 hover:bg-stone-50/70 hover:shadow-xs bg-white'
                      }`}
                      title={
                        canCreateBooking
                          ? `Click to book an event on ${dateStr}`
                          : `${dayEvents.length} event(s) scheduled on ${dateStr}`
                      }
                    >
                  {/* Cell Header: Day Number, Saya Badge, and Quick Book Action */}
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center space-x-1">
                      <span
                        className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center transition-transform ${
                          isToday
                            ? 'bg-[#14281D] text-[#F3E7C4] shadow-xs scale-105'
                            : 'text-stone-800 group-hover:scale-110'
                        }`}
                      >
                        {day}
                      </span>
                      {isToday && (
                        <span className="hidden sm:inline text-[9px] font-extrabold text-[#C5A059] uppercase tracking-wider">
                          Today
                        </span>
                      )}
                    </div>

                    {/* Auspicious Shubh Saya Tag */}
                    {hasSaya && (
                      <span
                        title="Shubh Vivah Muhurat (Saya Date)"
                        className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300/80"
                      >
                        <Sparkles className="w-2.5 h-2.5 mr-0.5 text-amber-600" />
                        <span>Saya</span>
                      </span>
                    )}

                    {/* Quick + Book Button (Appears on hover or click) */}
                    {canCreateBooking && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenNewBookingWithDate(dateStr);
                        }}
                        title={`Book on ${dateStr}`}
                        className="px-1.5 py-0.5 rounded-md text-[10px] font-bold text-[#14281D] bg-[#C5A059]/20 hover:bg-[#C5A059] hover:text-[#14281D] transition-all opacity-0 group-hover:opacity-100 flex items-center space-x-0.5"
                      >
                        <Plus className="w-3 h-3" />
                        <span className="hidden xl:inline">Book</span>
                      </button>
                    )}
                  </div>

                  {/* Scheduled Events List inside Cell */}
                  <div className="space-y-1 overflow-y-auto max-h-[85px] my-auto">
                    {dayEvents.map((evt) => {
                      const styling = hallColorClasses[evt.hallCode] || {
                        pill: 'bg-stone-800 text-white border-l-4 border-stone-500',
                      };
                      return (
                        <div
                          key={evt.id}
                          onClick={(e) => handleEventClick(e, evt)}
                          className={`p-1.5 rounded-lg text-[10px] font-semibold cursor-pointer shadow-2xs transition-all hover:scale-[1.02] active:scale-95 truncate ${styling.pill}`}
                          title={`${evt.title || evt.eventType} (${evt.startTime} - ${evt.endTime}) | ${evt.hallName}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold truncate">{evt.eventType}</span>
                            <span className="text-[8px] opacity-80 shrink-0 ml-1">{evt.startTime}</span>
                          </div>
                          <div className="text-[9px] opacity-90 truncate flex items-center justify-between mt-0.5">
                            <span className="truncate">{user?.role === 'STAFF' ? evt.hallName : evt.customerName}</span>
                            {evt.status === 'CONFIRMED' && (
                              <span className="text-[8px] text-emerald-300 font-extrabold ml-1">✓</span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {dayEvents.length === 0 && canCreateBooking && (
                      <div className="text-[10px] text-stone-400/70 text-center py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        + Click to Book
                      </div>
                    )}
                  </div>

                  {/* Empty Footer spacing */}
                  <div className="h-0.5" />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Calendar Legend */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 mt-5 border-t border-stone-200 text-xs text-stone-600">
            <div className="flex flex-wrap items-center gap-4">
              <span className="font-bold text-stone-800 uppercase tracking-wider text-[10px]">
                Venues:
              </span>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-md bg-[#14281D] border border-[#C5A059]" />
                <span>Grand Hall (HALL-A)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-md bg-stone-800 border border-stone-400" />
                <span>Royal Hall (HALL-B)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-md bg-emerald-900 border border-emerald-400" />
                <span>Garden Lawn (LAWN-1)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-md bg-purple-900 border border-purple-400" />
                <span>Party Hall (HALL-C)</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-[11px] text-stone-500">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-bold">
                <Sparkles className="w-3 h-3 mr-1 text-amber-600" /> Shubh Saya Muhurat
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* VIEW MODE 2: Agenda / Chronological Event Schedule */
        <div className="p-4 sm:p-6 rounded-3xl bg-white border border-stone-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-200 pb-3">
            <div>
              <h3 className="text-base font-bold text-stone-800">
                Upcoming Celebrations & Functions
              </h3>
              <p className="text-xs text-stone-500">
                Chronological list of all reservations for operations and briefing
              </p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-xl bg-stone-100 text-stone-700">
              {agendaEvents.length} Event(s) Found
            </span>
          </div>

          {agendaEvents.length === 0 ? (
            <div className="py-12 text-center text-stone-400 text-xs">
              No functions scheduled for the selected venue filter.
            </div>
          ) : (
            <div className="space-y-3">
              {agendaEvents.map((evt) => {
                const isSaya = isAuspiciousDay(evt.date);
                return (
                  <div
                    key={evt.id}
                    onClick={() => {
                      if (hasRole(['OWNER', 'MANAGER', 'ACCOUNTANT', 'RECEPTIONIST'])) {
                        setSelectedBookingEvent(evt);
                      } else {
                        setSelectedStaffEvent(evt);
                      }
                    }}
                    className="p-4 rounded-2xl border border-stone-200/90 hover:border-[#C5A059] bg-stone-50/40 hover:bg-stone-50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-start space-x-4">
                      {/* Date Badge */}
                      <div className="w-16 h-16 rounded-2xl bg-[#14281D] text-[#F3E7C4] flex flex-col items-center justify-center shrink-0 border border-[#C5A059]/40 shadow-xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#C5A059]">
                          {new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(new Date(`${evt.date}T00:00:00`))}
                        </span>
                        <span className="text-xl font-bold font-brand">
                          {new Date(`${evt.date}T00:00:00`).getDate()}
                        </span>
                        <span className="text-[9px] text-stone-300">
                          {new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(new Date(`${evt.date}T00:00:00`))}
                        </span>
                      </div>

                      {/* Details */}
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-stone-900 font-brand">
                            {evt.eventType}
                          </h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {evt.status}
                          </span>
                          {isSaya && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center">
                              <Sparkles className="w-2.5 h-2.5 mr-1 text-amber-600" /> Shubh Saya
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600 pt-1">
                          <span className="flex items-center space-x-1">
                            <Landmark className="w-3.5 h-3.5 text-stone-400" />
                            <span className="font-semibold text-stone-800">{evt.hallName}</span>
                            <span className="text-stone-400">({evt.hallCode})</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3.5 h-3.5 text-stone-400" />
                            <span>{evt.startTime} - {evt.endTime}</span>
                          </span>
                          {evt.guestCount && (
                            <span className="flex items-center space-x-1">
                              <User className="w-3.5 h-3.5 text-stone-400" />
                              <span>{evt.guestCount} Guests</span>
                            </span>
                          )}
                        </div>

                        {user?.role !== 'STAFF' && (
                          <div className="text-xs text-stone-500 pt-0.5 flex items-center space-x-3">
                            <span className="font-medium text-stone-800">
                              Host: {evt.customerName}
                            </span>
                            {evt.customerPhone && (
                              <span className="text-stone-400">📞 {evt.customerPhone}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right side actions / balance */}
                    <div className="flex items-center space-x-3 self-end md:self-center">
                      {hasRole(['OWNER', 'ACCOUNTANT']) && evt.balanceAmount && Number(evt.balanceAmount) > 0 && (
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-rose-500 uppercase block">Balance Due</span>
                          <span className="text-xs font-bold text-stone-800">
                            ₹{Number(evt.balanceAmount).toLocaleString('en-IN')}
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEventClick(e, evt);
                        }}
                        className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-xl transition-colors flex items-center space-x-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Details</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Authorized Booking Quick Details Modal */}
      {selectedBookingEvent && (
        <Modal
          isOpen={!!selectedBookingEvent}
          onClose={() => setSelectedBookingEvent(null)}
          title={selectedBookingEvent.eventType || 'Booking Details'}
          subtitle={`Booking Ref: ${selectedBookingEvent.bookingNumber || selectedBookingEvent.id}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs text-stone-700">
            {/* Header Banner */}
            <div className="p-4 rounded-2xl bg-[#14281D] text-[#F3E7C4] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#C5A059]">
                  Reserved Function
                </span>
                <h3 className="text-base font-bold font-brand text-[#F3E7C4] mt-0.5">
                  {selectedBookingEvent.eventType}
                </h3>
                <p className="text-xs text-stone-300">
                  Venue: {selectedBookingEvent.hallName} ({selectedBookingEvent.hallCode})
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#C5A059]/20 text-[#E2C07D] border border-[#C5A059]/40">
                {selectedBookingEvent.status}
              </span>
            </div>

            {/* Event Timing & Guests */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                <span className="text-[10px] text-stone-400 font-bold uppercase block">Function Date</span>
                <p className="font-bold text-xs text-stone-900 mt-0.5">
                  {new Intl.DateTimeFormat('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }).format(new Date(`${selectedBookingEvent.date}T00:00:00`))}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                <span className="text-[10px] text-stone-400 font-bold uppercase block">Slot Timings</span>
                <p className="font-bold text-xs text-stone-900 mt-0.5">
                  {selectedBookingEvent.startTime} - {selectedBookingEvent.endTime}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-stone-400 font-bold uppercase block">Expected Guests</span>
                <p className="font-bold text-xs text-stone-900 mt-0.5">
                  {selectedBookingEvent.guestCount || '—'} Persons
                </p>
              </div>
            </div>

            {/* Customer Details */}
            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
              <span className="text-[10px] text-stone-400 font-bold uppercase block">Customer / Host</span>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm text-stone-900">{selectedBookingEvent.customerName}</p>
                  {selectedBookingEvent.customerPhone && (
                    <p className="text-xs text-stone-500 mt-0.5">📞 {selectedBookingEvent.customerPhone}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Financial Summary (Only for Finance Roles) */}
            {hasRole(['OWNER', 'ACCOUNTANT']) && selectedBookingEvent.grandTotal && (
              <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="text-[10px] text-stone-400 font-bold uppercase block">Grand Total</span>
                  <p className="font-bold text-xs text-stone-900 mt-0.5">
                    ₹{Number(selectedBookingEvent.grandTotal).toLocaleString('en-IN')}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-600 font-bold uppercase block">Advance Paid</span>
                  <p className="font-bold text-xs text-emerald-700 mt-0.5">
                    ₹{Number(selectedBookingEvent.paidAmount || 0).toLocaleString('en-IN')}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-rose-500 font-bold uppercase block">Balance Due</span>
                  <p className="font-bold text-xs text-rose-600 mt-0.5">
                    ₹{Number(selectedBookingEvent.balanceAmount || 0).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-stone-200">
              {canCreateBooking && (
                <button
                  type="button"
                  onClick={() => {
                    const dateToBook = selectedBookingEvent.date;
                    setSelectedBookingEvent(null);
                    onOpenNewBookingWithDate(dateToBook);
                  }}
                  className="px-3.5 py-2 bg-[#C5A059]/15 hover:bg-[#C5A059]/25 text-[#14281D] text-xs font-bold rounded-xl transition-colors flex items-center space-x-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Book Another Slot on this Date</span>
                </button>
              )}

              <div className="flex items-center space-x-2 ml-auto">
                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBookingEvent(null);
                      onNavigateTab('bookings');
                    }}
                    className="px-3.5 py-2 bg-[#14281D] hover:bg-[#1a3325] text-[#F3E7C4] text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center space-x-1"
                  >
                    <span>View in Bookings</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedBookingEvent(null)}
                  className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 2: Staff Schedule Operational Details Modal (Zero Financials, Zero Phone) */}
      {selectedStaffEvent && (
        <Modal
          isOpen={!!selectedStaffEvent}
          onClose={() => setSelectedStaffEvent(null)}
          title={selectedStaffEvent.eventType || 'Event Schedule'}
          subtitle={`Venue: ${selectedStaffEvent.hallName}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs text-stone-700">
            <div className="p-4 rounded-2xl bg-[#14281D] text-[#F3E7C4] space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#C5A059]">
                Scheduled Function
              </span>
              <p className="text-base font-bold font-brand">{selectedStaffEvent.eventType}</p>
              <p className="text-xs text-stone-300">
                Venue: {selectedStaffEvent.hallName} ({selectedStaffEvent.hallCode})
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                <span className="text-[10px] text-stone-400 font-bold uppercase block">Date</span>
                <p className="font-bold text-sm text-stone-900 mt-0.5">{selectedStaffEvent.date}</p>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                <span className="text-[10px] text-stone-400 font-bold uppercase block">Timings</span>
                <p className="font-bold text-sm text-stone-900 mt-0.5">
                  {selectedStaffEvent.startTime} - {selectedStaffEvent.endTime}
                </p>
              </div>
            </div>
            {selectedStaffEvent.guestCount && (
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                <span className="text-[10px] text-stone-400 font-bold uppercase block">Expected Guests</span>
                <p className="font-bold text-sm text-stone-900 mt-0.5">
                  {selectedStaffEvent.guestCount} Persons
                </p>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedStaffEvent(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
