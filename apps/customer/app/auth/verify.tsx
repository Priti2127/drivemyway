import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiPost } from '../../services/api';
import { useAuthStore } from '../../store';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30;

export default function VerifyOtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const inputRef = useRef<TextInput>(null);
  const setUser = useAuthStore((s) => s.setUser);

  // Countdown timer for resend button
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  const handleVerify = async () => {
    if (otp.length !== OTP_LENGTH) return;
    setLoading(true);
    try {
      const data = await apiPost<{ accessToken: string; refreshToken: string; user: { id: string; name: string; phone: string } }>(
        '/auth/verify-otp',
        { phone, otp },
      );

      // Persist tokens
      await AsyncStorage.multiSet([
        ['access_token', data.accessToken],
        ['refresh_token', data.refreshToken],
      ]);

      setUser(data.user, data.accessToken);
      router.replace('/(tabs)');
    } catch (err: unknown) {
      Alert.alert('Invalid OTP', err instanceof Error ? err.message : 'Please check the code and try again.');
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    try {
      await apiPost('/auth/send-otp', { phone });
      setCountdown(RESEND_COOLDOWN);
      Alert.alert('OTP Resent', 'A new OTP has been sent to your number.');
    } catch {
      Alert.alert('Error', 'Could not resend OTP. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Back button */}
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Enter OTP</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to{'\n'}
          <Text style={styles.phone}>{phone}</Text>
        </Text>

        {/* OTP input */}
        <TextInput
          ref={inputRef}
          style={styles.otpInput}
          value={otp}
          onChangeText={(v) => { setOtp(v.replace(/\D/g, '')); if (v.length === OTP_LENGTH) handleVerify(); }}
          keyboardType="number-pad"
          maxLength={OTP_LENGTH}
          autoFocus
          textAlign="center"
          letterSpacing={8}
          placeholder="· · · · · ·"
          placeholderTextColor="#D1D5DB"
        />

        {/* Verify button */}
        <TouchableOpacity
          style={[styles.btn, (otp.length !== OTP_LENGTH || loading) && styles.btnDisabled]}
          onPress={handleVerify}
          disabled={otp.length !== OTP_LENGTH || loading}
          activeOpacity={0.8}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Verify & Continue</Text>
          }
        </TouchableOpacity>

        {/* Resend */}
        <TouchableOpacity onPress={handleResend} disabled={countdown > 0}>
          <Text style={[styles.resend, countdown > 0 && styles.resendDisabled]}>
            {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', padding: 24 },
  back: { paddingTop: 48, marginBottom: 32 },
  backText: { fontSize: 16, color: '#1A6B5A', fontWeight: '600' },
  content: { alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: '#1A1A2E', marginBottom: 10 },
  subtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 36 },
  phone: { color: '#1A6B5A', fontWeight: '700' },
  otpInput: {
    width: 260,
    borderWidth: 2,
    borderColor: '#1A6B5A',
    borderRadius: 16,
    padding: 18,
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A2E',
    backgroundColor: '#fff',
    marginBottom: 28,
  },
  btn: {
    width: 260,
    backgroundColor: '#1A6B5A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  btnDisabled: { backgroundColor: '#A0AEC0' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resend: { fontSize: 15, color: '#1A6B5A', fontWeight: '600' },
  resendDisabled: { color: '#9CA3AF' },
});
