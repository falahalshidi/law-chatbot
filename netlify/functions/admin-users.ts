import type { HandlerEvent, HandlerContext } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { normalizeUserStatus, statusToLegacyApproval, type UserStatus } from "./_lib/user-status";
import { sendApprovalEmail } from "./_lib/email";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function jsonResponse(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

const handler = async (event: HandlerEvent, _context: HandlerContext) => {
  if (event.httpMethod === "OPTIONS") {
    return jsonResponse(200, {});
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, {
      error: "Supabase admin endpoint is not configured",
      details: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    if (event.httpMethod === "GET") {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        return jsonResponse(500, { error: error.message });
      }

      return jsonResponse(200, {
        users: (data || []).map((user) => ({
          ...user,
          status: normalizeUserStatus(user),
        })),
      });
    }

    if (event.httpMethod === "PATCH") {
      const body = JSON.parse(event.body || "{}");
      const userId = String(body.userId || "");
      const nextStatus = typeof body.status === "string" ? (body.status as UserStatus) : undefined;
      const isAdmin = typeof body.isAdmin === "boolean" ? body.isAdmin : undefined;
      const resendApprovalEmail = body.resendApprovalEmail === true;

      if (!userId) {
        return jsonResponse(400, { error: "userId is required" });
      }

      const { data: existingUser, error: existingUserError } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (existingUserError || !existingUser) {
        return jsonResponse(404, {
          error: existingUserError?.message || "User not found",
        });
      }

      const previousStatus = normalizeUserStatus(existingUser);
      const updates: Record<string, unknown> = {};

      if (nextStatus) {
        updates.status = nextStatus;
        updates.is_approved = statusToLegacyApproval(nextStatus);
      }

      if (typeof isAdmin === "boolean") {
        updates.is_admin = isAdmin;
        if (isAdmin) {
          updates.is_approved = true;
          updates.status = "accepted";
        }
      }

      if (Object.keys(updates).length === 0 && !resendApprovalEmail) {
        return jsonResponse(400, { error: "No updates provided" });
      }

      if (resendApprovalEmail && previousStatus !== "accepted") {
        return jsonResponse(400, {
          error: "Approval email can only be resent for accepted users",
        });
      }

      if (resendApprovalEmail && existingUser.is_admin) {
        return jsonResponse(400, {
          error: "Approval email resend is not available for admin users",
        });
      }

      let error = null;

      if (Object.keys(updates).length > 0) {
        const updateResult = await supabase
          .from("users")
          .update(updates)
          .eq("id", userId);

        error = updateResult.error;
      }

      if (error && error.message.toLowerCase().includes("status")) {
        const fallbackUpdates = { ...updates };
        delete fallbackUpdates.status;

        const fallbackResult = await supabase
          .from("users")
          .update(fallbackUpdates)
          .eq("id", userId);

        error = fallbackResult.error;
      }

      if (error) {
        return jsonResponse(500, { error: error.message });
      }

      const finalStatus = isAdmin ? "accepted" : nextStatus || previousStatus;
      let emailNotification:
        | { sent: boolean; skipped?: boolean; reason?: string; messageId?: string }
        | undefined;

      if (resendApprovalEmail) {
        emailNotification = await sendApprovalEmail(existingUser.email || "");
      } else if (previousStatus !== "accepted" && finalStatus === "accepted" && !existingUser.is_admin) {
        emailNotification = await sendApprovalEmail(existingUser.email || "");
      }

      return jsonResponse(200, {
        success: true,
        emailNotification,
      });
    }

    return jsonResponse(405, { error: "Method not allowed" });
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
};

export { handler };
