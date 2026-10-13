// ─── User & Auth Types ────────────────────────────────────────────────────────

export type UserRole = 'customer' | 'driver' | 'admin' | 'corporate';

export interface User {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  profilePhoto?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface JwtPayload {
  userId: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// ─── Driver Types ─────────────────────────────────────────────────────────────

export type KycStatus = 'pending' | 'in_review' | 'approved' | 'rejected';

export interface Driver {
  id: string;
  userId: string;
  kycStatus: KycStatus;
  licenseNumber?: string;
  licenseVerified: boolean;
  aadhaarVerified: boolean;
  backgroundChecked: boolean;
  rating: number;
  totalTrips: number;
  languages: string[];
  cityIds: number[];
  isOnline: boolean;
  currentLat?: number;
  currentLng?: number;
  lastLocationAt?: Date;
}

// ─── Booking Types ────────────────────────────────────────────────────────────

export type BookingType = 'instant' | 'scheduled';
export type ServiceType = 'hourly' | 'half_day' | 'full_day' | 'one_way';
export type BookingStatus =
  | 'pending'
  | 'searching'
  | 'assigned'
  | 'driver_en_route'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface Booking {
  id: string;
  customerId: string;
  driverId?: string;
  bookingType: BookingType;
  serviceType: ServiceType;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropLat?: number;
  dropLng?: number;
  dropAddress?: string;
  scheduledAt?: Date;
  durationHours?: number;
  status: BookingStatus;
  estimatedFare?: number;
  finalFare?: number;
  surgeMultiplier: number;
  cityId: number;
  createdAt: Date;
}

// ─── Location / Tracking Types ────────────────────────────────────────────────

export interface LocationPoint {
  lat: number;
  lng: number;
  speed?: number;        // km/h
  heading?: number;      // degrees
  timestamp: string;     // ISO8601
}

export interface TrackingUpdate {
  tripId: string;
  driverId: string;
  location: LocationPoint;
  etaMinutes?: number;
  isOnRoute?: boolean;
}

// ─── Payment Types ────────────────────────────────────────────────────────────

export type PaymentMethod = 'upi' | 'card' | 'wallet' | 'cash' | 'corporate';
export type PaymentStatus =
  | 'pending'
  | 'authorized'
  | 'captured'
  | 'failed'
  | 'refunded';

export interface Payment {
  id: string;
  bookingId: string;
  userId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  createdAt: Date;
}

// ─── Fare Calculation ─────────────────────────────────────────────────────────

export interface FareBreakdown {
  baseFare: number;
  extraTimeFare: number;
  distanceFare: number;
  waitingFare: number;
  platformFee: number;
  surgeMultiplier: number;
  discount: number;
  total: number;
  currency: string;
}

// ─── Emergency / Safety ───────────────────────────────────────────────────────

export interface EmergencyContact {
  id: string;
  userId: string;
  name: string;
  phone: string;
  relation?: string;
  notifyOn: ('trip_start' | 'trip_end' | 'sos')[];
}

export interface SosEvent {
  tripId: string;
  triggeredBy: string;   // userId
  triggeredAt: string;   // ISO8601
  location: LocationPoint;
  contactsNotified: string[];
}

// ─── API Response Envelope ────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
