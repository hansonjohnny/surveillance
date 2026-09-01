import {
  createWardAccount,
  fetchWardSnapshot,
  inviteWard,
  listWards,
  revokeWardLink,
  type WardLink,
} from "@/lib/guardian";
import { supabase } from "@/lib/supabase";
import { useSettingsStore } from "@/store/useSettingsStore";
import type { RiskLevel } from "@/types";
import { useFocusEffect, useRouter } from "expo-router";
import { updatePassword } from "@/lib/auth";
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  KeyRound,
  LogOut,
  Pencil,
  Shield,
  UserCircle,
  UserPlus,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert as RNAlert,
  Modal,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BG = "#0A0A0F";
const CYAN = "#00E5FF";
const MUTED = "#8888A0";
const RISK_COLORS: Record<RiskLevel, string> = {
  low: "#00E676",
  medium: "#FFD740",
  high: "#FF3D3D",
};

function relativeTime(ts: number | null): string {
  if (!ts) return "Never";
  const secs = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

type WardRowState = WardLink & {
  riskLevel: RiskLevel | null;
  lastSeenAt: number | null;
  loadingSnapshot: boolean;
};

// ─── EmptyWards ───────────────────────────────────────────────────────────────
function EmptyWards() {
  return (
    <View style={{ alignItems: "center", paddingTop: 60 }}>
      <Shield size={40} color="#555568" strokeWidth={1.5} />
      <Text
        style={{
          fontFamily: "Outfit_600SemiBold",
          fontSize: 16,
          color: "#F0F0F5",
          marginTop: 16,
        }}
      >
        No one linked yet
      </Text>
      <Text
        style={{
          fontFamily: "DMSans_400Regular",
          fontSize: 13,
          color: MUTED,
          textAlign: "center",
          marginTop: 6,
          paddingHorizontal: 20,
        }}
      >
        Invite someone by their account email to see their live status, event
        log, and alerts here.
      </Text>
    </View>
  );
}

// ─── WardRow ──────────────────────────────────────────────────────────────────
function WardRow({
  ward,
  onPress,
  onRevoke,
}: {
  ward: WardRowState;
  onPress: () => void;
  onRevoke: () => void;
}) {
  const isPending = ward.status === "pending";
  const dotColor = isPending
    ? "#FFD740"
    : ward.riskLevel
      ? RISK_COLORS[ward.riskLevel]
      : "#555568";
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        borderRadius: 14,
        backgroundColor: "rgba(255, 255, 255, 0.04)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.08)",
        marginBottom: 10,
      }}
    >
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: dotColor,
          marginRight: 12,
        }}
      />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: "DMSans_500Medium",
            fontSize: 14,
            color: "#F0F0F5",
          }}
        >
          {ward.wardEmail ?? "Unknown"}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
          {isPending ? <Clock size={11} color="#FFD740" strokeWidth={1.5} /> : null}
          <Text
            style={{
              fontFamily: "JetBrainsMono_400Regular",
              fontSize: 11,
              color: isPending ? "#FFD740" : MUTED,
            }}
          >
            {isPending
              ? "Awaiting their confirmation"
              : ward.loadingSnapshot
                ? "Loading..."
                : `Last seen ${relativeTime(ward.lastSeenAt)}`}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={onRevoke}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{ padding: 6, marginRight: 4 }}
      >
        <X size={16} color={MUTED} strokeWidth={1.5} />
      </TouchableOpacity>
      <ChevronRight size={18} color={MUTED} strokeWidth={1.5} />
    </TouchableOpacity>
  );
}

// ─── InviteModal ──────────────────────────────────────────────────────────────
// Two distinct paths, per migration 011: creating a new account activates
// immediately (setting the password IS the confirmation); linking an
// existing one stays pending until that person accepts an email.
type InviteMode = "create" | "link";

function InviteModal({
  mode,
  onClose,
  onInvited,
}: {
  mode: InviteMode | null;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState("");
  const [backupName, setBackupName] = useState("");
  const [backupPhone, setBackupPhone] = useState("");
  const [backupEmail, setBackupEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const PHONE_REGEX = /^\+[\d\s\-().]{7,15}$/;
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  async function handleSubmit() {
    if (!mode) return;
    setError(null);

    if (mode === "create") {
      if (!backupName.trim() || !PHONE_REGEX.test(backupPhone.trim()) || !EMAIL_REGEX.test(backupEmail.trim())) {
        setError("Enter a valid backup contact name, phone, and email.");
        return;
      }
    }

    setSubmitting(true);
    const result =
      mode === "create"
        ? await createWardAccount(email, {
            name: backupName,
            phone: backupPhone,
            email: backupEmail,
          })
        : await inviteWard(email);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    setEmail("");
    setBackupName("");
    setBackupPhone("");
    setBackupEmail("");
    onInvited();
    onClose();
  }

  return (
    <Modal
      visible={mode !== null}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0, 0, 0, 0.6)",
        }}
      >
        <View
          style={{
            backgroundColor: "#111118",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            paddingBottom: 40,
          }}
        >
          <Text
            style={{
              fontFamily: "Outfit_600SemiBold",
              fontSize: 18,
              color: "#F0F0F5",
              marginBottom: 8,
            }}
          >
            {mode === "create" ? "Create a Ward Account" : "Link an Existing Account"}
          </Text>
          <Text
            style={{
              fontFamily: "DMSans_400Regular",
              fontSize: 13,
              color: MUTED,
              marginBottom: 16,
            }}
          >
            {mode === "create"
              ? "Enter their email — we'll create their account and send them a link to set their own password. No password ever passes through you."
              : "Enter the email they already use for Surveillance AI. They'll get an email and must confirm before you can see anything."}
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="ward@example.com"
            placeholderTextColor="#555568"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              height: 52,
              borderRadius: 12,
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.10)",
              paddingHorizontal: 16,
              color: "#F0F0F5",
              fontFamily: "DMSans_400Regular",
              fontSize: 15,
            }}
          />
          {mode === "create" && (
            <>
              <Text
                style={{
                  fontFamily: "DMSans_500Medium",
                  fontSize: 13,
                  color: "#F0F0F5",
                  marginTop: 20,
                  marginBottom: 8,
                }}
              >
                Backup contact
              </Text>
              <Text
                style={{
                  fontFamily: "DMSans_400Regular",
                  fontSize: 12,
                  color: MUTED,
                  marginBottom: 12,
                }}
              >
                Contacted if the primary (you) doesn't acknowledge a High
                alert within 10 minutes.
              </Text>
              <TextInput
                value={backupName}
                onChangeText={setBackupName}
                placeholder="Backup contact name"
                placeholderTextColor="#555568"
                autoCapitalize="words"
                style={{
                  height: 52,
                  borderRadius: 12,
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.10)",
                  paddingHorizontal: 16,
                  color: "#F0F0F5",
                  fontFamily: "DMSans_400Regular",
                  fontSize: 15,
                  marginBottom: 10,
                }}
              />
              <TextInput
                value={backupPhone}
                onChangeText={setBackupPhone}
                placeholder="+1 555 123 4567"
                placeholderTextColor="#555568"
                keyboardType="phone-pad"
                style={{
                  height: 52,
                  borderRadius: 12,
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.10)",
                  paddingHorizontal: 16,
                  color: "#F0F0F5",
                  fontFamily: "DMSans_400Regular",
                  fontSize: 15,
                  marginBottom: 10,
                }}
              />
              <TextInput
                value={backupEmail}
                onChangeText={setBackupEmail}
                placeholder="backup@example.com"
                placeholderTextColor="#555568"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  height: 52,
                  borderRadius: 12,
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.10)",
                  paddingHorizontal: 16,
                  color: "#F0F0F5",
                  fontFamily: "DMSans_400Regular",
                  fontSize: 15,
                }}
              />
            </>
          )}
          {error ? (
            <Text
              style={{
                fontFamily: "DMSans_400Regular",
                fontSize: 12,
                color: "#FF3D3D",
                marginTop: 8,
              }}
            >
              {error}
            </Text>
          ) : null}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
            style={{
              height: 52,
              borderRadius: 9999,
              backgroundColor: CYAN,
              alignItems: "center",
              justifyContent: "center",
              marginTop: 20,
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? (
              <ActivityIndicator color="#001F24" />
            ) : (
              <Text
                style={{
                  fontFamily: "DMSans_500Medium",
                  fontSize: 15,
                  color: "#001F24",
                }}
              >
                {mode === "create" ? "Create Account" : "Send Confirmation Email"}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onClose}
            style={{ alignItems: "center", marginTop: 14 }}
          >
            <Text
              style={{
                fontFamily: "DMSans_500Medium",
                fontSize: 14,
                color: MUTED,
              }}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── ProfileModal ───────────────────────────────────────────────────────────
// A guardian's only account surface — view/edit name+phone, change
// password, sign out. No dedicated Settings screen exists for a
// guardian (unlike self accounts), so this bottom sheet covers all of it.
type GuardianProfile = { name: string; email: string; phone: string };

const PHONE_REGEX = /^\+[\d\s\-().]{7,15}$/;

const inputStyle = {
  height: 52,
  borderRadius: 12,
  backgroundColor: "rgba(255, 255, 255, 0.05)",
  borderWidth: 1,
  borderColor: "rgba(255, 255, 255, 0.10)",
  paddingHorizontal: 16,
  color: "#F0F0F5",
  fontFamily: "DMSans_400Regular",
  fontSize: 15,
} as const;

function ProfileModal({
  visible,
  profile,
  onClose,
  onProfileUpdated,
  onSignOut,
}: {
  visible: boolean;
  profile: GuardianProfile | null;
  onClose: () => void;
  onProfileUpdated: () => void;
  onSignOut: () => void;
}) {
  const [mode, setMode] = useState<"view" | "editProfile" | "changePassword">("view");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset to a clean view every time the sheet opens.
  useEffect(() => {
    if (visible && profile) {
      setName(profile.name);
      setPhone(profile.phone);
      setMode("view");
      setError(null);
      setNewPassword("");
      setConfirmPassword("");
    }
  }, [visible, profile]);

  async function handleSaveProfile() {
    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (!PHONE_REGEX.test(phone.trim())) {
      setError("Enter a valid phone number, e.g. +1 555 123 4567.");
      return;
    }

    setSaving(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      setError("Not signed in.");
      return;
    }

    const [{ error: metaError }, { error: phoneError }] = await Promise.all([
      supabase.auth.updateUser({ data: { full_name: name.trim() } }),
      supabase.from("users").update({ phone: phone.trim() }).eq("id", user.id),
    ]);

    setSaving(false);

    if (metaError || phoneError) {
      setError("Something went wrong. Please try again.");
      return;
    }

    onProfileUpdated();
    setMode("view");
  }

  async function handleChangePassword() {
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    setError(null);
    const { success, error: updateError } = await updatePassword(newPassword);
    setSaving(false);

    if (!success) {
      setError(updateError ?? "Failed to update password.");
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setMode("view");
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0, 0, 0, 0.6)",
        }}
      >
        <View
          style={{
            backgroundColor: "#111118",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            paddingBottom: 40,
          }}
        >
          {mode === "view" && (
            <>
              <View style={{ alignItems: "center", marginBottom: 20 }}>
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: "rgba(0, 229, 255, 0.10)",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                  }}
                >
                  <UserCircle size={32} color={CYAN} strokeWidth={1.5} />
                </View>
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 18, color: "#F0F0F5" }}>
                  {profile?.name ?? "Guardian"}
                </Text>
                <Text
                  style={{ fontFamily: "DMSans_400Regular", fontSize: 13, color: MUTED, marginTop: 2 }}
                >
                  {profile?.email}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 14,
                  borderTopWidth: 1,
                  borderTopColor: "rgba(255, 255, 255, 0.08)",
                }}
              >
                <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 14, color: MUTED }}>
                  Account type
                </Text>
                <Text style={{ fontFamily: "DMSans_500Medium", fontSize: 14, color: "#F0F0F5" }}>
                  Guardian
                </Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 14,
                  borderTopWidth: 1,
                  borderTopColor: "rgba(255, 255, 255, 0.08)",
                }}
              >
                <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 14, color: MUTED }}>
                  Phone
                </Text>
                <Text style={{ fontFamily: "DMSans_500Medium", fontSize: 14, color: "#F0F0F5" }}>
                  {profile?.phone || "Not set"}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setMode("editProfile")}
                activeOpacity={0.85}
                style={{
                  flexDirection: "row",
                  gap: 8,
                  height: 52,
                  borderRadius: 9999,
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.15)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 20,
                }}
              >
                <Pencil size={16} color="#F0F0F5" strokeWidth={1.5} />
                <Text style={{ fontFamily: "DMSans_500Medium", fontSize: 15, color: "#F0F0F5" }}>
                  Edit Profile
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setMode("changePassword")}
                activeOpacity={0.85}
                style={{
                  flexDirection: "row",
                  gap: 8,
                  height: 52,
                  borderRadius: 9999,
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.15)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 10,
                }}
              >
                <KeyRound size={16} color="#F0F0F5" strokeWidth={1.5} />
                <Text style={{ fontFamily: "DMSans_500Medium", fontSize: 15, color: "#F0F0F5" }}>
                  Change Password
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onSignOut}
                activeOpacity={0.85}
                style={{
                  flexDirection: "row",
                  gap: 8,
                  height: 52,
                  borderRadius: 9999,
                  borderWidth: 1,
                  borderColor: "rgba(255, 61, 61, 0.30)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 10,
                }}
              >
                <LogOut size={18} color="#FF3D3D" strokeWidth={1.5} />
                <Text style={{ fontFamily: "DMSans_500Medium", fontSize: 15, color: "#FF3D3D" }}>
                  Sign Out
                </Text>
              </TouchableOpacity>
            </>
          )}

          {mode === "editProfile" && (
            <>
              <Text
                style={{
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 18,
                  color: "#F0F0F5",
                  marginBottom: 16,
                }}
              >
                Edit Profile
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Full name"
                placeholderTextColor="#555568"
                autoCapitalize="words"
                style={{ ...inputStyle, marginBottom: 10 }}
              />
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 555 123 4567"
                placeholderTextColor="#555568"
                keyboardType="phone-pad"
                style={inputStyle}
              />
              <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 12, color: MUTED, marginTop: 8 }}>
                This is the SOS contact number on every ward you've already
                created — changing it here doesn't retroactively update them.
              </Text>
              {error ? (
                <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 12, color: "#FF3D3D", marginTop: 8 }}>
                  {error}
                </Text>
              ) : null}
              <TouchableOpacity
                onPress={handleSaveProfile}
                disabled={saving}
                activeOpacity={0.85}
                style={{
                  height: 52,
                  borderRadius: 9999,
                  backgroundColor: CYAN,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 20,
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? (
                  <ActivityIndicator color="#001F24" />
                ) : (
                  <Text style={{ fontFamily: "DMSans_500Medium", fontSize: 15, color: "#001F24" }}>
                    Save
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setMode("view");
                  setError(null);
                }}
                style={{ alignItems: "center", marginTop: 14 }}
              >
                <Text style={{ fontFamily: "DMSans_500Medium", fontSize: 14, color: MUTED }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </>
          )}

          {mode === "changePassword" && (
            <>
              <Text
                style={{
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 18,
                  color: "#F0F0F5",
                  marginBottom: 16,
                }}
              >
                Change Password
              </Text>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="New password"
                placeholderTextColor="#555568"
                secureTextEntry
                style={{ ...inputStyle, marginBottom: 10 }}
              />
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor="#555568"
                secureTextEntry
                style={inputStyle}
              />
              {error ? (
                <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 12, color: "#FF3D3D", marginTop: 8 }}>
                  {error}
                </Text>
              ) : null}
              <TouchableOpacity
                onPress={handleChangePassword}
                disabled={saving}
                activeOpacity={0.85}
                style={{
                  height: 52,
                  borderRadius: 9999,
                  backgroundColor: CYAN,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 20,
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? (
                  <ActivityIndicator color="#001F24" />
                ) : (
                  <Text style={{ fontFamily: "DMSans_500Medium", fontSize: 15, color: "#001F24" }}>
                    Update Password
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setMode("view");
                  setError(null);
                }}
                style={{ alignItems: "center", marginTop: 14 }}
              >
                <Text style={{ fontFamily: "DMSans_500Medium", fontSize: 14, color: MUTED }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── GuardianListScreen ───────────────────────────────────────────────────────
export default function GuardianListScreen() {
  const router = useRouter();
  const isWard = useSettingsStore((s) => s.isWard);
  const [wards, setWards] = useState<WardRowState[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteMode, setInviteMode] = useState<InviteMode | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState<GuardianProfile | null>(null);

  const loadProfile = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { data: userRow } = await supabase
      .from("users")
      .select("phone")
      .eq("id", data.user.id)
      .single();
    setProfile({
      name: (data.user.user_metadata?.full_name as string | undefined) || "Guardian",
      email: data.user.email ?? "",
      phone: userRow?.phone ?? "",
    });
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const links = await listWards();
    setWards(
      links.map((l) => ({
        ...l,
        riskLevel: null,
        lastSeenAt: null,
        loadingSnapshot: l.status === "active",
      })),
    );
    setLoading(false);

    // Fetch each active ward's latest snapshot for the risk dot / last-seen
    // time — acceptable as N small fetches given a guardian typically links
    // a handful of wards, not hundreds. Skipped for pending links: RLS
    // (migration 011) blocks any read until they're accepted, so there's
    // nothing to fetch yet.
    links
      .filter((link) => link.status === "active")
      .forEach(async (link) => {
        const snapshot = await fetchWardSnapshot(link.wardId);
        const latestEvent = snapshot.events[0] ?? null;
        setWards((prev) =>
          prev.map((w) =>
            w.id === link.id
              ? {
                  ...w,
                  riskLevel: latestEvent?.riskLevel ?? null,
                  lastSeenAt:
                    snapshot.session?.lastLocationAt ??
                    latestEvent?.timestamp ??
                    null,
                  loadingSnapshot: false,
                }
              : w,
          ),
        );
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  function handleRevoke(ward: WardRowState) {
    RNAlert.alert(
      "Stop monitoring?",
      `You'll no longer be able to see ${ward.wardEmail ?? "this person"}'s status.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop Monitoring",
          style: "destructive",
          onPress: async () => {
            await revokeWardLink(ward.id);
            refresh();
          },
        },
      ],
    );
  }

  function handleSignOut() {
    RNAlert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => supabase.auth.signOut(),
      },
    ]);
  }

  // Defense in depth — the real enforcement is the RLS policy and edge
  // function checks in lib/guardian.ts (migration 012). This just stops
  // a ward from seeing the dashboard if they reach this route directly
  // (stale bookmark, back-button edge case) after the Settings row that
  // normally leads here is already hidden for them.
  if (isWard) {
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <StatusBar barStyle="light-content" backgroundColor={BG} />
        <SafeAreaView edges={["top"]}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              height: 64,
              paddingHorizontal: 16,
              borderBottomWidth: 1,
              borderBottomColor: "rgba(255, 255, 255, 0.10)",
            }}
          >
            <TouchableOpacity
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/(tabs)/settings")
              }
              style={{ padding: 8 }}
            >
              <ArrowLeft size={20} color={CYAN} strokeWidth={1.5} />
            </TouchableOpacity>
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                fontSize: 17,
                color: "#F0F0F5",
                marginLeft: 4,
              }}
            >
              Guardian
            </Text>
          </View>
        </SafeAreaView>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32,
          }}
        >
          <Shield size={40} color="#555568" strokeWidth={1.5} />
          <Text
            style={{
              fontFamily: "Outfit_600SemiBold",
              fontSize: 16,
              color: "#F0F0F5",
              marginTop: 16,
              textAlign: "center",
            }}
          >
            Not available
          </Text>
          <Text
            style={{
              fontFamily: "DMSans_400Regular",
              fontSize: 13,
              color: MUTED,
              textAlign: "center",
              marginTop: 6,
            }}
          >
            An account currently being monitored can't monitor others.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <SafeAreaView edges={["top"]}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            height: 64,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: "rgba(255, 255, 255, 0.10)",
          }}
        >
          <Text
            style={{
              fontFamily: "Outfit_700Bold",
              fontSize: 17,
              color: "#F0F0F5",
            }}
          >
            Guardian
          </Text>
          <TouchableOpacity onPress={() => setProfileOpen(true)} style={{ padding: 8 }}>
            <UserCircle size={22} color={CYAN} strokeWidth={1.5} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 20 }}>
        {wards.length === 0 && !loading ? (
          <EmptyWards />
        ) : (
          wards.map((w) => (
            <WardRow
              key={w.id}
              ward={w}
              onPress={() => {
                if (w.status === "pending") {
                  RNAlert.alert(
                    "Awaiting confirmation",
                    `${w.wardEmail ?? "This person"} hasn't accepted your request yet — there's nothing to show until they do.`,
                  );
                  return;
                }
                router.push(
                  `/guardian/${w.wardId}?email=${encodeURIComponent(w.wardEmail ?? "")}`,
                );
              }}
              onRevoke={() => handleRevoke(w)}
            />
          ))
        )}

        <View style={{ gap: 10, marginTop: 12 }}>
          <TouchableOpacity
            onPress={() => setInviteMode("create")}
            activeOpacity={0.85}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              height: 52,
              borderRadius: 9999,
              backgroundColor: CYAN,
            }}
          >
            <UserPlus size={18} color="#001F24" strokeWidth={2} />
            <Text
              style={{
                fontFamily: "DMSans_500Medium",
                fontSize: 15,
                color: "#001F24",
              }}
            >
              Create a Ward Account
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setInviteMode("link")}
            activeOpacity={0.85}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              height: 52,
              borderRadius: 9999,
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.15)",
            }}
          >
            <UserPlus size={18} color="#F0F0F5" strokeWidth={1.5} />
            <Text
              style={{
                fontFamily: "DMSans_500Medium",
                fontSize: 15,
                color: "#F0F0F5",
              }}
            >
              Link an Existing Account
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <InviteModal
        mode={inviteMode}
        onClose={() => setInviteMode(null)}
        onInvited={refresh}
      />

      <ProfileModal
        visible={profileOpen}
        profile={profile}
        onClose={() => setProfileOpen(false)}
        onProfileUpdated={loadProfile}
        onSignOut={() => {
          setProfileOpen(false);
          handleSignOut();
        }}
      />
    </View>
  );
}
