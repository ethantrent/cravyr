import { View, Text, StyleSheet } from 'react-native';

export function SaveLabel() {
  return (
    <View style={[styles.container, styles.saveContainer]}>
      <Text style={[styles.text, styles.saveText]}>SAVE</Text>
    </View>
  );
}

export function SkipLabel() {
  return (
    <View style={[styles.container, styles.skipContainer]}>
      <Text style={[styles.text, styles.skipText]}>SKIP</Text>
    </View>
  );
}

export function SuperlikeLabel() {
  return (
    <View style={[styles.container, styles.superlikeContainer]}>
      <Text style={[styles.text, styles.superlikeText]}>SUPERLIKE</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 3,
    borderRadius: 8,
    padding: 8,
  },
  text: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 28,
  },
  saveContainer: {
    borderColor: '#22c55e',
    transform: [{ rotate: '-15deg' }],
  },
  saveText: {
    color: '#22c55e',
  },
  skipContainer: {
    borderColor: '#ef4444',
    transform: [{ rotate: '15deg' }],
  },
  skipText: {
    color: '#ef4444',
  },
  superlikeContainer: {
    borderColor: '#eab308',
  },
  superlikeText: {
    color: '#eab308',
  },
});
