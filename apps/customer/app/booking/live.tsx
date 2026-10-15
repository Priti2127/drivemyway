import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Vibration, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';
import { useBookingStore, useAuthStore } from '../../store';
import { apiGet, apiPost } from '../../services/api';

const WS_URL: string =
  Constants.expoConfig?.extra?.TRACKING_WS_URL ?? 'https://tracking.drivemyway.up.railway.app';

interface DriverLocation {
  lat: number;
  lng: number;
  speed?: number;
}

let socket: Socket | null = null;

export default function LiveTripScreen() {
  const { activeBookingId, assignedDriver, setAssignedDriver } = useBookingStore();
  const { accessToken } = useAuthStore();

  const [status, setStatus] = useState<'searching' | 'driver_assigned' | 'in_progress' | 'completed'>('searching');
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [sosLoading, setSosLoading] = useState(false);

  // Connect to tracking WebSocket
  useEffect(() => {
    if (!activeBookingId) return;

    socket = io(WS_URL, {
      auth: { token: accessToken },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      socket?.emit('customer:subscribe', activeBookingId);
    });

    socket.on('location:update', (update: { location: DriverLocation; etaMinutes?: number }) => {
      setDriverLocation(update.location);
      if (update.etaMinutes !== undefined) setEtaMinutes(update.etaMinutes);
    });

    socket.on('trip:status', (newStatus: typeof status) => {
      setStatus(newStatus);
      if (newStatus === 'driver_assigned') {
        Vibration.vibrate([0, 100, 50, 100]); // haptic feedback
      }
    });

    socket.on('driver:assigned', (driver: typeof assignedDriver) => {
      setAssignedDriver(driver);
      setStatus('driver_assigned');
    });

    return () => { socket?.disconnect(); socket = null; };
  }, [activeBookingId]);

  // Fetch sharing link
  useEffect(() => {
    if (!activeBookingId) return;
    apiGet<{ url: string }>(`/track/${activeBookingId}/link`)
      .then((data) => setShareLink(data.url))
      .catch(() => {}); // Non-critical
  }, [activeBookingId]);

  const handleSOS = async () => {
    Alert.alert(
      '🆘 SOS Alert',
      'This will immediately notify all your emergency contacts and our safety team. Are you in danger?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'SEND SOS NOW',
          style: 'destructive',
          onPress: async () => {
            setSosLoading(true);
            socket?.emit('sos:trigger', {
              tripId: activeBookingId,
              triggeredBy: 'customer',
              location: driverLocation ?? {},
            });
            Alert.alert('🆘 SOS Sent', 'Your emergency contacts and our team have been notified. Help is on the way.');
            setSosLoading(false);
          },
        },
      ],
    );
  };

  const renderStatusBadge = () => {
    const map = {
      searching:        { label: '🔍 Finding your driver…', color: '#E65100', bg: '#FFF3E0' },
      driver_assigned:  { label: '🎉 Driver on the way!',   color: '#2E7D32', bg: '#E8F5E9' },
      in_progress:      { label: '🚗 Trip in progress',     color: '#1A6B5A', bg: '#E8F5F2' },
      completed:        { label: '✅ Trip completed',        color: '#374151', bg: '#F3F4F6' },
    };
    const s = map[status];
    return (
      <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
        <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
        {status === 'searching' && <ActivityIndicator color={s.color} size="small" style={{ marginLeft: 8 }} />}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Map placeholder — will integrate MapView here */}
      <View style={styles.mapArea}>
        <Text style={styles.mapPlaceholder}>🗺️</Text>
        <Text style={styles.mapHint}>
          {driverLocation
            ? `Driver at ${driverLocation.lat.toFixed(4)}, ${driverLocation.lng.toFixed(4)}`
            : 'Waiting for driver location…'}
        </Text>
        {etaMinutes !== null && (
          <View style={styles.etaBubble}>
            <Text style={styles.etaText}>{etaMinutes < 1 ? 'Arriving!' : `ETA ${etaMinutes} min`}</Text>
          </View>
        )}
      </View>

      {/* Bottom panel */}
      <View style={styles.panel}>
        {renderStatusBadge()}

        {/* Driver card */}
        {assignedDriver && (
          <View style={styles.driverCard}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarText}>{assignedDriver.name[0]}</Text>
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{assignedDriver.name}</Text>
              <Text style={styles.driverMeta}>
                ★ {assignedDriver.rating.toFixed(1)}  ·  {assignedDriver.totalTrips} trips
              </Text>
              <Text style={styles.driverPlate}>
                {assignedDriver.vehicle?.make} · {assignedDriver.vehicle?.licensePlate}
              </Text>
            </View>
            <TouchableOpacity style={styles.callBtn}>
              <Text style={styles.callBtnText}>📞</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Share link */}
        {shareLink && (
          <TouchableOpacity style={styles.shareBtn}>
            <Text style={styles.shareBtnText}>📤 Share Live Location with Family</Text>
          </TouchableOpacity>
        )}

        {/* SOS Button */}
        <TouchableOpacity
          style={styles.sosBtn}
          onPress={handleSOS}
          disabled={sosLoading}
          activeOpacity={0.8}
        >
          {sosLoading
            ? <ActivityIndicator color="#fff" />
            : <>
                <Text style={styles.sosBtnIcon}>🆘</Text>
                <Text style={styles.sosBtnText}>SOS — Emergency Help</Text>
              </>
          }
        </TouchableOpacity>

        {/* Cancel button (only when searching) */}
        {status === 'searching' && (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={async () => {
              await apiPost(`/bookings/${activeBookingId}/cancel`, { reason: 'Customer cancelled' });
              router.replace('/(tabs)');
            }}
          >
            <Text style={styles.cancelText}>Cancel Booking</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A2E' },
  mapArea: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#E8F0EC',
  },
  mapPlaceholder: { fontSize: 64 },
  mapHint: { fontSize: 13, color: '#6B7280', marginTop: 8 },
  etaBubble: {
    position: 'absolute', top: 16, right: 16,
    backgroundColor: '#1A6B5A', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  etaText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  panel: {
    backgroundColor: '#fff', borderRadius: 28, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 20, elevation: 10,
    gap: 12,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, paddingVertical: 10,
  },
  statusText: { fontSize: 15, fontWeight: '700' },
  driverCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14,
  },
  driverAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#1A6B5A', alignItems: 'center', justifyContent: 'center',
  },
  driverAvatarText: { color: '#fff', fontWeight: '800', fontSize: 20 },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  driverMeta: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  driverPlate: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  callBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#E8F5F2', alignItems: 'center', justifyContent: 'center',
  },
  callBtnText: { fontSize: 20 },
  shareBtn: {
    backgroundColor: '#F5F7FA', borderRadius: 12, paddingVertical: 13,
    alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB',
  },
  shareBtnText: { color: '#1A6B5A', fontWeight: '700', fontSize: 14 },
  sosBtn: {
    backgroundColor: '#D32F2F', borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  sosBtnIcon: { fontSize: 20 },
  sosBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  cancelBtn: { alignItems: 'center', paddingVertical: 6 },
  cancelText: { color: '#9CA3AF', fontSize: 14 },
});
