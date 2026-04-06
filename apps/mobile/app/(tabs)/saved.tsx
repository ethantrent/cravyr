import { useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { usePicksStore } from '../../stores/picksStore';
import { RestaurantRow } from '../../components/RestaurantRow/RestaurantRow';
import type { SavedRestaurant } from '@cravyr/shared';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function DeleteAction({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.deleteButton} onPress={onPress} accessibilityLabel="Delete pick">
      <Ionicons name="trash" size={22} color="#ffffff" />
    </Pressable>
  );
}

function SkeletonRow() {
  return (
    <View style={[styles.row, { opacity: 0.4 }]}>
      <View style={styles.skeletonThumbnail} />
      <View style={styles.skeletonInfo}>
        <View style={styles.skeletonNameBar} />
        <View style={styles.skeletonMetaBar} />
      </View>
    </View>
  );
}

export function SavedScreen() {
  const { picks, isLoading, setPicks, removePick, setLoading } = usePicksStore();

  const fetchPicks = useCallback(async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) return;

      const { data, error } = await supabase
        .from('saves')
        .select(`
          id,
          interaction_type,
          saved_at,
          restaurants (
            id, name, photo_urls, cuisines, price_level,
            location, distance_km
          )
        `)
        .eq('user_id', userId)
        .order('saved_at', { ascending: false });

      if (error) throw error;

      // Map Supabase response to SavedRestaurant shape
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: SavedRestaurant[] = (data ?? []).map((row: any) => ({
        id: row.id,
        user_id: userId,
        restaurant_id: row.restaurants.id,
        interaction_type: row.interaction_type,
        saved_at: row.saved_at,
        restaurant: {
          ...row.restaurants,
          primary_cuisine: row.restaurants.cuisines?.[0] ?? 'Restaurant',
          price_level_display: (['•', '••', '$$$', '$$$$'] as const)[
            (row.restaurants.price_level ?? 1) - 1
          ],
          distance_km: row.restaurants.distance_km ?? 0,
          rating: row.restaurants.rating ?? 0,
          review_count: row.restaurants.review_count ?? 0,
          hours: row.restaurants.hours ?? null,
          photo_urls: row.restaurants.photo_urls ?? [],
          cached_at: row.restaurants.cached_at ?? '',
          address: row.restaurants.address ?? '',
          city: row.restaurants.city ?? '',
          state: row.restaurants.state ?? '',
          external_id: row.restaurants.external_id ?? '',
        },
      }));
      setPicks(mapped);
    } catch {
      // Silent failure — empty list is acceptable fallback
    } finally {
      setLoading(false);
    }
  }, [setPicks, setLoading]);

  useEffect(() => {
    fetchPicks();
  }, [fetchPicks]);

  const handleDelete = useCallback(
    async (saveId: string) => {
      // Optimistic: remove from store immediately (D-07: no confirmation dialog)
      removePick(saveId);
      try {
        const headers = await getAuthHeader();
        await fetch(`${API_URL}/api/v1/saves/${saveId}`, {
          method: 'DELETE',
          headers,
        });
      } catch {
        // Non-fatal — the item was already removed from UI
        // On next load, the item will reappear if the DELETE failed
      }
    },
    [removePick]
  );

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </View>
    );
  }

  if (picks.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="bookmark-outline" size={64} color="#2c2c2e" />
        <Text style={styles.emptyHeading}>No picks yet.</Text>
        <Text style={styles.emptyBody}>
          Swipe right on restaurants to save them.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList<SavedRestaurant>
        data={picks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ReanimatedSwipeable
            friction={2}
            overshootRight={false}
            rightThreshold={40}
            renderRightActions={() => (
              <DeleteAction onPress={() => handleDelete(item.id)} />
            )}
          >
            <RestaurantRow pick={item} />
          </ReanimatedSwipeable>
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

export default SavedScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  listContent: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyHeading: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '400',
    marginTop: 16,
  },
  emptyBody: {
    color: '#636366',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 4,
  },
  deleteButton: {
    width: 80,
    height: 80,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 80,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1c1c1e',
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c2e',
  },
  skeletonThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#2c2c2e',
    marginRight: 12,
  },
  skeletonInfo: {
    flex: 1,
    gap: 8,
  },
  skeletonNameBar: {
    width: 120,
    height: 16,
    backgroundColor: '#2c2c2e',
    borderRadius: 4,
  },
  skeletonMetaBar: {
    width: 80,
    height: 13,
    backgroundColor: '#2c2c2e',
    borderRadius: 4,
  },
});
