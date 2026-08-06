import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  AtSign,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react-native";
import { forwardRef, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ContinueButton } from "../../components/ui/ContinueButton";
import { useOnboardingStore } from "../../store/useOnboardingStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { colors } from "../../theme/colors";

const TOTAL_STEPS = 12;
const CURRENT_STEP = 6;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// International E.164-style: must start with +, then 7–15 digits/separators.
const PHONE_REGEX = /^\+[\d\s\-().]{7,15}$/;

type Field = "name" | "phone" | "email";

export default function ContactScreen() {
  const router = useRouter();
  const setOnboarding = useOnboardingStore((s) => s.set);
  const insets = useSafeAreaInsets();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [focused, setFocused] = useState<Field | null>(null);

  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);

  const isValid =
    name.trim().length > 0 &&
    PHONE_REGEX.test(phone.trim()) &&
    EMAIL_REGEX.test(email.trim());

  async function handleContinue() {
    if (!isValid) return;
    const trimName  = name.trim();
    const trimPhone = phone.trim();
    const trimEmail = email.trim();

    // 1. Onboarding store (feeds plan-reveal summary + later Supabase sync)
    setOnboarding({ contactName: trimName, contactPhone: trimPhone, contactEmail: trimEmail });

    // 2. Settings store — persisted immediately so the rest of the app can read it
    useSettingsStore.getState().updateSettings({
      contactName:  trimName,
      contactPhone: trimPhone,
      contactEmail: trimEmail,
    });

    // 3. SecureStore — survives AsyncStorage wipes and iOS reinstalls
    await Promise.all([
      SecureStore.setItemAsync("contact_phone", trimPhone),
      SecureStore.setItemAsync("contact_email", trimEmail),
    ]).catch(console.warn);

    router.push("/(onboarding)/speed" as any);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg.primary }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <SafeAreaView
        style={{ flex: 1 }}
        edges={["top"]}
      >
      <StatusBar barStyle="light-content" backgroundColor={colors.bg.primary} />

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          height: 56,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ShieldCheck size={20} color={colors.accent} strokeWidth={2} />
          <Text
            className="font-display-bold text-[18px] text-accent"
            style={{ letterSpacing: -0.3 }}
          >
            Surveillance AI
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/")}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text className="font-body-medium text-body-md text-text-secondary">
            Skip
          </Text>
        </Pressable>
      </View>

      {/* Progress bar */}
      <View
        style={{
          height: 2,
          backgroundColor: "rgba(255,255,255,0.08)",
          marginHorizontal: 20,
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: 2,
            backgroundColor: colors.accent,
            borderRadius: 999,
            width: `${(CURRENT_STEP / TOTAL_STEPS) * 100}%`,
          }}
        />
      </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
        >
          {/* Headline */}
          <View
            style={{ paddingHorizontal: 20, marginTop: 36, marginBottom: 32 }}
          >
            <Text
              className="font-display-bold text-text-primary"
              style={{
                fontSize: 32,
                lineHeight: 40,
                letterSpacing: -0.5,
                marginBottom: 10,
              }}
            >
              Who should we contact if something is wrong?
            </Text>
            <Text className="font-body text-body-lg text-text-secondary">
              This person will receive an SMS, email, and phone call if the app
              detects a high-risk situation.
            </Text>
          </View>

          {/* Fields */}
          <View style={{ paddingHorizontal: 20 }}>
            <InputField
              label="CONTACT NAME"
              icon={
                <User
                  size={18}
                  color={
                    focused === "name" ? colors.accent : colors.text.tertiary
                  }
                  strokeWidth={1.8}
                />
              }
              value={name}
              onChangeText={setName}
              placeholder="e.g. Sarah Connor"
              focused={focused === "name"}
              onFocus={() => setFocused("name")}
              onBlur={() => setFocused(null)}
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
            />

            <InputField
              ref={phoneRef}
              label="PHONE NUMBER"
              icon={
                <Phone
                  size={18}
                  color={
                    focused === "phone" ? colors.accent : colors.text.tertiary
                  }
                  strokeWidth={1.8}
                />
              }
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 (555) 000-0000"
              focused={focused === "phone"}
              onFocus={() => setFocused("phone")}
              onBlur={() => setFocused(null)}
              keyboardType="phone-pad"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              hint="Include country code, e.g. +1 or +44"
            />

            <InputField
              ref={emailRef}
              label="EMAIL ADDRESS"
              icon={
                <AtSign
                  size={18}
                  color={
                    focused === "email" ? colors.accent : colors.text.tertiary
                  }
                  strokeWidth={1.8}
                />
              }
              value={email}
              onChangeText={setEmail}
              placeholder="contact@example.com"
              focused={focused === "email"}
              onFocus={() => setFocused("email")}
              onBlur={() => setFocused(null)}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleContinue}
            />

            {/* Privacy card */}
            <View
              style={{
                marginTop: 8,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: `${colors.accent}33`,
                backgroundColor: "rgba(0,229,255,0.04)",
                padding: 20,
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 16,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: "rgba(0,229,255,0.10)",
                  borderWidth: 1,
                  borderColor: `${colors.accent}44`,
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <ShieldCheck
                  size={20}
                  color={colors.accent}
                  strokeWidth={1.5}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 16,
                    color: colors.text.primary,
                    marginBottom: 4,
                  }}
                >
                  Encrypted & Secure
                </Text>
                <Text className="font-body text-body-md text-text-secondary">
                  Emergency contact data is encrypted end-to-end. Only used
                  during active SOS events.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Bottom nav */}
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: "rgba(255,255,255,0.06)",
            backgroundColor: colors.bg.primary,
            paddingBottom: insets.bottom || 16,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 20,
              paddingVertical: 16,
            }}
          >
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => ({
                opacity: pressed ? 0.6 : 1,
                alignItems: "center",
                gap: 2,
              })}
            >
              <ArrowLeft
                size={20}
                color={colors.text.secondary}
                strokeWidth={2}
              />
              <Text className="font-mono text-[10px] text-text-secondary tracking-[0.5px]">
                BACK
              </Text>
            </Pressable>

            <ContinueButton onPress={handleContinue} enabled={isValid} />
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

type InputFieldProps = {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  hint?: string;
  keyboardType?: TextInput["props"]["keyboardType"];
  autoCapitalize?: TextInput["props"]["autoCapitalize"];
  returnKeyType?: TextInput["props"]["returnKeyType"];
  onSubmitEditing?: () => void;
};

const InputField = forwardRef<TextInput, InputFieldProps>(function InputField(
  {
    label,
    icon,
    value,
    onChangeText,
    placeholder,
    focused,
    onFocus,
    onBlur,
    hint,
    ...rest
  },
  ref,
) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text
        style={{
          fontFamily: "JetBrainsMono_400Regular",
          fontSize: 10,
          color: focused ? colors.accent : colors.text.tertiary,
          letterSpacing: 1.2,
          marginBottom: 8,
          marginLeft: 2,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          height: 56,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: focused
            ? `${colors.accent}66`
            : "rgba(255,255,255,0.10)",
          backgroundColor: focused
            ? "rgba(0,229,255,0.04)"
            : colors.bg.secondary,
          paddingHorizontal: 16,
          gap: 12,
          shadowColor: colors.accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: focused ? 0.2 : 0,
          shadowRadius: 12,
        }}
      >
        {icon}
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.text.tertiary}
          onFocus={onFocus}
          onBlur={onBlur}
          style={{
            flex: 1,
            fontFamily: "DMSans_400Regular",
            fontSize: 15,
            color: colors.text.primary,
            paddingVertical: 0,
          }}
          {...rest}
        />
      </View>
      {hint ? (
        <Text
          style={{
            fontFamily: "DMSans_400Regular",
            fontSize: 12,
            color: colors.text.tertiary,
            marginTop: 6,
            marginLeft: 2,
          }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
});
