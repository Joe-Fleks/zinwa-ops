import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ResetPasswordPayload {
  target_user_id: string;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    console.log("Auth header received:", !!authHeader);
    console.log("All headers:", Array.from(req.headers.entries()));

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header", code: "NOT_ALLOWED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const token = authHeader.replace("Bearer ", "").trim();

    let userId: string;

    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        throw new Error("Invalid JWT format");
      }

      const decoded = JSON.parse(atob(parts[1]));
      userId = decoded.sub;

      if (!userId) {
        throw new Error("No user ID in token");
      }
    } catch (tokenError) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token", code: "NOT_ALLOWED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: caller, error: callerError } = await adminClient
      .from("user_profiles")
      .select("id, email")
      .eq("id", userId)
      .maybeSingle();

    if (callerError || !caller) {
      return new Response(
        JSON.stringify({ error: "User not found", code: "NOT_ALLOWED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: userRolesData, error: userRolesError } = await adminClient
      .from("user_roles")
      .select("role_id")
      .eq("user_id", caller.id)
      .is("effective_to", null);

    if (userRolesError) {
      return new Response(
        JSON.stringify({ error: "Failed to retrieve user roles", code: "NOT_ALLOWED" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!userRolesData || userRolesData.length === 0) {
      return new Response(
        JSON.stringify({ error: "You do not have any roles assigned", code: "NOT_ALLOWED" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const roleIds = userRolesData.map((ur: any) => ur.role_id);

    const { data: permissionsData, error: permError } = await adminClient
      .from("role_permissions")
      .select("permission_id, permissions(permission_key)")
      .in("role_id", roleIds);

    if (permError) {
      return new Response(
        JSON.stringify({ error: "Failed to retrieve permissions", code: "NOT_ALLOWED" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const permissions = permissionsData?.map((p: any) => p.permissions?.permission_key).filter(Boolean) as string[] || [];

    if (!permissions.includes("manage_users")) {
      return new Response(
        JSON.stringify({ error: "You do not have permission to reset passwords", code: "NOT_ALLOWED" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: ResetPasswordPayload = await req.json();

    if (!payload.target_user_id) {
      return new Response(
        JSON.stringify({ error: "Target user ID is required", code: "INVALID_REQUEST" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: targetUser } = await adminClient
      .from("user_profiles")
      .select("id, email")
      .eq("id", payload.target_user_id)
      .maybeSingle();

    if (!targetUser) {
      return new Response(
        JSON.stringify({ error: "Target user not found", code: "INVALID_REQUEST" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tempPassword = generateTempPassword();

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      payload.target_user_id,
      { password: tempPassword }
    );

    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message, code: "UPDATE_FAILED" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: profileError } = await adminClient
      .from("user_profiles")
      .update({ force_password_reset: true })
      .eq("id", payload.target_user_id);

    if (profileError) {
      return new Response(
        JSON.stringify({ error: "Failed to update user profile", code: "UPDATE_FAILED" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await adminClient.from("audit_logs").insert({
      user_id: caller.id,
      action_type: "PASSWORD_RESET_BY_ADMIN",
      entity_type: "user",
      entity_id: payload.target_user_id,
      previous_value: { email: targetUser.email },
      new_value: { email: targetUser.email, force_password_reset: true },
    });

    return new Response(
      JSON.stringify({
        success: true,
        temp_password: tempPassword,
        message: "Password reset successfully",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateTempPassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  password += "Aa1!";
  return password;
}
