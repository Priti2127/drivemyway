import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ScrollView, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useAuthStore } from '../../store';
import { apiGet, apiPost } from '../../services/api';

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

export default function ProfileScreen() {
  const { user, clearAuth } = useAuthStore();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiGet<EmergencyContact[]>('/users/emergency-contacts').then(setContacts).catch(() => {}),
      apiGet<{ balance: number }>('/payments/wallet/balance').then((d) => setWalletBalance(d.balance)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try { await apiPost('/auth/logout', {}); } catch {}
          await AsyncStorage.multiRemove(['access_token', 'refresh_token']);
          clearAuth();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#1A6B5A" size="large" /></View>;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Avatar + name */}
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.name ?? 'U')[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{user?.name ?? '—'}</Text>
        <Text style={styles.phone}>{user?.phone}</Text>
      </View>

      {/* Wallet */}
      <View style={styles.walletCard}>
        <Text style={styles.walletLabel}>💰 Wallet Balance</Text>
        <Text style={styles.walletAmount}>₹{walletBalance?.toFixed(2) ?? '0.00'}</Text>
        <TouchableOpacity style={styles.topupBtn}>
          <Text style={styles.topupText}>Add Money</Text>
        </TouchableOpacity>
      </View>

      {/* Emergency contacts */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🆘 Emergency Contacts</Text>
          <TouchableOpacity>
            <Text style={styles.addLink}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {contacts.length === 0 ? (
          <View style={styles.emptyContacts}>
            <Text style={styles.emptyContactsText}>
              Add emergency contacts to receive SOS alerts and trip notifications.
            </Text>
          </View>
        ) : (
          contacts.map((c) => (
            <View key={c.id} style={styles.contactCard}>
              <View style={styles.contactAvatar}>
                <Text style={styles.contactAvatarText}>{c.name[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>{c.name}</Text>
                <Text style={styles.contactMeta}>{c.relationship} · {c.phone}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Menu items */}
      {[
        { label: '📋 Trip History',          onPress: () => router.push('/(tabs)/rides') },
        { label: '💳 Payment Methods',       onPress: () => {} },
        { label: '🔔 Notification Settings', onPress: () => {} },
        { label: '🛡 Privacy & Safety',      onPress: () => {} },
        { label: '❓ Help & Support',        onPress: () => {} },
      ].map((item) => (
        <TouchableOpacity key={item.label} style={styles.menuItem} onPress={item.onPress}>
          <Text style={styles.menuLabel}>{item.label}</Text>
          <Text style={styles.menuChevron}>›</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>DriveMyWay v1.0.0</Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', paddingTop: 64, paddingBottom: 28, backgroundColor: '#1A6B5A' },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#fff', marginBottom: 12,
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  name: { color: '#fff', fontSize: 22, fontWeight: '800' },
  phone: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 4 },
  walletCard: {
    margin: 20, backgroundColor: '#fff', borderRadius: 16, padding: 20,
    alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  walletLabel: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  walletAmount: { fontSize: 32, fontWeight: '800', color: '#1A1A2E' },
  topupBtn: {
    backgroundColor: '#E8F5F2', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 8, marginTop: 4,
  },
  topupText: { color: '#1A6B5A', fontWeight: '700', fontSize: 14 },
  section: { marginHorizontal: 20, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151' },
  addLink: { color: '#1A6B5A', fontWeight: '700', fontSize: 14 },
  emptyContacts: {
    backgroundColor: '#FFF3E0', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#FFCC80',
  },
  emptyContactsText: { fontSize: 13, color: '#E65100', lineHeight: 18 },
  contactCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8,
  },
  contactAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1A6B5A', alignItems: 'center', justifyContent: 'center' },
  contactAvatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  contactName: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  contactMeta: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  menuLabel: { fontSize: 15, color: '#374151' },
  menuChevron: { fontSize: 20, color: '#D1D5DB' },
  logoutBtn: {
    margin: 20, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#FCA5A5',
  },
  logoutText: { color: '#D32F2F', fontWeight: '700', fontSize: 15 },
  version: { textAlign: 'center', fontSize: 12, color: '#D1D5DB', marginTop: 4 },
});
