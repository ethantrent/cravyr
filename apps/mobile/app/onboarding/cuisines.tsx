import { StyleSheet, View, Text, FlatList, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { CUISINE_OPTIONS } from '@cravyr/shared';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { StepProgress } from '../../components/onboarding/StepProgress';
import { theme } from '../../lib/theme';

export default function CuisinesScreen() {
  const { draftCuisines, toggleDraftCuisine } = usePreferencesStore();
  const canContinue = draftCuisines.length > 0;

  function handleContinue() {
    if (!canContinue) return;
    router.push('/onboarding/price');
  }

  return (
    <View style={styles.container}>
      <StepProgress current={1} total={4} />
      <Text style={styles.heading}>Your cuisines</Text>
      <Text style={styles.subheading}>Pick all that interest you.</Text>

      <FlatList
        data={[...CUISINE_OPTIONS]}
        keyExtractor={(item) => item}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <CuisineChip
            label={item}
            selected={draftCuisines.includes(item)}
            onPress={() => toggleDraftCuisine(item)}
          />
        )}
      />

      <TouchableOpacity
        style={[styles.ctaButton, !canContinue && styles.ctaButtonDisabled]}
        onPress={handleContinue}
        disabled={!canContinue}
        accessibilityRole="button"
        accessibilityLabel="Continue to price range"
        accessibilityState={{ disabled: !canContinue }}
      >
        <Text style={[styles.ctaLabel, !canContinue && styles.ctaLabelDisabled]}>
          Continue
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function CuisineChip({ label, selected, onPress }: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function handlePressIn() {
    scale.value = withSpring(0.96, { damping: 20, stiffness: 200 });
  }
  function handlePressOut() {
    scale.value = withSpring(1.0, { damping: 20, stiffness: 200 });
  }

  return (
    <Animated.View style={[styles.chipWrapper, animatedStyle]}>
      <TouchableOpacity
        style={[styles.chip, selected && styles.chipSelected]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="checkbox"
        accessibilityLabel={`${label}, ${selected ? 'selected' : 'not selected'}`}
        accessibilityState={{ checked: selected }}
      >
        <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
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
  grid: {
    paddingBottom: 16,
    rowGap: 8,
  },
  row: {
    gap: 8,
  },
  chipWrapper: {
    flex: 1,
  },
  chip: {
    backgroundColor: theme.colors.canvas,
    borderWidth: 1,
    borderColor: theme.colors.hairline,
    borderRadius: theme.rounded.xl,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: 'rgba(255,56,92,0.1)',
    borderColor: theme.colors.primary,
  },
  chipLabel: {
    ...theme.typography.bodyMd,
    color: theme.colors.muted,
  },
  chipLabelSelected: {
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
