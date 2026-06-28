import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { SavedRestaurant } from '@cravyr/shared';
import { photoProxyUrl } from '../../lib/api';
import { theme } from '../../lib/theme';

interface RestaurantRowProps {
  pick: SavedRestaurant;
}

export function RestaurantRow({ pick }: RestaurantRowProps) {
  const router = useRouter();
  const { restaurant, interaction_type } = pick;
  const photoUrl = photoProxyUrl(restaurant.photo_urls[0], 200);
  const cuisine = restaurant.primary_cuisine ?? restaurant.cuisines[0] ?? 'Restaurant';
  const distance = restaurant.distance_km;

  return (
    <Pressable
      style={styles.row}
      onPress={() => router.push(`/restaurant/${restaurant.id}`)}
      accessibilityLabel={`${restaurant.name}, ${cuisine}, ${distance} km away`}
    >
      {/* Thumbnail with optional superlike badge */}
      <View style={styles.thumbnailContainer}>
        <Image
          source={{ uri: photoUrl }}
          style={styles.thumbnail}
          contentFit="cover"
        />
        {interaction_type === 'superlike' && (
          <View
            style={styles.superlikeBadge}
            accessibilityLabel="Superliked"
          >
            <Ionicons name="star" size={13} color={theme.colors.onPrimary} />
          </View>
        )}
      </View>

      {/* Info column */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {restaurant.name}
        </Text>
        <Text style={styles.meta}>
          {cuisine} · {distance < 0.1 ? '< 0.1' : distance} km
        </Text>
      </View>

      {/* Row chevron */}
      <Ionicons name="chevron-forward" size={16} color={theme.colors.mutedSoft} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 80,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: 12,
    backgroundColor: theme.colors.canvas,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.hairline,
  },
  thumbnailContainer: {
    position: 'relative',
    marginRight: 12,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: theme.rounded.xs,
  },
  superlikeBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: theme.rounded.full,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.canvas,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  name: {
    ...theme.typography.titleMd,
    color: theme.colors.ink,
  },
  meta: {
    ...theme.typography.bodySm,
    color: theme.colors.muted,
  },
});
