import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../lib/theme';
import type { Restaurant } from '@cravyr/shared';
import { photoProxyUrl } from '../lib/api';

interface MatchModalProps {
  visible: boolean;
  restaurant: Restaurant | null;
  matchNames?: string[];
  onClose: () => void;
}

export function MatchModal({ visible, restaurant, matchNames = [], onClose }: MatchModalProps) {
  if (!restaurant) return null;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>It's a Match!</Text>
          <Text style={styles.subtitle}>
            You and {matchNames.join(', ')} both want to eat here!
          </Text>

          <View style={styles.imageContainer}>
            {restaurant.photo_urls[0] ? (
              <Image
                source={{ uri: photoProxyUrl(restaurant.photo_urls[0]) }}
                style={styles.image}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.image, styles.fallbackImage]}>
                <Ionicons name="restaurant-outline" size={48} color={theme.colors.mutedSoft} />
              </View>
            )}
            <View style={styles.heartBadge}>
              <Ionicons name="heart" size={24} color={theme.colors.onPrimary} />
            </View>
          </View>

          <Text style={styles.restaurantName}>{restaurant.name}</Text>

          <Pressable style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Keep Swiping</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  content: {
    backgroundColor: theme.colors.canvas,
    borderRadius: theme.rounded.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    ...theme.typography.displayLg,
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    ...theme.typography.bodyMd,
    color: theme.colors.muted,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: theme.spacing.lg,
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: theme.rounded.full,
    borderWidth: 4,
    borderColor: theme.colors.primary,
  },
  fallbackImage: {
    backgroundColor: theme.colors.surfaceSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartBadge: {
    position: 'absolute',
    bottom: 0,
    right: 20,
    backgroundColor: theme.colors.primary,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: theme.colors.canvas,
  },
  restaurantName: {
    ...theme.typography.displayMd,
    color: theme.colors.ink,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: theme.rounded.full,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    ...theme.typography.buttonMd,
    color: theme.colors.onPrimary,
  },
});
