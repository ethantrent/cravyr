import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="location-denied" />
      <Stack.Screen name="cuisines" />
      <Stack.Screen name="price" />
      <Stack.Screen name="distance" />
      <Stack.Screen name="auth" />
    </Stack>
  );
}
