/*
 * app/(auth)/reset-password.tsx
 *
 * Full password-reset flow, from deep link to new password.
 *
 * How it gets here
 * ----------------
 * 1. User taps "Forgot your password?" → goes to forgot-password.tsx
 * 2. They enter their email → sendPasswordResetEmail() sends an email
 *    containing a link like:
 *      https://[project].supabase.co/auth/v1/verify?token=...
 *      &type=recovery&redirect_to=surveillanceai://reset-password
 * 3. Supabase's server processes the one-time token and 302-redirects
 *    the browser to:
 *      surveillanceai://reset-password#access_token=...&refresh_token=...
 * 4. iOS/Android opens this app via the custom scheme.
 * 5. The deep link listener in app/_layout.tsx catches that URL,
 *    extracts the tokens, and navigates to this screen with the
 *    tokens as route params.
 *
 * What this screen does
 * ----------------------
 * On mount: calls supabase.auth.setSession({ access_token, refresh_token })
 * to restore the user's session from the one-time recovery tokens.
 * This is required before updatePassword() will accept the call.
 *
 * After setSession succeeds: the user enters and confirms a new password.
 * On submit: calls updatePassword() from lib/auth.ts.
 * On success: shows a confirmation then navigates to sign-in.
 */

import { supabase } from "@/lib/supabase";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Shield,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { updatePassword } from "../../lib/auth";
import { colors } from "../../theme/colors";

// Glow shadows — kept as plain objects because they need custom shadowColor values
// that Tailwind cannot express without arbitrary shadow-color support.
const glowAccent = {
  shadowColor: "#00E5FF",
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.4,
  shadowRadius: 20,
};

const glowAccentBtn = {
  shadowColor: "#00E5FF",
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.45,
  shadowRadius: 18,
};

const glowDanger = {
  shadowColor: "#FF3D3D",
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.4,
  shadowRadius: 20,
};

const glowSuccess = {
  shadowColor: "#00E676",
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.4,
  shadowRadius: 20,
};

// ── Shared layout shell ────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-1 bg-bg-primary">
      <StatusBar barStyle="light-content" backgroundColor={colors.bg.primary} />

      {/* Ambient glow orbs */}
      <View className="absolute top-[20%] -left-[60px] w-[220px] h-[220px] rounded-full bg-[rgba(0,229,255,0.05)]" />
      <View className="absolute bottom-[20%] -right-[60px] w-[220px] h-[220px] rounded-full bg-[rgba(0,229,255,0.03)]" />

      <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
        {/* Header bar */}
        <View className="flex-row items-center px-5 h-14 border-b border-border-subtle bg-[rgba(10,10,15,0.80)]">
          <Shield size={20} color={colors.accent} strokeWidth={1.5} />
          <Text className="font-display-bold text-[15px] text-accent tracking-[2px] ml-2">
            SURVEILLANCE AI
          </Text>
        </View>

        {children}

        {/* Footer */}
        <View className="items-center pb-4 pt-2">
          <View className="h-px w-10 bg-border-default mb-2" />
          <Text className="font-mono text-[9px] text-text-tertiary tracking-[1.5px] uppercase text-center leading-[15px]">
            {"ENCRYPTED CHANNEL SECURED\nEND-TO-END VERIFICATION ENABLED"}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ── Shared card sub-components ─────────────────────────────────────────────

function StatusChip() {
  return (
    <View className="px-3 py-1 bg-[rgba(0,229,255,0.10)] border border-border-accent rounded-full mb-5">
      <Text className="font-mono text-[10px] text-accent tracking-[1.5px] uppercase">
        AUTH_PROTOCOL_V2.1
      </Text>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  busy,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      className={`flex-row items-center justify-center gap-2 h-14 rounded-full bg-accent w-full mt-2 ${busy ? "opacity-70" : "active:opacity-90"}`}
      style={glowAccentBtn}
    >
      {busy ? (
        <ActivityIndicator color={colors.bg.primary} />
      ) : (
        <>
          <Text className="font-body-medium text-base text-text-inverse tracking-[0.3px]">
            {label}
          </Text>
          <ArrowRight size={18} color={colors.bg.primary} strokeWidth={2} />
        </>
      )}
    </Pressable>
  );
}

export default function ResetPasswordScreen() {
  const router = useRouter();

  const { access_token, refresh_token } = useLocalSearchParams<{
    access_token: string;
    refresh_token: string;
  }>();

  const [sessionState, setSessionState] = useState<
    "loading" | "ready" | "invalid"
  >("loading");
  const [sessionError, setSessionError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [newFocused, setNewFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  const passwordMismatch =
    confirmPassword.length > 0 && confirmPassword !== newPassword;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  useEffect(() => {
    async function restoreSession() {
      if (!access_token || !refresh_token) {
        setSessionState("invalid");
        setSessionError(
          "Missing reset tokens. Please request a new reset link.",
        );
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (error) {
        setSessionState("invalid");
        setSessionError(
          "This reset link has expired. Please request a new one.",
        );
        return;
      }

      setSessionState("ready");
    }

    restoreSession();
  }, [access_token, refresh_token]);

  async function handleUpdate() {
    setApiError(null);

    if (newPassword !== confirmPassword) {
      setApiError("Passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setApiError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const { success: ok, error } = await updatePassword(newPassword);
    setLoading(false);

    if (!ok) {
      setApiError(error ?? "Failed to update password.");
      return;
    }

    setSuccess(true);
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  if (sessionState === "loading") {
    return (
      <Shell>
        <View className="flex-1 items-center justify-center px-6">
          <View className="bg-bg-glass border border-border-default rounded-lg p-6 items-center w-full">
            <StatusChip />
            <Animated.View
              className="w-16 h-16 rounded-full bg-[rgba(0,229,255,0.10)] border border-[rgba(0,229,255,0.25)] items-center justify-center mb-5"
              style={[glowAccent, { transform: [{ scale: pulseAnim }] }]}
            >
              <KeyRound size={28} color={colors.accent} strokeWidth={1.5} />
            </Animated.View>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text className="font-body text-body-md text-text-secondary mt-3">
              Verifying reset link...
            </Text>
          </View>
        </View>
      </Shell>
    );
  }

  // ── Invalid / expired link ─────────────────────────────────────────────────

  if (sessionState === "invalid") {
    return (
      <Shell>
        <View className="flex-1 items-center justify-center px-6">
          <View className="bg-bg-glass border border-border-default rounded-lg p-6 items-center w-full">
            <StatusChip />
            <View
              className="w-16 h-16 rounded-full bg-[rgba(255,61,61,0.10)] border border-[rgba(255,61,61,0.25)] items-center justify-center mb-5"
              style={glowDanger}
            >
              <KeyRound size={28} color={colors.risk.high} strokeWidth={1.5} />
            </View>
            <Text className="font-display-bold text-display-md text-text-primary text-center mb-2">
              Link Expired
            </Text>
            <Text className="font-body text-body-md text-text-secondary text-center mb-5 px-2">
              {sessionError}
            </Text>
            <ActionButton
              label="Request New Link"
              onPress={() => router.replace("/(auth)/forgot-password")}
            />
          </View>
        </View>
      </Shell>
    );
  }

  // ── Success state ──────────────────────────────────────────────────────────

  if (success) {
    return (
      <Shell>
        <View className="flex-1 items-center justify-center px-6">
          <View className="bg-bg-glass border border-border-default rounded-lg p-6 items-center w-full">
            <StatusChip />
            <View
              className="w-16 h-16 rounded-full bg-[rgba(0,230,118,0.10)] border border-[rgba(0,230,118,0.30)] items-center justify-center mb-5"
              style={glowSuccess}
            >
              <CheckCircle2
                size={28}
                color={colors.risk.low}
                strokeWidth={1.5}
              />
            </View>
            <Text className="font-display-bold text-display-md text-text-primary text-center mb-2">
              Password Updated!
            </Text>
            <Text className="font-body text-body-md text-text-secondary text-center mb-5 px-2">
              You can now sign in with your new password.
            </Text>
            <ActionButton
              label="Go to Sign In"
              onPress={() => router.replace("/(auth)/sign-in")}
            />
          </View>
        </View>
      </Shell>
    );
  }

  // ── Set new password form ──────────────────────────────────────────────────

  return (
    <Shell>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerClassName="flex-grow items-center justify-center px-6 py-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
        >
          <View className="bg-bg-glass border border-border-default rounded-lg p-6 items-center w-full">
            {/* Status chip */}
            <StatusChip />

            {/* Icon */}
            <Animated.View
              className="w-16 h-16 rounded-full bg-[rgba(0,229,255,0.10)] border border-[rgba(0,229,255,0.25)] items-center justify-center mb-5"
              style={[glowAccent, { transform: [{ scale: pulseAnim }] }]}
            >
              <KeyRound size={28} color={colors.accent} strokeWidth={1.5} />
            </Animated.View>

            {/* Headline + subtitle */}
            <Text className="font-display-bold text-display-md text-text-primary text-center mb-2">
              Set New Password
            </Text>
            <Text className="font-body text-body-md text-text-secondary text-center mb-5 px-2">
              Choose a strong password of at least 8 characters for your
              account.
            </Text>

            {/* New password */}
            <View className="w-full">
              <Text className="font-body-medium text-[11px] tracking-[0.8px] text-text-secondary uppercase mb-1.5 ml-0.5">
                NEW PASSWORD
              </Text>
              <View
                className={`flex-row items-center h-[52px] rounded-md border px-[14px] mb-3 ${
                  newFocused
                    ? "bg-[rgba(0,229,255,0.04)] border-[rgba(0,229,255,0.50)]"
                    : "bg-[rgba(255,255,255,0.05)] border-border-default"
                }`}
              >
                <KeyRound
                  size={16}
                  color={newFocused ? colors.accent : colors.text.tertiary}
                  strokeWidth={1.5}
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  className="flex-1 font-body text-[15px] text-text-primary"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Min. 8 characters"
                  placeholderTextColor={colors.text.tertiary}
                  secureTextEntry={!showNew}
                  onFocus={() => setNewFocused(true)}
                  onBlur={() => setNewFocused(false)}
                />
                <Pressable onPress={() => setShowNew((v) => !v)} hitSlop={8}>
                  {showNew ? (
                    <EyeOff
                      size={18}
                      color={colors.text.tertiary}
                      strokeWidth={1.5}
                    />
                  ) : (
                    <Eye
                      size={18}
                      color={colors.text.tertiary}
                      strokeWidth={1.5}
                    />
                  )}
                </Pressable>
              </View>
            </View>

            {/* Confirm password */}
            <View className="w-full">
              <Text className="font-body-medium text-[11px] tracking-[0.8px] text-text-secondary uppercase mb-1.5 ml-0.5">
                CONFIRM PASSWORD
              </Text>
              <View
                className={`flex-row items-center h-[52px] rounded-md border px-[14px] mb-3 ${
                  passwordMismatch
                    ? "bg-[rgba(255,255,255,0.05)] border-risk-high"
                    : confirmFocused
                      ? "bg-[rgba(0,229,255,0.04)] border-[rgba(0,229,255,0.50)]"
                      : "bg-[rgba(255,255,255,0.05)] border-border-default"
                }`}
              >
                <KeyRound
                  size={16}
                  color={
                    passwordMismatch
                      ? colors.risk.high
                      : confirmFocused
                        ? colors.accent
                        : colors.text.tertiary
                  }
                  strokeWidth={1.5}
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  className="flex-1 font-body text-[15px] text-text-primary"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter password"
                  placeholderTextColor={colors.text.tertiary}
                  secureTextEntry={!showConfirm}
                  onFocus={() => setConfirmFocused(true)}
                  onBlur={() => setConfirmFocused(false)}
                />
                <Pressable
                  onPress={() => setShowConfirm((v) => !v)}
                  hitSlop={8}
                >
                  {showConfirm ? (
                    <EyeOff
                      size={18}
                      color={colors.text.tertiary}
                      strokeWidth={1.5}
                    />
                  ) : (
                    <Eye
                      size={18}
                      color={colors.text.tertiary}
                      strokeWidth={1.5}
                    />
                  )}
                </Pressable>
              </View>
              {passwordMismatch && (
                <Text className="font-body text-[12px] text-risk-high -mt-1.5 mb-2">
                  Passwords do not match.
                </Text>
              )}
            </View>

            {/* API error */}
            {apiError && (
              <Text className="font-body text-[13px] text-risk-high text-center mb-2">
                {apiError}
              </Text>
            )}

            {/* Action button */}
            <ActionButton
              label="Update Password"
              onPress={handleUpdate}
              busy={loading}
            />

            {/* Divider */}
            <View className="h-px w-full bg-border-subtle mt-5 mb-4" />

            {/* Back link */}
            <Pressable
              onPress={() => router.replace("/(auth)/sign-in")}
              className="flex-row items-center gap-1.5 active:opacity-70"
            >
              <ArrowLeft
                size={16}
                color={colors.text.secondary}
                strokeWidth={1.5}
              />
              <Text className="font-body-medium text-sm text-text-secondary">
                Back to Login
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Shell>
  );
}
