import { StyleSheet, View, Text } from 'react-native';

interface StepProgressProps {
  current: 1 | 2 | 3;
  total?: number;
}

export function StepProgress({ current, total = 3 }: StepProgressProps) {
  return (
    <View style={styles.container} accessibilityLabel={`Step ${current} of ${total}`}>
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
    marginTop: 48,
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
    backgroundColor: '#2c2c2e',
  },
  dotActive: {
    backgroundColor: '#f97316',
  },
  label: {
    fontSize: 13,
    fontWeight: '400',
    color: '#ababab',
  },
});
