import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useAuthStore, useBookingStore } from '../../store';
import { apiPost } from '../../services/api';

const SERVICE_OPTIONS = [
  { id: 'hourly',    label: '⏱ Hourly',    desc: 'Pay per hour' },
  { id: 'half_day',  label: '🌤 Half Day',  desc: '4 hours' },
  { id: 'full_day',  label: '☀️ Full Day',  desc: '8 hours' },
  { id: 'one_way',   label: '📍 One Way',   desc: 'Point to point' },
] as const;

const HOURS_OPTIONS = [1, 2, 3, 4, 6, 8];

export default function BookScreen() {
  const user = useAuthStore((s) => s.user);
  const { current, fareEstimate, setBookingField, setFareEstimate, setActiveBooking } = useBookingStore();
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loadingFare, setLoadingFare] = useState(false);
  const [booking, setBooking] = useState(false);

  // Request location on mount
  useEffect(() => {
    fetchCurrentLocation();
  }, []);

  const fetchCurrentLocation = async () => {
    setLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const [address] = await Location.reverseGeocodeAsync(loc.coords);

      setBookingField('pickupLat', loc.coords.latitude);
      setBookingField('pickupLng', loc.coords.longitude);
      setBookingField('pickupAddress',
        `${address.name ?? ''}, ${address.street ?? ''}, ${address.city ?? ''}`.trim().replace(/^,\s*/, '')
      );
    } catch {
      // Silently fail — user can type address manually
    } finally {
      setLoadingLocation(false);
    }
  };

  const estimateFare = async () => {
    if (!current.pickupLat || !current.cityId) return;
    setLoadingFare(true);
    try {
      const fare = await apiPost<{ estimatedTotal: number; breakdown: Record<string, number>; surgeMultiplier: number }>(
        '/bookings/estimate',
        {
          cityId:      current.cityId,
          serviceType: current.serviceType,
          durationHours: current.durationHours,
          pickupLat:   current.pickupLat,
          pickupLng:   current.pickupLng,
        },
      );
      setFareEstimate(fare);
    } catch {
      Alert.alert('Error', 'Could not get fare estimate');
    } finally {
      setLoadingFare(false);
    }
  };

  const handleBook = async () => {
    if (!current.pickupAddress) {
      Alert.alert('Missing pickup', 'Please allow location access or enter your pickup address.');
      return;
    }
    setBooking(true);
    try {
      const result = await apiPost<{ id: string }>('/bookings', {
        bookingType:  'instant',
        serviceType:  current.serviceType,
        durationHours: current.durationHours,
        pickupLat:    current.pickupLat,
        pickupLng:    current.pickupLng,
        pickupAddress: current.pickupAddress,
        cityId:       current.cityId ?? 1,
      });
      setActiveBooking(result.id);
      router.push('/booking/live');
    } catch (err: unknown) {
      Alert.alert('Booking failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBooking(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good morning 👋</Text>
          <Text style={styles.name}>{user?.name ?? 'Welcome back'}</Text>
        </View>
        <View style={styles.avatarBox}>
          <Text style={styles.avatarText}>
            {(user?.name ?? 'U')[0].toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Pickup location */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📍 Pickup Location</Text>
        <View style={styles.locationCard}>
          {loadingLocation
            ? <ActivityIndicator color="#1A6B5A" />
            : (
              <Text style={styles.address} numberOfLines={2}>
                {current.pickupAddress ?? 'Tap to set location'}
              </Text>
            )
          }
          <TouchableOpacity onPress={fetchCurrentLocation} style={styles.locBtn}>
            <Text style={styles.locBtnText}>📡</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Service type */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🚗 Service Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            {SERVICE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.chip, current.serviceType === opt.id && styles.chipActive]}
                onPress={() => { setBookingField('serviceType', opt.id); setFareEstimate(null); }}
              >
                <Text style={[styles.chipLabel, current.serviceType === opt.id && styles.chipLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={[styles.chipDesc, current.serviceType === opt.id && styles.chipDescActive]}>
                  {opt.desc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Hours (only for hourly) */}
      {current.serviceType === 'hourly' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⏱ Duration</Text>
          <View style={styles.chipRow}>
            {HOURS_OPTIONS.map((h) => (
              <TouchableOpacity
                key={h}
                style={[styles.hourChip, current.durationHours === h && styles.chipActive]}
                onPress={() => { setBookingField('durationHours', h); setFareEstimate(null); }}
              >
                <Text style={[styles.hourText, current.durationHours === h && styles.chipLabelActive]}>
                  {h}h
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Fare estimate */}
      <View style={styles.section}>
        {fareEstimate ? (
          <View style={styles.fareCard}>
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Estimated Fare</Text>
              <Text style={styles.fareAmount}>₹{fareEstimate.estimatedTotal}</Text>
            </View>
            {fareEstimate.surgeMultiplier > 1 && (
              <Text style={styles.surgeText}>
                ⚡ {fareEstimate.surgeMultiplier}× surge pricing active
              </Text>
            )}
          </View>
        ) : (
          <TouchableOpacity style={styles.estimateBtn} onPress={estimateFare} disabled={loadingFare}>
            {loadingFare
              ? <ActivityIndicator color="#1A6B5A" />
              : <Text style={styles.estimateBtnText}>Get Fare Estimate</Text>
            }
          </TouchableOpacity>
        )}
      </View>

      {/* Book button */}
      <TouchableOpacity
        style={[styles.bookBtn, booking && styles.bookBtnDisabled]}
        onPress={handleBook}
        disabled={booking}
        activeOpacity={0.85}
      >
        {booking
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.bookBtnText}>Book Driver Instantly 🚗</Text>
        }
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', paddingHorizontal: 20 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 60, paddingBottom: 24,
  },
  greeting: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  name: { fontSize: 22, fontWeight: '800', color: '#1A1A2E', marginTop: 2 },
  avatarBox: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1A6B5A', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  locationCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  address: { flex: 1, fontSize: 15, color: '#1A1A2E', lineHeight: 20 },
  locBtn: { padding: 8 },
  locBtnText: { fontSize: 20 },
  chipRow: { flexDirection: 'row', gap: 10 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB',
    minWidth: 100, alignItems: 'center',
  },
  chipActive: { backgroundColor: '#1A6B5A', borderColor: '#1A6B5A' },
  chipLabel: { fontSize: 14, fontWeight: '700', color: '#374151' },
  chipLabelActive: { color: '#fff' },
  chipDesc: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  chipDescActive: { color: 'rgba(255,255,255,0.8)' },
  hourChip: {
    width: 52, height: 52, borderRadius: 12,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center',
  },
  hourText: { fontSize: 15, fontWeight: '700', color: '#374151' },
  fareCard: {
    backgroundColor: '#E8F5F2', borderRadius: 14, padding: 16,
    borderWidth: 1.5, borderColor: '#1A6B5A',
  },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fareLabel: { fontSize: 14, color: '#1A6B5A', fontWeight: '600' },
  fareAmount: { fontSize: 24, fontWeight: '800', color: '#0D3D2F' },
  surgeText: { fontSize: 12, color: '#E65100', marginTop: 6, fontWeight: '600' },
  estimateBtn: {
    backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#1A6B5A',
  },
  estimateBtnText: { color: '#1A6B5A', fontSize: 15, fontWeight: '700' },
  bookBtn: {
    backgroundColor: '#1A6B5A', borderRadius: 16, paddingVertical: 18,
    alignItems: 'center', marginTop: 8,
    shadowColor: '#1A6B5A', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  bookBtnDisabled: { backgroundColor: '#A0AEC0', shadowOpacity: 0 },
  bookBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
});
