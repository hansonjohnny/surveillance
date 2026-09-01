import { useRouter } from 'expo-router';
import { AtSign, Eye, EyeOff, Lock, Shield } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { resolvePostSignInDestination, signIn } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { useOnboardingStore } from '../../store/useOnboardingStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { colors } from '../../theme/colors';

export default function SignInScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 4000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 4000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.6] });

  async function handleSignIn() {
    setApiError(null);
    setLoading(true);
    const { success, error } = await signIn(email.trim(), password);
    setLoading(false);

    if (!success) {
      setApiError(error ?? 'Sign-in failed.');
      return;
    }

    // A pending guardian-confirm link (set by guardian-confirm.tsx when
    // the person had to sign in first) takes priority — but don't
    // navigate here. _layout.tsx's routing effect already reacts to
    // isAuthenticated flipping true and routes there itself; issuing our
    // own router.replace() here too would race it.
    if (useSettingsStore.getState().pendingGuardianConfirmLinkId) {
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.replace('/(tabs)/home'); // defensive fallback, shouldn't happen
      return;
    }

    // Determines role/ward-based routing and marks onboarding complete
    // (deferred for a ward's first sign-in — see the function itself).
    // Not calling syncToSupabase here on purpose: that's the one-time
    // post-confirmation write, already handled in email-confirmed.tsx —
    // a returning user's sign-in should only ever read, never re-run it.
    const dest = await resolvePostSignInDestination(user.id);
    useOnboardingStore.getState().hydrateFromSupabase(user.id);
    router.replace(dest as never);
  }

  return (
    <View className="flex-1 bg-bg-primary">
      <StatusBar barStyle="light-content" backgroundColor={colors.bg.primary} />

      {/* Atmospheric background glow — animated values must stay in style */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: 300,
          alignSelf: 'center',
          top: '50%',
          marginTop: -300,
          backgroundColor: 'rgba(0,229,255,0.05)',
          opacity: pulseOpacity,
          transform: [{ scale: pulseScale }],
        }}
      />

      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerClassName="grow px-5 pb-6 justify-center"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets
          >
            {/* ── Brand Header ── */}
            <View className="items-center mb-8">
              <View className="mb-3">
                <Shield size={48} color={colors.accent} strokeWidth={1.5} />
              </View>
              <Text
                className="font-display-bold text-display-md text-accent uppercase"
                style={{ letterSpacing: -0.5 }}
              >
                Surveillance AI
              </Text>
              <Text className="font-body text-body-md text-text-secondary mt-1.5">
                Authenticated Guardians Only
              </Text>
            </View>

            {/* ── Glass Form Panel ── */}
            <View className="bg-bg-glass border border-border-default rounded-md p-5 gap-4">

              {/* ── Email field ── */}
              <View className="gap-2">
                <View className="flex-row items-center gap-1.5">
                  <AtSign size={13} color={colors.text.secondary} strokeWidth={1.5} />
                  <Text
                    className="font-body-medium text-label-sm text-text-secondary uppercase"
                    style={{ letterSpacing: 0.8 }}
                  >
                    Identity
                  </Text>
                </View>
                <TextInput
                  className={`h-[54px] rounded-sm border px-4 pr-11 font-mono text-body-md text-text-primary ${
                    emailFocused
                      ? 'bg-[rgba(0,229,255,0.04)] border-[rgba(0,229,255,0.5)]'
                      : 'bg-bg-secondary border-border-default'
                  }`}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="agent@network.ai"
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />
              </View>

              {/* ── Password field ── */}
              <View className="gap-2">
                <View className="flex-row items-center gap-1.5">
                  <Lock size={13} color={colors.text.secondary} strokeWidth={1.5} />
                  <Text
                    className="font-body-medium text-label-sm text-text-secondary uppercase"
                    style={{ letterSpacing: 0.8 }}
                  >
                    Clearance Key
                  </Text>
                </View>
                <View className="relative">
                  <TextInput
                    className={`h-[54px] rounded-sm border px-4 pr-11 font-mono text-body-md text-text-primary ${
                      passwordFocused
                        ? 'bg-[rgba(0,229,255,0.04)] border-[rgba(0,229,255,0.5)]'
                        : 'bg-bg-secondary border-border-default'
                    }`}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor={colors.text.tertiary}
                    secureTextEntry={!showPassword}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                  />
                  <Pressable
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={8}
                    className="absolute right-3.5 top-0 bottom-0 justify-center"
                  >
                    {showPassword ? (
                      <EyeOff size={18} color={colors.text.tertiary} strokeWidth={1.5} />
                    ) : (
                      <Eye size={18} color={colors.text.tertiary} strokeWidth={1.5} />
                    )}
                  </Pressable>
                </View>
              </View>

              {/* ── API error ── */}
              {apiError && (
                <Text className="font-body text-label-md text-risk-high text-center">
                  {apiError}
                </Text>
              )}

              {/* ── Submit button ── */}
              <Pressable
                onPress={handleSignIn}
                disabled={loading}
                className="h-14 rounded-full bg-accent items-center justify-center flex-row gap-2 mt-1"
                style={({ pressed }) => ({
                  opacity: loading ? 0.7 : pressed ? 0.88 : 1,
                  shadowColor: colors.accent,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.45,
                  shadowRadius: 18,
                })}
              >
                {loading ? (
                  <ActivityIndicator color={colors.bg.primary} />
                ) : (
                  <Text
                    className="font-body-medium text-label-md text-text-inverse uppercase"
                    style={{ letterSpacing: 0.8 }}
                  >
                    Initiate Login
                  </Text>
                )}
              </Pressable>

              {/* ── Forgot password ── */}
              <Pressable
                onPress={() => router.push('/(auth)/forgot-password')}
                hitSlop={8}
                className="items-center mt-1"
              >
                <Text className="font-body text-body-md text-[rgba(0,229,255,0.7)]">
                  Forgot Password?
                </Text>
              </Pressable>
            </View>

            {/* ── Sign-up link ── */}
            <View className="items-center mt-6 gap-3">
              <View className="w-12 h-px bg-border-subtle" />
              <View className="flex-row items-center">
                <Text className="font-body text-body-md text-text-secondary">
                  Don't have an account?
                </Text>
                <Pressable
                  onPress={() => router.replace('/(onboarding)/account-type')}
                  hitSlop={6}
                >
                  {/* Routes through onboarding, not straight to the sign-up
                      form — account-type.tsx is the only place a fresh
                      account's role (self vs guardian) actually gets chosen. */}
                  <Text className="font-body-medium text-body-md text-accent ml-1.5">
                    Sign up
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* ── Status indicators ── */}
            <View className="flex-row justify-between mt-7 px-1">
              <View className="flex-row items-center gap-1.5">
                <View className="w-1.5 h-1.5 rounded-full bg-risk-low" />
                <Text
                  className="font-mono text-[10px] text-text-secondary uppercase opacity-60"
                  style={{ letterSpacing: 1.2 }}
                >
                  System Online
                </Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Text
                  className="font-mono text-[10px] text-text-secondary uppercase opacity-60"
                  style={{ letterSpacing: 1.2 }}
                >
                  TLS 1.3 Secure
                </Text>
                <View className="opacity-60">
                  <Shield size={11} color={colors.text.secondary} strokeWidth={1.5} />
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
