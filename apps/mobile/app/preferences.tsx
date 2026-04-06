import { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { usePreferencesStore } from '../stores/preferencesStore';
import { CUISINE_OPTIONS } from '@cravyr/shared';
import type { UserPreferences } from '@cravyr/shared';
import { supabase } from '../lib/supabase';

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
  const {
    draftCuisines,
    draftPriceRange,
    draftMaxDistance,
    isSaving,
    toggleDraftCuisine,
    toggleDraftPrice,
    setDraftMaxDistance,
    setPreferences,
    setSaving,
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
      setDidSave(true);
      setTimeout(() => setDidSave(false), 2000);
    } catch {
      // Silent failure for MVP — save button is re-pressable
    } finally {
      setSaving(false);
    }
  }, [draftCuisines, draftPriceRange, draftMaxDistance, setPreferences, setSaving]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
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
  screen: { flex: 1, backgroundColor: '#0f0f0f' },
  content: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 48 },
  sectionLabel: {
    color: '#ababab',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 24,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: '#2c2c2e',
  },
  chipSelected: {
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderColor: '#f97316',
  },
  chipText: { color: '#ababab', fontSize: 16, fontWeight: '400' },
  chipTextSelected: { color: '#f97316', fontWeight: '700' },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggle: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: '#2c2c2e',
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderColor: '#f97316',
  },
  toggleText: { color: '#ababab', fontSize: 16, fontWeight: '400' },
  toggleTextActive: { color: '#f97316', fontWeight: '700' },
  saveButton: {
    backgroundColor: '#f97316',
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  saveText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
