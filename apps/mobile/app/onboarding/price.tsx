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

const PRICE_OPTIONS: Array<{ label: string; value: 1 | 2 | 3 | 4 }> = [
  { label: '$', value: 1 },
  { label: '$$', value: 2 },
  { label: '$$$', value: 3 },
  { label: '$$$$', value: 4 },
];

export default function PriceScreen() {
  const { draftPriceRange, toggleDraftPrice } = usePreferencesStore();
  const canContinue = draftPriceRange.length > 0;

  function handleContinue() {
    if (!canContinue) return;
    router.push('/onboarding/distance');
  }

  return (
    <View style={styles.container}>
      <StepProgress current={2} total={4} />
      <Text style={styles.heading}>Your price range</Text>
      <Text style={styles.subheading}>Select all that apply.</Text>

      <View style={styles.segmentRow}>
        {PRICE_OPTIONS.map(({ label, value }) => (
          <PriceSegment
            key={value}
            label={label}
            selected={draftPriceRange.includes(value)}
            onPress={() => toggleDraftPrice(value)}
          />
        ))}
      </View>

      <TouchableOpacity
        style={[styles.ctaButton, !canContinue && styles.ctaButtonDisabled]}
        onPress={handleContinue}
        disabled={!canContinue}
        accessibilityRole="button"
        accessibilityLabel="Continue to distance selection"
        accessibilityState={{ disabled: !canContinue }}
      >
        <Text style={[styles.ctaLabel, !canContinue && styles.ctaLabelDisabled]}>
          Continue
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function PriceSegment({ label, selected, onPress }: {
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
        accessibilityRole="checkbox"
        accessibilityLabel={`${label}, ${selected ? 'selected' : 'not selected'}`}
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
  ctaButtonDisabled: {
    backgroundColor: theme.colors.surfaceStrong,
  },
  ctaLabel: {
    ...theme.typography.buttonMd,
    color: theme.colors.onPrimary,
  },
  ctaLabelDisabled: {
    color: theme.colors.mutedSoft,
  },
});
