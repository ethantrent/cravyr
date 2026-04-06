import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface SettingsRowProps {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  showChevron?: boolean;
}

function SettingsRow({ label, onPress, destructive = false, showChevron = true }: SettingsRowProps) {
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button">
      <Text style={[styles.rowLabel, destructive && styles.destructiveLabel]}>
        {label}
      </Text>
      {showChevron && !destructive && (
        <Ionicons name="chevron-forward" size={16} color="#636366" />
      )}
    </Pressable>
  );
}

export function SettingsScreen() {
  const router = useRouter();

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account and all saved restaurants. This cannot be undone.',
      [
        {
          text: 'Keep Account',
          style: 'cancel',
        },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            try {
              const headers = await getAuthHeader();
              const res = await fetch(`${API_URL}/api/v1/users/me`, {
                method: 'DELETE',
                headers,
              });
              if (!res.ok) throw new Error(`API ${res.status}`);
              // Per RESEARCH.md Anti-pattern: always sign out after deletion to clear local JWT
              await supabase.auth.signOut();
              // Phase 3 auth guard will redirect to onboarding/login
            } catch {
              Alert.alert(
                'Error',
                'Could not delete account. Please try again or contact support.'
              );
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      {/* Account section */}
      <View style={styles.sectionGroup}>
        <SettingsRow
          label="Preferences"
          onPress={() => router.push('/preferences')}
        />
      </View>

      {/* Danger zone — delete account in own section at bottom */}
      <View style={styles.sectionGroup}>
        <SettingsRow
          label="Delete Account"
          onPress={handleDeleteAccount}
          destructive
          showChevron={false}
        />
      </View>
    </View>
  );
}

export default SettingsScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    paddingTop: 24,
  },
  sectionGroup: {
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    paddingHorizontal: 16,
    backgroundColor: '#1c1c1e',
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c2e',
  },
  rowLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 16 * 1.5,
  },
  destructiveLabel: {
    color: '#ef4444',
  },
});
