import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export function RestaurantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View style={{ flex: 1, backgroundColor: '#0f0f0f', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#ffffff' }}>Detail View — {id} — Phase 4 Plan 04</Text>
    </View>
  );
}

export default RestaurantDetailScreen;
