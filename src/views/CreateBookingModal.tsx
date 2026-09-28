import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../components/Modal.tsx';
import { Customer, Hall, Room } from '../types/index.ts';
import { apiRequest } from '../api/client.ts';
import { BookingSlip } from '../components/BookingSlip.tsx';
import { OfficialBillSlip } from '../components/OfficialBillSlip.tsx';
import { DualBillModal } from '../components/DualBillModal.tsx';
import { isFoodService, splitBookingIntoBills } from '../utils/gstClassifier.ts';
import { printElement } from '../utils/print.ts';
import {
  User,
  Calendar,
  Clock,
  Landmark,
  BedDouble,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Plus,
  Trash2,
  Phone,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Search,
  Check,
  Camera,
  UploadCloud,
  Eye,
  Printer,
  FileText,
  Receipt,
  Utensils,
  Layers,
} from 'lucide-react';

interface CreateBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: string;
  initialPackage?: 'STANDARD' | 'JEEVIKA';
}

interface ServiceItem {
  id: string;
  name: string;
  quantity: number;
  rate: number;
  amount: number;
}

export const CreateBookingModal: React.FC<CreateBookingModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialDate,
  initialPackage = 'STANDARD',
}) => {
  const [step, setStep] = useState<number>(1);
  const [activePackage, setActivePackage] = useState<'STANDARD' | 'JEEVIKA'>(initialPackage);
  const [foodDays, setFoodDays] = useState<number>(2);
  const [foodPersons, setFoodPersons] = useState<number>(35);
  const [foodPlateRate, setFoodPlateRate] = useState<number>(514.29);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Master Data
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [hallsList, setHallsList] = useState<Hall[]>([]);
  const [roomsList, setRoomsList] = useState<Room[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');

  // Step 1: Customer Selection
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [newCustName, setNewCustName] = useState('');
  const [newCustMobile, setNewCustMobile] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustCity, setNewCustCity] = useState('Ara');
  const [newCustIdProofType, setNewCustIdProofType] = useState('Aadhaar Card');
  const [newCustIdProofNumber, setNewCustIdProofNumber] = useState('');
  const [newCustIdProofImage, setNewCustIdProofImage] = useState<string | null>(null);
  const [mobileConflictWarning, setMobileConflictWarning] = useState<string | null>(null);

  // Step 2: Event Details (Asia/Kolkata Business Context)
  const [eventType, setEventType] = useState('Wedding');
  const [eventDate, setEventDate] = useState(
    initialDate || new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('23:00');
  const [guestCount, setGuestCount] = useState(250);

  // Step 3: Venue & Guest Rooms
  const [selectedHallId, setSelectedHallId] = useState<string>('');
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [availabilityChecking, setAvailabilityChecking] = useState(false);
  const [availabilityResult, setAvailabilityResult] = useState<{
    available: boolean;
    hallAvailable?: boolean;
    roomsAvailable?: boolean;
    message?: string;
    conflicts?: Array<{ type: string; message: string }>;
  } | null>(null);

  // Step 4: Services & Financials
  const [services, setServices] = useState<ServiceItem[]>([
    { id: '1', name: 'Standard Catering Buffet Package', quantity: 1, rate: 120000, amount: 120000 },
    { id: '2', name: 'Floral Stage & Mandap Decoration', quantity: 1, rate: 45000, amount: 45000 },
  ]);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceQty, setNewServiceQty] = useState('1');
  const [newServiceRate, setNewServiceRate] = useState('');
  const [discount, setDiscount] = useState<number>(0);
  const [waiveHallFee, setWaiveHallFee] = useState<boolean>(false);
  const [taxPercent, setTaxPercent] = useState<number>(5);
  const [taxMode, setTaxMode] = useState<'DUAL' | 'FLAT_5' | 'FLAT_18' | 'EXEMPT'>('DUAL');
  const [advancePayment, setAdvancePayment] = useState<number | ''>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER'>('UPI');
  const [notes, setNotes] = useState('');
  const [createdBookingResult, setCreatedBookingResult] = useState<any | null>(null);

  // Default room dates when eventDate changes
  useEffect(() => {
    if (eventDate) {
      setCheckInDate(eventDate);
      const nextDay = new Date(`${eventDate}T00:00:00Z`);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      setCheckOutDate(nextDay.toISOString().split('T')[0]);
    }
  }, [eventDate]);

  // Package Switcher Handler
  const applyPackage = (pkg: 'STANDARD' | 'JEEVIKA', list?: Customer[]) => {
    setActivePackage(pkg);
    const activeList = list || customersList;
    if (pkg === 'JEEVIKA') {
      const jCust = activeList.find((c) =>
        c.name.toLowerCase().includes('jeevika') ||
        c.name.toLowerCase().includes('जीविका') ||
        c.customerCode?.toLowerCase().includes('jeevika')
      );
      if (jCust) {
        setSelectedCustomerId(jCust.id);
        setIsNewCustomer(false);
      }
      setEventType('JEEViKA Training (जीविका प्रशिक्षण)');
      const totalPlates = foodDays * foodPersons;
      setGuestCount(totalPlates > 0 ? totalPlates : 70);
      setWaiveHallFee(true);
      setTaxMode('FLAT_5');
      setTaxPercent(5);
      setAdvancePayment(0);
      const foodTotal = Math.round((totalPlates > 0 ? totalPlates : 70) * foodPlateRate);
      setServices([
        {
          id: 'jeevika-food-pkg',
          name: `JEEViKA Staff Training Food & Catering (${foodDays} Days × ${foodPersons} Persons = ${totalPlates > 0 ? totalPlates : 70} Plates: Breakfast + Lunch + Dinner)`,
          quantity: totalPlates > 0 ? totalPlates : 70,
          rate: foodPlateRate,
          amount: foodTotal,
        },
      ]);
      setNotes('Hall allocated complimentary (₹0) for JEEViKA Training program. Billed exclusively for staff training food & catering with 5% GST.');
    } else {
      setEventType('Wedding');
      setWaiveHallFee(false);
      setTaxMode('DUAL');
      setTaxPercent(18);
      setAdvancePayment(0);
      setServices([
        { id: '1', name: 'Standard Catering Buffet Package', quantity: 1, rate: 120000, amount: 120000 },
        { id: '2', name: 'Floral Stage & Mandap Decoration', quantity: 1, rate: 45000, amount: 45000 },
      ]);
      setNotes('');
    }
  };

  const applyFoodCateringCharges = () => {
    const totalPlates = foodDays * foodPersons;
    const foodTotal = Math.round(totalPlates * foodPlateRate);
    setServices((prev) => {
      const filtered = prev.filter((s) => !s.id.includes('jeevika-food'));
      return [
        ...filtered,
        {
          id: `jeevika-food-${Date.now()}`,
          name: `JEEViKA Staff Training Food & Catering (${foodDays} Days × ${foodPersons} Persons = ${totalPlates} Plates: Breakfast + Lunch + Dinner)`,
          quantity: totalPlates,
          rate: foodPlateRate,
          amount: foodTotal,
        },
      ];
    });
    setGuestCount(totalPlates);
  };

  // Sync eventDate whenever modal opens with initialDate
  useEffect(() => {
    if (isOpen) {
      setActivePackage(initialPackage || 'STANDARD');
      if (initialDate) {
        setEventDate(initialDate);
        setCheckInDate(initialDate);
        const nextDay = new Date(`${initialDate}T00:00:00Z`);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        setCheckOutDate(nextDay.toISOString().split('T')[0]);
      }
      setStep(1);
      setError(null);
    }
  }, [isOpen, initialDate, initialPackage]);

  // Load masters when modal opens
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setError(null);
      return;
    }
    const loadMasters = async () => {
      const [cRes, hRes, rRes] = await Promise.all([
        apiRequest<Customer[]>('/customers'),
        apiRequest<Hall[]>('/halls'),
        apiRequest<Room[]>('/rooms'),
      ]);
      if (cRes.success && cRes.data) {
        setCustomersList(cRes.data);
        if (initialPackage === 'JEEVIKA') {
          applyPackage('JEEVIKA', cRes.data);
        } else if (cRes.data.length > 0 && !selectedCustomerId) {
          setSelectedCustomerId(cRes.data[0].id);
        }
      }
      if (hRes.success && hRes.data) {
        setHallsList(hRes.data);
        if (hRes.data.length > 0 && !selectedHallId) {
          const activeHalls = hRes.data.filter((h) => h.status === 'ACTIVE');
          if (activeHalls.length > 0) setSelectedHallId(activeHalls[0].id);
        }
      }
      if (rRes.success && rRes.data) {
        setRoomsList(rRes.data);
      }
    };
    loadMasters();
  }, [isOpen]);

  // Check mobile duplicates in real-time
  useEffect(() => {
    if (!isNewCustomer || newCustMobile.trim().length !== 10) {
      setMobileConflictWarning(null);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await apiRequest(`/customers/check-mobile/${newCustMobile.trim()}`);
      if (res.exists) {
        setMobileConflictWarning(`A customer already exists with mobile ${newCustMobile}: "${res.customer.name}". Switch to "Existing Customer" to select them.`);
      } else {
        setMobileConflictWarning(null);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [newCustMobile, isNewCustomer]);

  // Real-time backend availability check for Hall & Rooms
  useEffect(() => {
    if (!selectedHallId || !eventDate || !startTime || !endTime || startTime >= endTime) return;

    const checkAvailability = async () => {
      setAvailabilityChecking(true);
      const res = await apiRequest('/bookings/check-availability', {
        method: 'POST',
        body: JSON.stringify({
          hallId: selectedHallId,
          eventDate,
          startTime,
          endTime,
          roomIds: selectedRoomIds,
          checkInDate: checkInDate || eventDate,
          checkOutDate: checkOutDate || eventDate,
        }),
      });
      setAvailabilityChecking(false);
      if (res.available) {
        setAvailabilityResult({
          available: true,
          message: 'Venue and selected rooms are free and ready for reservation!',
        });
      } else {
        setAvailabilityResult({
          available: false,
          conflicts: res.conflicts,
          message: res.message || 'Scheduling conflict detected for the chosen venue or rooms.',
        });
      }
    };
    checkAvailability();
  }, [selectedHallId, selectedRoomIds, eventDate, startTime, endTime, checkInDate, checkOutDate]);

  // Calculations for Step 4
  const selectedHall = hallsList.find((h) => h.id === selectedHallId);
  const hallCost = waiveHallFee ? 0 : (selectedHall ? Number(selectedHall.basePrice) : 0);

  const roomNights = useMemo(() => {
    if (!checkInDate || !checkOutDate) return 1;
    const d1 = new Date(`${checkInDate}T00:00:00Z`).getTime();
    const d2 = new Date(`${checkOutDate}T00:00:00Z`).getTime();
    const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays);
  }, [checkInDate, checkOutDate]);

  const roomCost = useMemo(() => {
    return roomsList
      .filter((r) => selectedRoomIds.includes(r.id))
      .reduce((sum, r) => sum + Number(r.pricePerNight) * roomNights, 0);
  }, [roomsList, selectedRoomIds, roomNights]);

  const servicesCost = useMemo(() => {
    return services.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  }, [services]);

  // Categorize services into Food vs Banquet/Rooms
  const foodSubtotal = useMemo(() => {
    return services
      .filter((s) => isFoodService(s.name))
      .reduce((sum, s) => sum + Number(s.amount || 0), 0);
  }, [services]);

  const banquetSubtotal = useMemo(() => {
    const nonFoodServices = services
      .filter((s) => !isFoodService(s.name))
      .reduce((sum, s) => sum + Number(s.amount || 0), 0);
    return hallCost + roomCost + nonFoodServices;
  }, [hallCost, roomCost, services]);

  const subtotal = foodSubtotal + banquetSubtotal;
  const rawDiscount = Math.min(subtotal, Math.max(0, Number(discount) || 0));

  // Proportional discount distribution
  const foodDiscount = subtotal > 0 ? Math.round((foodSubtotal / subtotal) * rawDiscount) : 0;
  const banquetDiscount = Math.max(0, rawDiscount - foodDiscount);

  const foodTaxable = Math.max(0, foodSubtotal - foodDiscount);
  const banquetTaxable = Math.max(0, banquetSubtotal - banquetDiscount);
  const totalTaxable = foodTaxable + banquetTaxable;

  // Tax rates
  const foodTaxRate = taxMode === 'DUAL' || taxMode === 'FLAT_5' ? 5 : (taxMode === 'EXEMPT' ? 0 : 18);
  const banquetTaxRate = taxMode === 'DUAL' || taxMode === 'FLAT_18' ? 18 : (taxMode === 'EXEMPT' ? 0 : 5);

  const foodTaxAmount = Math.round((foodTaxable * foodTaxRate) / 100);
  const banquetTaxAmount = Math.round((banquetTaxable * banquetTaxRate) / 100);
  const totalTaxAmount = foodTaxAmount + banquetTaxAmount;

  const grandTotal = totalTaxable + totalTaxAmount;
  const balanceDue = Math.max(0, grandTotal - (Number(advancePayment) || 0));

  // Effective tax percent for backend storage
  const effectiveTaxPercent = totalTaxable > 0
    ? Number(((totalTaxAmount / totalTaxable) * 100).toFixed(2))
    : (taxMode === 'FLAT_5' ? 5 : (taxMode === 'FLAT_18' ? 18 : (taxMode === 'EXEMPT' ? 0 : 18)));

  const handleAddService = () => {
    if (!newServiceName.trim() || !newServiceRate) return;
    const qty = Math.max(1, Number(newServiceQty) || 1);
    const rate = Math.max(0, Number(newServiceRate) || 0);
    const amount = qty * rate;

    setServices([
      ...services,
      {
        id: `s-${Date.now()}`,
        name: newServiceName.trim(),
        quantity: qty,
        rate,
        amount,
      },
    ]);
    setNewServiceName('');
    setNewServiceQty('1');
    setNewServiceRate('');
  };

  const handleRemoveService = (id: string) => {
    setServices(services.filter((s) => s.id !== id));
  };

  const toggleRoom = (roomId: string) => {
    if (selectedRoomIds.includes(roomId)) {
      setSelectedRoomIds(selectedRoomIds.filter((id) => id !== roomId));
    } else {
      setSelectedRoomIds([...selectedRoomIds, roomId]);
    }
  };

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customersList;
    const q = customerSearch.toLowerCase();
    return customersList.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.mobile.includes(q) ||
        (c.city && c.city.toLowerCase().includes(q))
    );
  }, [customersList, customerSearch]);

  const validateStep = (currentStep: number): boolean => {
    setError(null);
    if (currentStep === 1) {
      if (isNewCustomer) {
        if (!newCustName.trim()) {
          setError('Customer full name is required.');
          return false;
        }
        if (!/^[6-9]\d{9}$/.test(newCustMobile.trim())) {
          setError('Please provide a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
          return false;
        }
        if (mobileConflictWarning) {
          setError('A customer with this mobile number already exists. Please choose them from existing customers.');
          return false;
        }
      } else {
        if (!selectedCustomerId) {
          setError('Please select an existing customer.');
          return false;
        }
      }
    } else if (currentStep === 2) {
      if (!eventType.trim()) {
        setError('Event type is required.');
        return false;
      }
      if (!eventDate) {
        setError('Valid event date is required.');
        return false;
      }
      if (startTime >= endTime) {
        setError('Start time must be strictly before End time.');
        return false;
      }
      if (guestCount <= 0) {
        setError('Guest count must be greater than zero.');
        return false;
      }
    } else if (currentStep === 3) {
      if (!selectedHallId) {
        setError('Please select a hall or banquet venue.');
        return false;
      }
      if (selectedRoomIds.length > 0) {
        if (!checkInDate || !checkOutDate) {
          setError('Please select room check-in and check-out dates.');
          return false;
        }
        if (checkOutDate <= checkInDate) {
          setError('Room check-out date must be strictly after check-in date.');
          return false;
        }
      }
      if (availabilityResult && !availabilityResult.available) {
        setError('The selected hall or rooms have scheduling conflicts. Please choose an available slot.');
        return false;
      }
    } else if (currentStep === 4) {
      if (discount > subtotal) {
        setError(`Discount (₹${discount}) cannot exceed subtotal (₹${subtotal}).`);
        return false;
      }
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const handleSubmitBooking = async () => {
    if (!validateStep(4)) return;

    setError(null);
    setLoading(true);

    let customerIdToUse = selectedCustomerId;

    // If new customer, create first
    if (isNewCustomer) {
      const cRes = await apiRequest<Customer>('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: newCustName.trim(),
          mobile: newCustMobile.trim(),
          email: newCustEmail.trim() || undefined,
          address: newCustAddress.trim() || undefined,
          city: newCustCity.trim() || 'Ara',
          idProofType: newCustIdProofType || undefined,
          idProofNumber: newCustIdProofNumber.trim() || undefined,
          idProofImage: newCustIdProofImage || undefined,
        }),
      });
      if (!cRes.success || !cRes.data) {
        setError(cRes.error?.message || 'Failed to create customer record');
        setLoading(false);
        return;
      }
      customerIdToUse = cRes.data.id;
    }

    // Submit booking to backend engine
    const bookingRes = await apiRequest('/bookings', {
      method: 'POST',
      body: JSON.stringify({
        customerId: customerIdToUse,
        eventType,
        eventDate,
        startTime,
        endTime,
        guestCount,
        hallId: selectedHallId,
        waiveHallFee,
        taxPercent: effectiveTaxPercent,
        roomIds: selectedRoomIds,
        checkInDate: selectedRoomIds.length > 0 ? checkInDate : undefined,
        checkOutDate: selectedRoomIds.length > 0 ? checkOutDate : undefined,
        services: services.map((s) => ({
          name: s.name,
          quantity: s.quantity,
          rate: s.rate,
          amount: s.amount,
          category: isFoodService(s.name) ? 'FOOD' : 'BANQUET',
          taxPercent: isFoodService(s.name) ? foodTaxRate : banquetTaxRate,
        })),
        discount: rawDiscount,
        advancePayment: Number(advancePayment) || 0,
        paymentMethod,
        notes,
      }),
    });

    setLoading(false);

    if (bookingRes.success && bookingRes.data) {
      setCreatedBookingResult(bookingRes.data);
    } else if (bookingRes.success) {
      onSuccess();
      onClose();
    } else {
      setError(bookingRes.error?.message || 'Failed to confirm booking.');
    }
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCreatedBookingResult(null);
      setStep(1);
    }
  }, [isOpen]);

  if (createdBookingResult) {
    const bkg = (createdBookingResult as any).booking || createdBookingResult;
    const cust =
      (createdBookingResult as any).customer ||
      bkg.customer ||
      customersList.find((c) => c.id === bkg.customerId) ||
      (isNewCustomer ? { name: newCustName, mobile: newCustMobile, address: newCustAddress } : null);
    const hall = (createdBookingResult as any).hall || bkg.hall || selectedHall;
    const fullBooking = {
      ...bkg,
      customer: cust,
      hall,
      services: bkg.services || services,
      hallRentalPrice: waiveHallFee ? 0 : (selectedHall?.basePrice || 0),
    };
    const bkgAdvance = Number(bkg.paidAmount !== undefined ? bkg.paidAmount : (Number(advancePayment) || 0));
    const bkgBalance = Number(bkg.balanceAmount !== undefined ? bkg.balanceAmount : balanceDue);

    // Compute statutory dual bills for the confirmed booking
    const splitBills = splitBookingIntoBills(fullBooking, {
      customFoodTax: foodTaxRate,
      customBanquetTax: banquetTaxRate,
    });

    const bookingNo = bkg.bookingNumber || 'BV-BKG-XXXX';
    const cleanNo = bookingNo.replace('BV-BKG-', 'BKG-');
    const foodBillNo = `FD-${cleanNo}`;
    const banquetBillNo = `BQ-${cleanNo}`;
    const billDate = new Date().toLocaleDateString('en-GB');

    return (
      <Modal
        isOpen={isOpen}
        onClose={() => {
          setCreatedBookingResult(null);
          onSuccess();
          onClose();
        }}
        title="सट्टा व बिल तैयार (Booking & Dual Bills Ready)"
        subtitle={`Booking #${bkg.bookingNumber || 'BV-BKG'}`}
        maxWidth="4xl"
      >
        <div className="space-y-5 text-center py-2">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto text-2xl shadow-xs">
            ✓
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-bold font-brand text-[#14281D]">
              सट्टा व बिल सफलतापूर्वक दर्ज हो गए!
            </h3>
            <p className="text-xs text-stone-600">
              Booking <span className="font-mono font-bold text-stone-900">#{bkg.bookingNumber}</span> has been confirmed. Indian GST ke anuroop Food Bill (5%) aur Banquet Bill (18%) alag-alag taiyar hain:
            </p>
          </div>

          {/* Quick Summary Card */}
          <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 text-left text-xs grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <span className="text-[10px] text-stone-400 font-bold uppercase block">ग्राहक (Customer)</span>
              <strong className="text-stone-900 truncate block">{cust?.name || '—'}</strong>
              <div className="text-[10px] text-stone-500 font-mono">{cust?.mobile}</div>
            </div>
            <div>
              <span className="text-[10px] text-stone-400 font-bold uppercase block">उत्सव दिनांक (Date)</span>
              <strong className="text-[#14281D]">{bkg.eventDate}</strong>
              <div className="text-[10px] text-stone-500 truncate">{bkg.eventType}</div>
            </div>
            <div>
              <span className="text-[10px] text-stone-400 font-bold uppercase block">कुल तय रकम (Total)</span>
              <strong className="text-stone-900">₹{splitBills.combined.totalGrandTotal.toLocaleString('en-IN')}</strong>
              <div className="text-[10px] text-stone-500">
                Food: ₹{splitBills.food.grandTotal.toLocaleString('en-IN')} | Hall: ₹{splitBills.banquet.grandTotal.toLocaleString('en-IN')}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-stone-400 font-bold uppercase block">अग्रीम जमा (Advance)</span>
              <strong className="text-emerald-700 font-bold">₹{splitBills.combined.totalPaid.toLocaleString('en-IN')}</strong>
              <div className="text-[10px] text-rose-600 font-semibold">
                बाकी: ₹{splitBills.combined.totalBalance.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Distinct Documents Selection Cards */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#FAF8F5] via-white to-[#FAF8F5] border-2 border-[#E3DACB] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                दस्तावेज़ प्रिंट करें (Print Separate Documents)
              </span>
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                भोजन (5% GST) व हॉल (18% GST) अलग-अलग
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* Card 1: Satta Booking Slip */}
              <button
                type="button"
                onClick={() => {
                  printElement('bandhan-new-booking-slip', `Booking_Slip_${bkg.bookingNumber}`);
                }}
                className="p-3.5 rounded-xl border-2 border-[#14281D] bg-[#14281D] hover:bg-[#1f3c2b] text-[#F3E7C4] text-left transition-all shadow-md cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-lg">📜</span>
                    <span className="font-bold text-xs uppercase tracking-wide text-[#E2C07D]">
                      1. सट्टा पर्ची (Booking Slip)
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-300 leading-snug">
                    सट्टा अनुबंध, कुल रकम, अग्रीम जमा, बाकी राशी, 7 नियम एवं सट्टेदार/प्रबंधक हस्ताक्षर।
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-white/20 flex items-center justify-between text-[11px] font-bold text-[#E2C07D]">
                  <span>🖨️ प्रिंट सट्टा पर्ची</span>
                  <span>A4 Slip →</span>
                </div>
              </button>

              {/* Card 2: Food Bill */}
              <button
                type="button"
                onClick={() => {
                  printElement('bandhan-new-food-bill', `Food_Bill_${foodBillNo}`);
                }}
                className="p-3.5 rounded-xl border-2 border-amber-500 bg-white hover:bg-amber-50/50 text-amber-950 text-left transition-all shadow-xs cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-lg">🍽️</span>
                    <span className="font-bold text-xs uppercase tracking-wide text-amber-800">
                      2. भोजन बिल (Food Bill @ 5%)
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 leading-snug">
                    खाद्य व केटरिंग बुफे, SAC 9963, 2.5% CGST + 2.5% SGST, Visit Again मुहर।
                  </p>
                  <div className="mt-1 text-[11px] font-mono font-bold text-amber-900">
                    Total: ₹{splitBills.food.grandTotal.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-amber-200 flex items-center justify-between text-[11px] font-bold text-amber-800">
                  <span>🖨️ प्रिंट भोजन बिल</span>
                  <span>Red Bill →</span>
                </div>
              </button>

              {/* Card 3: Banquet & Rooms Bill */}
              <button
                type="button"
                onClick={() => {
                  printElement('bandhan-new-banquet-bill', `Banquet_Bill_${banquetBillNo}`);
                }}
                className="p-3.5 rounded-xl border-2 border-[#B91C1C] bg-white hover:bg-rose-50/50 text-[#B91C1C] text-left transition-all shadow-xs cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-lg">🏛️</span>
                    <span className="font-bold text-xs uppercase tracking-wide text-[#B91C1C]">
                      3. हॉल व रूम बिल (18% GST)
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 leading-snug">
                    मैरेज हॉल, लॉन, AC रूम्स व सजावट, SAC 9972, 9% CGST + 9% SGST।
                  </p>
                  <div className="mt-1 text-[11px] font-mono font-bold text-[#B91C1C]">
                    Total: ₹{splitBills.banquet.grandTotal.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-rose-200 flex items-center justify-between text-[11px] font-bold text-[#B91C1C]">
                  <span>🖨️ प्रिंट हॉल बिल</span>
                  <span>Red Bill →</span>
                </div>
              </button>
            </div>

            {/* Print Both Bills option */}
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  printElement('bandhan-new-both-bills', `Dual_Bills_${cleanNo}`);
                }}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center space-x-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>📑 Print Both Bills in Sequence (दोनों बिल एक साथ प्रिंट करें)</span>
              </button>
            </div>
          </div>

          {/* Close button */}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => {
                setCreatedBookingResult(null);
                onSuccess();
                onClose();
              }}
              className="px-6 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition-all cursor-pointer"
            >
              सम्पन्न (Done &amp; View All Bookings)
            </button>
          </div>

          {/* Offscreen print targets */}
          <div style={{ position: 'fixed', left: '-9999px', top: '-9999px', width: '210mm', opacity: 0, pointerEvents: 'none' }}>
            {/* Target 1: Satta Booking Slip */}
            <div id="bandhan-new-booking-slip">
              <BookingSlip
                booking={fullBooking}
                customer={cust}
                advancePayment={splitBills.combined.totalPaid}
                paymentMethod={paymentMethod}
              />
            </div>

            {/* Target 2: Food Bill (5% GST) */}
            <div id="bandhan-new-food-bill">
              <OfficialBillSlip
                billNumber={foodBillNo}
                date={billDate}
                billType="FOOD BILL"
                customerName={cust?.name || ''}
                customerAddress={cust?.address || 'Pakariyabar, Chandwa, Ara'}
                customerMobile={cust?.mobile || ''}
                customerGstin={(cust as any)?.gstin || ''}
                items={splitBills.food.items}
                subtotal={splitBills.food.subtotal}
                discount={splitBills.food.discount}
                taxPercent={splitBills.food.taxPercent}
                cgstAmount={splitBills.food.cgstAmount}
                sgstAmount={splitBills.food.sgstAmount}
                grandTotal={splitBills.food.grandTotal}
                paidAmount={splitBills.food.allocatedPaid}
                balanceAmount={splitBills.food.allocatedBalance}
                showTerms={false}
              />
            </div>

            {/* Target 3: Banquet & Rooms Bill (18% GST) */}
            <div id="bandhan-new-banquet-bill">
              <OfficialBillSlip
                billNumber={banquetBillNo}
                date={billDate}
                billType="HOTEL & BANQUET BILL"
                customerName={cust?.name || ''}
                customerAddress={cust?.address || 'Pakariyabar, Chandwa, Ara'}
                customerMobile={cust?.mobile || ''}
                customerGstin={(cust as any)?.gstin || ''}
                items={splitBills.banquet.items}
                subtotal={splitBills.banquet.subtotal}
                discount={splitBills.banquet.discount}
                taxPercent={splitBills.banquet.taxPercent}
                cgstAmount={splitBills.banquet.cgstAmount}
                sgstAmount={splitBills.banquet.sgstAmount}
                grandTotal={splitBills.banquet.grandTotal}
                paidAmount={splitBills.banquet.allocatedPaid}
                balanceAmount={splitBills.banquet.allocatedBalance}
                showTerms={false}
              />
            </div>

            {/* Target 4: Both Bills Sequentially (Page 1: Food, Page 2: Banquet) */}
            <div id="bandhan-new-both-bills">
              <div>
                <OfficialBillSlip
                  billNumber={foodBillNo}
                  date={billDate}
                  billType="FOOD BILL"
                  customerName={cust?.name || ''}
                  customerAddress={cust?.address || 'Pakariyabar, Chandwa, Ara'}
                  customerMobile={cust?.mobile || ''}
                  customerGstin={(cust as any)?.gstin || ''}
                  items={splitBills.food.items}
                  subtotal={splitBills.food.subtotal}
                  discount={splitBills.food.discount}
                  taxPercent={splitBills.food.taxPercent}
                  cgstAmount={splitBills.food.cgstAmount}
                  sgstAmount={splitBills.food.sgstAmount}
                  grandTotal={splitBills.food.grandTotal}
                  paidAmount={splitBills.food.allocatedPaid}
                  balanceAmount={splitBills.food.allocatedBalance}
                  showTerms={false}
                />
              </div>

              <div className="page-break-between" />

              <div>
                <OfficialBillSlip
                  billNumber={banquetBillNo}
                  date={billDate}
                  billType="HOTEL & BANQUET BILL"
                  customerName={cust?.name || ''}
                  customerAddress={cust?.address || 'Pakariyabar, Chandwa, Ara'}
                  customerMobile={cust?.mobile || ''}
                  customerGstin={(cust as any)?.gstin || ''}
                  items={splitBills.banquet.items}
                  subtotal={splitBills.banquet.subtotal}
                  discount={splitBills.banquet.discount}
                  taxPercent={splitBills.banquet.taxPercent}
                  cgstAmount={splitBills.banquet.cgstAmount}
                  sgstAmount={splitBills.banquet.sgstAmount}
                  grandTotal={splitBills.banquet.grandTotal}
                  paidAmount={splitBills.banquet.allocatedPaid}
                  balanceAmount={splitBills.banquet.allocatedBalance}
                  showTerms={false}
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Booking"
      subtitle="Bandhan Vatika 4-Step Reservation Engine"
      maxWidth="4xl"
    >
      {/* Step Progress Bar */}
      <div className="mb-4">
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 text-center text-xs font-semibold">
          {[
            { num: 1, label: 'Customer' },
            { num: 2, label: 'Event Details' },
            { num: 3, label: 'Venues & Rooms' },
            { num: 4, label: 'Pricing & Review' },
          ].map((s) => (
            <div
              key={s.num}
              className={`p-1.5 sm:p-2.5 rounded-xl border transition-all ${
                step === s.num
                  ? 'bg-[#14281D] text-[#F3E7C4] border-[#14281D] shadow-sm'
                  : step > s.num
                  ? 'bg-[#C5A059]/15 text-[#14281D] border-[#C5A059]/40'
                  : 'bg-stone-50 text-stone-400 border-stone-200'
              }`}
            >
              <div className="text-[9px] sm:text-[10px] tracking-widest uppercase">Step {s.num}</div>
              <div className="truncate font-bold text-[10px] sm:text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Package Quick Selector - only display if JEEViKA was explicitly requested or selected */}
      {(initialPackage === 'JEEVIKA' || activePackage === 'JEEVIKA' || eventType.toLowerCase().includes('jeevika')) && (
        <div className="mb-4 p-3 bg-gradient-to-r from-[#FAF8F5] via-white to-[#FAF8F5] border border-[#E3DACB] rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-stone-800 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>Select Booking Package (पैकेज चुनें)</span>
            </div>
            <span className="text-[10px] text-stone-400 font-medium">1-Click Auto Configuration</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Standard Wedding Package */}
            <button
              type="button"
              onClick={() => applyPackage('STANDARD')}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                activePackage === 'STANDARD'
                  ? 'border-[#14281D] bg-[#14281D]/5 shadow-xs'
                  : 'border-stone-200 hover:border-stone-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-[#14281D]">👑 Wedding &amp; Celebration Package</span>
                {activePackage === 'STANDARD' && (
                  <span className="text-[10px] font-bold text-[#14281D] bg-white px-2 py-0.5 rounded-full border border-stone-200">Active</span>
                )}
              </div>
              <p className="text-[11px] text-stone-500 mt-0.5">
                Banquet Hall + AC Rooms + Buffet Catering + Stage Decor (18% GST)
              </p>
            </button>

            {/* JEEViKA Training & Catering Package */}
            <button
              type="button"
              onClick={() => applyPackage('JEEVIKA')}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                activePackage === 'JEEVIKA'
                  ? 'border-[#B91C1C] bg-red-50/80 shadow-xs'
                  : 'border-red-200/60 hover:border-red-300 bg-red-50/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-[#B91C1C]">🌾 JEEViKA Training &amp; Catering Package</span>
                {activePackage === 'JEEVIKA' ? (
                  <span className="text-[10px] font-bold text-white bg-[#B91C1C] px-2 py-0.5 rounded-full">Active</span>
                ) : (
                  <span className="text-[10px] font-bold text-[#B91C1C] bg-red-100 px-1.5 py-0.5 rounded">₹0 Hall + 5% GST</span>
                )}
              </div>
              <p className="text-[11px] text-red-900/80 mt-0.5">
                जीविका प्रशिक्षण: हॉल शुल्क ₹0 (मानार्थ) + भोजन कॉम्बो (नाश्ता + लंच + डिनर) + 5% GST
              </p>
            </button>
          </div>
        </div>
      )}

      {/* Selected Function Date Indicator */}
      {eventDate && (
        <div className="mb-4 px-3.5 py-2 rounded-xl bg-[#C5A059]/10 border border-[#C5A059]/30 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2 text-xs text-[#14281D]">
            <Calendar className="w-4 h-4 text-[#C5A059] shrink-0" />
            <span className="font-semibold">Selected Function Date:</span>
            <span className="font-bold bg-white px-2.5 py-0.5 rounded-lg border border-[#C5A059]/30 text-[#14281D] shadow-2xs">
              {new Intl.DateTimeFormat('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }).format(new Date(`${eventDate}T00:00:00`))}
            </span>
          </div>
          <span className="text-[10px] text-stone-500 font-medium">
            (You can adjust date or time slot anytime in Step 2)
          </span>
        </div>
      )}

      {error && (
        <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: CUSTOMER */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-100 border border-stone-200">
            <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">Customer Type</span>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setIsNewCustomer(false)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  !isNewCustomer ? 'bg-[#14281D] text-[#F3E7C4] shadow-xs' : 'bg-white text-stone-600 border border-stone-200'
                }`}
              >
                Existing Customer
              </button>
              <button
                type="button"
                onClick={() => setIsNewCustomer(true)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isNewCustomer ? 'bg-[#14281D] text-[#F3E7C4] shadow-xs' : 'bg-white text-stone-600 border border-stone-200'
                }`}
              >
                + New Customer
              </button>
            </div>
          </div>

          {!isNewCustomer ? (
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search customer by name, mobile, or city..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
                />
              </div>

              <div className="max-h-56 overflow-y-auto space-y-1.5 p-1 border border-stone-200 rounded-2xl bg-white">
                {filteredCustomers.length === 0 ? (
                  <div className="py-8 text-center text-xs text-stone-400">No customers found. Switch to "+ New Customer".</div>
                ) : (
                  filteredCustomers.map((c) => {
                    const isSelected = selectedCustomerId === c.id;
                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCustomerId(c.id)}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#C5A059] bg-[#C5A059]/10 shadow-xs'
                            : 'border-stone-100 hover:bg-stone-50'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-xs text-stone-900">{c.name}</div>
                          <div className="text-[11px] text-stone-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span>{c.mobile} · {c.city || 'Ara'}</span>
                            {c.idProofType && c.idProofNumber ? (
                              <span className="inline-flex items-center space-x-1 text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-emerald-200/60">
                                <span>✓ {c.idProofType}: {c.idProofNumber}</span>
                                {c.idProofImage && <span className="text-[9px] bg-emerald-200/70 px-1 rounded text-emerald-900 font-bold">Photo Attached</span>}
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] font-medium border border-amber-200/60">
                                ID Pending
                              </span>
                            )}
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-[#C5A059]" />}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Chandra Verma"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Mobile Number (10 digits) *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    value={newCustMobile}
                    onChange={(e) => setNewCustMobile(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
                  />
                </div>
                {mobileConflictWarning && (
                  <p className="text-[11px] text-amber-600 mt-1 font-medium">{mobileConflictWarning}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="ramesh@example.com"
                  value={newCustEmail}
                  onChange={(e) => setNewCustEmail(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  City
                </label>
                <input
                  type="text"
                  placeholder="Ara"
                  value={newCustCity}
                  onChange={(e) => setNewCustCity(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Address
                </label>
                <input
                  type="text"
                  placeholder="Ara-Buxar Road, Ara"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Govt ID Proof Type
                </label>
                <select
                  value={newCustIdProofType}
                  onChange={(e) => setNewCustIdProofType(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold focus:border-[#C5A059] outline-none"
                >
                  <option value="Aadhaar Card">Aadhaar Card (UIDAI)</option>
                  <option value="PAN Card">PAN Card</option>
                  <option value="Voter ID">Voter ID (Election Card)</option>
                  <option value="Driving License">Driving License</option>
                  <option value="Passport">Passport</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Govt ID Number (e.g. 12-digit Aadhaar)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1234 5678 9012"
                  value={newCustIdProofNumber}
                  onChange={(e) => setNewCustIdProofNumber(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
                />
              </div>

              {/* ID Proof Photo Upload */}
              <div className="sm:col-span-2 p-3 bg-stone-50 rounded-xl border border-stone-200">
                <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
                  <Camera className="w-4 h-4 text-[#C5A059]" />
                  <span>Attach ID Card Photo (आधार / पैन / वोटर कार्ड की फ़ोटो)</span>
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
                              const maxDim = 900;
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
                              setNewCustIdProofImage(canvas.toDataURL('image/jpeg', 0.72));
                            };
                            img.src = ev.target?.result as string;
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>

                  {newCustIdProofImage ? (
                    <div className="flex items-center space-x-2.5">
                      <img
                        src={newCustIdProofImage}
                        alt="ID Preview"
                        className="w-14 h-10 object-cover rounded-lg border-2 border-emerald-500 shadow-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setNewCustIdProofImage(null)}
                        className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center space-x-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-stone-400 italic">No ID photo selected</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: EVENT DETAILS */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Event Type *
              </label>
              <select
                value={eventType}
                onChange={(e) => {
                  const val = e.target.value;
                  setEventType(val);
                  if (val.toLowerCase().includes('jeevika')) {
                    setWaiveHallFee(true);
                    setTaxPercent(5);
                    setAdvancePayment(0);
                  }
                }}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold focus:border-[#C5A059] outline-none"
              >
                <option value="Wedding">Wedding (Vivah Sanskar)</option>
                <option value="Reception">Reception Ceremony</option>
                <option value="Engagement">Engagement (Sagai / Ring Ceremony)</option>
                <option value="Sangeet">Sangeet / Mehendi Night</option>
                <option value="Birthday">Birthday Celebration</option>
                <option value="Anniversary">Anniversary</option>
                <option value="Corporate">Corporate Conference / Seminar</option>
                <option value="JEEViKA Training">JEEViKA Training / Workshop (जीविका - Free Hall, 5% Food GST)</option>
                <option value="Other">Other Private Function</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Event Date (Asia/Kolkata) *
              </label>
              <input
                type="date"
                required
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold focus:border-[#C5A059] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Start Time *
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold focus:border-[#C5A059] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                End Time *
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold focus:border-[#C5A059] outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Expected Guest Count *
              </label>
              <input
                type="number"
                min="1"
                max="3000"
                value={guestCount}
                onChange={(e) => setGuestCount(Number(e.target.value))}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold focus:border-[#C5A059] outline-none"
              />
              {selectedHall && guestCount > selectedHall.capacity && (
                <p className="text-[11px] text-amber-600 mt-1 font-medium">
                  Warning: Guest count ({guestCount}) exceeds {selectedHall.name} capacity ({selectedHall.capacity}).
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: VENUES & ROOMS */}
      {step === 3 && (
        <div className="space-y-5">
          {/* Hall Selection */}
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
              Select Primary Banquet / Lawn *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {hallsList.map((h) => {
                const isSelected = selectedHallId === h.id;
                const isInactive = h.status !== 'ACTIVE';
                return (
                  <div
                    key={h.id}
                    onClick={() => !isInactive && setSelectedHallId(h.id)}
                    className={`p-3.5 rounded-2xl border-2 transition-all ${
                      isInactive
                        ? 'opacity-50 cursor-not-allowed bg-stone-100 border-stone-200'
                        : isSelected
                        ? 'border-[#C5A059] bg-[#C5A059]/10 shadow-xs cursor-pointer'
                        : 'border-stone-200 hover:border-stone-300 bg-white cursor-pointer'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <h4 className="font-bold text-xs text-[#14281D]">{h.name}</h4>
                          {isInactive && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 uppercase">
                              {h.status}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          {h.type} · Capacity: {h.capacity}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-[#14281D] bg-[#14281D]/5 px-2 py-1 rounded-md">
                        ₹{Number(h.basePrice).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rooms Check-in / Check-out Dates */}
          <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Guest Rooms Schedule ({roomNights} Night{roomNights > 1 ? 's' : ''})
              </span>
              <span className="text-[11px] text-stone-500">
                Half-open interval [Check-in, Check-out)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">Check-in Date</label>
                <input
                  type="date"
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  className="w-full p-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">Check-out Date</label>
                <input
                  type="date"
                  value={checkOutDate}
                  onChange={(e) => setCheckOutDate(e.target.value)}
                  className="w-full p-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold outline-none"
                />
              </div>
            </div>
          </div>

          {/* Rooms Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Select Guest Rooms (Optional Add-on)
              </label>
              <span className="text-[11px] text-stone-500">
                {selectedRoomIds.length} Selected
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-1">
              {roomsList.map((r) => {
                const isSelected = selectedRoomIds.includes(r.id);
                const isBlocked = r.status === 'MAINTENANCE' || r.status === 'BLOCKED';
                return (
                  <div
                    key={r.id}
                    onClick={() => !isBlocked && toggleRoom(r.id)}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      isBlocked
                        ? 'opacity-40 cursor-not-allowed bg-stone-100 border-stone-200'
                        : isSelected
                        ? 'border-[#14281D] bg-[#14281D] text-[#F3E7C4] shadow-xs cursor-pointer'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 cursor-pointer'
                    }`}
                  >
                    <div className="text-xs font-bold">Room {r.roomNumber}</div>
                    <div className="text-[10px] opacity-80">{r.roomType}</div>
                    <div className="text-[11px] font-semibold mt-1">₹{Number(r.pricePerNight).toLocaleString('en-IN')}/nt</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Availability Feedback */}
          <div className="p-3.5 rounded-2xl border transition-all">
            {availabilityChecking ? (
              <div className="flex items-center space-x-2 text-stone-500 text-xs">
                <span className="animate-spin w-4 h-4 border-2 border-[#C5A059] border-t-transparent rounded-full" />
                <span>Checking real-time calendar availability for {eventDate}...</span>
              </div>
            ) : availabilityResult?.available ? (
              <div className="flex items-center space-x-2.5 text-emerald-700 bg-emerald-50 p-2.5 rounded-xl text-xs font-medium">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{availabilityResult.message}</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2.5 text-rose-700 bg-rose-50 p-2.5 rounded-xl text-xs font-medium">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{availabilityResult?.message || 'Scheduling conflict detected for the chosen venue or rooms.'}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 4: SERVICES & PRICING REVIEW */}
      {step === 4 && (
        <div className="space-y-4">
          {/* Services list */}
          <div>
            {/* Dedicated JEEViKA Food & Catering Configurator Card - only when JEEViKA is active */}
            {(activePackage === 'JEEVIKA' || eventType.toLowerCase().includes('jeevika')) && (
              <div className="p-3.5 bg-red-50/80 border border-red-200 rounded-2xl space-y-2.5 mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-[#B91C1C]">
                    <span>🍽️</span>
                    <span>JEEViKA Food &amp; Catering Calculator (जीविका भोजन कैलकुलेटर)</span>
                  </div>
                  <span className="text-[10px] bg-red-100 text-[#B91C1C] px-2 py-0.5 rounded font-bold">5% GST</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 mb-1">Training Days</label>
                    <input
                      type="number"
                      min="1"
                      value={foodDays}
                      onChange={(e) => setFoodDays(Math.max(1, Number(e.target.value)))}
                      className="w-full p-2 bg-white border border-stone-200 rounded-xl font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 mb-1">Persons / Day</label>
                    <input
                      type="number"
                      min="1"
                      value={foodPersons}
                      onChange={(e) => setFoodPersons(Math.max(1, Number(e.target.value)))}
                      className="w-full p-2 bg-white border border-stone-200 rounded-xl font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 mb-1">Rate / Plate (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={foodPlateRate}
                      onChange={(e) => setFoodPlateRate(Number(e.target.value))}
                      className="w-full p-2 bg-white border border-stone-200 rounded-xl font-bold text-center"
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <button
                      type="button"
                      onClick={applyFoodCateringCharges}
                      className="w-full py-2 bg-[#B91C1C] hover:bg-[#991B1B] text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer"
                    >
                      Apply to Bill
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-[#B91C1C] font-medium pt-1 border-t border-red-200/60">
                  <span>Total: {foodDays * foodPersons} Plates (Breakfast + Lunch + Dinner)</span>
                  <span className="font-bold font-mono">₹{Math.round(foodDays * foodPersons * foodPlateRate).toLocaleString('en-IN')} + 5% GST</span>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Itemized Services &amp; Add-ons
              </label>
              <span className="text-xs font-bold text-stone-900">
                Total Services: ₹{servicesCost.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
              {services.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs"
                >
                  <div>
                    <span className="font-bold text-stone-900">{s.name}</span>
                    <span className="text-[11px] text-stone-500 ml-2">
                      (Qty: {s.quantity} × ₹{s.rate.toLocaleString('en-IN')})
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="font-bold text-stone-900">₹{s.amount.toLocaleString('en-IN')}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveService(s.id)}
                      className="text-stone-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add service inline */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Service Name (e.g. Mandap Floral Decor)"
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                className="flex-1 p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
              />
              <input
                type="number"
                min="1"
                placeholder="Qty"
                value={newServiceQty}
                onChange={(e) => setNewServiceQty(e.target.value)}
                className="w-16 p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
              />
              <input
                type="number"
                min="0"
                placeholder="Rate ₹"
                value={newServiceRate}
                onChange={(e) => setNewServiceRate(e.target.value)}
                className="w-24 p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-[#C5A059]"
              />
              <button
                type="button"
                onClick={handleAddService}
                className="px-3.5 py-2 bg-[#14281D] hover:bg-[#1f3c2b] text-[#F3E7C4] rounded-xl text-xs font-bold"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Complimentary / Waive Hall Fee Checkbox */}
          <div className="flex items-center justify-between p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="waiveHallFee"
                checked={waiveHallFee}
                onChange={(e) => setWaiveHallFee(e.target.checked)}
                className="rounded text-[#B91C1C] w-4 h-4 cursor-pointer"
              />
              <label htmlFor="waiveHallFee" className="font-bold text-stone-800 cursor-pointer">
                Complimentary / Free Hall (₹0 Venue Fee)
              </label>
            </div>
            {waiveHallFee && (
              <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                Hall Fee ₹0 Applied (Only Services Charged)
              </span>
            )}
          </div>

          {/* Pricing Adjustments */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-stone-200">
            <div>
              <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">Discount (₹)</label>
              <input
                type="number"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">GST Tax Scheme</label>
              <select
                value={taxMode}
                onChange={(e) => {
                  const mode = e.target.value as any;
                  setTaxMode(mode);
                  if (mode === 'FLAT_5') setTaxPercent(5);
                  else if (mode === 'FLAT_18') setTaxPercent(18);
                  else if (mode === 'EXEMPT') setTaxPercent(0);
                }}
                className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold outline-none"
              >
                <option value="DUAL">🇮🇳 Dual GST (भोजन 5% + हॉल 18%)</option>
                <option value="FLAT_5">🍲 5% Flat (Food / Catering Only)</option>
                <option value="FLAT_18">🏛️ 18% Flat (Banquet Only)</option>
                <option value="EXEMPT">0️⃣ 0% (Tax Exempt)</option>
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-stone-600 uppercase">
                  Advance / Prebooking (₹)
                </label>
                <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  Manual Entry
                </span>
              </div>
              <input
                type="number"
                min="0"
                placeholder="Enter manual advance (₹)"
                value={advancePayment === '' ? '' : advancePayment}
                onChange={(e) => {
                  const val = e.target.value;
                  setAdvancePayment(val === '' ? '' : Math.max(0, Number(val)));
                }}
                className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-emerald-700 outline-none focus:border-emerald-600 focus:bg-white"
              />
              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                <button
                  type="button"
                  onClick={() => setAdvancePayment(0)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all ${
                    (Number(advancePayment) || 0) === 0
                      ? 'bg-stone-800 text-white'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                  }`}
                >
                  ₹0
                </button>
                <button
                  type="button"
                  onClick={() => setAdvancePayment(Math.round(grandTotal * 0.25))}
                  className="px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] font-semibold"
                >
                  25%
                </button>
                <button
                  type="button"
                  onClick={() => setAdvancePayment(Math.round(grandTotal * 0.30))}
                  className="px-2 py-0.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-semibold"
                >
                  30% (Satta Standard)
                </button>
                <button
                  type="button"
                  onClick={() => setAdvancePayment(Math.round(grandTotal * 0.50))}
                  className="px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] font-semibold"
                >
                  50%
                </button>
                <button
                  type="button"
                  onClick={() => setAdvancePayment(grandTotal)}
                  className="px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] font-semibold"
                >
                  100%
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">Mode</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold"
              >
                <option value="UPI">UPI / GPay</option>
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer (NEFT)</option>
                <option value="CARD">Credit / Debit Card</option>
              </select>
            </div>
          </div>

          {/* Statutory Dual GST Breakdown Card */}
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/90 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-950 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-amber-700" />
                Statutory GST Separation (खाद्य 5% व हॉल 18% अलग-अलग)
              </span>
              <span className="text-[10px] bg-amber-200/80 text-amber-900 font-mono font-bold px-2 py-0.5 rounded">
                2 Separate Bills Generated
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* 1. Food portion */}
              <div className="p-2.5 rounded-lg bg-white border border-amber-200/80">
                <div className="flex justify-between items-center mb-1">
                  <strong className="text-amber-900 text-xs flex items-center gap-1">
                    <span>🍽️</span> 1. भोजन बिल (Food Catering)
                  </strong>
                  <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded">
                    {foodTaxRate}% GST (SAC 9963)
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-stone-600">
                  <span>Food Subtotal:</span>
                  <span className="font-mono font-medium">₹{foodSubtotal.toLocaleString('en-IN')}</span>
                </div>
                {foodDiscount > 0 && (
                  <div className="flex justify-between text-[11px] text-emerald-600">
                    <span>Discount:</span>
                    <span className="font-mono">- ₹{foodDiscount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between text-[11px] text-stone-600">
                  <span>GST ({foodTaxRate}% = {foodTaxRate / 2}% CGST + {foodTaxRate / 2}% SGST):</span>
                  <span className="font-mono font-semibold">+ ₹{foodTaxAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-amber-950 pt-1 mt-1 border-t border-amber-100">
                  <span>Food Total:</span>
                  <span className="font-mono">₹{(foodTaxable + foodTaxAmount).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* 2. Banquet portion */}
              <div className="p-2.5 rounded-lg bg-white border border-rose-200/80">
                <div className="flex justify-between items-center mb-1">
                  <strong className="text-[#B91C1C] text-xs flex items-center gap-1">
                    <span>🏛️</span> 2. हॉल व रूम बिल (Banquet &amp; Rooms)
                  </strong>
                  <span className="text-[10px] font-mono font-bold bg-rose-100 text-[#B91C1C] px-1.5 py-0.2 rounded">
                    {banquetTaxRate}% GST (SAC 9972)
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-stone-600">
                  <span>Banquet Subtotal:</span>
                  <span className="font-mono font-medium">₹{banquetSubtotal.toLocaleString('en-IN')}</span>
                </div>
                {banquetDiscount > 0 && (
                  <div className="flex justify-between text-[11px] text-emerald-600">
                    <span>Discount:</span>
                    <span className="font-mono">- ₹{banquetDiscount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between text-[11px] text-stone-600">
                  <span>GST ({banquetTaxRate}% = {banquetTaxRate / 2}% CGST + {banquetTaxRate / 2}% SGST):</span>
                  <span className="font-mono font-semibold">+ ₹{banquetTaxAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-[#B91C1C] pt-1 mt-1 border-t border-rose-100">
                  <span>Banquet Total:</span>
                  <span className="font-mono">₹{(banquetTaxable + banquetTaxAmount).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Financial Breakdown Ledger */}
          <div className="p-4 rounded-2xl bg-[#14281D] text-[#FBF9F5] space-y-2">
            <div className="flex justify-between text-xs text-stone-300">
              <span>Hall Rental ({selectedHall?.name || 'Selected Hall'})</span>
              <span>₹{hallCost.toLocaleString('en-IN')}</span>
            </div>
            {roomCost > 0 && (
              <div className="flex justify-between text-xs text-stone-300">
                <span>Rooms ({selectedRoomIds.length} rooms × {roomNights} night{roomNights > 1 ? 's' : ''})</span>
                <span>₹{roomCost.toLocaleString('en-IN')}</span>
              </div>
            )}
            {servicesCost > 0 && (
              <div className="flex justify-between text-xs text-stone-300">
                <span>Additional Services Total</span>
                <span>₹{servicesCost.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between text-xs font-bold text-stone-200 pt-1 border-t border-white/10">
              <span>Combined Subtotal</span>
              <span>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            {rawDiscount > 0 && (
              <div className="flex justify-between text-xs text-emerald-400">
                <span>Discount Applied</span>
                <span>- ₹{rawDiscount.toLocaleString('en-IN')}</span>
              </div>
            )}
            {foodTaxAmount > 0 && (
              <div className="flex justify-between text-xs text-amber-300">
                <span>Food GST ({foodTaxRate}% on ₹{foodTaxable.toLocaleString('en-IN')})</span>
                <span>+ ₹{foodTaxAmount.toLocaleString('en-IN')}</span>
              </div>
            )}
            {banquetTaxAmount > 0 && (
              <div className="flex justify-between text-xs text-rose-300">
                <span>Banquet GST ({banquetTaxRate}% on ₹{banquetTaxable.toLocaleString('en-IN')})</span>
                <span>+ ₹{banquetTaxAmount.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-[#E2C07D] pt-2 border-t border-white/10 font-brand">
              <span>Combined Grand Total</span>
              <span>₹{grandTotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-xs text-emerald-300 font-semibold pt-1">
              <span>Advance Payment</span>
              <span>₹{(Number(advancePayment) || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-xs text-rose-300 font-bold">
              <span>Remaining Balance Due</span>
              <span>₹{balanceDue.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Internal Booking Notes
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Mandap setup required by 2 PM, Jain food preferences..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none"
            />
          </div>

          {/* Official Terms & Conditions (सट्टा नियम व शर्तें) */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/70 border border-amber-200/90 text-xs space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-amber-200/80 text-amber-950 font-bold">
              <span className="flex items-center space-x-1.5 text-xs font-bold">
                <span>📜</span>
                <span>नोट :- (नियम व शर्तें / Terms &amp; Conditions)</span>
              </span>
              <span className="text-[10px] font-normal text-amber-800">बंधन वाटिका, पकड़ीयावर, चन्दवाँ, आरा</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-stone-800 font-medium">
              <li>किसी कारण वश सट्टा रद्द होने पर अग्रीम राशी जब्त हो जायेगी</li>
              <li>उत्सव का दिनांक पुनः बदलने पर उपलब्धता देखी जायेगी</li>
              <li>तय कुल रकम का 30% अग्रीम के रूप में लिया जायेगा</li>
              <li>उत्सव की दिनांक से 5 दिन पहले कुल रकम का भुगतान करना होगा।</li>
              <li>उत्सव भवन के यत्र तत्र गंदगी फैलाने पर सफाई का खर्च सट्टेदार को देना होगा।</li>
              <li>किसी प्रकार का तोड़फोड़ या भारी नुकसान होने पर उसका वाजिब भुगतान सट्टेदार को करना होगा।</li>
              <li>उत्सव के दिन किसी भी विद्युत उपकरण के खराबी आने पर ठीक कराने का प्रयास किया जायेगा परन्तु नहीं होने पर उसकी जिम्मेदारी प्रबंधन पर नहीं होगी।</li>
            </ol>
          </div>
        </div>
      )}

      {/* Footer Controls */}
      <div className="flex items-center justify-between pt-5 mt-5 border-t border-stone-100">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-bold transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
        ) : (
          <div />
        )}

        {step < 4 ? (
          <button
            type="button"
            disabled={step === 3 && availabilityResult?.available === false}
            onClick={handleNextStep}
            className="flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-[#14281D] hover:bg-[#1f3c2b] text-[#F3E7C4] text-xs font-bold transition-all disabled:opacity-50"
          >
            <span>Proceed to Step {step + 1}</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#C5A059]" />
          </button>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={handleSubmitBooking}
            className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-[#C5A059] hover:bg-[#b58f47] text-[#14281D] text-xs font-extrabold uppercase tracking-wider shadow-md transition-all disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-[#14281D]" />
            <span>{loading ? 'Creating Booking...' : 'Confirm & Create Booking'}</span>
          </button>
        )}
      </div>
    </Modal>
  );
};
