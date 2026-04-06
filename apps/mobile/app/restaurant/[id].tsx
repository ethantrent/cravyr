import {
  View,
  Text,
  ScrollView,
  Pressable,
  Share,
  Linking,
  Platform,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { usePicksStore } from '../../stores/picksStore';
import { PhotoGallery } from '../../components/PhotoGallery/PhotoGallery';
import type { Restaurant } from '@cravyr/shared';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const HEADER_HEIGHT = SCREEN_HEIGHT * 0.4;
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const openDirections = async (lat: number, lng: number, name: string) => {
  const encodedName = encodeURIComponent(name);
  const url = Platform.select({
    ios: `https://maps.apple.com/?daddr=${lat},${lng}&q=${encodedName}`,
    android: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
  });
  if (url) {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) await Linking.openURL(url);
  }
};

export function RestaurantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { picks } = usePicksStore();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    // Sync saved state from picks store on mount and whenever picks change
    const saved = picks.some((p) => p.restaurant.id === id);
    setIsSaved(saved);
  }, [id, picks]);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/api/v1/restaurants/${id}`, { headers });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data: Restaurant = await res.json();
      setRestaurant(data);
    } catch {
      // Stay on screen with loading state resolved; null restaurant triggers error UI
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleShare = async () => {
    if (!restaurant) return;
    try {
      await Share.share({
        message: `Check out ${restaurant.name} on Cravyr!`,
        title: restaurant.name,
      });
    } catch {
      // User dismissed share sheet — non-fatal
    }
  };

  const handleSaveToggle = async () => {
    if (!restaurant) return;
    // Optimistic toggle — capture current state before flipping
    const wasSaved = isSaved;
    setIsSaved(!wasSaved);
    const headers = {
      ...(await getAuthHeader()),
      'Content-Type': 'application/json',
    };
    if (!wasSaved) {
      // Add to saves
      try {
        await fetch(`${API_URL}/api/v1/saves`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ restaurant_id: restaurant.id, interaction_type: 'right' }),
        });
      } catch {
        setIsSaved(wasSaved); // revert on failure
      }
    } else {
      // Remove from saves — find the save record in picks store
      const pick = picks.find((p) => p.restaurant.id === restaurant.id);
      if (pick) {
        try {
          await fetch(`${API_URL}/api/v1/saves/${pick.id}`, { method: 'DELETE', headers });
        } catch {
          setIsSaved(wasSaved); // revert on failure
        }
      }
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Ionicons name="restaurant-outline" size={40} color="#2c2c2e" />
      </View>
    );
  }

  if (!restaurant) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Ionicons name="cloud-offline-outline" size={40} color="#2c2c2e" />
        <Text style={styles.errorText}>Couldn't load restaurant</Text>
        <Pressable onPress={fetchDetail} style={{ marginTop: 16 }}>
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const isOpen = restaurant.hours?.open_now;
  const priceDisplay = restaurant.price_level_display;
  const ratingDisplay = restaurant.rating ? restaurant.rating.toFixed(1) : null;

  return (
    <View style={styles.screen}>
      {/* Photo gallery header — 40% screen height per D-09 */}
      <View style={{ height: HEADER_HEIGHT }}>
        <PhotoGallery
          photoUrls={restaurant.photo_urls.slice(0, 5)}
          height={HEADER_HEIGHT}
          blurhash={restaurant.photo_blurhash}
        />
        {/* Back button — absolute top-left, safe-area inset aware */}
        <Pressable
          style={[styles.backButton, { top: insets.top + 8 }]}
          onPress={() => router.back()}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color="#ffffff" />
        </Pressable>
      </View>

      {/* Info sheet — scrollable below photo header */}
      <ScrollView
        style={styles.infoSheet}
        contentContainerStyle={styles.infoContent}
      >
        {/* Restaurant name */}
        <Text style={styles.heading}>{restaurant.name}</Text>

        {/* Rating row: star + rating + review_count + price + cuisine */}
        <View style={styles.ratingRow}>
          {ratingDisplay && (
            <>
              <Ionicons name="star" size={14} color="#eab308" />
              <Text style={styles.ratingText}>{ratingDisplay}</Text>
              <Text style={styles.reviewCount}>
                {' '}({restaurant.review_count})
              </Text>
            </>
          )}
          <Text style={styles.ratingMeta}>
            {[priceDisplay, restaurant.primary_cuisine].filter(Boolean).join(' · ')}
          </Text>
        </View>

        {/* Action bar: Directions, Call (conditional), Share, Save toggle */}
        <View style={styles.actionBar}>
          <Pressable
            style={styles.actionBarButton}
            onPress={() =>
              openDirections(
                restaurant.location.lat,
                restaurant.location.lng,
                restaurant.name
              )
            }
            accessibilityLabel="Get directions"
          >
            <Ionicons name="navigate" size={22} color="#f97316" />
            <Text style={styles.actionBarLabel}>Directions</Text>
          </Pressable>

          {/* Call button — hidden when phone_number is absent per UI-SPEC */}
          {restaurant.phone_number && (
            <Pressable
              style={styles.actionBarButton}
              onPress={() => Linking.openURL(`tel:${restaurant.phone_number}`)}
              accessibilityLabel="Call restaurant"
            >
              <Ionicons name="call" size={22} color="#ababab" />
              <Text style={styles.actionBarLabel}>Call</Text>
            </Pressable>
          )}

          <Pressable
            style={styles.actionBarButton}
            onPress={handleShare}
            accessibilityLabel="Share restaurant"
          >
            <Ionicons name="share-social-outline" size={22} color="#ababab" />
            <Text style={styles.actionBarLabel}>Share</Text>
          </Pressable>

          <Pressable
            style={styles.actionBarButton}
            onPress={handleSaveToggle}
            accessibilityLabel={isSaved ? 'Remove from picks' : 'Add to picks'}
          >
            <Ionicons
              name={isSaved ? 'heart' : 'heart-outline'}
              size={22}
              color={isSaved ? '#eab308' : '#ababab'}
            />
            <Text style={styles.actionBarLabel}>
              {isSaved ? 'Saved' : 'Add to Picks'}
            </Text>
          </Pressable>
        </View>

        {/* Address */}
        <Text style={styles.sectionLabel}>ADDRESS</Text>
        <View style={styles.inlineRow}>
          <Ionicons name="location-outline" size={16} color="#ababab" />
          <Text style={styles.body}> {restaurant.address}</Text>
        </View>

        {/* Opening hours */}
        {restaurant.hours && (
          <>
            <Text style={styles.sectionLabel}>OPENING HOURS</Text>
            <Text
              style={[
                styles.body,
                { color: isOpen ? '#22c55e' : '#ef4444', fontWeight: '700', marginBottom: 4 },
              ]}
            >
              {isOpen ? 'Open now' : 'Closed'}
            </Text>
            {restaurant.hours.weekday_text?.map((line, i) => (
              <Text key={i} style={styles.body}>
                {line}
              </Text>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

export default RestaurantDetailScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(28,28,30,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoSheet: {
    flex: 1,
    backgroundColor: '#1c1c1e',
  },
  infoContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 48,
  },
  heading: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 22 * 1.2,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 4,
  },
  ratingText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '400',
  },
  reviewCount: {
    color: '#ababab',
    fontSize: 13,
    fontWeight: '400',
  },
  ratingMeta: {
    color: '#ababab',
    fontSize: 16,
    fontWeight: '400',
  },
  actionBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  actionBarButton: {
    flex: 1,
    height: 48,
    backgroundColor: '#2c2c2e',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionBarLabel: {
    color: '#ababab',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 13,
  },
  sectionLabel: {
    color: '#ababab',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 13 * 1.2,
    marginTop: 24,
    marginBottom: 8,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  body: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 16 * 1.5,
  },
  errorText: {
    color: '#ababab',
    marginTop: 16,
    fontSize: 16,
  },
  retryText: {
    color: '#f97316',
    fontSize: 16,
  },
});
