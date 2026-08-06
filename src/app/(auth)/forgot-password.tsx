import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, AtSign, LockKeyhole, MailCheck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sendPasswordResetEmail } from '../../lib/auth';

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.6,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  async function handleSend() {
    setApiError(null);
    setLoading(true);
    const { success, error } = await sendPasswordResetEmail(email.trim());
    setLoading(false);
    if (!success) {
      setApiError(error ?? 'Could not send reset email.');
      return;
    }
    setSent(true);
  }

  return (
    <View className="flex-1 bg-bg-primary">
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />

      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        {/* ── Top bar ── */}
        <View className="h-16 flex-row items-center justify-between px-screen bg-bg-primary/80">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            className="active:opacity-60"
          >
            <ArrowLeft size={22} color="#00E5FF" strokeWidth={1.5} />
          </Pressable>

          <Text className="font-display-bold text-heading-lg text-accent tracking-widest">
            SURVEILLANCE AI
          </Text>

          {/* Spacer to keep title centred */}
          <View className="w-6" />
        </View>

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets
          >

            {/* ── Glass card ── */}
            <View className="bg-bg-glass border border-border-default rounded-lg p-7 items-center overflow-hidden">

              {/* Atmospheric glow blob */}
              <View
                className="absolute -top-16 -right-16 w-40 h-40 rounded-full"
                style={{ backgroundColor: 'rgba(0,229,255,0.08)' }}
                pointerEvents="none"
              />

              {sent ? (
                /* ── Success state ── */
                <View className="items-center w-full">
                  {/* Icon */}
                  <View
                    className="w-16 h-16 rounded-full items-center justify-center mb-sm"
                    style={{
                      backgroundColor: 'rgba(0,230,118,0.10)',
                      borderWidth: 1,
                      borderColor: 'rgba(0,230,118,0.25)',
                      shadowColor: '#00E676',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.4,
                      shadowRadius: 16,
                    }}
                  >
                    <MailCheck size={30} color="#00E676" strokeWidth={1.5} />
                  </View>

                  <Text className="font-display-bold text-display-sm text-text-primary text-center mb-sm">
                    Link Transmitted
                  </Text>

                  <Text className="font-body text-body-md text-text-secondary text-center max-w-[280px] mb-xl">
                    We sent a password reset link to{'\n'}
                    <Text className="text-text-primary">{email.trim()}</Text>
                  </Text>

                  <Pressable
                    onPress={() => router.replace('/(auth)/sign-in')}
                    className="flex-row items-center gap-1.5 active:opacity-60"
                  >
                    <ArrowLeft size={16} color="#8888A0" strokeWidth={1.5} />
                    <Text className="font-body-medium text-label-lg text-text-secondary">
                      Back to Login
                    </Text>
                  </Pressable>
                </View>
              ) : (
                /* ── Send form ── */
                <View className="items-center w-full">
                  {/* Lock icon */}
                  <View
                    className="w-16 h-16 rounded-full items-center justify-center mb-sm"
                    style={{
                      backgroundColor: 'rgba(0,229,255,0.10)',
                      borderWidth: 1,
                      borderColor: 'rgba(0,229,255,0.20)',
                      shadowColor: '#00E5FF',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.4,
                      shadowRadius: 16,
                    }}
                  >
                    <LockKeyhole size={30} color="#00E5FF" strokeWidth={1.5} />
                  </View>

                  <Text className="font-display-bold text-display-sm text-text-primary text-center mb-sm">
                    Forgot Password
                  </Text>

                  <Text className="font-body text-body-md text-text-secondary text-center max-w-[280px] mb-7">
                    Enter your email address and we'll send you a link to reset your password.
                  </Text>

                  {/* Email field */}
                  <View className="w-full mb-sm">
                    <Text className="font-mono text-data-sm text-accent uppercase mb-sm tracking-widest">
                      REGISTERED EMAIL
                    </Text>

                    <View className="relative">
                      <View
                        className="absolute left-4 top-0 bottom-0 justify-center z-10"
                        pointerEvents="none"
                      >
                        <AtSign
                          size={18}
                          color={emailFocused ? '#00E5FF' : '#8888A0'}
                          strokeWidth={1.5}
                        />
                      </View>

                      <TextInput
                        className="h-[54px] rounded-md pl-[46px] pr-[18px] font-body text-body-lg text-text-primary"
                        style={{
                          backgroundColor: emailFocused
                            ? 'rgba(0,229,255,0.04)'
                            : 'rgba(255,255,255,0.05)',
                          borderWidth: 1,
                          borderColor: emailFocused
                            ? 'rgba(0,229,255,0.50)'
                            : 'rgba(255,255,255,0.10)',
                        }}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="agent@surveillance.ai"
                        placeholderTextColor="rgba(136,136,160,0.4)"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        onFocus={() => setEmailFocused(true)}
                        onBlur={() => setEmailFocused(false)}
                      />
                    </View>
                  </View>

                  {/* API error */}
                  {apiError && (
                    <Text className="font-body text-body-sm text-risk-high text-center mb-sm">
                      {apiError}
                    </Text>
                  )}

                  {/* CTA button */}
                  <Pressable
                    onPress={handleSend}
                    disabled={loading}
                    className="w-full h-14 rounded-full flex-row items-center justify-center gap-2 mt-sm mb-5 active:opacity-90"
                    style={{
                      backgroundColor: '#00E5FF',
                      opacity: loading ? 0.7 : 1,
                      shadowColor: '#00E5FF',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.45,
                      shadowRadius: 18,
                    }}
                  >
                    {loading ? (
                      <ActivityIndicator color="#0A0A0F" />
                    ) : (
                      <>
                        <Text
                          className="font-mono text-data-md text-text-inverse font-bold tracking-widest"
                        >
                          SEND RESET LINK
                        </Text>
                        <ArrowRight size={18} color="#0A0A0F" strokeWidth={2} />
                      </>
                    )}
                  </Pressable>

                  {/* Back to login */}
                  <Pressable
                    onPress={() => router.back()}
                    className="flex-row items-center gap-1.5 active:opacity-60"
                  >
                    <ArrowLeft size={16} color="#8888A0" strokeWidth={1.5} />
                    <Text className="font-body-medium text-label-lg text-text-secondary">
                      Back to Login
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* ── Footer status ── */}
            <View className="items-center mt-xl gap-1.5 opacity-40">
              <View className="flex-row items-center gap-2">
                <Animated.View
                  className="w-1.5 h-1.5 rounded-full bg-risk-low"
                  style={{ transform: [{ scale: pulseAnim }] }}
                />
                <Text className="font-mono text-data-sm text-text-secondary uppercase tracking-widest">
                  Secure Connection Active
                </Text>
              </View>
              <Text className="font-mono text-data-sm text-text-secondary uppercase tracking-widest">
                Authenticated Guardians Only
              </Text>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
