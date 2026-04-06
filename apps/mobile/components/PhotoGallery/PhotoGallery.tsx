import { View, FlatList, Dimensions, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface PhotoGalleryProps {
  photoUrls: string[];
  height: number;
  blurhash?: string;
}

export function PhotoGallery({ photoUrls, height, blurhash }: PhotoGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = (event: { nativeEvent: { contentOffset: { x: number } } }) => {
    const index = Math.round(
      event.nativeEvent.contentOffset.x / SCREEN_WIDTH
    );
    setActiveIndex(index);
  };

  if (photoUrls.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.noPhotoFallback}>
          <Ionicons name="image-outline" size={32} color="#636366" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <FlatList
        data={photoUrls}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={SCREEN_WIDTH}
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyExtractor={(_, index) => String(index)}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={{ width: SCREEN_WIDTH, height }}
            contentFit="cover"
            placeholder={blurhash ? { thumbhash: blurhash } : undefined}
            transition={200}
          />
        )}
      />

      {/* Dot indicators — only shown when 2+ photos */}
      {photoUrls.length > 1 && (
        <View style={styles.dotsContainer}>
          {photoUrls.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    overflow: 'hidden',
    backgroundColor: '#1c1c1e',
  },
  noPhotoFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1c1c1e',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: '#ffffff',
  },
  dotInactive: {
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
});
