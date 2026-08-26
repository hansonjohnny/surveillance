import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useFocusEffect } from 'expo-router';
// expo-image-picker requires a native dev build — guarded to prevent crash in older builds
let ImagePicker: typeof import('expo-image-picker') | null = null;
try { ImagePicker = require('expo-image-picker'); } catch { /* native module not yet linked */ }
import * as FileSystem from 'expo-file-system/legacy';
import {
  Bell,
  BellRing,
  CalendarClock,
  Camera as CameraIcon,
  ChevronRight,
  Clock,
  Code2,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Mic,
  Settings2,
  Shield,
  ShieldAlert,
  User,
  Users,
  Vibrate,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import { getRecordingPermissionsAsync } from 'expo-audio';
import * as Notifications from 'expo-notifications';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Interval,
  MonitoringIntervalPicker,
} from '../../components/ui/MonitoringIntervalPicker';
import {
  Sensitivity,
  ShakeSensitivityPicker,
} from '../../components/ui/ShakeSensitivityPicker';
import { cancelWellnessCheckIn, scheduleWellnessCheckIn } from '../../lib/wellness';
import { supabase } from '../../lib/supabase';
import { PLANS, capLabel, capPercent, type Plan } from '../../lib/plans';
import { useAlertStore } from '../../store/useAlertStore';
import { useOnboardingStore } from '../../store/useOnboardingStore';
import { useSessionStore } from '../../store/useSessionStore';
import { ONBOARDING_SECURE_KEY, useSettingsStore } from '../../store/useSettingsStore';
import { useRouter } from 'expo-router';
import { colors } from '../../theme/colors';

const CYAN = '#00E5FF';
const SENS_MAP = { 0: 'low', 1: 'medium', 2: 'high' } as const;
const REVERSE_SENS: Record<string, Sensitivity> = { low: 0, medium: 1, high: 2 };
const AVATAR_KEY = 'profile_avatar_uri';
const DISPLAY_NAME_KEY = 'profile_display_name';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTimeInput(input: string): string | null {
  const s = input.trim();
  const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const m = parseInt(m24[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59)
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
  const m12 = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const m = m12[2] ? parseInt(m12[2], 10) : 0;
    const ampm = m12[3].toLowerCase();
    if (h === 12) h = ampm === 'am' ? 0 : 12;
    else if (ampm === 'pm') h += 12;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59)
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
  return null;
}

function formatTime12h(time24: string): string {
  const [hourStr, minuteStr] = time24.split(':');
  const h = parseInt(hourStr, 10);
  const m = parseInt(minuteStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 0);
  return d;
}

// ─── MenuRow ──────────────────────────────────────────────────────────────────

function MenuRow({
  icon,
  label,
  value,
  onPress,
  destructive = false,
  last = false,
  rightEl,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  last?: boolean;
  rightEl?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.65 : 1}
      style={[
        {
          backgroundColor: 'rgba(255,255,255,0.04)',
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 16,
          minHeight: 56,
        },
        !last && { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
      ]}
    >
      <View style={{ width: 32, alignItems: 'center', marginRight: 14 }}>
        {icon}
      </View>
      <Text
        style={{
          flex: 1,
          fontFamily: 'DMSans_400Regular',
          fontSize: 15,
          color: destructive ? colors.risk.high : '#F0F0F5',
        }}
      >
        {label}
      </Text>
      {rightEl ?? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {value ? (
            <Text
              style={{
                fontFamily: 'JetBrainsMono_400Regular',
                fontSize: 12,
                color: '#555568',
                maxWidth: 160,
              }}
              numberOfLines={1}
            >
              {value}
            </Text>
          ) : null}
          {onPress && (
            <ChevronRight
              size={18}
              color={destructive ? colors.risk.high : '#555568'}
              strokeWidth={1.5}
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <Text
      style={{
        fontFamily: 'JetBrainsMono_400Regular',
        fontSize: 11,
        color: '#555568',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: 10,
        marginLeft: 4,
      }}
    >
      {label}
    </Text>
  );
}

// ─── MenuGroup ────────────────────────────────────────────────────────────────

function MenuGroup({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
      }}
    >
      {children}
    </View>
  );
}

// ─── PermissionBadge ──────────────────────────────────────────────────────────

function PermissionBadge({ label, granted, partial = false }: { label: string; granted: boolean; partial?: boolean }) {
  const color = granted ? (partial ? colors.risk.medium : colors.risk.low) : colors.risk.high;
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, backgroundColor: `${color}1a`, borderWidth: 1, borderColor: `${color}33` }}>
      <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, letterSpacing: 0.8, color }}>{label}</Text>
    </View>
  );
}

// ─── BottomSheet wrapper ──────────────────────────────────────────────────────

function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const bottomOffset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(bottomOffset, {
        toValue: e.endCoordinates.height,
        duration: Platform.OS === 'ios' ? e.duration : 200,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(bottomOffset, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? e.duration : 200,
        useNativeDriver: false,
      }).start();
    });

    return () => { showSub.remove(); hideSub.remove(); };
  }, [bottomOffset]);

  useEffect(() => {
    if (!visible) bottomOffset.setValue(0);
  }, [visible, bottomOffset]);

  function handleClose() { Keyboard.dismiss(); onClose(); }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} onPress={handleClose} />
        <Animated.View style={{ marginBottom: bottomOffset, backgroundColor: '#111118', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.10)', paddingBottom: 40 }}>
          <View style={{ width: 40, height: 4, borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.20)', alignSelf: 'center', marginTop: 14, marginBottom: 4 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16 }}>
            <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 20, color: '#F0F0F5' }}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color="#555568" strokeWidth={1.5} />
            </TouchableOpacity>
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

function FieldLabel({ label }: { label: string }) {
  return (
    <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 11, color: '#555568', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
      {label}
    </Text>
  );
}

function StyledInput(props: React.ComponentProps<typeof TextInput> & { error?: boolean }) {
  const { error, style, onFocus, onBlur, ...rest } = props;
  const [isFocused, setIsFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor="#555568"
      onFocus={(e) => { setIsFocused(true); onFocus?.(e); }}
      onBlur={(e) => { setIsFocused(false); onBlur?.(e); }}
      style={[
        {
          height: 54,
          borderRadius: 12,
          backgroundColor: error
            ? 'rgba(255,61,61,0.06)'
            : isFocused
            ? 'rgba(0,229,255,0.04)'
            : 'rgba(255,255,255,0.05)',
          borderWidth: 1,
          borderColor: error
            ? 'rgba(255,61,61,0.40)'
            : isFocused
            ? 'rgba(0,229,255,0.50)'
            : 'rgba(255,255,255,0.10)',
          paddingHorizontal: 18,
          fontFamily: 'DMSans_400Regular',
          fontSize: 15,
          color: '#F0F0F5',
        },
        style,
      ]}
      {...rest}
    />
  );
}

function CyanButton({ label, onPress, style }: { label: string; onPress: () => void; style?: any }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        { height: 56, borderRadius: 9999, backgroundColor: CYAN, alignItems: 'center', justifyContent: 'center', shadowColor: CYAN, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 18 },
        style,
      ]}
    >
      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 16, letterSpacing: 0.3, color: '#0A0A0F' }}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── ProfileModal ─────────────────────────────────────────────────────────────

function ProfileModal({
  visible,
  currentName,
  currentAvatar,
  userEmail,
  onSave,
  onClose,
}: {
  visible: boolean;
  currentName: string;
  currentAvatar: string | null;
  userEmail: string | null;
  onSave: (name: string, avatarUri: string | null) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'profile' | 'password'>('profile');
  const [draftName, setDraftName] = useState(currentName);
  const [avatarUri, setAvatarUri] = useState<string | null>(currentAvatar);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setDraftName(currentName);
      setAvatarUri(currentAvatar);
      setTab('profile');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwError('');
      setPwSuccess(false);
    }
  }, [visible, currentName, currentAvatar]);

  async function pickAvatar() {
    if (!ImagePicker) {
      Alert.alert('Not available', 'Rebuild the dev client to enable photo selection.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to choose a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    // Copy to documents directory so the URI persists across app restarts
    const src = result.assets[0].uri;
    const dest = FileSystem.documentDirectory + 'profile_avatar.jpg';
    await FileSystem.copyAsync({ from: src, to: dest });
    setAvatarUri(dest);
  }

  function handleSaveProfile() {
    if (!draftName.trim()) {
      Alert.alert('Name required', 'Please enter your display name.');
      return;
    }
    onSave(draftName.trim(), avatarUri);
    onClose();
  }

  async function handleChangePassword() {
    setPwError('');
    if (!newPassword) { setPwError('Enter a new password.'); return; }
    if (newPassword.length < 6) { setPwError('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match.'); return; }

    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwLoading(false);

    if (error) {
      setPwError(error.message);
    } else {
      setPwSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }

  const initials = (draftName || userEmail || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Sheet visible={visible} onClose={onClose} title="Profile">
      {/* Tab switcher */}
      <View style={{ flexDirection: 'row', marginHorizontal: 24, marginBottom: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 4 }}>
        {(['profile', 'password'] as const).map(t => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={{ flex: 1, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: tab === t ? 'rgba(0,229,255,0.15)' : 'transparent' }}
          >
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: tab === t ? CYAN : '#555568', letterSpacing: 0.3 }}>
              {t === 'profile' ? 'Edit Profile' : 'Change Password'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 8 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {tab === 'profile' ? (
          <View style={{ gap: 20 }}>
            {/* Avatar picker */}
            <View style={{ alignItems: 'center', marginBottom: 4 }}>
              <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8} style={{ position: 'relative' }}>
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: `${CYAN}55` }}
                  />
                ) : (
                  <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(0,229,255,0.10)', borderWidth: 2, borderColor: `${CYAN}33`, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 32, color: CYAN }}>{initials}</Text>
                  </View>
                )}
                {/* Camera overlay badge */}
                <View style={{ position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: CYAN, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#111118' }}>
                  <CameraIcon size={14} color="#0A0A0F" strokeWidth={2} />
                </View>
              </TouchableOpacity>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#555568', marginTop: 10 }}>
                Tap to change photo
              </Text>
            </View>

            {/* Display name */}
            <View>
              <FieldLabel label="Display Name" />
              <StyledInput
                value={draftName}
                onChangeText={setDraftName}
                placeholder="Your name"
                autoCapitalize="words"
              />
            </View>

            {/* Email (read-only) */}
            <View>
              <FieldLabel label="Email" />
              <View style={{ height: 54, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', paddingHorizontal: 18, justifyContent: 'center' }}>
                <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 14, color: '#555568' }}>
                  {userEmail ?? '—'}
                </Text>
              </View>
            </View>

            <CyanButton label="Save Profile" onPress={handleSaveProfile} />
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            <View>
              <FieldLabel label="New Password" />
              <StyledInput
                value={newPassword}
                onChangeText={v => { setNewPassword(v); setPwError(''); setPwSuccess(false); }}
                placeholder="Min. 6 characters"
                secureTextEntry
                error={!!pwError}
              />
            </View>
            <View>
              <FieldLabel label="Confirm Password" />
              <StyledInput
                value={confirmPassword}
                onChangeText={v => { setConfirmPassword(v); setPwError(''); setPwSuccess(false); }}
                placeholder="Repeat new password"
                secureTextEntry
                error={!!pwError}
              />
            </View>

            {pwError ? (
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: colors.risk.high }}>{pwError}</Text>
            ) : null}
            {pwSuccess ? (
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: colors.risk.low }}>Password updated successfully.</Text>
            ) : null}

            <CyanButton
              label={pwLoading ? 'Updating...' : 'Update Password'}
              onPress={handleChangePassword}
            />
          </View>
        )}
      </ScrollView>
    </Sheet>
  );
}

// ─── EditContactModal ─────────────────────────────────────────────────────────

function EditContactModal({
  visible,
  title = 'Emergency Contact',
  name,
  phone,
  email,
  onSave,
  onClose,
}: {
  visible: boolean;
  title?: string;
  name: string;
  phone: string;
  email: string;
  onSave: (name: string, phone: string, email: string) => void;
  onClose: () => void;
}) {
  const [draftName, setDraftName] = useState(name);
  const [draftPhone, setDraftPhone] = useState(phone);
  const [draftEmail, setDraftEmail] = useState(email);

  useEffect(() => {
    if (visible) { setDraftName(name); setDraftPhone(phone); setDraftEmail(email); }
  }, [visible, name, phone, email]);

  function handleSave() {
    if (!draftName.trim() || !draftPhone.trim()) {
      Alert.alert('Missing fields', 'Name and phone number are required.');
      return;
    }
    if (!draftPhone.trim().startsWith('+')) {
      Alert.alert('Invalid phone', 'Phone number must include country code (e.g. +1 555 000 1234).');
      return;
    }
    onSave(draftName.trim(), draftPhone.trim(), draftEmail.trim());
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, gap: 16, paddingBottom: 8 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View>
          <FieldLabel label="Full Name" />
          <StyledInput value={draftName} onChangeText={setDraftName} placeholder="e.g. Jane Smith" autoCapitalize="words" />
        </View>
        <View>
          <FieldLabel label="Phone Number" />
          <StyledInput value={draftPhone} onChangeText={setDraftPhone} placeholder="+1 555 012 3456" keyboardType="phone-pad" />
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#555568', marginTop: 5, marginLeft: 2 }}>Include country code, e.g. +1 or +44</Text>
        </View>
        <View>
          <FieldLabel label="Email Address" />
          <StyledInput value={draftEmail} onChangeText={setDraftEmail} placeholder="jane@example.com" keyboardType="email-address" autoCapitalize="none" />
        </View>
        <CyanButton label="Save Contact" onPress={handleSave} style={{ marginTop: 8 }} />
      </ScrollView>
    </Sheet>
  );
}

// ─── MonitoringModal ──────────────────────────────────────────────────────────

function MonitoringModal({
  visible,
  interval,
  sensitivity,
  onIntervalChange,
  onSensitivityChange,
  onClose,
}: {
  visible: boolean;
  interval: Interval;
  sensitivity: Sensitivity;
  onIntervalChange: (v: Interval) => void;
  onSensitivityChange: (v: Sensitivity) => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Monitoring">
      <View style={{ paddingHorizontal: 24, gap: 24, paddingBottom: 8 }}>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
          <MonitoringIntervalPicker value={interval} onChange={onIntervalChange} />
        </View>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
          <ShakeSensitivityPicker value={sensitivity} onChange={onSensitivityChange} />
        </View>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 18, color: '#555568', paddingHorizontal: 4 }}>
          Location and audio monitoring continue while the app is in the background or your screen is locked. Camera snapshots pause in the background (an iOS/Android restriction) and resume automatically when you reopen the app.
        </Text>
        <CyanButton label="Done" onPress={onClose} style={{ marginTop: 4 }} />
      </View>
    </Sheet>
  );
}

// ─── BehaviourModal ───────────────────────────────────────────────────────────

function BehaviourModal({
  visible,
  stealthMode,
  cameraSoundEnabled,
  wellnessEnabled,
  wellnessTimeInput,
  wellnessTimeError,
  storedWellnessTime,
  onStealthToggle,
  onCameraSoundToggle,
  onWellnessToggle,
  onWellnessTimeChange,
  onWellnessTimeSubmit,
  onClose,
}: {
  visible: boolean;
  stealthMode: boolean;
  cameraSoundEnabled: boolean;
  wellnessEnabled: boolean;
  wellnessTimeInput: string;
  wellnessTimeError: boolean;
  storedWellnessTime: string | null;
  onStealthToggle: (v: boolean) => void;
  onCameraSoundToggle: (v: boolean) => void;
  onWellnessToggle: (v: boolean) => void;
  onWellnessTimeChange: (v: string) => void;
  onWellnessTimeSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Behaviour">
      <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ paddingHorizontal: 24, gap: 16, paddingBottom: 8 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Stealth Mode */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: stealthMode ? `${CYAN}33` : 'rgba(255,255,255,0.08)', flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#F0F0F5', marginBottom: 4 }}>Stealth Mode</Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#8888A0' }}>Screen dims to black while monitoring continues silently.</Text>
          </View>
          <Switch
            value={stealthMode}
            onValueChange={onStealthToggle}
            trackColor={{ false: 'rgba(255,255,255,0.10)', true: `${CYAN}55` }}
            thumbColor={stealthMode ? CYAN : colors.text.tertiary}
            ios_backgroundColor="rgba(255,255,255,0.10)"
          />
        </View>

        {/* Camera Shutter Sound */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: cameraSoundEnabled ? `${CYAN}33` : 'rgba(255,255,255,0.08)', flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#F0F0F5', marginBottom: 4 }}>Camera Shutter Sound</Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#8888A0' }}>
              {cameraSoundEnabled ? 'Shutter sound plays when a snapshot is taken.' : 'Silent by default — no sound when capturing.'}
            </Text>
          </View>
          <Switch
            value={cameraSoundEnabled}
            onValueChange={onCameraSoundToggle}
            trackColor={{ false: 'rgba(255,255,255,0.10)', true: `${CYAN}55` }}
            thumbColor={cameraSoundEnabled ? CYAN : colors.text.tertiary}
            ios_backgroundColor="rgba(255,255,255,0.10)"
          />
        </View>

        {/* Wellness Check-In */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: wellnessEnabled ? `${CYAN}33` : 'rgba(255,255,255,0.08)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: wellnessEnabled ? 16 : 0 }}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Clock size={14} color={wellnessEnabled ? CYAN : '#8888A0'} strokeWidth={1.5} />
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#F0F0F5' }}>Daily Check-In</Text>
              </View>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#8888A0' }}>
                {wellnessEnabled && storedWellnessTime
                  ? `Alert fires if you miss check-in at ${formatTime12h(storedWellnessTime)}`
                  : 'Alert your contact if you miss a check-in.'}
              </Text>
            </View>
            <Switch
              value={wellnessEnabled}
              onValueChange={onWellnessToggle}
              trackColor={{ false: 'rgba(255,255,255,0.10)', true: `${CYAN}55` }}
              thumbColor={wellnessEnabled ? CYAN : colors.text.tertiary}
              ios_backgroundColor="rgba(255,255,255,0.10)"
            />
          </View>
          {wellnessEnabled && (
            <View>
              <FieldLabel label="Check-In Time" />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TextInput
                  value={wellnessTimeInput}
                  onChangeText={v => { onWellnessTimeChange(v); }}
                  onBlur={onWellnessTimeSubmit}
                  onSubmitEditing={onWellnessTimeSubmit}
                  placeholder="10:00 PM or 22:00"
                  placeholderTextColor="#555568"
                  returnKeyType="done"
                  style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: wellnessTimeError ? 'rgba(255,61,61,0.06)' : 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: wellnessTimeError ? 'rgba(255,61,61,0.40)' : 'rgba(255,255,255,0.10)', paddingHorizontal: 16, fontFamily: 'JetBrainsMono_400Regular', fontSize: 15, color: '#F0F0F5' }}
                />
                <TouchableOpacity onPress={onWellnessTimeSubmit} activeOpacity={0.8} style={{ height: 50, paddingHorizontal: 20, borderRadius: 12, backgroundColor: CYAN, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#0A0A0F' }}>Set</Text>
                </TouchableOpacity>
              </View>
              {wellnessTimeError && (
                <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 11, color: colors.risk.high, letterSpacing: 0.5, marginTop: 6 }}>
                  Enter a valid time: 10:00 PM or 22:00
                </Text>
              )}
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#555568', marginTop: 10 }}>
                If you have not tapped "I'm Safe" within 10 minutes of this time, your emergency contact will be alerted.
              </Text>
            </View>
          )}
        </View>

        <CyanButton label="Done" onPress={onClose} style={{ marginTop: 4 }} />
      </ScrollView>
    </Sheet>
  );
}

// ─── EventLogModal ────────────────────────────────────────────────────────────

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function DatePickerModal({ visible, value, minimumDate, onSelect, onClose }: { visible: boolean; value: Date; minimumDate?: Date; onSelect: (date: Date) => void; onClose: () => void }) {
  const [viewYear, setViewYear] = useState(value.getFullYear());
  const [viewMonth, setViewMonth] = useState(value.getMonth());

  const minDay = minimumDate ? new Date(minimumDate.getFullYear(), minimumDate.getMonth(), minimumDate.getDate()) : null;
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDayOfMonth).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center' }} onPress={onClose}>
        <Pressable onPress={() => {}} style={{ width: 320, backgroundColor: '#111118', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <TouchableOpacity onPress={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={{ color: CYAN, fontSize: 24, fontFamily: 'DMSans_500Medium', lineHeight: 28 }}>‹</Text>
            </TouchableOpacity>
            <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: '#F0F0F5' }}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
            <TouchableOpacity onPress={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={{ color: CYAN, fontSize: 24, fontFamily: 'DMSans_500Medium', lineHeight: 28 }}>›</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', marginBottom: 8 }}>
            {DAY_NAMES.map(d => <View key={d} style={{ flex: 1, alignItems: 'center' }}><Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: '#555568', letterSpacing: 0.5 }}>{d}</Text></View>)}
          </View>
          {Array.from({ length: cells.length / 7 }, (_, row) => (
            <View key={row} style={{ flexDirection: 'row', marginBottom: 2 }}>
              {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                if (day === null) return <View key={col} style={{ flex: 1 }} />;
                const selected = day === value.getDate() && viewMonth === value.getMonth() && viewYear === value.getFullYear();
                const disabled = minDay ? new Date(viewYear, viewMonth, day) < minDay : false;
                return (
                  <TouchableOpacity key={col} onPress={() => { if (!disabled) { onSelect(new Date(viewYear, viewMonth, day)); onClose(); } }} style={{ flex: 1, alignItems: 'center', paddingVertical: 5 }} activeOpacity={disabled ? 1 : 0.7}>
                    <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? CYAN : 'transparent' }}>
                      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: selected ? '#0A0A0F' : disabled ? '#333344' : '#F0F0F5' }}>{day}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function EventLogModal({
  visible,
  logClearEnabled,
  logClearDate,
  storedLogClearScheduledAt,
  onToggle,
  onDateSelect,
  onClose,
}: {
  visible: boolean;
  logClearEnabled: boolean;
  logClearDate: Date;
  storedLogClearScheduledAt: string | null;
  onToggle: (v: boolean) => void;
  onDateSelect: (date: Date) => void;
  onClose: () => void;
}) {
  const [showDatePicker, setShowDatePicker] = useState(false);

  return (
    <Sheet visible={visible} onClose={onClose} title="Event Log">
      <View style={{ paddingHorizontal: 24, gap: 16, paddingBottom: 8 }}>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: logClearEnabled ? `${CYAN}33` : 'rgba(255,255,255,0.08)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <CalendarClock size={14} color={logClearEnabled ? CYAN : '#8888A0'} strokeWidth={1.5} />
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#F0F0F5' }}>Auto-Clear Log</Text>
              </View>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#8888A0' }}>
                {logClearEnabled && storedLogClearScheduledAt
                  ? `Clears on ${new Date(storedLogClearScheduledAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`
                  : 'Auto-clears every 5 days by default.'}
              </Text>
            </View>
            <Switch
              value={logClearEnabled}
              onValueChange={onToggle}
              trackColor={{ false: 'rgba(255,255,255,0.10)', true: `${CYAN}55` }}
              thumbColor={logClearEnabled ? CYAN : colors.text.tertiary}
              ios_backgroundColor="rgba(255,255,255,0.10)"
            />
          </View>
          {logClearEnabled && (
            <View style={{ marginTop: 16 }}>
              <FieldLabel label="Clear Date" />
              <TouchableOpacity onPress={() => setShowDatePicker(true)} activeOpacity={0.7} style={{ height: 50, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 15, color: '#F0F0F5' }}>
                  {logClearDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </Text>
                <CalendarClock size={16} color={CYAN} strokeWidth={1.5} />
              </TouchableOpacity>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#555568', marginTop: 10 }}>
                All events will be permanently deleted when the app next opens after this date.
              </Text>
              <DatePickerModal
                visible={showDatePicker}
                value={logClearDate}
                minimumDate={new Date()}
                onSelect={onDateSelect}
                onClose={() => setShowDatePicker(false)}
              />
            </View>
          )}
        </View>
        <CyanButton label="Done" onPress={onClose} style={{ marginTop: 4 }} />
      </View>
    </Sheet>
  );
}

// ─── DangerModal ──────────────────────────────────────────────────────────────

function DangerModal({
  visible,
  onClose,
  onFactoryReset,
  onDeleteAccount,
}: {
  visible: boolean;
  onClose: () => void;
  onFactoryReset: () => void;
  onDeleteAccount: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Danger Zone">
      <View style={{ paddingHorizontal: 24, gap: 12, paddingBottom: 8 }}>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#8888A0', marginBottom: 4 }}>
          These actions are irreversible. Proceed with caution.
        </Text>
        <TouchableOpacity
          onPress={() => { onClose(); setTimeout(onFactoryReset, 300); }}
          activeOpacity={0.8}
          style={{ height: 56, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,61,61,0.35)', backgroundColor: 'rgba(255,61,61,0.06)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: colors.risk.high }}>Factory Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { onClose(); setTimeout(onDeleteAccount, 300); }}
          activeOpacity={0.8}
          style={{ height: 56, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,61,61,0.60)', backgroundColor: 'rgba(255,61,61,0.12)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: colors.risk.high }}>Delete Account</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 15, color: '#555568' }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Sheet>
  );
}

// ─── DevToolsModal ────────────────────────────────────────────────────────────

type AdminUser = {
  id: string;
  email: string;
  plan: 'free' | 'pro' | 'guardian';
  created_at: string;
  todayUsage: number;
};

const PLAN_OPTIONS = Object.keys(PLANS) as Plan[];
const PLAN_COLORS: Record<string, string> = Object.fromEntries(
  (Object.keys(PLANS) as Plan[]).map((k) => [k, PLANS[k].color]),
);
const PLAN_CAPS: Record<string, number | null> = Object.fromEntries(
  (Object.keys(PLANS) as Plan[]).map((k) => [k, PLANS[k].dailyCap]),
);

function DevToolsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null); // userId being updated
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const setPlan = useSettingsStore((s) => s.setPlan);

  async function fetchUsers() {
    setLoading(true);
    setError(null);
    try {
      const [{ data, error: fnError }, { data: { user } }] = await Promise.all([
        supabase.functions.invoke('admin-users', { body: { action: 'list' } }),
        supabase.auth.getUser(),
      ]);
      if (fnError) throw new Error(fnError.message);
      setUsers(data as AdminUser[]);
      setCurrentUserId(user?.id ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (visible) fetchUsers();
  }, [visible]);

  async function assignPlan(userId: string, plan: 'free' | 'pro' | 'guardian') {
    setUpdating(userId);
    try {
      const { error: fnError } = await supabase.functions.invoke('admin-users', {
        body: { action: 'assign', userId, plan },
      });
      if (fnError) throw new Error(fnError.message);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, plan } : u));
      // Sync to local store so the monitoring cycle picks up the new plan immediately.
      if (userId === currentUserId) setPlan(plan);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Update failed');
    } finally {
      setUpdating(null);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} onPress={onClose} />
        <View style={{ backgroundColor: '#111118', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.10)', maxHeight: '85%' }}>
          {/* Handle */}
          <View style={{ width: 40, height: 4, borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.20)', alignSelf: 'center', marginTop: 14 }} />

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Code2 size={18} color="#FFD740" strokeWidth={1.5} />
              <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 18, color: '#F0F0F5' }}>Dev — User Plans</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity onPress={fetchUsers} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: CYAN }}>Refresh</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color="#555568" strokeWidth={1.5} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Disclaimer */}
          <View style={{ marginHorizontal: 24, marginBottom: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,215,64,0.08)', borderWidth: 1, borderColor: 'rgba(255,215,64,0.25)' }}>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#FFD740' }}>
              Dev tool — remove before production. Visible only to admin accounts.
            </Text>
          </View>

          <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {loading ? (
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#555568', textAlign: 'center', marginTop: 40 }}>
                Loading users...
              </Text>
            ) : error ? (
              <View style={{ alignItems: 'center', marginTop: 40, gap: 12 }}>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: colors.risk.high, textAlign: 'center' }}>{error}</Text>
                <TouchableOpacity onPress={fetchUsers} activeOpacity={0.7} style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 9999, borderWidth: 1, borderColor: CYAN }}>
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: CYAN }}>Try Again</Text>
                </TouchableOpacity>
              </View>
            ) : (
              users.map((user, index) => {
                const cap = PLAN_CAPS[user.plan];
                const usageLabel = cap === null ? `${user.todayUsage} / ∞` : `${user.todayUsage} / ${cap}`;
                const isUpdating = updating === user.id;

                return (
                  <View
                    key={user.id}
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.08)',
                      padding: 16,
                      marginBottom: 12,
                    }}
                  >
                    {/* Email + usage */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 12, color: '#F0F0F5', flex: 1 }} numberOfLines={1}>
                        {user.email}
                      </Text>
                      <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 11, color: '#555568', marginLeft: 8 }}>
                        {usageLabel} today
                      </Text>
                    </View>

                    {/* Plan selector */}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {PLAN_OPTIONS.map((plan) => {
                        const isActive = user.plan === plan;
                        const color = PLAN_COLORS[plan];
                        return (
                          <TouchableOpacity
                            key={plan}
                            onPress={() => !isActive && !isUpdating && assignPlan(user.id, plan)}
                            activeOpacity={0.75}
                            style={{
                              flex: 1,
                              paddingVertical: 8,
                              borderRadius: 10,
                              alignItems: 'center',
                              backgroundColor: isActive ? `${color}20` : 'rgba(255,255,255,0.04)',
                              borderWidth: 1,
                              borderColor: isActive ? `${color}60` : 'rgba(255,255,255,0.08)',
                              opacity: isUpdating ? 0.5 : 1,
                            }}
                          >
                            <Text style={{ fontFamily: isActive ? 'DMSans_500Medium' : 'DMSans_400Regular', fontSize: 12, color: isActive ? color : '#555568', textTransform: 'capitalize' }}>
                              {isUpdating && isActive ? '...' : plan}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── SettingsScreen ───────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const router = useRouter();
  const { set } = useOnboardingStore();

  const plan        = useSettingsStore((s) => s.plan);
  const todayUsage  = useSettingsStore((s) => s.todayUsage);
  const planConfig  = PLANS[plan];

  const storedInterval      = useSettingsStore((s) => s.monitoringInterval);
  const storedSensitivity   = useSettingsStore((s) => s.shakeSensitivity);
  const storedStealth       = useSettingsStore((s) => s.stealthMode);
  const storedCameraSound   = useSettingsStore((s) => s.cameraSoundEnabled);
  const storedContactName   = useSettingsStore((s) => s.contactName);
  const storedContactPhone  = useSettingsStore((s) => s.contactPhone);
  const storedContactEmail  = useSettingsStore((s) => s.contactEmail);
  const storedBackupName    = useSettingsStore((s) => s.backupContactName);
  const storedBackupPhone   = useSettingsStore((s) => s.backupContactPhone);
  const storedBackupEmail   = useSettingsStore((s) => s.backupContactEmail);
  const storedWellnessTime  = useSettingsStore((s) => s.wellnessCheckInTime);
  const storedLogClearScheduledAt = useSettingsStore((s) => s.logClearScheduledAt);
  const updateSettings      = useSettingsStore((s) => s.updateSettings);

  // Monitoring
  const [monitoringInterval, setMonitoringInterval] = useState<Interval>(storedInterval);
  const [sensitivity, setSensitivity] = useState<Sensitivity>((REVERSE_SENS[storedSensitivity] ?? 1) as Sensitivity);

  // Behaviour
  const [stealthMode, setStealthMode] = useState(storedStealth);
  const [cameraSoundEnabled, setCameraSoundEnabled] = useState(storedCameraSound);
  const [wellnessEnabled, setWellnessEnabled] = useState(storedWellnessTime !== null);
  const [wellnessTimeInput, setWellnessTimeInput] = useState(storedWellnessTime ? formatTime12h(storedWellnessTime) : '10:00 PM');
  const [wellnessTimeError, setWellnessTimeError] = useState(false);

  // Event log
  const [logClearEnabled, setLogClearEnabled] = useState(storedLogClearScheduledAt !== null);
  const [logClearDate, setLogClearDate] = useState<Date>(() => storedLogClearScheduledAt ? new Date(storedLogClearScheduledAt) : new Date());

  // Account / profile
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // Permissions
  type PermState = { gps: 'always' | 'foreground' | 'denied'; camera: boolean; audio: boolean; notifications: boolean };
  const [perms, setPerms] = useState<PermState>({ gps: 'denied', camera: false, audio: false, notifications: false });

  // Modal open states
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [backupContactModalOpen, setBackupContactModalOpen] = useState(false);
  const [monitoringModalOpen, setMonitoringModalOpen] = useState(false);
  const [behaviourModalOpen, setBehaviourModalOpen] = useState(false);
  const [eventLogModalOpen, setEventLogModalOpen] = useState(false);
  const [dangerModalOpen, setDangerModalOpen] = useState(false);
  const [devToolsOpen, setDevToolsOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      async function refresh() {
        const [fg, bg, cam, mic, notif, { data: { user } }] = await Promise.all([
          Location.getForegroundPermissionsAsync(),
          Location.getBackgroundPermissionsAsync(),
          Camera.getCameraPermissionsAsync(),
          getRecordingPermissionsAsync(),
          Notifications.getPermissionsAsync(),
          supabase.auth.getUser(),
        ]);
        setPerms({
          gps: bg.status === 'granted' ? 'always' : fg.status === 'granted' ? 'foreground' : 'denied',
          camera: cam.status === 'granted',
          audio: mic.status === 'granted',
          notifications: notif.status === 'granted',
        });
        setUserEmail(user?.email ?? null);
        // Load display name: prefer user metadata, fallback to AsyncStorage
        const metaName = user?.user_metadata?.display_name;
        const storedName = await AsyncStorage.getItem(DISPLAY_NAME_KEY);
        setDisplayName(metaName || storedName || '');
        // Load avatar
        const uri = await AsyncStorage.getItem(AVATAR_KEY);
        if (uri) {
          const info = await FileSystem.getInfoAsync(uri);
          setAvatarUri(info.exists ? uri : null);
        }
      }
      refresh();
    }, []),
  );

  // ── Supabase settings sync ───────────────────────────────────────────────────

  async function syncSettingsRow(partial: {
    monitoring_interval?: number;
    shake_sensitivity?: string;
    stealth_mode?: boolean;
    wellness_checkin_time?: string | null;
  }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return;
    supabase
      .from('settings')
      .upsert({ user_id: user.id, ...partial }, { onConflict: 'user_id' })
      .then(({ error }) => { if (error) console.warn('[settings] Supabase sync failed:', error.message); });
  }

  // ── Monitoring handlers ──────────────────────────────────────────────────────

  function handleIntervalChange(v: Interval) {
    setMonitoringInterval(v);
    set({ interval: v });
    updateSettings({ monitoringInterval: v });
    syncSettingsRow({ monitoring_interval: v });
  }

  function handleSensitivityChange(v: Sensitivity) {
    setSensitivity(v);
    set({ sensitivity: v });
    const sens = SENS_MAP[v];
    updateSettings({ shakeSensitivity: sens });
    syncSettingsRow({ shake_sensitivity: sens });
  }

  // ── Behaviour handlers ───────────────────────────────────────────────────────

  function handleStealthToggle(val: boolean) {
    setStealthMode(val);
    set({ stealthMode: val });
    updateSettings({ stealthMode: val });
    syncSettingsRow({ stealth_mode: val });
  }

  function handleCameraSoundToggle(val: boolean) {
    setCameraSoundEnabled(val);
    updateSettings({ cameraSoundEnabled: val });
  }

  async function handleWellnessToggle(val: boolean) {
    setWellnessEnabled(val);
    if (!val) {
      await cancelWellnessCheckIn();
      updateSettings({ wellnessCheckInTime: null });
      syncSettingsRow({ wellness_checkin_time: null });
      return;
    }
    const parsed = parseTimeInput(wellnessTimeInput);
    if (parsed) {
      setWellnessTimeError(false);
      await scheduleWellnessCheckIn(parsed);
      updateSettings({ wellnessCheckInTime: parsed });
      syncSettingsRow({ wellness_checkin_time: parsed });
    } else {
      setWellnessTimeError(true);
    }
  }

  async function handleWellnessTimeSubmit() {
    const parsed = parseTimeInput(wellnessTimeInput);
    if (!parsed) { setWellnessTimeError(true); return; }
    setWellnessTimeError(false);
    if (wellnessEnabled) {
      await scheduleWellnessCheckIn(parsed);
      updateSettings({ wellnessCheckInTime: parsed });
      syncSettingsRow({ wellness_checkin_time: parsed });
    }
  }

  // ── Log auto-clear handlers ──────────────────────────────────────────────────

  function handleLogClearToggle(val: boolean) {
    setLogClearEnabled(val);
    if (!val) { updateSettings({ logClearScheduledAt: null }); return; }
    const scheduled = endOfDay(logClearDate);
    if (scheduled.getTime() > Date.now()) updateSettings({ logClearScheduledAt: scheduled.toISOString() });
  }

  function handleLogClearDateSelect(date: Date) {
    setLogClearDate(date);
    const scheduled = endOfDay(date);
    if (scheduled.getTime() > Date.now()) updateSettings({ logClearScheduledAt: scheduled.toISOString() });
  }

  // ── Contact save ─────────────────────────────────────────────────────────────

  async function handleSaveContact(name: string, phone: string, email: string) {
    set({ contactName: name, contactPhone: phone, contactEmail: email });
    updateSettings({ contactName: name, contactPhone: phone, contactEmail: email });
    Promise.all([
      SecureStore.setItemAsync('contact_phone', phone),
      SecureStore.setItemAsync('contact_email', email),
    ]).catch(console.warn);
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user?.id) return;
      supabase.from('contacts').upsert({ user_id: user.id, name, phone, email }, { onConflict: 'user_id' })
        .then(({ error }) => { if (error) console.warn('[settings] Contact sync failed:', error.message); });
    });
  }

  // Backup contact — escalation.ts reads these straight from AsyncStorage,
  // so unlike the primary contact this only needs to live in Settings/local
  // storage, not the `contacts` table.
  function handleSaveBackupContact(name: string, phone: string, email: string) {
    updateSettings({
      backupContactName: name,
      backupContactPhone: phone,
      backupContactEmail: email,
    });
  }

  // ── Profile save ─────────────────────────────────────────────────────────────

  async function handleSaveProfile(name: string, newAvatarUri: string | null) {
    setDisplayName(name);
    setAvatarUri(newAvatarUri);
    await AsyncStorage.setItem(DISPLAY_NAME_KEY, name);
    if (newAvatarUri) await AsyncStorage.setItem(AVATAR_KEY, newAvatarUri);
    else await AsyncStorage.removeItem(AVATAR_KEY);
    // Sync name to Supabase user metadata
    supabase.auth.updateUser({ data: { display_name: name } }).catch(console.warn);
  }

  // ── Sign out ──────────────────────────────────────────────────────────────────

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  // ── Danger zone ───────────────────────────────────────────────────────────────

  function handleFactoryReset() {
    Alert.alert(
      'Factory Reset',
      'Wipes all local data and signs you out.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              await SecureStore.deleteItemAsync(ONBOARDING_SECURE_KEY);
              useOnboardingStore.setState({ data: {}, isComplete: false });
              useSettingsStore.setState({ contactName: '', contactPhone: '', contactEmail: '', backupContactName: '', backupContactPhone: '', backupContactEmail: '', monitoringInterval: 30, shakeSensitivity: 'medium', stealthMode: false, cameraSoundEnabled: false, wellnessCheckInTime: null, logClearScheduledAt: null, lastAutoCleared: null, onboardingComplete: false, plan: 'free', todayUsage: 0, usageDate: null, role: 'self' });
              useSessionStore.setState({ userId: null, isActive: false, sessionId: null, sessionStartTime: null, lastRiskLevel: null, lastAISummary: null, lastLocation: null, cycleCount: 0 });
              useAlertStore.setState({ events: [], alerts: [] });
              await supabase.auth.signOut();
            } catch (err) {
              console.error('[settings] Factory reset failed:', err);
              Alert.alert('Reset Failed', 'Something went wrong. Please try again.');
            }
          },
        },
      ]
    );
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              const uid = user?.id;
              if (uid) {
                await Promise.all([
                  supabase.from('events').delete().eq('user_id', uid),
                  supabase.from('alerts').delete().eq('user_id', uid),
                  supabase.from('sessions').delete().eq('user_id', uid),
                  supabase.from('contacts').delete().eq('user_id', uid),
                  supabase.from('settings').delete().eq('user_id', uid),
                  supabase.from('users').delete().eq('id', uid),
                ]);
              }
              await AsyncStorage.clear();
              await Promise.all([
                SecureStore.deleteItemAsync('contact_name'),
                SecureStore.deleteItemAsync('contact_phone'),
                SecureStore.deleteItemAsync('contact_email'),
                SecureStore.deleteItemAsync(ONBOARDING_SECURE_KEY),
              ]);
              useOnboardingStore.setState({ data: {}, isComplete: false });
              useSettingsStore.setState({ contactName: '', contactPhone: '', contactEmail: '', backupContactName: '', backupContactPhone: '', backupContactEmail: '', monitoringInterval: 30, shakeSensitivity: 'medium', stealthMode: false, cameraSoundEnabled: false, wellnessCheckInTime: null, logClearScheduledAt: null, lastAutoCleared: null, onboardingComplete: false, plan: 'free', todayUsage: 0, usageDate: null, role: 'self' });
              useSessionStore.setState({ userId: null, isActive: false, sessionId: null, sessionStartTime: null, lastRiskLevel: null, lastAISummary: null, lastLocation: null, cycleCount: 0 });
              useAlertStore.setState({ events: [], alerts: [] });
              await supabase.auth.signOut();
            } catch (err) {
              console.error('[settings] Delete account failed:', err);
              Alert.alert('Delete Failed', 'Something went wrong. Please try again.');
            }
          },
        },
      ]
    );
  }

  // ── Permission summary label ──────────────────────────────────────────────────

  const allGranted = perms.gps === 'always' && perms.camera && perms.audio && perms.notifications;
  const permValue = allGranted ? 'All granted' : 'Tap to review';

  // ── Profile initials ──────────────────────────────────────────────────────────

  const initials = (displayName || userEmail || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // ── Monitoring value label ────────────────────────────────────────────────────

  const intervalLabel = `${monitoringInterval}s · ${SENS_MAP[sensitivity]} shake`;

  // ── Wellness value label ──────────────────────────────────────────────────────

  const behaviourValue = [
    stealthMode ? 'Stealth' : null,
    !cameraSoundEnabled ? 'Silent cam' : null,
    wellnessEnabled && storedWellnessTime ? `Check-in ${formatTime12h(storedWellnessTime)}` : null,
  ].filter(Boolean).join(' · ') || 'Configure';

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
      <StatusBar barStyle="light-content" />

      {/* Atmospheric glows */}
      <View pointerEvents="none" style={{ position: 'absolute', top: '-10%', left: '-10%', width: '40%', aspectRatio: 1, backgroundColor: 'rgba(0,229,255,0.05)', borderRadius: 9999 }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, right: 0, width: 200, height: 200, backgroundColor: 'rgba(255,61,61,0.05)', borderRadius: 9999 }} />

      {/* Header */}
      <SafeAreaView edges={['top']}>
        <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Settings2 size={18} color={CYAN} strokeWidth={1.5} />
            <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 18, color: '#F0F0F5' }}>Settings</Text>
          </View>
          <TouchableOpacity onPress={() => setProfileModalOpen(true)} activeOpacity={0.7}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: `${CYAN}55` }} />
            ) : (
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,229,255,0.12)', borderWidth: 1.5, borderColor: `${CYAN}33`, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 13, color: CYAN }}>{initials}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {/* ── Profile Card ─────────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={() => setProfileModalOpen(true)}
          activeOpacity={0.8}
          style={{ backgroundColor: 'rgba(0,229,255,0.05)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,229,255,0.18)', padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 32 }}
        >
          {/* Avatar */}
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: `${CYAN}55`, marginRight: 16 }} />
          ) : (
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,229,255,0.12)', borderWidth: 2, borderColor: `${CYAN}33`, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
              <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 22, color: CYAN }}>{initials}</Text>
            </View>
          )}
          {/* Info */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 18, color: '#F0F0F5', marginBottom: 2 }}>
              {displayName || 'Your Name'}
            </Text>
            <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 12, color: '#555568' }} numberOfLines={1}>
              {userEmail ?? '—'}
            </Text>
          </View>
          {/* Edit hint */}
          <View style={{ alignItems: 'center', paddingLeft: 8 }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: CYAN }}>Edit</Text>
            <ChevronRight size={14} color={CYAN} strokeWidth={1.5} />
          </View>
        </TouchableOpacity>

        {/* ── Plan ─────────────────────────────────────────────────────── */}
        <SectionLabel label="Plan" />
        <View style={{ marginBottom: 28 }}>
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: `${planConfig.color}33`, backgroundColor: `${planConfig.color}0A`, padding: 16, gap: 12 }}>
            {/* Plan badge + price row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, backgroundColor: `${planConfig.color}1A`, borderWidth: 1, borderColor: `${planConfig.color}40` }}>
                <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: planConfig.color }}>
                  {planConfig.label}
                </Text>
              </View>
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 12, color: '#555568' }}>
                {planConfig.price}
              </Text>
            </View>

            {/* Usage bar */}
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#8888A0' }}>
                  AI analyses today
                </Text>
                <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 12, color: planConfig.dailyCap !== null && todayUsage >= planConfig.dailyCap ? '#FF3D3D' : '#8888A0' }}>
                  {capLabel(plan, todayUsage)}
                </Text>
              </View>
              {planConfig.dailyCap !== null && (
                <View style={{ height: 4, borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <View style={{ height: 4, borderRadius: 9999, width: `${Math.round(capPercent(plan, todayUsage) * 100)}%`, backgroundColor: capPercent(plan, todayUsage) >= 1 ? '#FF3D3D' : planConfig.color }} />
                </View>
              )}
            </View>

            {/* Upgrade button — hidden on guardian */}
            {plan !== 'guardian' && (
              <TouchableOpacity
                onPress={() => router.push('/upgrade')}
                activeOpacity={0.8}
                style={{ height: 44, borderRadius: 9999, backgroundColor: CYAN, alignItems: 'center', justifyContent: 'center', marginTop: 4, shadowColor: CYAN, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 12 }}
              >
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#0A0A0F' }}>
                  {plan === 'free' ? 'Upgrade to Pro' : 'Upgrade to Guardian'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Safety ───────────────────────────────────────────────────── */}
        <SectionLabel label="Safety" />
        <View style={{ marginBottom: 28 }}>
          <MenuGroup>
            <MenuRow
              icon={<Shield size={18} color={CYAN} strokeWidth={1.5} />}
              label="Emergency Contact"
              value={storedContactName || 'Not set'}
              onPress={() => setContactModalOpen(true)}
            />
            <MenuRow
              icon={<ShieldAlert size={18} color={colors.risk.medium} strokeWidth={1.5} />}
              label="Backup Contact"
              value={storedBackupName || 'Escalates after 10 min'}
              onPress={() => setBackupContactModalOpen(true)}
            />
            <MenuRow
              icon={<Users size={18} color={CYAN} strokeWidth={1.5} />}
              label="Guardian"
              value="Monitor a linked ward"
              onPress={() => router.push('/guardian')}
            />
            <MenuRow
              icon={<Vibrate size={18} color={CYAN} strokeWidth={1.5} />}
              label="Monitoring"
              value={intervalLabel}
              onPress={() => setMonitoringModalOpen(true)}
            />
            <MenuRow
              icon={<Bell size={18} color={CYAN} strokeWidth={1.5} />}
              label="Behaviour"
              value={behaviourValue}
              onPress={() => setBehaviourModalOpen(true)}
              last
            />
          </MenuGroup>
        </View>

        {/* ── Data ─────────────────────────────────────────────────────── */}
        <SectionLabel label="Data" />
        <View style={{ marginBottom: 28 }}>
          <MenuGroup>
            <MenuRow
              icon={<CalendarClock size={18} color="#8888A0" strokeWidth={1.5} />}
              label="Event Log"
              value={logClearEnabled && storedLogClearScheduledAt
                ? `Clears ${new Date(storedLogClearScheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                : 'Auto-clear'}
              onPress={() => setEventLogModalOpen(true)}
            />
            <MenuRow
              icon={<MapPin size={18} color={perms.gps === 'always' ? colors.risk.low : perms.gps === 'foreground' ? colors.risk.medium : colors.risk.high} strokeWidth={1.5} />}
              label="Permissions"
              value={permValue}
              onPress={() => Linking.openSettings()}
              last
            />
          </MenuGroup>
        </View>

        {/* ── Account ──────────────────────────────────────────────────── */}
        <SectionLabel label="Account" />
        <View style={{ marginBottom: 28 }}>
          <MenuGroup>
            <MenuRow
              icon={<Mail size={18} color="#8888A0" strokeWidth={1.5} />}
              label="Email"
              value={userEmail ?? '—'}
            />
            <MenuRow
              icon={<Lock size={18} color="#8888A0" strokeWidth={1.5} />}
              label="Change Password"
              onPress={() => { setProfileModalOpen(true); }}
            />
            <MenuRow
              icon={<LogOut size={18} color={colors.risk.high} strokeWidth={1.5} />}
              label="Sign Out"
              onPress={handleSignOut}
              destructive
            />
            <MenuRow
              icon={<ShieldAlert size={18} color={colors.risk.high} strokeWidth={1.5} />}
              label="Danger Zone"
              onPress={() => setDangerModalOpen(true)}
              destructive
              last
            />
          </MenuGroup>
        </View>

        {/* Permission badges summary */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 4 }}>
          <PermissionBadge label={perms.gps === 'always' ? 'GPS · ALWAYS' : perms.gps === 'foreground' ? 'GPS · PARTIAL' : 'GPS · DENIED'} granted={perms.gps !== 'denied'} partial={perms.gps === 'foreground'} />
          <PermissionBadge label="CAMERA" granted={perms.camera} />
          <PermissionBadge label="MIC" granted={perms.audio} />
          <PermissionBadge label="NOTIFS" granted={perms.notifications} />
        </View>

        {/* ── Dev Tools (remove before production) ─────────────────────── */}
        {__DEV__ && (
          <View style={{ marginTop: 32 }}>
            <SectionLabel label="Developer" />
            <MenuGroup>
              <MenuRow
                icon={<Code2 size={18} color="#FFD740" strokeWidth={1.5} />}
                label="Manage User Plans"
                value="Dev only"
                onPress={() => setDevToolsOpen(true)}
                last
              />
            </MenuGroup>
          </View>
        )}

      </ScrollView>

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      <ProfileModal
        visible={profileModalOpen}
        currentName={displayName}
        currentAvatar={avatarUri}
        userEmail={userEmail}
        onSave={handleSaveProfile}
        onClose={() => setProfileModalOpen(false)}
      />
      <EditContactModal
        visible={contactModalOpen}
        name={storedContactName}
        phone={storedContactPhone}
        email={storedContactEmail}
        onSave={handleSaveContact}
        onClose={() => setContactModalOpen(false)}
      />
      <EditContactModal
        visible={backupContactModalOpen}
        title="Backup Contact"
        name={storedBackupName}
        phone={storedBackupPhone}
        email={storedBackupEmail}
        onSave={handleSaveBackupContact}
        onClose={() => setBackupContactModalOpen(false)}
      />
      <MonitoringModal
        visible={monitoringModalOpen}
        interval={monitoringInterval}
        sensitivity={sensitivity}
        onIntervalChange={handleIntervalChange}
        onSensitivityChange={handleSensitivityChange}
        onClose={() => setMonitoringModalOpen(false)}
      />
      <BehaviourModal
        visible={behaviourModalOpen}
        stealthMode={stealthMode}
        cameraSoundEnabled={cameraSoundEnabled}
        wellnessEnabled={wellnessEnabled}
        wellnessTimeInput={wellnessTimeInput}
        wellnessTimeError={wellnessTimeError}
        storedWellnessTime={storedWellnessTime}
        onStealthToggle={handleStealthToggle}
        onCameraSoundToggle={handleCameraSoundToggle}
        onWellnessToggle={handleWellnessToggle}
        onWellnessTimeChange={(v) => { setWellnessTimeInput(v); setWellnessTimeError(false); }}
        onWellnessTimeSubmit={handleWellnessTimeSubmit}
        onClose={() => setBehaviourModalOpen(false)}
      />
      <EventLogModal
        visible={eventLogModalOpen}
        logClearEnabled={logClearEnabled}
        logClearDate={logClearDate}
        storedLogClearScheduledAt={storedLogClearScheduledAt}
        onToggle={handleLogClearToggle}
        onDateSelect={handleLogClearDateSelect}
        onClose={() => setEventLogModalOpen(false)}
      />
      <DangerModal
        visible={dangerModalOpen}
        onClose={() => setDangerModalOpen(false)}
        onFactoryReset={handleFactoryReset}
        onDeleteAccount={handleDeleteAccount}
      />
      <DevToolsModal
        visible={devToolsOpen}
        onClose={() => setDevToolsOpen(false)}
      />
    </View>
  );
}
