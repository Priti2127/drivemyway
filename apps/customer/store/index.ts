import { create } from 'zustand';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  profilePic?: string;
}

export interface Driver {
  id: string;
  name: string;
  rating: number;
  totalTrips: number;
  vehicle: {
    make: string;
    color: string;
    licensePlate: string;
  };
  profilePic?: string;
  etaMinutes?: number;
  distance?: number;
}

export interface BookingState {
  pickupAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropAddress?: string;
  dropLat?: number | null;
  dropLng?: number | null;
  serviceType: 'hourly' | 'half_day' | 'full_day' | 'one_way';
  durationHours: number;
  bookingType: 'instant' | 'scheduled';
  scheduledAt?: string;
  cityId: number;
}

// ─── Auth Store ───────────────────────────────────────────────────────────────
interface AuthStore {
  user: User | null;
  accessToken: string | null;
  isLoggedIn: boolean;
  setUser: (user: User, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  accessToken: null,
  isLoggedIn: false,
  setUser: (user, accessToken) => set({ user, accessToken, isLoggedIn: true }),
  clearAuth: () => set({ user: null, accessToken: null, isLoggedIn: false }),
}));

// ─── Booking Flow Store ───────────────────────────────────────────────────────
interface BookingStore {
  current: Partial<BookingState>;
  activeBookingId: string | null;
  assignedDriver: Driver | null;
  fareEstimate: {
    estimatedTotal: number;
    breakdown: Record<string, number>;
    surgeMultiplier: number;
  } | null;
  setBookingField: <K extends keyof BookingState>(key: K, value: BookingState[K]) => void;
  setFareEstimate: (fare: BookingStore['fareEstimate']) => void;
  setActiveBooking: (bookingId: string) => void;
  setAssignedDriver: (driver: Driver | null) => void;
  resetBooking: () => void;
}

export const useBookingStore = create<BookingStore>((set) => ({
  current: {
    serviceType: 'hourly',
    durationHours: 2,
    bookingType: 'instant',
    cityId: 1,
  },
  activeBookingId: null,
  assignedDriver: null,
  fareEstimate: null,
  setBookingField: (key, value) =>
    set((state) => ({ current: { ...state.current, [key]: value } })),
  setFareEstimate: (fareEstimate) => set({ fareEstimate }),
  setActiveBooking: (bookingId) => set({ activeBookingId: bookingId }),
  setAssignedDriver: (assignedDriver) => set({ assignedDriver }),
  resetBooking: () => set({
    current: { serviceType: 'hourly', durationHours: 2, bookingType: 'instant', cityId: 1 },
    activeBookingId: null,
    assignedDriver: null,
    fareEstimate: null,
  }),
}));
