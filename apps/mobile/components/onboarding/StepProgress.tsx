import { StyleSheet, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../lib/theme';

interface StepProgressProps {
  current: 1 | 2 | 3 | 4;
  total?: number;
}

export function StepProgress({ current, total = 4 }: StepProgressProps) {
  const insets = useSafeAreaInsets();
  return (
    <View 
      style={[styles.container, { marginTop: Math.max(insets.top + 16, 48) }]} 
      accessibilityLabel={`Step ${current} of ${total}`}
    >
      <View style={styles.dots}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={[styles.dot, i + 1 === current && styles.dotActive]}
          />
        ))}
      </View>
      <Text style={styles.label}>Step {current} of {total}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 32,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.hairline,
  },
  dotActive: {
    backgroundColor: theme.colors.primary,
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.mutedSoft,
  },
});
