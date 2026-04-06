import { Stack } from 'expo-router';

export function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="restaurant/[id]"
        options={{
          headerShown: true,
          title: '',
          headerTransparent: true,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="preferences"
        options={{
          title: 'Preferences',
          headerTintColor: '#ffffff',
          headerStyle: { backgroundColor: '#0f0f0f' },
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerTintColor: '#ffffff',
          headerStyle: { backgroundColor: '#0f0f0f' },
        }}
      />
    </Stack>
  );
}

export default RootLayout;
