import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { theme } from '../../lib/theme';

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
  // Returning users reach this screen directly (bypassing onboarding); they keep
  // their stored preferences and start on the Sign In tab.
  const { returning } = useLocalSearchParams<{ returning?: string }>();
  const isReturning = returning === '1';
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<AuthMode>(isReturning ? 'signin' : 'create');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [secureText, setSecureText] = useState(true);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabWidth, setTabWidth] = useState(0);

  // Animations
  const overlayOpacity = useSharedValue(0);
  const enterAnim = useSharedValue(0);
  const tabAnim = useSharedValue(isReturning ? 0 : 1);
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const flushedRef = useRef(false);

  useEffect(() => {
    enterAnim.value = withTiming(1, { duration: 600 });
  }, []);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: enterAnim.value,
    transform: [{ translateY: 20 * (1 - enterAnim.value) }],
  }));

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(tabAnim.value * tabWidth, { damping: 20, stiffness: 200 }) }],
  }));

  // Configure Google Sign-In once
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    });
  }, []);

  // Route user based on whether they have completed onboarding
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session && !flushedRef.current) {
        flushedRef.current = true;
        try {
          const { data } = await supabase
            .from('user_preferences')
            .select('user_id')
            .eq('user_id', session.user.id)
            .single();

          if (data) {
            router.replace('/(tabs)/discover');
          } else {
            router.push('/onboarding/cuisines');
          }
        } catch {
          // If no row is found (.single() throws) or network fails, send to onboarding
          router.push('/onboarding/cuisines');
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

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
          console.error('Supabase Auth Error (Google):', authError.message);
          setError('Sign-in failed. Please try again.');
        }
        // On success, onAuthStateChange handles navigation
      } else {
        console.error('Google Sign-In Non-Success Response:', response);
        setError('Sign-in failed. Please try again.');
      }
    } catch (err: any) {
      console.error('Google Sign-In Error:', err?.message || err);
      setError('Sign-in failed. Please try again.');
    } finally {
      overlayOpacity.value = withTiming(0, { duration: 100 });
      setSocialLoading(false);
    }
  }

  async function handleAppleSignIn() {
    clearError();
    setSocialLoading(true);
    overlayOpacity.value = withTiming(1, { duration: 150 });
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        setError('Apple Sign-In failed. No identity token received.');
        return;
      }

      const { error: authError } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (authError) {
        setError('Sign-in failed. Please try again.');
        return;
      }

      // Apple only returns fullName on the FIRST sign-in — persist it now or lose it forever
      if (credential.fullName) {
        const parts = [credential.fullName.givenName, credential.fullName.familyName]
          .filter(Boolean);
        if (parts.length > 0) {
          await supabase.auth.updateUser({
            data: { full_name: parts.join(' ') },
          });
        }
      }
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'ERR_REQUEST_CANCELED') return;
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
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.container, { paddingTop: Math.max(insets.top + 16, 48) }]}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={enterStyle}>
          <View style={styles.hero}>
            <Image source={require('../../assets/images/logo.png')} style={styles.logo} />
            <Text style={styles.heading}>Welcome to Cravyr</Text>
            <Text style={styles.subheading}>
              {mode === 'signin' ? 'Sign in to your account.' : 'Create your free account.'}
            </Text>
          </View>

          {/* Mode toggle */}
          <View 
            style={styles.toggleRow} 
            onLayout={(e) => setTabWidth(e.nativeEvent.layout.width / 2)}
          >
            {tabWidth > 0 && <Animated.View style={[styles.togglePill, pillStyle]} />}
            <TouchableOpacity
              style={styles.toggleTab}
              onPress={() => {
                setMode('signin');
                tabAnim.value = 0;
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
              style={styles.toggleTab}
              onPress={() => {
                setMode('create');
                tabAnim.value = 1;
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
          placeholderTextColor={theme.colors.mutedSoft}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Email address"
        />

        {/* Password input */}
        <View style={[styles.inputWrapper, passwordFocused && styles.inputFocused]}>
          <TextInput
            style={styles.inputInner}
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              clearError();
            }}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            placeholder="Password"
            placeholderTextColor={theme.colors.mutedSoft}
            secureTextEntry={secureText}
            accessibilityLabel="Password"
            accessibilityHint="Enter your password"
          />
          <TouchableOpacity
            onPress={() => setSecureText(!secureText)}
            style={styles.eyeIcon}
            accessibilityRole="button"
            accessibilityLabel={secureText ? "Show password" : "Hide password"}
          >
            <Ionicons name={secureText ? 'eye-off' : 'eye'} size={20} color={theme.colors.muted} />
          </TouchableOpacity>
        </View>

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
            <Ionicons name="alert-circle" size={16} color={theme.colors.error} style={{ marginRight: 8 }} />
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
          <Ionicons name="logo-google" size={18} color={theme.colors.ink} style={{ marginRight: 8 }} />
          <Text style={styles.socialButtonLabel}>Continue with Google</Text>
        </TouchableOpacity>

          {/* Apple Sign-In — iOS only (required by App Store if any social login is offered) */}
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={styles.appleButton}
              onPress={handleAppleSignIn}
              disabled={socialLoading}
              accessibilityRole="button"
              accessibilityLabel="Sign in with Apple"
            >
              <Ionicons name="logo-apple" size={18} color={theme.colors.onDark} style={{ marginRight: 8 }} />
              <Text style={styles.appleButtonLabel}>Sign in with Apple</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </ScrollView>

      {/* Social loading overlay */}
      {socialLoading && (
        <Animated.View style={[StyleSheet.absoluteFillObject, styles.overlay, overlayStyle]}>
          <View pointerEvents="none" style={styles.overlayContent}>
            <ActivityIndicator size="large" color="#f97316" />
          </View>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: theme.colors.canvas,
  },
  container: {
    paddingHorizontal: theme.spacing.base,
    paddingBottom: 48,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 16,
    marginBottom: 24,
  },
  heading: {
    ...theme.typography.displayLg,
    color: theme.colors.ink,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  subheading: {
    ...theme.typography.bodyMd,
    color: theme.colors.muted,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  toggleRow: {
    position: 'relative',
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceSoft,
    borderRadius: theme.rounded.sm,
    marginBottom: 24,
    overflow: 'hidden',
    padding: 4,
  },
  toggleTab: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.rounded.xs,
    zIndex: 1,
  },
  togglePill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: '50%',
    backgroundColor: theme.colors.canvas,
    borderRadius: theme.rounded.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 0,
  },
  toggleLabel: {
    ...theme.typography.bodyMd,
    color: theme.colors.muted,
  },
  toggleLabelActive: {
    ...theme.typography.titleSm,
    color: theme.colors.ink,
  },
  input: {
    backgroundColor: theme.colors.canvas,
    borderRadius: theme.rounded.sm,
    paddingHorizontal: theme.spacing.base,
    minHeight: 56,
    ...theme.typography.bodyMd,
    color: theme.colors.ink,
    borderWidth: 1,
    borderColor: theme.colors.hairline,
    marginBottom: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.canvas,
    borderRadius: theme.rounded.sm,
    borderWidth: 1,
    borderColor: theme.colors.hairline,
    marginBottom: 24,
    minHeight: 56,
  },
  inputInner: {
    flex: 1,
    paddingHorizontal: theme.spacing.base,
    ...theme.typography.bodyMd,
    color: theme.colors.ink,
    height: '100%',
  },
  eyeIcon: {
    padding: theme.spacing.base,
  },
  inputFocused: {
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.rounded.md,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonLabel: {
    ...theme.typography.buttonMd,
    color: theme.colors.onPrimary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(193,53,21,0.1)',
    borderWidth: 1,
    borderColor: theme.colors.error,
    borderRadius: theme.rounded.sm,
    padding: 12,
    marginTop: 16,
  },
  errorText: {
    ...theme.typography.bodySm,
    color: theme.colors.error,
    flex: 1,
  },
  forgotWrapper: {
    marginTop: 16,
    alignItems: 'center',
  },
  forgotText: {
    ...theme.typography.caption,
    color: theme.colors.muted,
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
    backgroundColor: theme.colors.hairlineSoft,
  },
  dividerText: {
    ...theme.typography.caption,
    color: theme.colors.mutedSoft,
    marginHorizontal: 12,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.canvas,
    borderRadius: theme.rounded.md,
    height: 56,
    borderWidth: 1,
    borderColor: theme.colors.hairline,
    marginBottom: 12,
  },
  socialButtonLabel: {
    ...theme.typography.buttonMd,
    color: theme.colors.ink,
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.ink,
    borderRadius: theme.rounded.md,
    height: 56,
  },
  appleButtonLabel: {
    ...theme.typography.buttonMd,
    color: theme.colors.onDark,
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
