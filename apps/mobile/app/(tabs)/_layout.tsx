import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { theme } from '../../lib/theme';

export function TabLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarStyle: {
          backgroundColor: theme.colors.canvas,
          borderTopColor: theme.colors.hairlineSoft,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: theme.typography.caption,
        headerShown: true,
        headerStyle: { backgroundColor: theme.colors.canvas },
        headerTitleStyle: { ...theme.typography.titleMd, color: theme.colors.ink },
        headerShadowVisible: false,
        headerRight: () => (
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            hitSlop={12}
            style={{ paddingHorizontal: 16 }}
          >
            <Ionicons name="settings-outline" size={22} color={theme.colors.ink} />
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
