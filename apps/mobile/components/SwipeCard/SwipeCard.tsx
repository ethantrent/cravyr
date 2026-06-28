import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { Restaurant } from '@cravyr/shared';
import { useRouter } from 'expo-router';
import { photoProxyUrl } from '../../lib/api';
import { theme } from '../../lib/theme';

interface SwipeCardProps {
  restaurant: Restaurant;
}

export function SwipeCard({ restaurant }: SwipeCardProps) {
  const router = useRouter();
  const photoUrl = photoProxyUrl(restaurant.photo_urls[0]);

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/restaurant/${restaurant.id}`)}
      accessibilityLabel={`${restaurant.name}, ${restaurant.primary_cuisine}, ${restaurant.distance_km} km away`}
    >
      <Image
        source={{ uri: photoUrl }}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        placeholder={{ thumbhash: restaurant.photo_blurhash }}
        transition={200}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        style={styles.gradient}
      >
        <Text style={styles.name} numberOfLines={2}>
          {restaurant.name}
        </Text>
        <Text style={styles.meta}>
          {restaurant.price_level_display} · {restaurant.primary_cuisine} ·{' '}
          {restaurant.distance_km < 0.1
            ? '< 0.1 km away'
            : `${restaurant.distance_km} km away`}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: theme.rounded.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.canvas,
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
    padding: 16,
    justifyContent: 'flex-end',
  },
  name: {
    ...theme.typography.displayLg,
    color: theme.colors.onDark,
    marginBottom: 4,
  },
  meta: {
    ...theme.typography.bodyMd,
    color: 'rgba(255,255,255,0.85)',
  },
});
