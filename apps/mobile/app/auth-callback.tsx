import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

function firstParam(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Handles email confirmation deep links from the API redirect page:
 * cravyr://auth-callback?access_token=...&refresh_token=...
 */
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{
    access_token?: string | string[];
    refresh_token?: string | string[];
  }>();
  const router = useRouter();
  const [message, setMessage] = useState('Signing you in…');

  useEffect(() => {
    const access_token = firstParam(params.access_token);
    const refresh_token = firstParam(params.refresh_token);

    if (!access_token || !refresh_token) {
      setMessage('This sign-in link is missing tokens. Request a new email from the app.');
      return;
    }

    let cancelled = false;
    void (async () => {
      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (cancelled) return;
      if (error) {
        setMessage(error.message);
        return;
      }
      router.replace('/(tabs)/discover');
    })();

    return () => {
      cancelled = true;
    };
  }, [params.access_token, params.refresh_token, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#f97316" />
      <Text style={styles.text}>{message}</Text>
      <Pressable style={styles.button} onPress={() => router.replace('/onboarding')}>
        <Text style={styles.buttonText}>Back to sign in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#0f0f0f',
  },
  text: {
    marginTop: 16,
    color: '#e5e5e5',
    textAlign: 'center',
    fontSize: 16,
  },
  button: {
    marginTop: 32,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#f97316',
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
