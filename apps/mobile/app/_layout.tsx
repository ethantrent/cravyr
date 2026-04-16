import { Stack, useSegments, useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { ErrorBoundary } from '../components/ErrorBoundary';

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
const EAS_PROJECT_ID = 'e6d2a650-fd20-4092-a4a5-0f7a211e1e1a';

async function registerPushToken(session: Session) {
  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    if (existingStatus !== 'granted') return;

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: EAS_PROJECT_ID,
    });

    const token = session.access_token;
    await fetch(`${API_URL}/api/v1/notifications/register`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expo_push_token: tokenData.data,
        platform: Platform.OS,
      }),
    });
  } catch {
    // Push registration is non-blocking — failure must not break the app
  }
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const appState = useRef(AppState.currentState);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
      SplashScreen.hideAsync();
      if (s) registerPushToken(s);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, s: Session | null) => {
      setSession(s);
      if (s) registerPushToken(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Re-register push token when app returns to foreground (SC-2)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        if (session) registerPushToken(session);
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [session]);

  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const inOnboarding = segments[0] === 'onboarding';

    if (!session && !inOnboarding) {
      router.replace('/onboarding');
    } else if (session && inOnboarding) {
      router.replace('/(tabs)/discover');
    }
  }, [session, loading, segments]);

  if (loading) return null;

  return (
    <ErrorBoundary>
    <GestureHandlerRootView style={{ flex: 1 }}>
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen
        name="restaurant/[id]"
        options={{
          headerShown: true,
          title: '',
          headerTransparent: true,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="preferences"
        options={{
          title: 'Preferences',
          headerTintColor: '#ffffff',
          headerStyle: { backgroundColor: '#0f0f0f' },
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerTintColor: '#ffffff',
          headerStyle: { backgroundColor: '#0f0f0f' },
        }}
      />
    </Stack>
    </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
