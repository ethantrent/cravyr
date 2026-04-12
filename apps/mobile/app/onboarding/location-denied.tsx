import { StyleSheet, View, Text, TouchableOpacity, Linking, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import * as Location from 'expo-location';

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
      <Ionicons name="location-outline" size={64} color="#ababab" style={styles.icon} />
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
    backgroundColor: '#0f0f0f',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  icon: {
    marginBottom: 24,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22 * 1.2,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    color: '#ababab',
    textAlign: 'center',
    lineHeight: 16 * 1.5,
    marginBottom: 8,
  },
  instruction: {
    fontSize: 13,
    fontWeight: '400',
    color: '#ababab',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#f97316',
    borderRadius: 12,
    height: 56,
    width: '100%',
    marginTop: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});
