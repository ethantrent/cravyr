import { Stack, useSegments, useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { API_URL } from '../lib/api';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { ErrorBoundary } from '../components/ErrorBoundary';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { theme } from '../lib/theme';

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

const EAS_PROJECT_ID = 'e6d2a650-fd20-4092-a4a5-0f7a211e1e1a';

async function registerPushToken(session: Session) {
  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    if (existingStatus !== 'granted') return;

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: EAS_PROJECT_ID,
    });

    let timezone: string | undefined;
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      // Intl unavailable — server falls back to its default UTC send hour
    }

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
        timezone,
      }),
    });
  } catch {
    // Push registration is non-blocking — failure must not break the app
  }
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
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
    if (loading || !fontsLoaded) return;
    const root = segments[0] as string | undefined;
    const inOnboarding = root === 'onboarding';
    const inAuthCallback = root === 'auth-callback';

    if (!session && !inOnboarding && !inAuthCallback) {
      router.replace('/onboarding');
    }
  }, [session, loading, segments]);

  if (loading || !fontsLoaded) return null;

  return (
    <ErrorBoundary>
    <GestureHandlerRootView style={{ flex: 1 }}>
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="auth-callback" options={{ headerShown: false, title: '' }} />
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
          headerTintColor: theme.colors.ink,
          headerStyle: { backgroundColor: theme.colors.canvas },
          headerTitleStyle: theme.typography.titleSm,
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerTintColor: theme.colors.ink,
          headerStyle: { backgroundColor: theme.colors.canvas },
          headerTitleStyle: theme.typography.titleSm,
        }}
      />
    </Stack>
    </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
