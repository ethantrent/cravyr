import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
// Apple Sign-In import intentionally omitted — requires Apple Developer account entitlements
import { router } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { usePreferencesStore } from '../../stores/preferencesStore';

type AuthMode = 'signin' | 'create';

function mapAuthError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Something went wrong. Please try again.';
  const msg = (error as { message?: string }).message ?? '';
  if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
    return 'Incorrect email or password.';
  }
  if (msg.includes('User already registered') || msg.includes('already been registered')) {
    return 'An account with this email already exists. Try signing in.';
  }
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('Network')) {
    return 'Connection failed. Check your internet and try again.';
  }
  return 'Something went wrong. Please try again.';
}

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('create');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayOpacity = useSharedValue(0);
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const flushedRef = useRef(false);

  const { draftCuisines, draftPriceRange, draftMaxDistance } = usePreferencesStore();

  // Configure Google Sign-In once
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    });
  }, []);

  // Flush preferences on SIGNED_IN event (not in signUp/signIn call chain — avoids RLS timing issue)
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session && !flushedRef.current) {
        flushedRef.current = true;
        try {
          await supabase
            .from('user_preferences')
            .upsert(
              {
                user_id: session.user.id,
                cuisines: draftCuisines,
                price_range: draftPriceRange,
                max_distance_km: draftMaxDistance,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id' }
            );
        } catch {
          // Preferences flush failure is non-blocking — user still gets to the app
        } finally {
          router.replace('/(tabs)');
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [draftCuisines, draftPriceRange, draftMaxDistance]);

  function clearError() {
    setError(null);
  }

  async function handleEmailAuth() {
    clearError();
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    // T-03-03-07: Minimum password length — immediate feedback before server round-trip
    if (mode === 'create' && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const authFn =
        mode === 'create'
          ? () => supabase.auth.signUp({ email, password })
          : () => supabase.auth.signInWithPassword({ email, password });
      const { error: authError } = await authFn();
      if (authError) setError(mapAuthError(authError));
      // On success, onAuthStateChange SIGNED_IN handler handles navigation
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    clearError();
    setSocialLoading(true);
    overlayOpacity.value = withTiming(1, { duration: 150 });
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (isSuccessResponse(response)) {
        const { error: authError } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: response.data.idToken!,
        });
        if (authError) {
          setError('Sign-in failed. Please try again.');
        }
        // On success, onAuthStateChange handles navigation
      }
    } catch {
      setError('Sign-in failed. Please try again.');
    } finally {
      overlayOpacity.value = withTiming(0, { duration: 100 });
      setSocialLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email above, then tap "Forgot password?"');
      return;
    }
    await supabase.auth.resetPasswordForEmail(email);
    setError(null);
    // Success is silent — Supabase sends the email; no need to show a UI state here
  }

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>Welcome to Cravyr</Text>
        <Text style={styles.subheading}>
          {mode === 'signin' ? 'Sign in to your account.' : 'Create your free account.'}
        </Text>

        {/* Mode toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleTab, mode === 'signin' && styles.toggleTabActive]}
            onPress={() => {
              setMode('signin');
              clearError();
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === 'signin' }}
          >
            <Text style={[styles.toggleLabel, mode === 'signin' && styles.toggleLabelActive]}>
              Sign In
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleTab, mode === 'create' && styles.toggleTabActive]}
            onPress={() => {
              setMode('create');
              clearError();
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === 'create' }}
          >
            <Text style={[styles.toggleLabel, mode === 'create' && styles.toggleLabelActive]}>
              Create Account
            </Text>
          </TouchableOpacity>
        </View>

        {/* Email input */}
        <TextInput
          style={[styles.input, emailFocused && styles.inputFocused]}
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            clearError();
          }}
          onFocus={() => setEmailFocused(true)}
          onBlur={() => setEmailFocused(false)}
          placeholder="Email address"
          placeholderTextColor="#ababab"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Email address"
        />

        {/* Password input */}
        <TextInput
          style={[styles.input, styles.inputPassword, passwordFocused && styles.inputFocused]}
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            clearError();
          }}
          onFocus={() => setPasswordFocused(true)}
          onBlur={() => setPasswordFocused(false)}
          placeholder="Password"
          placeholderTextColor="#ababab"
          secureTextEntry
          accessibilityLabel="Password"
          accessibilityHint="Enter your password"
        />

        {/* Primary CTA */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleEmailAuth}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={mode === 'signin' ? 'Sign in to your account' : 'Create a new account'}
        >
          {loading ? (
            <ActivityIndicator size={20} color="#ffffff" />
          ) : (
            <Text style={styles.primaryButtonLabel}>
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Error banner */}
        {error && (
          <View style={styles.errorBanner} accessibilityLiveRegion="polite">
            <Ionicons name="alert-circle" size={16} color="#ef4444" style={{ marginRight: 8 }} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Forgot password (Sign In mode only) */}
        {mode === 'signin' && (
          <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotWrapper}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
        )}

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Google Sign-In */}
        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleGoogleSignIn}
          disabled={socialLoading}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
        >
          <Ionicons name="logo-google" size={18} color="#ffffff" style={{ marginRight: 8 }} />
          <Text style={styles.socialButtonLabel}>Continue with Google</Text>
        </TouchableOpacity>

        {/* Apple Sign-In — enabled when Apple Developer account is set up */}
        <TouchableOpacity
          style={[styles.appleButton, { opacity: 0.4 }]}
          disabled
          accessibilityRole="button"
          accessibilityLabel="Sign in with Apple — coming soon"
        >
          <Ionicons name="logo-apple" size={18} color="#ffffff" style={{ marginRight: 8 }} />
          <Text style={styles.socialButtonLabel}>Sign in with Apple</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Social loading overlay */}
      {socialLoading && (
        <Animated.View style={[StyleSheet.absoluteFillObject, styles.overlay, overlayStyle]}>
          <View pointerEvents="none" style={styles.overlayContent}>
            <ActivityIndicator size="large" color="#f97316" />
          </View>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 48,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 28 * 1.2,
  },
  subheading: {
    fontSize: 16,
    fontWeight: '400',
    color: '#ababab',
    textAlign: 'center',
    marginBottom: 32,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#1c1c1e',
    borderRadius: 8,
    marginBottom: 24,
    overflow: 'hidden',
  },
  toggleTab: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  toggleTabActive: {
    borderBottomColor: '#f97316',
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: '#ababab',
  },
  toggleLabelActive: {
    fontWeight: '700',
    color: '#ffffff',
  },
  input: {
    backgroundColor: '#1c1c1e',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 20,
    fontSize: 16,
    fontWeight: '400',
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#2c2c2e',
    marginBottom: 12,
  },
  inputPassword: {
    marginBottom: 24,
  },
  inputFocused: {
    borderColor: '#f97316',
  },
  primaryButton: {
    backgroundColor: '#f97316',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#ef4444',
    flex: 1,
  },
  forgotWrapper: {
    marginTop: 16,
    alignItems: 'center',
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#ababab',
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2c2c2e',
  },
  dividerText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#ababab',
    marginHorizontal: 12,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    height: 40,
    borderWidth: 1,
    borderColor: '#2c2c2e',
    marginBottom: 12,
  },
  socialButtonLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: '#ffffff',
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    height: 40,
    borderWidth: 1,
    borderColor: '#2c2c2e',
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
