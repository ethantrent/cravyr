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

export default function CuisinesScreen() {
  const { draftCuisines, toggleDraftCuisine } = usePreferencesStore();
  const canContinue = draftCuisines.length > 0;

  function handleContinue() {
    if (!canContinue) return;
    router.push('/onboarding/price');
  }

  return (
    <View style={styles.container}>
      <StepProgress current={1} />
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
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: '#2c2c2e',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderColor: '#f97316',
  },
  chipLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: '#ababab',
  },
  chipLabelSelected: {
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
