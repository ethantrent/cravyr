import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';

export function CardSkeleton() {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1.0, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={styles.card}>
      <Animated.View style={[styles.highlight, animatedStyle]} />
      <View style={styles.bottom}>
        <View style={styles.barWide} />
        <View style={styles.barNarrow} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#2c2c2e',
    overflow: 'hidden',
  },
  highlight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#3a3a3c',
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    backgroundColor: '#2c2c2e',
    padding: 16,
    gap: 8,
    justifyContent: 'center',
  },
  barWide: {
    width: 120,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
    opacity: 0.4,
  },
  barNarrow: {
    width: 80,
    height: 13,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
    opacity: 0.4,
  },
});
