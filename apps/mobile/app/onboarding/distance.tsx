import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { StepProgress } from '../../components/onboarding/StepProgress';
import { theme } from '../../lib/theme';

const DISTANCE_OPTIONS: Array<{ label: string; value: 1 | 5 | 15 }> = [
  { label: '1 km', value: 1 },
  { label: '5 km', value: 5 },
  { label: '15 km', value: 15 },
];

export default function DistanceScreen() {
  const { draftMaxDistance, setDraftMaxDistance } = usePreferencesStore();
  // Default is 5 km from preferencesStore initial state

  function handleContinue() {
    router.replace('/onboarding/location');
  }

  return (
    <View style={styles.container}>
      <StepProgress current={3} total={4} />
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
        accessibilityLabel="Continue to location setup"
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
    backgroundColor: theme.colors.canvas,
    paddingHorizontal: theme.spacing.base,
  },
  heading: {
    ...theme.typography.displayMd,
    color: theme.colors.ink,
    marginBottom: theme.spacing.sm,
  },
  subheading: {
    ...theme.typography.bodyMd,
    color: theme.colors.muted,
    marginBottom: theme.spacing.lg,
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
    backgroundColor: theme.colors.canvas,
    borderWidth: 1,
    borderColor: theme.colors.hairline,
    borderRadius: theme.rounded.md,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
  },
  segmentSelected: {
    backgroundColor: 'rgba(255,56,92,0.1)',
    borderColor: theme.colors.primary,
  },
  segmentLabel: {
    ...theme.typography.bodyMd,
    color: theme.colors.muted,
  },
  segmentLabelSelected: {
    ...theme.typography.titleSm,
    color: theme.colors.primary,
  },
  ctaButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.rounded.md,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  ctaLabel: {
    ...theme.typography.buttonMd,
    color: theme.colors.onPrimary,
  },
});
