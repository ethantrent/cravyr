import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { SavedRestaurant } from '@cravyr/shared';

interface RestaurantRowProps {
  pick: SavedRestaurant;
}

export function RestaurantRow({ pick }: RestaurantRowProps) {
  const router = useRouter();
  const { restaurant, interaction_type } = pick;
  const photoUrl = restaurant.photo_urls[0];
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
            <Ionicons name="star" size={13} color="#ffffff" />
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
      <Ionicons name="chevron-forward" size={16} color="#636366" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  thumbnailContainer: {
    position: 'relative',
    marginRight: 12,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  superlikeBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#eab308',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 16 * 1.3,
  },
  meta: {
    color: '#ababab',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 13 * 1.3,
  },
});
