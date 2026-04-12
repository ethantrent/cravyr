import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import * as Location from 'expo-location';

export default function LocationPromptScreen() {
  const [requesting, setRequesting] = useState(false);

  async function handleAllowLocation() {
    setRequesting(true);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      router.push('/onboarding/cuisines');
    } else {
      router.replace('/onboarding/location-denied');
    }
    setRequesting(false);
  }

  return (
    <View style={styles.container}>
      <Ionicons name="location" size={64} color="#f97316" style={styles.icon} />
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
    backgroundColor: '#0f0f0f',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  icon: {
    marginBottom: 24,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 28 * 1.2,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    color: '#ababab',
    textAlign: 'center',
    lineHeight: 16 * 1.5,
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
