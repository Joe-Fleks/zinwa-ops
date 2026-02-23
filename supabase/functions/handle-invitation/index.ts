import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AcceptInvitationRequest {
  invitationId: string;
  password: string;
  fullName: string;
  role: string;
}

interface ResendInvitationRequest {
  invitationId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("authorization");
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "accept" && req.method === "POST") {
      return await handleAcceptInvitation(req, authHeader);
    } else if (action === "resend" && req.method === "POST") {
      return await handleResendInvitation(req, authHeader);
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function handleAcceptInvitation(req: Request, authHeader: string | null) {
  const { invitationId, password, fullName, role }: AcceptInvitationRequest = await req.json();

  if (!invitationId || !password || !fullName || !role) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (password.length < 6) {
    return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const getInvitation = await fetch(`${supabaseUrl}/rest/v1/user_invitations?id=eq.${invitationId}`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${supabaseKey}`,
        "content-type": "application/json",
      },
    });

    if (!getInvitation.ok) {
      throw new Error("Failed to fetch invitation");
    }

    const invitations = await getInvitation.json();
    if (invitations.length === 0) {
      return new Response(JSON.stringify({ error: "Invitation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const invitation = invitations[0];

    if (invitation.status !== "pending") {
      return new Response(JSON.stringify({ error: "Invitation is no longer valid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Invitation has expired" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const signupResponse = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: "POST",
      headers: {
        "apikey": supabaseKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: invitation.email,
        password: password,
      }),
    });

    if (!signupResponse.ok) {
      const error = await signupResponse.json();
      throw new Error(error.message || "Failed to create account");
    }

    const newUser = await signupResponse.json();
    const userId = newUser.user.id;

    const profileResponse = await fetch(`${supabaseUrl}/rest/v1/user_profiles`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${supabaseKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        id: userId,
        full_name: fullName,
        role: role,
        email: invitation.email,
      }),
    });

    if (!profileResponse.ok) {
      throw new Error("Failed to create user profile");
    }

    const updateResponse = await fetch(
      `${supabaseUrl}/rest/v1/user_invitations?id=eq.${invitationId}`,
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${supabaseKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          status: "accepted",
          accepted_at: new Date().toISOString(),
        }),
      }
    );

    if (!updateResponse.ok) {
      console.error("Failed to update invitation status");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Account created and invitation accepted",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error accepting invitation:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to accept invitation",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

async function handleResendInvitation(req: Request, authHeader: string | null) {
  const { invitationId }: ResendInvitationRequest = await req.json();

  if (!invitationId) {
    return new Response(JSON.stringify({ error: "Missing invitationId" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Invitation resend handled (email sending would be implemented here)",
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
