import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../store';

export default function RootLayout() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Auth gates — redirect to login if not authenticated */}
      {!isLoggedIn && <Redirect href="/auth/login" />}

      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="auth/verify" />
      <Stack.Screen name="booking/[id]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="booking/live" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
