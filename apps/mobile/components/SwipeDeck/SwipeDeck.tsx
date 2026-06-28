import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Swiper, type SwiperCardRefType } from 'rn-swiper-list';
import { useRef, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import type { Restaurant } from '@cravyr/shared';
import { SwipeCard } from '../SwipeCard/SwipeCard';
import { SaveLabel, SkipLabel, SuperlikeLabel } from '../SwipeCard/OverlayLabels';
import { CardSkeleton } from '../SwipeCard/CardSkeleton';
import { useSwipeDeckStore } from '../../stores/swipeDeckStore';
import { photoProxyUrl } from '../../lib/api';
import { theme } from '../../lib/theme';

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
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const cardDimensions = useMemo(() => ({
    width: screenWidth - 32,
    // Reserve room for the tab header, action buttons, and tab bar
    height: screenHeight - 320,
  }), [screenWidth, screenHeight]);

  // Prefetch next 2-3 images when index changes
  const handleIndexChange = (index: number) => {
    const upcomingUrls = deck
      .slice(index + 1, index + 4)
      .map((r) => photoProxyUrl(r.photo_urls[0]))
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
        <Ionicons name="cloud-offline-outline" size={64} color={theme.colors.mutedSoft} />
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
        <Ionicons name="restaurant-outline" size={64} color={theme.colors.mutedSoft} />
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
        <Ionicons name="arrow-undo" size={22} color={theme.colors.ink} />
      </Pressable>

      {/* Card deck */}
      <View style={styles.deckArea}>
        <Swiper
          ref={swiperRef}
          data={deck}
          renderCard={(restaurant: Restaurant) => <SwipeCard restaurant={restaurant} />}
          cardStyle={cardDimensions}
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
          <Ionicons name="close" size={32} color={theme.colors.ink} />
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.actionButtonPrimary]}
          onPress={() => swiperRef.current?.swipeRight()}
          accessibilityLabel="Save restaurant"
        >
          <Ionicons name="heart" size={36} color={theme.colors.primary} />
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
    backgroundColor: theme.colors.canvas,
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
    width: 44,
    height: 44,
    borderRadius: theme.rounded.full,
    backgroundColor: theme.colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  disabled: {
    opacity: 0.4,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
    marginBottom: 24,
  },
  actionButton: {
    width: 64,
    height: 64,
    borderRadius: theme.rounded.full,
    backgroundColor: theme.colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  actionButtonPrimary: {
    width: 72,
    height: 72,
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.canvas,
    paddingHorizontal: 32,
  },
  emptyHeading: {
    ...theme.typography.displayMd,
    color: theme.colors.ink,
    textAlign: 'center',
    marginTop: 24,
  },
  emptyBody: {
    ...theme.typography.bodyMd,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: 8,
  },
  ctaButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.rounded.md,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginTop: 32,
  },
  ctaText: {
    ...theme.typography.buttonMd,
    color: theme.colors.onPrimary,
    textAlign: 'center',
  },
});
