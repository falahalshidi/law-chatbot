import type { HandlerEvent, HandlerContext } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

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

      return jsonResponse(200, { users: data || [] });
    }

    if (event.httpMethod === "PATCH") {
      const body = JSON.parse(event.body || "{}");
      const userId = String(body.userId || "");
      const isApproved = Boolean(body.isApproved);

      if (!userId) {
        return jsonResponse(400, { error: "userId is required" });
      }

      const { error } = await supabase
        .from("users")
        .update({ is_approved: isApproved })
        .eq("id", userId);

      if (error) {
        return jsonResponse(500, { error: error.message });
      }

      return jsonResponse(200, { success: true });
    }

    return jsonResponse(405, { error: "Method not allowed" });
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
};

export { handler };
