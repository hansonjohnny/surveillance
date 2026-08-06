// Supabase Edge Function -- admin-users
//
// DEV-ONLY tool. Lists all users and lets the caller reassign plan tiers.
// Protected by an admin email allowlist — remove or disable before production.
//
// Actions:
//   { action: 'list' }
//     → [{ id, email, plan, created_at, todayUsage }]
//
//   { action: 'assign', userId: string, plan: 'free'|'pro'|'guardian' }
//     → { success: true }
//
// Deploy: supabase functions deploy admin-users

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Admin allowlist loaded from the ADMIN_ALLOWLIST env var (comma-separated emails).
// Set it with: supabase secrets set ADMIN_ALLOWLIST="alice@example.com,bob@example.com"
// The function returns 503 if the var is missing so it cannot run unconfigured.
const rawAllowlist = Deno.env.get("ADMIN_ALLOWLIST") ?? "";
const ADMIN_SET = new Set(
  rawAllowlist.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (!ADMIN_SET.size) {
    return json({ error: "Admin access not configured" }, 503);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  // Verify the caller is an admin.
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const { data: { user: caller } } = await db.auth.getUser(token);

  if (!caller || !ADMIN_SET.has((caller.email ?? "").toLowerCase())) {
    return json({ error: "Forbidden" }, 403);
  }

  try {
    const body = await req.json();
    const today = new Date().toISOString().split("T")[0];

    // ── list ─────────────────────────────────────────────────────────────────
    if (body.action === "list") {
      const { data: users, error } = await db
        .from("users")
        .select("id, plan, created_at");

      if (error) return json({ error: error.message }, 500);

      // Fetch emails from auth.users in one query.
      const ids = (users ?? []).map((u: { id: string }) => u.id);
      const { data: authUsers } = await db.auth.admin.listUsers();
      const emailMap: Record<string, string> = {};
      for (const au of authUsers?.users ?? []) {
        emailMap[au.id] = au.email ?? "";
      }

      // Fetch today's usage for all users.
      const { data: usage } = await db
        .from("ai_usage")
        .select("user_id, call_count")
        .in("user_id", ids)
        .eq("date", today);

      const usageMap: Record<string, number> = {};
      for (const row of usage ?? []) {
        usageMap[row.user_id] = row.call_count;
      }

      const result = (users ?? []).map((u: { id: string; plan: string; created_at: string }) => ({
        id: u.id,
        email: emailMap[u.id] ?? u.id,
        plan: u.plan,
        created_at: u.created_at,
        todayUsage: usageMap[u.id] ?? 0,
      }));

      return json(result);
    }

    // ── assign ────────────────────────────────────────────────────────────────
    if (body.action === "assign") {
      const { userId, plan } = body;
      if (!userId || !["free", "pro", "guardian"].includes(plan)) {
        return json({ error: "userId and valid plan required" }, 400);
      }

      const { error } = await db
        .from("users")
        .update({ plan })
        .eq("id", userId);

      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("[admin-users] error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
