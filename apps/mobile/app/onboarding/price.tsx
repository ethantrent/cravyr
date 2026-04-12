import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { StepProgress } from '../../components/onboarding/StepProgress';

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
      <StepProgress current={2} />
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
  ctaButtonDisabled: {
    backgroundColor: '#2c2c2e',
  },
  ctaLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  ctaLabelDisabled: {
    color: '#636366',
    fontWeight: '400',
  },
});
