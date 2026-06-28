import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { useSwipeDeckStore } from '../../stores/swipeDeckStore';
import { usePicksStore } from '../../stores/picksStore';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { SwipeDeck } from '../../components/SwipeDeck/SwipeDeck';
import { MatchModal } from '../../components/MatchModal';
import { API_URL, getAuthHeader } from '../../lib/api';
import { theme } from '../../lib/theme';
import type { Restaurant, SavedRestaurant } from '@cravyr/shared';
import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Build a transient pick so a saved restaurant shows up immediately. The
// authoritative record (with the real saves.id) replaces it when the Tonight's
// Picks tab refetches on focus.
function optimisticPickId(restaurantId: string): string {
  return `optimistic-${restaurantId}`;
}

function buildOptimisticPick(
  restaurant: Restaurant,
  interaction: 'right' | 'superlike'
): SavedRestaurant {
  return {
    id: optimisticPickId(restaurant.id),
    user_id: '',
    restaurant_id: restaurant.id,
    interaction_type: interaction,
    saved_at: new Date().toISOString(),
    restaurant,
  };
}

export function DiscoverScreen() {
  const [matchData, setMatchData] = useState<{ restaurant: Restaurant, matchNames: string[] } | null>(null);
  const { setDeck, setLoading, setError, pushUndo, popUndo } = useSwipeDeckStore();
  const { addPick, removePick } = usePicksStore();
  const { preferencesVersion, travelLocation } = usePreferencesStore();
  const lastFetchedVersion = useRef<number | null>(null);

  const fetchDeck = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      let latitude: number;
      let longitude: number;

      if (travelLocation) {
        latitude = travelLocation.lat;
        longitude = travelLocation.lng;
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError(true);
          return;
        }

        let position = await Location.getLastKnownPositionAsync();
        if (!position) {
          position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low,
          });
        }
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      }

      const headers = await getAuthHeader();

      // Warm the geo-cache so restaurants exist in the DB before querying recs
      const nearbyRes = await fetch(
        `${API_URL}/api/v1/restaurants/nearby?lat=${latitude}&lng=${longitude}`,
        { headers },
      );
      if (nearbyRes.ok) await nearbyRes.json();

      const res = await fetch(
        `${API_URL}/api/v1/recommendations?lat=${latitude}&lng=${longitude}`,
        { headers },
      );
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data: Restaurant[] = await res.json();
      setDeck(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [setDeck, setLoading, setError, travelLocation]);

  // Fetch on first focus, then again only when preferences change — keeps Places
  // API usage down while ensuring an edited filter set reloads the deck.
  useFocusEffect(
    useCallback(() => {
      if (lastFetchedVersion.current !== preferencesVersion) {
        lastFetchedVersion.current = preferencesVersion;
        fetchDeck();
      }
    }, [preferencesVersion, fetchDeck])
  );

  const recordSwipe = async (
    restaurantId: string,
    direction: 'left' | 'right' | 'superlike'
  ) => {
    try {
      const headers = {
        ...(await getAuthHeader()),
        'Content-Type': 'application/json',
      };
      const res = await fetch(`${API_URL}/api/v1/swipes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ restaurant_id: restaurantId, direction }),
      });
      const data = await res.json();
      if (data.matches && data.matches.length > 0) {
        // Find the restaurant from the deck or undo stack (since it was just swiped)
        const matched = useSwipeDeckStore.getState().deck.find(r => r.id === restaurantId) || useSwipeDeckStore.getState().undoStack[0];
        if (matched) {
          setMatchData({ restaurant: matched, matchNames: data.matches });
        }
      }
    } catch {
      // Non-fatal: swipe recording failure should not interrupt UX
    }
  };

  const handleSave = useCallback(
    async (restaurant: Restaurant) => {
      pushUndo(restaurant);
      addPick(buildOptimisticPick(restaurant, 'right'));
      await recordSwipe(restaurant.id, 'right');
    },
    [pushUndo, addPick]
  );

  const handleSkip = useCallback(
    async (restaurant: Restaurant) => {
      pushUndo(restaurant);
      await recordSwipe(restaurant.id, 'left');
    },
    [pushUndo]
  );

  const handleSuperlike = useCallback(
    async (restaurant: Restaurant) => {
      pushUndo(restaurant);
      addPick(buildOptimisticPick(restaurant, 'superlike'));
      await recordSwipe(restaurant.id, 'superlike');
    },
    [pushUndo, addPick]
  );

  const handleUndo = useCallback(async () => {
    const restaurant = popUndo();
    if (!restaurant) return;
    // Roll back the optimistic pick (no-op for skips, which never added one)
    removePick(optimisticPickId(restaurant.id));
    // Per Pitfall 5 in RESEARCH.md: delete the swipe record so recommendation engine re-includes it
    try {
      const headers = await getAuthHeader();
      await fetch(`${API_URL}/api/v1/swipes/${restaurant.id}`, {
        method: 'DELETE',
        headers,
      });
    } catch {
      // Non-fatal
    }
  }, [popUndo, removePick]);

  return (
    <View style={styles.container}>
      {travelLocation && (
        <View style={styles.travelBanner}>
          <Text style={styles.travelText}>Traveling in {travelLocation.name}</Text>
        </View>
      )}
      <SwipeDeck
        onSave={handleSave}
        onSkip={handleSkip}
        onSuperlike={handleSuperlike}
        onUndo={handleUndo}
        onRetry={fetchDeck}
      />
      <MatchModal
        visible={matchData !== null}
        restaurant={matchData?.restaurant || null}
        matchNames={matchData?.matchNames || []}
        onClose={() => setMatchData(null)}
      />
    </View>
  );
}

export default DiscoverScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  travelBanner: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  travelText: {
    ...theme.typography.caption,
    color: theme.colors.onPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
