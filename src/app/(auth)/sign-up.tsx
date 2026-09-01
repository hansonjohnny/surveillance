import { useRouter } from "expo-router";
import {
  ArrowRight,
  AtSign,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Phone,
  Shield,
  User,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { signUp } from "../../lib/auth";
import { CONFIRM_BRIDGE_URL } from "../../lib/supabase";
import { useOnboardingStore } from "../../store/useOnboardingStore";
import { colors } from "../../theme/colors";

const PHONE_REGEX = /^\+[\d\s\-().]{7,15}$/;

export default function SignUpScreen() {
  const router = useRouter();
  const setOnboarding = useOnboardingStore((s) => s.set);
  // accountType is decided once, at account-type.tsx, before this screen
  // is ever reached — read reactively so the phone field can render
  // immediately, not just at submit time.
  const isGuardian = useOnboardingStore((s) => s.data.accountType) === "guardian";
  // Lives in useOnboardingStore, not local state, like every other field
  // in this flow — it has to survive until email-confirmed.tsx can
  // write it, which may be well after this screen unmounts.
  const phone = useOnboardingStore((s) => s.data.phone) ?? "";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);

  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);

  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  async function handleSignUp() {
    setApiError(null);

    if (!agreedToTerms) {
      setApiError("Please agree to the Terms of Service to continue.");
      return;
    }

    if (isGuardian && !PHONE_REGEX.test(phone.trim())) {
      setApiError("Enter a valid phone number, e.g. +1 555 123 4567.");
      return;
    }

    setLoading(true);
    const { success, error } = await signUp(email.trim(), password, {
      data: { full_name: fullName },
      emailRedirectTo: CONFIRM_BRIDGE_URL,
    });
    setLoading(false);

    if (!success) {
      setApiError(error ?? "Sign-up failed.");
      return;
    }

    // No session exists yet — email confirmation is required first (see
    // supabase/config, mailer_autoconfirm: false). Role/phone or
    // contact/settings can't be written until then (both need auth.uid()
    // under RLS), so that write is deferred to email-confirmed.tsx, and
    // this account's onboarding answers stay in useOnboardingStore
    // (not reset yet) so they're still there when it runs.
    setSignupComplete(true);
  }

  return (
    <View className="flex-1 bg-bg-primary">
      <StatusBar barStyle="light-content" backgroundColor={colors.bg.primary} />

      {/* ── Header bar ── */}
      <SafeAreaView
        edges={["top"]}
        className="bg-[rgba(10,10,15,0.85)] border-b border-[rgba(255,255,255,0.08)]"
        style={{
          shadowColor: colors.accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.12,
          shadowRadius: 20,
        }}
      >
        <View className="h-[52px] flex-row items-center justify-center gap-2">
          <Shield size={18} color={colors.accent} strokeWidth={1.5} />
          <Text
            className="font-display-bold text-[17px] text-accent"
            style={{ letterSpacing: 2.5 }}
          >
            SURVEILLANCE AI
          </Text>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        className="flex-1"
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 52 : 0}
      >
        <ScrollView
          contentContainerClassName="px-6 pt-9 pb-10 items-center"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Shield pulse ── */}
          <Animated.View
            className="mb-6"
            style={{ transform: [{ scale: pulseAnim }] }}
          >
            <View className="w-16 h-16 rounded-full bg-bg-glass border border-border-default items-center justify-center">
              <Shield size={28} color={colors.accent} strokeWidth={1.5} />
            </View>
          </Animated.View>

          {signupComplete ? (
            <View className="w-full bg-bg-glass border border-border-default rounded-lg p-6 items-center">
              <View className="w-16 h-16 rounded-full bg-[rgba(0,230,118,0.10)] border border-[rgba(0,230,118,0.30)] items-center justify-center mb-5">
                <CheckCircle2 size={28} color={colors.risk.low} strokeWidth={1.5} />
              </View>
              <Text className="font-display-bold text-display-md text-text-primary text-center mb-2">
                Confirm your email to continue
              </Text>
              <Text className="font-body text-body-md text-text-secondary text-center mb-6">
                We sent a link to {email}. Tap it, then come back and sign
                in.
              </Text>
              <Pressable
                onPress={() => router.replace("/(auth)/sign-in")}
                className="h-14 rounded-full bg-accent flex-row items-center justify-center gap-2 w-full"
                style={{
                  shadowColor: colors.accent,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.45,
                  shadowRadius: 18,
                }}
              >
                <Text
                  className="font-body-medium text-[16px] text-text-inverse"
                  style={{ letterSpacing: 0.3 }}
                >
                  Go to Sign In
                </Text>
                <ArrowRight size={18} color={colors.bg.primary} strokeWidth={2} />
              </Pressable>
            </View>
          ) : (
          <>
          {/* ── Headline ── */}
          <Text className="font-display-bold text-display-lg text-text-primary text-center mb-2.5">
            Create Your Account
          </Text>
          <Text className="font-body text-[15px] leading-6 text-text-secondary text-center mb-7 max-w-[300px]">
            Initialize your personal AI guardian and begin high-performance
            protection.
          </Text>

          {/* ── Glass form card ── */}
          <View className="w-full bg-bg-glass border border-border-default rounded-lg p-5 gap-4">
            {/* Full Name */}
            <View className="gap-2">
              <View className="flex-row items-center gap-1.5">
                <User
                  size={12}
                  color={colors.text.secondary}
                  strokeWidth={1.5}
                />
                <Text
                  className="font-body-medium text-label-sm text-text-secondary uppercase"
                  style={{ letterSpacing: 0.8 }}
                >
                  Full Name
                </Text>
              </View>
              <TextInput
                className={`h-[54px] rounded-md border px-[18px] font-body text-[15px] text-text-primary ${
                  nameFocused
                    ? "bg-[rgba(0,229,255,0.04)] border-[rgba(0,229,255,0.5)]"
                    : "bg-bg-secondary border-border-default"
                }`}
                value={fullName}
                onChangeText={setFullName}
                placeholder="John Doe"
                placeholderTextColor={colors.text.tertiary}
                autoCapitalize="words"
                autoCorrect={false}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
              />
            </View>

            {/* Phone — guardian accounts only, auto-fills as the ward's
                primary emergency contact at creation time */}
            {isGuardian && (
              <View className="gap-2">
                <View className="flex-row items-center gap-1.5">
                  <Phone
                    size={12}
                    color={colors.text.secondary}
                    strokeWidth={1.5}
                  />
                  <Text
                    className="font-body-medium text-label-sm text-text-secondary uppercase"
                    style={{ letterSpacing: 0.8 }}
                  >
                    Phone Number
                  </Text>
                </View>
                <TextInput
                  className={`h-[54px] rounded-md border px-[18px] font-body text-[15px] text-text-primary ${
                    phoneFocused
                      ? "bg-[rgba(0,229,255,0.04)] border-[rgba(0,229,255,0.5)]"
                      : "bg-bg-secondary border-border-default"
                  }`}
                  value={phone}
                  onChangeText={(text) => setOnboarding({ phone: text })}
                  placeholder="+1 555 123 4567"
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="phone-pad"
                  onFocus={() => setPhoneFocused(true)}
                  onBlur={() => setPhoneFocused(false)}
                />
                <Text className="font-body text-[12px] text-text-tertiary">
                  Include country code — this becomes your ward's SOS contact.
                </Text>
              </View>
            )}

            {/* Email */}
            <View className="gap-2">
              <View className="flex-row items-center gap-1.5">
                <AtSign
                  size={12}
                  color={colors.text.secondary}
                  strokeWidth={1.5}
                />
                <Text
                  className="font-body-medium text-label-sm text-text-secondary uppercase"
                  style={{ letterSpacing: 0.8 }}
                >
                  Email Address
                </Text>
              </View>
              <TextInput
                className={`h-[54px] rounded-md border px-[18px] font-body text-[15px] text-text-primary ${
                  emailFocused
                    ? "bg-[rgba(0,229,255,0.04)] border-[rgba(0,229,255,0.5)]"
                    : "bg-bg-secondary border-border-default"
                }`}
                value={email}
                onChangeText={setEmail}
                placeholder="name@security.com"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </View>

            {/* Password */}
            <View className="gap-2">
              <View className="flex-row items-center gap-1.5">
                <Lock
                  size={12}
                  color={colors.text.secondary}
                  strokeWidth={1.5}
                />
                <Text
                  className="font-body-medium text-label-sm text-text-secondary uppercase"
                  style={{ letterSpacing: 0.8 }}
                >
                  Password
                </Text>
              </View>
              <View className="relative">
                <TextInput
                  className={`h-[54px] rounded-md border px-[18px] pr-12 font-body text-[15px] text-text-primary ${
                    passwordFocused
                      ? "bg-[rgba(0,229,255,0.04)] border-[rgba(0,229,255,0.5)]"
                      : "bg-bg-secondary border-border-default"
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
                  className="absolute right-4 top-0 bottom-0 justify-center"
                >
                  {showPassword ? (
                    <EyeOff
                      size={20}
                      color={colors.text.tertiary}
                      strokeWidth={1.5}
                    />
                  ) : (
                    <Eye
                      size={20}
                      color={colors.text.tertiary}
                      strokeWidth={1.5}
                    />
                  )}
                </Pressable>
              </View>
            </View>

            {/* TOS Checkbox */}
            <Pressable
              onPress={() => setAgreedToTerms((v) => !v)}
              className="flex-row items-start gap-3"
            >
              <View
                className={`w-5 h-5 rounded-sm mt-0.5 items-center justify-center border ${
                  agreedToTerms
                    ? "bg-[rgba(0,229,255,0.125)] border-accent"
                    : "bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.20)]"
                }`}
              >
                {agreedToTerms && (
                  <View className="w-2.5 h-2.5 rounded-[2px] bg-accent" />
                )}
              </View>
              <Text className="font-body text-[13px] leading-5 text-text-secondary flex-1">
                I agree to the{" "}
                <Text className="text-accent">Terms of Service</Text> and{" "}
                <Text className="text-accent">Privacy Policy</Text>.
              </Text>
            </Pressable>

            {/* API error */}
            {apiError && (
              <Text className="font-body text-label-md text-risk-high text-center">
                {apiError}
              </Text>
            )}

            {/* Create Account button */}
            <Pressable
              onPress={handleSignUp}
              disabled={loading}
              className="h-14 rounded-full bg-accent flex-row items-center justify-center gap-2"
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
                <>
                  <Text
                    className="font-body-medium text-[16px] text-text-inverse"
                    style={{ letterSpacing: 0.3 }}
                  >
                    Create Account
                  </Text>
                  <ArrowRight
                    size={18}
                    color={colors.bg.primary}
                    strokeWidth={2}
                  />
                </>
              )}
            </Pressable>

            {/* Secure Initialization divider */}
            <View className="flex-row items-center gap-2.5">
              <View className="flex-1 h-px bg-[rgba(255,255,255,0.08)]" />
              <Text
                className="font-mono text-[10px] text-text-tertiary uppercase"
                style={{ letterSpacing: 1 }}
              >
                Secure Initialization
              </Text>
              <View className="flex-1 h-px bg-[rgba(255,255,255,0.08)]" />
            </View>

            {/* Sign-in link */}
            <View className="flex-row justify-center items-center">
              <Text className="font-body text-body-md text-text-secondary">
                Already have an account?{" "}
              </Text>
              <Pressable
                onPress={() => router.replace("/(auth)/sign-in")}
                hitSlop={6}
              >
                <Text className="font-body-medium text-body-md text-accent">
                  Log in
                </Text>
              </Pressable>
            </View>
          </View>
          </>
          )}

          {/* ── Footer status decorations ── */}
          <View className="flex-row gap-6 mt-8 opacity-40">
            <View className="flex-row items-center gap-1.5">
              <View className="w-1.5 h-1.5 rounded-full bg-risk-low" />
              <Text
                className="font-mono text-[10px] text-text-secondary"
                style={{ letterSpacing: 0.5 }}
              >
                AES-256 ENCRYPTED
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <View className="w-1.5 h-1.5 rounded-full bg-risk-low" />
              <Text
                className="font-mono text-[10px] text-text-secondary"
                style={{ letterSpacing: 0.5 }}
              >
                NEURAL-LINK ACTIVE
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
