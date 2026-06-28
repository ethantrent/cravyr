import { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { usePreferencesStore } from '../stores/preferencesStore';
import { CUISINE_OPTIONS } from '@cravyr/shared';
import type { UserPreferences } from '@cravyr/shared';
import { supabase } from '../lib/supabase';
import { theme } from '../lib/theme';

const PRICE_LEVELS: Array<{ level: 1 | 2 | 3 | 4; label: string }> = [
  { level: 1, label: '$' },
  { level: 2, label: '$$' },
  { level: 3, label: '$$$' },
  { level: 4, label: '$$$$' },
];

const DISTANCE_OPTIONS: Array<{ km: 1 | 5 | 15; label: string }> = [
  { km: 1, label: '1 km' },
  { km: 5, label: '5 km' },
  { km: 15, label: '15 km' },
];

export function PreferencesScreen() {
  const router = useRouter();
  const {
    travelLocation,
    draftCuisines,
    draftPriceRange,
    draftMaxDistance,
    isSaving,
    toggleDraftCuisine,
    toggleDraftPrice,
    setDraftMaxDistance,
    setPreferences,
    setSaving,
    bumpPreferencesVersion,
  } = usePreferencesStore();

  const [didSave, setDidSave] = useState(false);

  // Load existing preferences on mount
  useEffect(() => {
    const load = async () => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) return;
      const { data } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (data) {
        setPreferences({
          user_id: userId,
          cuisines: data.cuisines ?? [],
          price_range: data.price_range ?? [1, 2, 3, 4],
          max_distance_km: data.max_distance_km ?? 5,
          updated_at: data.updated_at ?? new Date().toISOString(),
        });
      }
    };
    load();
  }, [setPreferences]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setDidSave(false);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) throw new Error('Not authenticated');

      const prefs: Omit<UserPreferences, 'updated_at'> & { updated_at: string } = {
        user_id: userId,
        cuisines: draftCuisines,
        price_range: draftPriceRange,
        max_distance_km: draftMaxDistance,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('user_preferences')
        .upsert(prefs, { onConflict: 'user_id' });

      if (error) throw error;

      setPreferences(prefs);
      // Signal the Discover deck to refetch recommendations on next focus
      bumpPreferencesVersion();
      setDidSave(true);
      setTimeout(() => setDidSave(false), 2000);
    } catch {
      // Silent failure for MVP — save button is re-pressable
    } finally {
      setSaving(false);
    }
  }, [
    draftCuisines,
    draftPriceRange,
    draftMaxDistance,
    setPreferences,
    setSaving,
    bumpPreferencesVersion,
  ]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      {/* Location row */}
      <Text style={styles.sectionLabel}>LOCATION</Text>
      <Pressable
        style={styles.locationRow}
        onPress={() => router.push('/location-search')}
        accessibilityRole="button"
      >
        <View style={styles.locationInfo}>
          <Ionicons name={travelLocation ? 'airplane' : 'navigate'} size={20} color={theme.colors.primary} />
          <Text style={styles.locationText}>
            {travelLocation ? travelLocation.name : 'Current Location'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.colors.muted} />
      </Pressable>

      {/* Cuisine multi-select */}
      <Text style={styles.sectionLabel}>CUISINES</Text>
      <View style={styles.chipGrid}>
        {CUISINE_OPTIONS.map((cuisine) => {
          const selected = draftCuisines.includes(cuisine);
          return (
            <Pressable
              key={cuisine}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => toggleDraftCuisine(cuisine)}
              accessibilityLabel={`${cuisine}${selected ? ', selected' : ''}`}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {cuisine}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Price range */}
      <Text style={styles.sectionLabel}>PRICE RANGE</Text>
      <View style={styles.toggleRow}>
        {PRICE_LEVELS.map(({ level, label }) => {
          const active = draftPriceRange.includes(level);
          return (
            <Pressable
              key={level}
              style={[styles.toggle, active && styles.toggleActive]}
              onPress={() => toggleDraftPrice(level)}
              accessibilityLabel={`${label}${active ? ', selected' : ''}`}
            >
              <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Distance */}
      <Text style={styles.sectionLabel}>DISTANCE</Text>
      <View style={styles.toggleRow}>
        {DISTANCE_OPTIONS.map(({ km, label }) => {
          const active = draftMaxDistance === km;
          return (
            <Pressable
              key={km}
              style={[styles.toggle, active && styles.toggleActive]}
              onPress={() => setDraftMaxDistance(km)}
              accessibilityLabel={`${label}${active ? ', selected' : ''}`}
            >
              <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Save button */}
      <Pressable
        style={[styles.saveButton, isSaving && { opacity: 0.7 }]}
        onPress={handleSave}
        disabled={isSaving}
        accessibilityLabel="Save preferences"
      >
        {isSaving ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.saveText}>
            {didSave ? 'Saved!' : 'Save Preferences'}
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

export default PreferencesScreen;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.canvas },
  content: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 48 },
  sectionLabel: {
    ...theme.typography.caption,
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 24,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.surfaceSoft,
    borderRadius: theme.rounded.md,
    borderWidth: 1,
    borderColor: theme.colors.hairline,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    ...theme.typography.bodyMd,
    color: theme.colors.ink,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: theme.rounded.full,
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.hairline,
  },
  chipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: { 
    ...theme.typography.bodyMd,
    color: theme.colors.muted,
  },
  chipTextSelected: { 
    color: theme.colors.onPrimary,
    fontWeight: '700' 
  },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggle: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.rounded.md,
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.hairline,
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  toggleText: { 
    ...theme.typography.bodyMd,
    color: theme.colors.muted,
  },
  toggleTextActive: { 
    color: theme.colors.onPrimary,
    fontWeight: '700' 
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.rounded.md,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  saveText: { 
    ...theme.typography.buttonMd,
    color: theme.colors.onPrimary,
  },
});
