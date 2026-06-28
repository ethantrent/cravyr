import { StyleSheet, View, Text, TouchableOpacity, Linking, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import * as Location from 'expo-location';
import { theme } from '../../lib/theme';

export default function LocationDeniedScreen() {
  // Re-check permission when user returns from Settings
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active') {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          router.replace('/onboarding/cuisines');
        }
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <View style={styles.container}>
      <Ionicons name="location-outline" size={64} color={theme.colors.muted} style={styles.icon} />
      <Text style={styles.heading}>Location access required</Text>
      <Text style={styles.body}>
        To find restaurants near you, allow location access in your device Settings.
      </Text>
      <Text style={styles.instruction}>
        Settings {'>'} Privacy {'>'} Location Services {'>'} Cravyr {'>'} While Using
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => Linking.openSettings()}
        accessibilityRole="button"
        accessibilityLabel="Open device settings"
      >
        <Text style={styles.buttonLabel}>Open Settings</Text>
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
    marginBottom: 8,
  },
  instruction: {
    ...theme.typography.caption,
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
});
