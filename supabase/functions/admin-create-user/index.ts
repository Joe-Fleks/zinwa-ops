import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateUserPayload {
  email: string;
  full_name: string;
  role_id?: string;
  scope_type?: 'SC' | 'CATCHMENT' | 'NATIONAL';
  scope_id?: string;
}

const ROLE_SCOPE_MATRIX: Record<string, string[]> = {
  'TO': ['SC'],
  'RO': ['SC'],
  'MO': ['SC'],
  'STL': ['SC'],
  'CM': ['CATCHMENT'],
  'WSSE': ['NATIONAL'],
  'WSSM': ['NATIONAL'],
  'Director': ['NATIONAL'],
  'CEO': ['NATIONAL'],
  'Maintenance Manager': ['NATIONAL'],
  'Global Admin': ['NATIONAL'],
  'Standard User': ['SC', 'CATCHMENT', 'NATIONAL'],
};

function validateRoleScope(roleName: string, scopeType: string): { valid: boolean; error?: string } {
  if (!roleName || !scopeType) {
    return { valid: false, error: 'Role and scope type are required' };
  }

  const allowedScopes = ROLE_SCOPE_MATRIX[roleName];

  if (!allowedScopes) {
    return { valid: false, error: `Unknown role: ${roleName}` };
  }

  if (!allowedScopes.includes(scopeType)) {
    const scopeList = allowedScopes.join(' or ');
    return {
      valid: false,
      error: `Role "${roleName}" must use ${scopeList} scope`,
    };
  }

  return { valid: true };
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header", code: "NOT_ALLOWED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    console.log("DIAGNOSTIC: SERVICE_ROLE_KEY EXISTS:", !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    console.log("DIAGNOSTIC: ANON_KEY EXISTS:", !!Deno.env.get("SUPABASE_ANON_KEY"));
    console.log("DIAGNOSTIC: ADMIN_CLIENT KEY PREFIX:", (serviceRoleKey || "").slice(0, 10));
    console.log("DIAGNOSTIC: ADMIN_CLIENT KEY VARIABLE:", "serviceRoleKey");

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log("DIAGNOSTIC: ADMIN_CLIENT INITIALIZED");

    const token = authHeader.replace("Bearer ", "").trim();
    console.log("DIAGNOSTIC: Token extracted, length:", token.length);

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

      console.log("DIAGNOSTIC: Token decoded, user ID:", userId);
    } catch (tokenError) {
      console.error("DIAGNOSTIC: Token decode error:", tokenError);
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
      console.error("DIAGNOSTIC: User not found");
      return new Response(
        JSON.stringify({ error: "User not found", code: "NOT_ALLOWED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("DIAGNOSTIC: User authenticated successfully:", caller.id);

    console.log("DIAGNOSTIC: Checking permissions for user:", caller.id);

    const { data: userRolesData, error: userRolesError } = await adminClient
      .from("user_roles")
      .select("role_id")
      .eq("user_id", caller.id)
      .is("effective_to", null);

    console.log("DIAGNOSTIC: User roles query error:", userRolesError);
    console.log("DIAGNOSTIC: User roles data:", userRolesData);

    if (userRolesError) {
      console.error("User roles query error:", userRolesError);
      return new Response(
        JSON.stringify({ error: "Failed to retrieve user roles: " + userRolesError.message, code: "NOT_ALLOWED" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!userRolesData || userRolesData.length === 0) {
      console.log("DIAGNOSTIC: No roles assigned to user");
      return new Response(
        JSON.stringify({ error: "You do not have any roles assigned", code: "NOT_ALLOWED" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const roleIds = userRolesData.map((ur: any) => ur.role_id);
    console.log("DIAGNOSTIC: Role IDs to check:", roleIds);

    const { data: permissionsData, error: permError } = await adminClient
      .from("role_permissions")
      .select("permission_id, permissions(permission_key)")
      .in("role_id", roleIds);

    console.log("DIAGNOSTIC: Permissions query error:", permError);
    console.log("DIAGNOSTIC: Permissions data:", JSON.stringify(permissionsData, null, 2));

    if (permError) {
      console.error("Permissions query error:", permError);
      return new Response(
        JSON.stringify({ error: "Failed to retrieve permissions: " + permError.message, code: "NOT_ALLOWED" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const permissions = permissionsData?.map((p: any) => p.permissions?.permission_key).filter(Boolean) as string[] || [];
    console.log("DIAGNOSTIC: Final permissions array:", permissions);
    console.log("DIAGNOSTIC: Checking for 'manage_users':", permissions.includes("manage_users"));

    if (!permissions.includes("manage_users")) {
      return new Response(
        JSON.stringify({ error: "You do not have permission to create users. Your permissions: " + permissions.join(", "), code: "NOT_ALLOWED" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: CreateUserPayload = await req.json();

    if (!payload.email || !payload.full_name) {
      return new Response(
        JSON.stringify({ error: "Email and full name are required", code: "INVALID_REQUEST" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = payload.email.trim().toLowerCase();

    const { data: existingUser } = await adminClient
      .from("user_profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: "This email address is already registered", code: "EMAIL_EXISTS" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tempPassword = generateTempPassword();

    const { data: authUser, error: createAuthError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: payload.full_name },
    });

    if (createAuthError) {
      console.error("Auth user creation error:", createAuthError);
      return new Response(
        JSON.stringify({ error: createAuthError.message, code: "CREATE_FAILED" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: profileError } = await adminClient
      .from("user_profiles")
      .upsert({
        id: authUser.user.id,
        email: normalizedEmail,
        full_name: payload.full_name,
        is_active: true,
        force_password_reset: true,
        created_at: new Date().toISOString(),
      }, { onConflict: "id" });

    if (profileError) {
      console.error("Profile creation error:", profileError);
      await adminClient.auth.admin.deleteUser(authUser.user.id);
      return new Response(
        JSON.stringify({ error: "Failed to create user profile", code: "CREATE_FAILED" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let roleIdToAssign = payload.role_id;

    if (!roleIdToAssign) {
      const { data: defaultRole } = await adminClient
        .from("roles")
        .select("id")
        .eq("name", "Standard User")
        .maybeSingle();

      roleIdToAssign = defaultRole?.id;
    }

    if (roleIdToAssign) {
      const { data: roleData } = await adminClient
        .from("roles")
        .select("name")
        .eq("id", roleIdToAssign)
        .maybeSingle();

      const roleName = roleData?.name;
      const scopeType = payload.scope_type || 'SC';

      const validation = validateRoleScope(roleName, scopeType);
      if (!validation.valid) {
        await adminClient.auth.admin.deleteUser(authUser.user.id);
        await adminClient.from("user_profiles").delete().eq("id", authUser.user.id);
        return new Response(
          JSON.stringify({ error: validation.error, code: "INVALID_REQUEST" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let scopeId: string | null = null;

      if (scopeType === 'SC') {
        if (!payload.scope_id) {
          await adminClient.auth.admin.deleteUser(authUser.user.id);
          await adminClient.from("user_profiles").delete().eq("id", authUser.user.id);
          return new Response(
            JSON.stringify({ error: "Service Centre ID is required for SC scope", code: "INVALID_REQUEST" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: scExists } = await adminClient
          .from("service_centres")
          .select("id")
          .eq("id", payload.scope_id)
          .maybeSingle();

        if (!scExists) {
          await adminClient.auth.admin.deleteUser(authUser.user.id);
          await adminClient.from("user_profiles").delete().eq("id", authUser.user.id);
          return new Response(
            JSON.stringify({ error: "Service Centre not found", code: "INVALID_REQUEST" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        scopeId = payload.scope_id;
      } else if (scopeType === 'CATCHMENT') {
        if (!payload.scope_id) {
          await adminClient.auth.admin.deleteUser(authUser.user.id);
          await adminClient.from("user_profiles").delete().eq("id", authUser.user.id);
          return new Response(
            JSON.stringify({ error: "Catchment ID is required for CATCHMENT scope", code: "INVALID_REQUEST" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: catchmentExists } = await adminClient
          .from("catchments")
          .select("id")
          .eq("id", payload.scope_id)
          .maybeSingle();

        if (!catchmentExists) {
          await adminClient.auth.admin.deleteUser(authUser.user.id);
          await adminClient.from("user_profiles").delete().eq("id", authUser.user.id);
          return new Response(
            JSON.stringify({ error: "Catchment not found", code: "INVALID_REQUEST" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        scopeId = payload.scope_id;
      }

      const { error: roleError } = await adminClient
        .from("user_roles")
        .insert({
          user_id: authUser.user.id,
          role_id: roleIdToAssign,
          scope_type: scopeType,
          scope_id: scopeId,
          assigned_by: caller.id,
          effective_from: new Date().toISOString(),
        });

      if (roleError) {
        console.error("Role assignment error:", roleError);
      }
    }

    await adminClient.from("audit_logs").insert({
      user_id: caller.id,
      action_type: "USER_CREATED",
      entity_type: "user",
      entity_id: authUser.user.id,
      previous_value: null,
      new_value: {
        email: normalizedEmail,
        full_name: payload.full_name,
        role_id: roleIdToAssign,
        scope_type: payload.scope_type,
        scope_id: payload.scope_id,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        user_id: authUser.user.id,
        temp_password: tempPassword,
        message: "User created successfully",
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
