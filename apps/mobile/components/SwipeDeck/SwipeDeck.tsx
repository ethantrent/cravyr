import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Swiper, type SwiperCardRefType } from 'rn-swiper-list';
import { useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import type { Restaurant } from '@cravyr/shared';
import { SwipeCard } from '../SwipeCard/SwipeCard';
import { SaveLabel, SkipLabel, SuperlikeLabel } from '../SwipeCard/OverlayLabels';
import { CardSkeleton } from '../SwipeCard/CardSkeleton';
import { useSwipeDeckStore } from '../../stores/swipeDeckStore';

interface SwipeDeckProps {
  onSave: (restaurant: Restaurant) => void;
  onSkip: (restaurant: Restaurant) => void;
  onSuperlike: (restaurant: Restaurant) => void;
  onUndo: () => void;
  onRetry: () => void;
}

export function SwipeDeck({ onSave, onSkip, onSuperlike, onUndo, onRetry }: SwipeDeckProps) {
  const swiperRef = useRef<SwiperCardRefType>(null);
  const router = useRouter();
  const { deck, undoStack, isLoading, hasError, isDeckEmpty } = useSwipeDeckStore();

  // Prefetch next 2-3 images when index changes
  const handleIndexChange = (index: number) => {
    const upcomingUrls = deck
      .slice(index + 1, index + 4)
      .map((r) => r.photo_urls[0])
      .filter((url): url is string => Boolean(url));
    if (upcomingUrls.length > 0) {
      Image.prefetch(upcomingUrls, 'memory-disk');
    }
  };

  const handleSwipeRight = (index: number) => {
    onSave(deck[index]);
  };

  const handleSwipeLeft = (index: number) => {
    onSkip(deck[index]);
  };

  const handleSwipeTop = (index: number) => {
    onSuperlike(deck[index]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    swiperRef.current?.swipeBack();
    onUndo();
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <CardSkeleton />
      </View>
    );
  }

  if (hasError) {
    return (
      <View style={styles.centered}>
        <Ionicons name="cloud-offline-outline" size={64} color="#2c2c2e" />
        <Text style={styles.emptyHeading}>Couldn't load restaurants</Text>
        <Text style={styles.emptyBody}>Check your connection and try again.</Text>
        <Pressable style={styles.ctaButton} onPress={onRetry}>
          <Text style={styles.ctaText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  if (isDeckEmpty) {
    return (
      <View style={styles.centered}>
        <Ionicons name="restaurant-outline" size={64} color="#2c2c2e" />
        <Text style={styles.emptyHeading}>You've seen everything nearby</Text>
        <Text style={styles.emptyBody}>
          Adjust your preferences to discover more restaurants.
        </Text>
        <Pressable
          style={styles.ctaButton}
          onPress={() => router.push('/preferences')}
        >
          <Text style={styles.ctaText}>Go to Preferences</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Undo button — top-right, disabled when undoStack is empty */}
      <Pressable
        style={[styles.undoButton, undoStack.length === 0 && styles.disabled]}
        onPress={handleUndo}
        accessibilityLabel="Undo last swipe"
        disabled={undoStack.length === 0}
      >
        <Ionicons name="arrow-undo" size={22} color="#ababab" />
      </Pressable>

      {/* Card deck */}
      <View style={styles.deckArea}>
        <Swiper
          ref={swiperRef}
          data={deck}
          renderCard={(restaurant: Restaurant) => <SwipeCard restaurant={restaurant} />}
          prerenderItems={7}
          onSwipeRight={handleSwipeRight}
          onSwipeLeft={handleSwipeLeft}
          onSwipeTop={handleSwipeTop}
          onIndexChange={handleIndexChange}
          OverlayLabelRight={() => <SaveLabel />}
          OverlayLabelLeft={() => <SkipLabel />}
          OverlayLabelTop={() => <SuperlikeLabel />}
          disableBottomSwipe
          swipeRightSpringConfig={{ damping: 18, stiffness: 120, mass: 1 }}
          swipeLeftSpringConfig={{ damping: 18, stiffness: 120, mass: 1 }}
          swipeTopSpringConfig={{ damping: 18, stiffness: 120, mass: 1 }}
        />
      </View>

      {/* Action buttons: X (Skip), Heart (Save), Star (Superlike) per D-03 */}
      <View style={styles.actionRow}>
        <Pressable
          style={styles.actionButton}
          onPress={() => swiperRef.current?.swipeLeft()}
          accessibilityLabel="Skip restaurant"
        >
          <Ionicons name="close" size={28} color="#ef4444" />
        </Pressable>
        <Pressable
          style={styles.actionButton}
          onPress={() => swiperRef.current?.swipeRight()}
          accessibilityLabel="Save restaurant"
        >
          <Ionicons name="heart" size={28} color="#22c55e" />
        </Pressable>
        <Pressable
          style={styles.actionButton}
          onPress={() => swiperRef.current?.swipeTop()}
          accessibilityLabel="Superlike restaurant"
        >
          <Ionicons name="star" size={28} color="#eab308" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  deckArea: {
    flex: 1,
    marginBottom: 32,
  },
  undoButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  disabled: {
    opacity: 0.4,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    marginBottom: 24,
  },
  actionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1c1c1e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f0f0f',
    paddingHorizontal: 32,
  },
  emptyHeading: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 22 * 1.3,
    marginTop: 24,
  },
  emptyBody: {
    color: '#ababab',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 16 * 1.5,
    marginTop: 8,
  },
  ctaButton: {
    backgroundColor: '#f97316',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginTop: 32,
  },
  ctaText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});
