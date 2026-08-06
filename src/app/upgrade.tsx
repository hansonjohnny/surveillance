// Upgrade screen — placeholder until RevenueCat is integrated.
// Shows the three plan tiers. The "Subscribe" buttons are no-ops for now.
// When RevenueCat is added, replace the onPress handlers with
// Purchases.purchasePackage() calls.

import { PLANS } from '../lib/plans';
import { supabase } from '../lib/supabase';
import { useSettingsStore } from '../store/useSettingsStore';
import { useRouter } from 'expo-router';
import { Check, Shield, X } from 'lucide-react-native';
import { Alert, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BG = '#0A0A0F';
const CYAN = '#00E5FF';

type Feature = { label: string; free: boolean; pro: boolean; guardian: boolean };

const FEATURES: Feature[] = [
  { label: 'AI image analysis',         free: true,  pro: true,  guardian: true  },
  { label: 'Audio transcription',       free: false, pro: true,  guardian: true  },
  { label: 'Audio threat detection',    free: false, pro: true,  guardian: true  },
  { label: 'Daily AI analyses',         free: false, pro: false, guardian: false }, // shown separately
  { label: '30s monitoring interval',   free: false, pro: true,  guardian: true  },
  { label: '20s monitoring interval',   free: false, pro: false, guardian: true  },
  { label: 'SMS + email + call alerts', free: true,  pro: true,  guardian: true  },
  { label: 'Priority alert delivery',  free: false, pro: false, guardian: true  },
];

function Tick({ ok }: { ok: boolean }) {
  return ok
    ? <Check size={16} color="#00E676" strokeWidth={2} />
    : <X size={16} color="#333344" strokeWidth={2} />;
}

export default function UpgradeScreen() {
  const router = useRouter();
  const currentPlan = useSettingsStore((s) => s.plan);
  const setPlan = useSettingsStore((s) => s.setPlan);

  async function handleSubscribe(plan: 'pro' | 'guardian') {
    try {
      const { error } = await supabase.functions.invoke('upgrade-plan', {
        body: { plan },
      });
      if (error) throw error;
      setPlan(plan);
      Alert.alert(
        `You're on ${PLANS[plan].label}`,
        'Your plan has been updated.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err) {
      console.warn('[upgrade] plan update failed:', err);
      Alert.alert('Upgrade Failed', 'Could not update your plan. Please try again.');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      <SafeAreaView edges={['top']}>
        <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <X size={22} color="#8888A0" strokeWidth={1.5} />
          </TouchableOpacity>
          <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 18, color: '#F0F0F5', marginLeft: 16 }}>
            Choose a Plan
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(0,229,255,0.10)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Shield size={36} color={CYAN} strokeWidth={1.5} />
          </View>
          <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 26, color: '#F0F0F5', textAlign: 'center', letterSpacing: -0.5 }}>
            More coverage.{'\n'}More peace of mind.
          </Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#8888A0', textAlign: 'center', marginTop: 10, lineHeight: 22 }}>
            Upgrade to unlock audio analysis,{'\n'}faster monitoring, and unlimited AI scans.
          </Text>
        </View>

        {/* Plan cards */}
        {(['free', 'pro', 'guardian'] as const).map((plan) => {
          const config = PLANS[plan];
          const isCurrent = plan === currentPlan;
          const isUpgrade = plan !== 'free';

          return (
            <View
              key={plan}
              style={{
                borderRadius: 20,
                borderWidth: isCurrent ? 1.5 : 1,
                borderColor: isCurrent ? config.color : 'rgba(255,255,255,0.10)',
                backgroundColor: isCurrent ? `${config.color}0D` : 'rgba(255,255,255,0.03)',
                padding: 20,
                marginBottom: 16,
              }}
            >
              {/* Plan header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, backgroundColor: `${config.color}1A`, borderWidth: 1, borderColor: `${config.color}40` }}>
                    <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: config.color }}>
                      {config.label}
                    </Text>
                  </View>
                  {isCurrent && (
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: config.color }}>
                      Current plan
                    </Text>
                  )}
                </View>
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 18, color: '#F0F0F5' }}>
                  {config.price}
                </Text>
              </View>

              {/* Daily cap */}
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#8888A0', marginBottom: 16 }}>
                {config.dailyCap === null ? 'Unlimited AI analyses per day' : `${config.dailyCap} AI analyses per day`}
              </Text>

              {/* Feature list */}
              <View style={{ gap: 10, marginBottom: isUpgrade ? 20 : 0 }}>
                {FEATURES.filter((f) => f.label !== 'Daily AI analyses').map((f) => (
                  <View key={f.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Tick ok={f[plan]} />
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: f[plan] ? '#F0F0F5' : '#333344' }}>
                      {f.label}
                    </Text>
                  </View>
                ))}
              </View>

              {/* CTA */}
              {isUpgrade && !isCurrent && (
                <TouchableOpacity
                  onPress={() => handleSubscribe(plan)}
                  activeOpacity={0.85}
                  style={{
                    height: 50,
                    borderRadius: 9999,
                    backgroundColor: config.color,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: config.color,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.4,
                    shadowRadius: 14,
                  }}
                >
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#0A0A0F' }}>
                    Upgrade to {config.label}
                  </Text>
                </TouchableOpacity>
              )}
              {isUpgrade && isCurrent && (
                <View style={{ height: 50, borderRadius: 9999, borderWidth: 1, borderColor: `${config.color}40`, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: config.color }}>
                    Active
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#555568', textAlign: 'center', marginTop: 8, lineHeight: 18 }}>
          In-app billing coming soon.{'\n'}Subscriptions managed via App Store and Google Play.
        </Text>

      </ScrollView>
    </View>
  );
}
