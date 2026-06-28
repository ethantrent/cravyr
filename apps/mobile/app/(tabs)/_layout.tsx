import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

export function TabLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#f97316',
        tabBarInactiveTintColor: '#636366',
        tabBarStyle: {
          backgroundColor: '#0f0f0f',
          borderTopColor: '#1c1c1e',
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 13 },
        headerShown: true,
        headerStyle: { backgroundColor: '#0f0f0f' },
        headerTitleStyle: { color: '#ffffff' },
        headerShadowVisible: false,
        headerRight: () => (
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            hitSlop={12}
            style={{ paddingHorizontal: 16 }}
          >
            <Ionicons name="settings-outline" size={22} color="#ffffff" />
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarAccessibilityLabel: 'Discover',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'compass' : 'compass-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "Tonight's Picks",
          tabBarAccessibilityLabel: "Tonight's Picks",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'bookmark' : 'bookmark-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

export default TabLayout;
