import type { HandlerEvent, HandlerContext } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { normalizeUserStatus, statusToLegacyApproval, type UserStatus } from "./_lib/user-status";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, 100000, 32, "sha256");
  return `${salt.toString("base64")}:${hash.toString("base64")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  if (!stored.includes(":")) {
    return stored === password;
  }

  const [saltBase64, hashBase64] = stored.split(":");
  if (!saltBase64 || !hashBase64) return false;

  const salt = Buffer.from(saltBase64, "base64");
  const expectedHash = Buffer.from(hashBase64, "base64");
  const computedHash = pbkdf2Sync(password, salt, 100000, 32, "sha256");

  if (computedHash.length !== expectedHash.length) return false;
  return timingSafeEqual(computedHash, expectedHash);
}

function jsonResponse(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

const handler = async (event: HandlerEvent, _context: HandlerContext) => {
  if (event.httpMethod === "OPTIONS") {
    return jsonResponse(200, {});
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return jsonResponse(503, {
      error: "Supabase is not configured on server",
      details: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set SUPABASE_SERVICE_ROLE_KEY in Netlify env (Supabase Dashboard > Project Settings > API > service_role).",
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const body = JSON.parse(event.body || "{}");
    const action = String(body.action || "").toLowerCase();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return jsonResponse(400, { error: "Email and password are required" });
    }

    if (action === "login") {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .ilike("email", email)
        .limit(1);

      if (error) {
        return jsonResponse(500, { error: "Database query failed", details: error.message });
      }

      const user = data?.[0];
      if (!user || !verifyPassword(password, user.password_hash || "")) {
        return jsonResponse(401, { error: "INVALID_CREDENTIALS" });
      }

      const status = normalizeUserStatus(user);
      if (status === "rejected") {
        return jsonResponse(403, { error: "REJECTED_ACCOUNT" });
      }

      if (status !== "accepted" && !user.is_admin) {
        return jsonResponse(403, { error: "PENDING_APPROVAL" });
      }

      return jsonResponse(200, {
        user: {
          id: user.id,
          email: user.email,
          is_admin: !!user.is_admin,
          status,
        },
      });
    }

    if (action === "signup") {
      const confirmPassword = String(body.confirmPassword || "");
      if (password !== confirmPassword) {
        return jsonResponse(400, { error: "PASSWORD_MISMATCH" });
      }
      if (password.length < 6) {
        return jsonResponse(400, { error: "WEAK_PASSWORD" });
      }

      const { data: existing, error: existingError } = await supabase
        .from("users")
        .select("id")
        .ilike("email", email)
        .limit(1);

      if (existingError) {
        return jsonResponse(500, { error: "Database query failed", details: existingError.message });
      }

      if (existing?.length) {
        return jsonResponse(409, { error: "EMAIL_EXISTS" });
      }

      const passwordHash = hashPassword(password);
      const baseUserPayload = {
        email,
        password_hash: passwordHash,
        is_admin: false,
        is_approved: statusToLegacyApproval("pending" as UserStatus),
      };

      let inserted: { id: string } | null = null;
      let insertError: { message: string } | null = null;

      const primaryInsert = await supabase
        .from("users")
        .insert([
          {
            ...baseUserPayload,
            status: "pending",
          },
        ])
        .select("id")
        .single();

      inserted = primaryInsert.data;
      insertError = primaryInsert.error;

      if (insertError && insertError.message.toLowerCase().includes("status")) {
        const fallbackInsert = await supabase
          .from("users")
          .insert([baseUserPayload])
          .select("id")
          .single();

        inserted = fallbackInsert.data;
        insertError = fallbackInsert.error;
      }

      if (insertError) {
        return jsonResponse(500, { error: "Failed to create user", details: insertError.message });
      }

      return jsonResponse(201, {
        success: true,
        userId: inserted!.id,
      });
    }

    return jsonResponse(400, { error: "Invalid action" });
  } catch (error) {
    return jsonResponse(500, {
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export { handler };
