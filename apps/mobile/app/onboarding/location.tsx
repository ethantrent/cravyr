import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import * as Location from 'expo-location';
import { theme } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { StepProgress } from '../../components/onboarding/StepProgress';

export default function LocationPromptScreen() {
  const [requesting, setRequesting] = useState(false);
  const { draftCuisines, draftPriceRange, draftMaxDistance } = usePreferencesStore();

  async function handleAllowLocation() {
    setRequesting(true);
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    // Save drafted preferences to Supabase now that the flow is complete
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from('user_preferences').upsert({
          user_id: session.user.id,
          cuisines: draftCuisines,
          price_range: draftPriceRange,
          max_distance_km: draftMaxDistance,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      }
    } catch (e) {
      console.error('Failed to save preferences:', e);
    }

    if (status === 'granted') {
      router.replace('/(tabs)/discover');
    } else {
      router.replace('/onboarding/location-denied');
    }
    setRequesting(false);
  }

  return (
    <View style={styles.container}>
      <StepProgress current={4} total={4} />
      <Ionicons name="location" size={80} color={theme.colors.primary} style={styles.icon} />
      <Text style={styles.heading}>Find restaurants near you</Text>
      <Text style={styles.body}>
        Cravyr uses your location to show restaurants nearby and how far away they are.
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={handleAllowLocation}
        disabled={requesting}
        accessibilityRole="button"
        accessibilityLabel="Allow location access"
      >
        {requesting ? (
          <ActivityIndicator size={16} color="#ffffff" />
        ) : (
          <Text style={styles.buttonLabel}>Allow Location</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.canvas,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  icon: {
    marginBottom: 24,
  },
  heading: {
    ...theme.typography.displayLg,
    color: theme.colors.ink,
    textAlign: 'center',
    marginBottom: 16,
  },
  body: {
    ...theme.typography.bodyMd,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.rounded.md,
    height: 56,
    width: '100%',
    marginTop: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonLabel: {
    ...theme.typography.buttonMd,
    color: theme.colors.onPrimary,
  },
  signInLink: {
    marginTop: 24,
    paddingVertical: 8,
  },
  signInText: {
    ...theme.typography.bodyMd,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  signInTextEmphasis: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
});
