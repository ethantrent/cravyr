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
            id, external_id, name, photo_urls, cuisines, price_level,
            rating, review_count, phone_number, hours,
            lat, lng, address, city, state, cached_at
          )
        `)
        .eq('user_id', userId)
        .order('saved_at', { ascending: false });

      if (error) throw error;

      const PRICE_DISPLAY = ['$', '$$', '$$$', '$$$$'] as const;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: SavedRestaurant[] = (data ?? []).map((row: any) => {
        const r = row.restaurants;
        const cuisines = r.cuisines ?? [];
        const pl = (r.price_level ?? 1) as 1 | 2 | 3 | 4;
        return {
          id: row.id,
          user_id: userId,
          restaurant_id: r.id,
          interaction_type: row.interaction_type,
          saved_at: row.saved_at,
          restaurant: {
            id: r.id,
            external_id: r.external_id ?? '',
            name: r.name,
            location: { lat: r.lat ?? 0, lng: r.lng ?? 0 },
            address: r.address ?? '',
            city: r.city ?? '',
            state: r.state ?? '',
            photo_urls: r.photo_urls ?? [],
            cuisines,
            primary_cuisine: cuisines[0] ?? 'Restaurant',
            price_level: pl,
            price_level_display: PRICE_DISPLAY[pl - 1] ?? '$',
            rating: r.rating ?? 0,
            review_count: r.review_count ?? 0,
            phone_number: r.phone_number ?? undefined,
            hours: r.hours ?? null,
            distance_km: 0,
            cached_at: r.cached_at ?? '',
          },
        };
      });
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
