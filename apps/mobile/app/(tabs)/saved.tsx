import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { usePicksStore } from '../../stores/picksStore';
import { useMatchesStore } from '../../stores/matchesStore';
import { useConnectionsStore } from '../../stores/connectionsStore';
import { RestaurantRow } from '../../components/RestaurantRow/RestaurantRow';
import { API_URL, getAuthHeader } from '../../lib/api';
import { theme } from '../../lib/theme';
import type { SavedRestaurant, Restaurant } from '@cravyr/shared';

function DeleteAction({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.deleteButton} onPress={onPress} accessibilityLabel="Delete pick">
      <Ionicons name="trash" size={22} color={theme.colors.onPrimary} />
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
  const [activeTab, setActiveTab] = useState<'picks' | 'matches'>('picks');
  const { picks, isLoading, setPicks, removePick, setLoading } = usePicksStore();
  const { matches, setMatches, isLoading: isLoadingMatches, setLoading: setLoadingMatches } = useMatchesStore();
  const { connections, selectedFriendIds, toggleFriendSelection, fetchConnections } = useConnectionsStore((state) => ({
    connections: state.connections,
    selectedFriendIds: state.selectedFriendIds,
    toggleFriendSelection: state.toggleFriendSelection,
    fetchConnections: async () => {
      try {
        const headers = await getAuthHeader();
        const res = await fetch(`${API_URL}/api/v1/connections`, { headers });
        if (res.ok) {
          const data = await res.json();
          state.setConnections(data);
        }
      } catch {}
    }
  }));

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

  const fetchMatches = useCallback(async () => {
    if (activeTab !== 'matches') return;
    if (selectedFriendIds.length === 0) {
      setMatches([]);
      return;
    }
    
    setLoadingMatches(true);
    try {
      const headers = await getAuthHeader();
      const params = new URLSearchParams({ friendIds: selectedFriendIds.join(',') });
      const res = await fetch(`${API_URL}/api/v1/matches?${params.toString()}`, { headers });
      const data = await res.json();
      if (res.ok) {
        setMatches(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingMatches(false);
    }
  }, [setMatches, setLoadingMatches, activeTab, selectedFriendIds]);

  // Refetch every time the tab regains focus so picks saved via swiping on the
  // Discover deck appear without needing an app restart.
  useFocusEffect(
    useCallback(() => {
      fetchPicks();
      fetchConnections();
    }, [fetchPicks, fetchConnections])
  );
  
  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

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

  const renderList = () => {
    if (activeTab === 'picks') {
      if (isLoading) {
        return (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        );
      }
      if (picks.length === 0) {
        return (
          <View style={styles.emptyContainer}>
            <Ionicons name="bookmark-outline" size={64} color={theme.colors.mutedSoft} />
            <Text style={styles.emptyHeading}>No picks yet.</Text>
            <Text style={styles.emptyBody}>Swipe right on restaurants to save them.</Text>
          </View>
        );
      }
      return (
        <FlatList<SavedRestaurant>
          data={picks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ReanimatedSwipeable
              friction={2}
              overshootRight={false}
              rightThreshold={40}
              renderRightActions={() => <DeleteAction onPress={() => handleDelete(item.id)} />}
            >
              <RestaurantRow pick={item} />
            </ReanimatedSwipeable>
          )}
          contentContainerStyle={styles.listContent}
        />
      );
    }

    // Matches tab
    if (connections.length === 0) {
       return (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color={theme.colors.mutedSoft} />
          <Text style={styles.emptyHeading}>No connections yet.</Text>
          <Text style={styles.emptyBody}>Add connections in Settings to see matches.</Text>
        </View>
      );
    }

    return (
      <View style={styles.matchesContainer}>
        <View style={styles.chipsContainer}>
          <Text style={styles.chipsLabel}>Finding matches with:</Text>
          <View style={styles.chipsScroll}>
            {connections.map((c) => {
              const isSelected = selectedFriendIds.includes(c.id);
              return (
                <Pressable
                  key={c.id}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => toggleFriendSelection(c.id)}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {isSelected ? '✓ ' : ''}{c.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        
        {selectedFriendIds.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color={theme.colors.mutedSoft} />
            <Text style={styles.emptyHeading}>Select friends above</Text>
            <Text style={styles.emptyBody}>Choose who you're going out with to find overlapping picks.</Text>
          </View>
        ) : isLoadingMatches ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : matches.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="heart-outline" size={64} color={theme.colors.mutedSoft} />
            <Text style={styles.emptyHeading}>No matches yet.</Text>
            <Text style={styles.emptyBody}>Keep swiping together to find a match!</Text>
          </View>
        ) : (
          <FlatList<Restaurant>
            data={matches}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <RestaurantRow pick={{ id: item.id, restaurant: item } as any} />
            )}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.segmentContainer}>
        <Pressable
          style={[styles.segment, activeTab === 'picks' && styles.segmentActive]}
          onPress={() => setActiveTab('picks')}
        >
          <Text style={[styles.segmentText, activeTab === 'picks' && styles.segmentTextActive]}>My Picks</Text>
        </Pressable>
        <Pressable
          style={[styles.segment, activeTab === 'matches' && styles.segmentActive]}
          onPress={() => setActiveTab('matches')}
        >
          <Text style={[styles.segmentText, activeTab === 'matches' && styles.segmentTextActive]}>Our Matches</Text>
        </Pressable>
      </View>
      {renderList()}
    </View>
  );
}

export default SavedScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.canvas,
  },
  segmentContainer: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: theme.colors.surfaceStrong,
    borderRadius: theme.rounded.md,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: theme.rounded.sm,
  },
  segmentActive: {
    backgroundColor: theme.colors.canvas,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    ...theme.typography.titleSm,
    color: theme.colors.muted,
  },
  segmentTextActive: {
    color: theme.colors.ink,
  },
  listContent: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: theme.colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyHeading: {
    ...theme.typography.titleMd,
    color: theme.colors.ink,
    marginTop: 16,
  },
  emptyBody: {
    ...theme.typography.bodyMd,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: 4,
  },
  deleteButton: {
    width: 80,
    height: 80,
    backgroundColor: theme.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 80,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.colors.canvas,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.hairline,
  },
  skeletonThumbnail: {
    width: 64,
    height: 64,
    borderRadius: theme.rounded.xs,
    backgroundColor: theme.colors.surfaceStrong,
    marginRight: 12,
  },
  skeletonInfo: {
    flex: 1,
    gap: 8,
  },
  skeletonNameBar: {
    width: 120,
    height: 16,
    backgroundColor: theme.colors.surfaceStrong,
    borderRadius: 4,
  },
  skeletonMetaBar: {
    width: 80,
    height: 13,
    backgroundColor: theme.colors.surfaceStrong,
    borderRadius: 4,
  },
  matchesContainer: {
    flex: 1,
  },
  chipsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.hairline,
  },
  chipsLabel: {
    ...theme.typography.caption,
    color: theme.colors.muted,
    marginBottom: 8,
  },
  chipsScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceStrong,
    borderWidth: 1,
    borderColor: theme.colors.hairline,
  },
  chipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    ...theme.typography.bodyMd,
    color: theme.colors.ink,
  },
  chipTextSelected: {
    color: theme.colors.onPrimary,
    fontWeight: '600',
  },
});
