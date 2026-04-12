import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      SplashScreen.hideAsync();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Keep splash screen showing until session check resolves
  if (loading) return null;

  return (
    <Stack>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
      </Stack.Protected>

      <Stack.Protected guard={!session}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
