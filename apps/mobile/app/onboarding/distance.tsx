import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { StepProgress } from '../../components/onboarding/StepProgress';

const DISTANCE_OPTIONS: Array<{ label: string; value: 1 | 5 | 15 }> = [
  { label: '1 km', value: 1 },
  { label: '5 km', value: 5 },
  { label: '15 km', value: 15 },
];

export default function DistanceScreen() {
  const { draftMaxDistance, setDraftMaxDistance } = usePreferencesStore();
  // Default is 5 km from preferencesStore initial state

  function handleContinue() {
    router.replace('/onboarding/auth');
  }

  return (
    <View style={styles.container}>
      <StepProgress current={3} />
      <Text style={styles.heading}>How far will you go?</Text>
      <Text style={styles.subheading}>Maximum distance from your location.</Text>

      <View style={styles.segmentRow}>
        {DISTANCE_OPTIONS.map(({ label, value }) => (
          <DistanceSegment
            key={value}
            label={label}
            selected={draftMaxDistance === value}
            onPress={() => setDraftMaxDistance(value)}
          />
        ))}
      </View>

      <TouchableOpacity
        style={styles.ctaButton}
        onPress={handleContinue}
        accessibilityRole="button"
        accessibilityLabel="Continue to account creation"
      >
        <Text style={styles.ctaLabel}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

function DistanceSegment({ label, selected, onPress }: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.segmentWrapper, animatedStyle]}>
      <TouchableOpacity
        style={[styles.segment, selected && styles.segmentSelected]}
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.96, { damping: 20, stiffness: 200 }); }}
        onPressOut={() => { scale.value = withSpring(1.0, { damping: 20, stiffness: 200 }); }}
        accessibilityRole="radio"
        accessibilityLabel={`${label}${selected ? ', selected' : ''}`}
        accessibilityState={{ checked: selected }}
      >
        <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    paddingHorizontal: 16,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  subheading: {
    fontSize: 16,
    fontWeight: '400',
    color: '#ababab',
    marginBottom: 24,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentWrapper: {
    flex: 1,
  },
  segment: {
    height: 56,
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: '#2c2c2e',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
  },
  segmentSelected: {
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderColor: '#f97316',
  },
  segmentLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: '#ababab',
  },
  segmentLabelSelected: {
    fontWeight: '700',
    color: '#f97316',
  },
  ctaButton: {
    backgroundColor: '#f97316',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  ctaLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});
