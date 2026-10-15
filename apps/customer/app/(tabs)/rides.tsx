import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { apiGet } from '../../services/api';

interface Booking {
  id: string;
  serviceType: string;
  pickupAddress: string;
  dropAddress?: string;
  status: string;
  estimatedFare: number;
  finalFare?: number;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  completed:  { color: '#2E7D32', bg: '#E8F5E9', label: '✅ Completed' },
  cancelled:  { color: '#D32F2F', bg: '#FFEBEE', label: '❌ Cancelled' },
  in_progress:{ color: '#1A6B5A', bg: '#E8F5F2', label: '🚗 In Progress' },
  searching:  { color: '#E65100', bg: '#FFF3E0', label: '🔍 Searching' },
};

export default function RidesScreen() {
  const [rides, setRides] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadRides = async (p: number) => {
    try {
      const result = await apiGet<{ data: Booking[]; meta: { total: number } }>(
        `/bookings?page=${p}&limit=15`
      );
      if (p === 1) setRides(result.data);
      else setRides((prev) => [...prev, ...result.data]);
      setHasMore(result.data.length === 15);
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRides(1); }, []);

  const renderItem = ({ item }: { item: Booking }) => {
    const s = STATUS_CONFIG[item.status] ?? { color: '#6B7280', bg: '#F3F4F6', label: item.status };
    const date = new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const fare = item.finalFare ?? item.estimatedFare;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
            <Text style={[styles.statusLabel, { color: s.color }]}>{s.label}</Text>
          </View>
          <Text style={styles.date}>{date}</Text>
        </View>

        <View style={styles.route}>
          <Text style={styles.pickup} numberOfLines={1}>📍 {item.pickupAddress}</Text>
          {item.dropAddress && (
            <Text style={styles.drop} numberOfLines={1}>🏁 {item.dropAddress}</Text>
          )}
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.serviceType}>
            {item.serviceType.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase())}
          </Text>
          <Text style={styles.fare}>₹{fare?.toFixed(0) ?? '—'}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1A6B5A" />
      </View>
    );
  }

  return (
    <FlatList
      data={rides}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      ListHeaderComponent={<Text style={styles.pageTitle}>My Rides</Text>}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🚗</Text>
          <Text style={styles.emptyTitle}>No trips yet</Text>
          <Text style={styles.emptyText}>Your booked trips will appear here.</Text>
        </View>
      }
      onEndReached={() => { if (hasMore) { setPage(p => p + 1); loadRides(page + 1); } }}
      onEndReachedThreshold={0.5}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { fontSize: 24, fontWeight: '800', color: '#1A1A2E', marginBottom: 16, paddingTop: 56 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    gap: 10,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusPill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusLabel: { fontSize: 12, fontWeight: '700' },
  date: { fontSize: 12, color: '#9CA3AF' },
  route: { gap: 4 },
  pickup: { fontSize: 14, color: '#374151', fontWeight: '500' },
  drop: { fontSize: 14, color: '#6B7280' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  serviceType: { fontSize: 13, color: '#6B7280' },
  fare: { fontSize: 18, fontWeight: '800', color: '#1A1A2E' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptyText: { fontSize: 14, color: '#9CA3AF' },
});
