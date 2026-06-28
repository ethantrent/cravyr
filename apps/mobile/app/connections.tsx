import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { API_URL, getAuthHeader } from '../lib/api';
import { theme } from '../lib/theme';
import { useConnectionsStore } from '../stores/connectionsStore';

export default function ConnectionsScreen() {
  const router = useRouter();
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { connections, setConnections, addConnection, removeConnection } = useConnectionsStore();

  const fetchConnections = useCallback(async () => {
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/api/v1/connections`, { headers });
      if (res.ok) {
        const data = await res.json();
        setConnections(data);
      }
    } catch {
      // ignore
    }
  }, [setConnections]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/api/v1/connections/code`, {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate code');
      setGeneratedCode(data.code);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLink = async () => {
    if (inputCode.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter a 6-digit code.');
      return;
    }
    setIsLoading(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/api/v1/connections/link`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inputCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect');
      
      Alert.alert('Success!', 'You are now connected.', [
        { text: 'Awesome', onPress: fetchConnections }
      ]);
      setInputCode('');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Remove Connection', `Are you sure you want to remove ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const headers = await getAuthHeader();
            await fetch(`${API_URL}/api/v1/connections/${id}`, {
              method: 'DELETE',
              headers,
            });
            removeConnection(id);
          } catch {
            Alert.alert('Error', 'Failed to remove connection.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Connections</Text>
      <Text style={styles.description}>
        Connect with friends to see where your tastes overlap!
      </Text>

      {connections.length > 0 && (
        <View style={styles.listContainer}>
          <Text style={styles.subtitle}>Current Connections</Text>
          {connections.map((c) => (
            <View key={c.id} style={styles.connectionRow}>
              <Text style={styles.connectionName}>{c.name}</Text>
              <Pressable onPress={() => handleDelete(c.id, c.name)}>
                <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
              </Pressable>
            </View>
          ))}
          <View style={styles.divider} />
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.subtitle}>Option 1: Give a Code</Text>
        {generatedCode ? (
          <View style={styles.codeContainer}>
            <Text style={styles.codeText}>{generatedCode}</Text>
            <Text style={styles.codeHelp}>Valid for 15 minutes</Text>
          </View>
        ) : (
          <Pressable style={styles.button} onPress={handleGenerate} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Generate Code</Text>}
          </Pressable>
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.card}>
        <Text style={styles.subtitle}>Option 2: Enter a Code</Text>
        <TextInput
          style={styles.input}
          placeholder="000000"
          placeholderTextColor={theme.colors.mutedSoft}
          keyboardType="number-pad"
          maxLength={6}
          value={inputCode}
          onChangeText={setInputCode}
          editable={!isLoading}
        />
        <Pressable style={[styles.button, styles.outlineButton]} onPress={handleLink} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color={theme.colors.primary} /> : <Text style={styles.outlineButtonText}>Link Partner</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.canvas,
    padding: theme.spacing.lg,
  },
  title: {
    ...theme.typography.displayMd,
    color: theme.colors.ink,
    marginBottom: theme.spacing.sm,
  },
  description: {
    ...theme.typography.bodyMd,
    color: theme.colors.muted,
    marginBottom: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.surfaceSoft,
    padding: theme.spacing.lg,
    borderRadius: theme.rounded.md,
  },
  subtitle: {
    ...theme.typography.titleMd,
    color: theme.colors.ink,
    marginBottom: theme.spacing.base,
  },
  codeContainer: {
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.canvas,
    borderRadius: theme.rounded.sm,
  },
  codeText: {
    ...theme.typography.displayLg,
    color: theme.colors.primary,
    letterSpacing: 4,
  },
  codeHelp: {
    ...theme.typography.caption,
    color: theme.colors.mutedSoft,
    marginTop: theme.spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.hairline,
    marginVertical: theme.spacing.lg,
  },
  input: {
    backgroundColor: theme.colors.canvas,
    borderWidth: 1,
    borderColor: theme.colors.hairline,
    borderRadius: theme.rounded.sm,
    padding: theme.spacing.md,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: theme.spacing.md,
    color: theme.colors.ink,
  },
  button: {
    backgroundColor: theme.colors.primary,
    height: 48,
    borderRadius: theme.rounded.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    ...theme.typography.buttonMd,
    color: theme.colors.onPrimary,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  outlineButtonText: {
    ...theme.typography.buttonMd,
    color: theme.colors.primary,
  },
  listContainer: {
    marginBottom: theme.spacing.lg,
  },
  connectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.hairline,
  },
  connectionName: {
    ...theme.typography.bodyMd,
    color: theme.colors.ink,
  },
});
