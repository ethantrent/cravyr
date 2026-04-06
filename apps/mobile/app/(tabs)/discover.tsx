import { useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useSwipeDeckStore } from '../../stores/swipeDeckStore';
import { SwipeDeck } from '../../components/SwipeDeck/SwipeDeck';
import type { Restaurant } from '@cravyr/shared';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function DiscoverScreen() {
  const { setDeck, setLoading, setError, pushUndo, popUndo } = useSwipeDeckStore();

  const fetchDeck = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/api/v1/recommendations`, { headers });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data: Restaurant[] = await res.json();
      setDeck(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [setDeck, setLoading, setError]);

  useEffect(() => {
    fetchDeck();
  }, [fetchDeck]);

  const recordSwipe = async (
    restaurantId: string,
    direction: 'left' | 'right' | 'superlike'
  ) => {
    try {
      const headers = {
        ...(await getAuthHeader()),
        'Content-Type': 'application/json',
      };
      await fetch(`${API_URL}/api/v1/swipes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ restaurant_id: restaurantId, direction }),
      });
    } catch {
      // Non-fatal: swipe recording failure should not interrupt UX
    }
  };

  const handleSave = useCallback(
    async (restaurant: Restaurant) => {
      pushUndo(restaurant);
      await recordSwipe(restaurant.id, 'right');
    },
    [pushUndo]
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
      await recordSwipe(restaurant.id, 'superlike');
    },
    [pushUndo]
  );

  const handleUndo = useCallback(async () => {
    const restaurant = popUndo();
    if (!restaurant) return;
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
  }, [popUndo]);

  return (
    <SwipeDeck
      onSave={handleSave}
      onSkip={handleSkip}
      onSuperlike={handleSuperlike}
      onUndo={handleUndo}
      onRetry={fetchDeck}
    />
  );
}

export default DiscoverScreen;
