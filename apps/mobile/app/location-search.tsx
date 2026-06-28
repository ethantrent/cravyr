import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { API_URL, getAuthHeader } from '../lib/api';
import { theme } from '../lib/theme';
import { usePreferencesStore } from '../stores/preferencesStore';

interface PlacePrediction {
  placeId: string;
  description: string;
}

export default function LocationSearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  
  const { setTravelLocation, bumpPreferencesVersion, travelLocation } = usePreferencesStore();

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const headers = await getAuthHeader();
        const res = await fetch(`${API_URL}/api/v1/places/autocomplete?q=${encodeURIComponent(query)}`, { headers });
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch (err) {
        // ignore
      } finally {
        setIsLoading(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectPlace = async (place: PlacePrediction) => {
    setIsGeocoding(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/api/v1/places/geocode?placeId=${encodeURIComponent(place.placeId)}`, { headers });
      if (res.ok) {
        const { lat, lng } = await res.json();
        // Update travel location and trigger deck refresh
        setTravelLocation({ lat, lng, name: place.description.split(',')[0] });
        bumpPreferencesVersion();
        router.back();
      }
    } catch (err) {
      // ignore
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleClearLocation = () => {
    setTravelLocation(null);
    bumpPreferencesVersion();
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={theme.colors.muted} />
        <TextInput
          style={styles.input}
          placeholder="Search for a city..."
          placeholderTextColor={theme.colors.mutedSoft}
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
        {isLoading && <ActivityIndicator size="small" color={theme.colors.primary} />}
      </View>

      {travelLocation && !query && (
        <Pressable style={styles.clearRow} onPress={handleClearLocation}>
          <Ionicons name="location-outline" size={20} color={theme.colors.primary} />
          <Text style={styles.clearText}>Use Current Location</Text>
        </Pressable>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.placeId}
        renderItem={({ item }) => (
          <Pressable
            style={styles.resultRow}
            onPress={() => handleSelectPlace(item)}
            disabled={isGeocoding}
          >
            <Ionicons name="airplane-outline" size={20} color={theme.colors.muted} />
            <Text style={styles.resultText} numberOfLines={1}>
              {item.description}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={() => (
          query && !isLoading ? (
            <Text style={styles.emptyText}>No cities found.</Text>
          ) : null
        )}
      />

      {isGeocoding && (
        <View style={styles.geocodingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.canvas,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSoft,
    margin: 16,
    paddingHorizontal: 12,
    height: 48,
    borderRadius: theme.rounded.md,
    borderWidth: 1,
    borderColor: theme.colors.hairline,
  },
  input: {
    flex: 1,
    ...theme.typography.bodyMd,
    color: theme.colors.ink,
    marginLeft: 8,
  },
  clearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.hairline,
  },
  clearText: {
    ...theme.typography.bodyMd,
    color: theme.colors.primary,
    marginLeft: 12,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.hairline,
  },
  resultText: {
    ...theme.typography.bodyMd,
    color: theme.colors.ink,
    marginLeft: 12,
    flex: 1,
  },
  emptyText: {
    ...theme.typography.bodyMd,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: 32,
  },
  geocodingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
