export type UserRole = 'OWNER' | 'MANAGER' | 'ACCOUNTANT' | 'RECEPTIONIST' | 'STAFF';

export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  role: UserRole;
  phone?: string | null;
  idProofType?: string | null;
  idProofNumber?: string | null;
  idProofImage?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  lastLoginAt?: string | null;
}

export interface Customer {
  id: string;
  customerCode: string;
  name: string;
  mobile: string;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  idProofType?: string | null;
  idProofNumber?: string | null;
  idProofImage?: string | null;
  notes?: string | null;
  isActive: boolean;
  totalBookings: number;
  totalSpent: string;
  outstandingAmount: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Hall {
  id: string;
  code: string;
  name: string;
  type: string;
  capacity: number;
  basePrice: string;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  amenities: string; // JSON array string
  description?: string | null;
}

export interface Room {
  id: string;
  roomNumber: string;
  roomType: string;
  isAc: boolean;
  capacity: number;
  pricePerNight: string;
  status: 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'CLEANING' | 'MAINTENANCE' | 'BLOCKED';
  amenities: string; // JSON array string
  description?: string | null;
}

export interface Booking {
  id: string;
  bookingNumber: string;
  customerId: string;
  eventType: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  guestCount: number;
  hallId?: string | null;
  hallIds: string;
  roomIds: string;
  services: string;
  subtotal: string;
  discount: string;
  taxPercent: string;
  taxAmount: string;
  grandTotal: string;
  paidAmount: string;
  balanceAmount: string;
  status: 'INQUIRY' | 'QUOTATION' | 'PENDING_ADVANCE' | 'CONFIRMED' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'POSTPONED';
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
  customer?: Customer;
  hall?: Hall;
  invoices?: Invoice[];
  payments?: Payment[];
}

export interface QuotationItem {
  description: string;
  name?: string;
  quantity?: number;
  qty?: number;
  rate?: number;
  unitPrice?: number;
  cost?: number;
  amount?: number;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  customerId: string;
  bookingId?: string | null;
  eventType: string;
  eventDate: string;
  hallId?: string | null;
  items: string; // JSON array
  subtotal: string;
  discount: string;
  taxPercent: string;
  taxAmount: string;
  totalAmount: string;
  validUntil: string;
  terms?: string | null;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'CONVERTED';
  createdAt?: string;
  updatedAt?: string;
  customer?: Customer;
  hall?: Hall | null;
  booking?: Booking | null;
  parsedItems?: QuotationItem[];
}

export interface InvoiceItem {
  description: string;
  quantity?: number;
  qty?: number;
  rate?: number;
  unitPrice?: number;
  amount: number;
}

export interface InvoiceSnapshot {
  businessName?: string;
  tagline?: string;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  terms?: string;
  customerName?: string;
  customerMobile?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerGstin?: string;
  appliedTaxPercent?: string;
  issuedAt?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  bookingId?: string | null;
  quotationId?: string | null;
  invoiceDate: string;
  eventDate: string;
  eventType: string;
  items: string; // JSON array
  subtotal: string;
  discount: string;
  taxPercent: string;
  taxAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  grandTotal: string;
  paidAmount: string;
  balanceAmount: string;
  status: 'DRAFT' | 'ISSUED' | 'PARTIAL' | 'PAID' | 'CANCELLED';
  dueDate?: string | null;
  terms?: string | null;
  notes?: string | null;
  snapshot?: string;
  createdBy?: string | null;
  createdAt: string;
  updatedAt?: string;
  customer?: Customer;
  booking?: Booking | null;
  quotation?: Quotation | null;
  parsedItems?: InvoiceItem[];
  parsedSnapshot?: InvoiceSnapshot;
  auditHistory?: any[];
}

export interface Payment {
  id: string;
  receiptNumber: string;
  invoiceId?: string | null;
  bookingId?: string | null;
  customerId: string;
  amount: string;
  paymentMethod: 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';
  transactionReference?: string | null;
  paymentDate: string;
  paymentType: 'ADVANCE' | 'PARTIAL' | 'FINAL';
  notes?: string | null;
  isReversed: boolean;
  reversalReason?: string | null;
  reversedAt?: string | null;
  reversedBy?: string | null;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
  customer?: Customer;
  invoice?: Invoice | null;
  booking?: Booking | null;
  auditHistory?: any[];
}

export interface Expense {
  id: string;
  expenseCode: string;
  category: string;
  amount: string;
  date: string;
  vendor: string;
  paymentMethod: string;
  notes?: string | null;
  createdBy: string;
}

export interface AuditLog {
  id: string;
  userId?: string | null;
  userName: string;
  userRole: string;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

export interface Settings {
  id: string;
  businessName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  defaultTaxPercent: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  termsAndConditions: string;
}
