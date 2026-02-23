import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

function streamHeaders() {
  return {
    ...corsHeaders,
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };
}

const SYSTEM_PROMPT = `You are an AI assistant for a water utility management system called ZINWA (Zimbabwe National Water Authority). You help operators, managers, and executives understand their water production, chemical stock, maintenance, and financial data.

## Domain Knowledge

### Production Metrics
- **CW Volume (m3)**: Clear Water volume produced, measured in cubic metres
- **RW Volume (m3)**: Raw Water volume intake
- **CW Hours Run**: Hours the clear water pumps operated
- **RW Hours Run**: Hours the raw water pumps operated
- **Pump Rate (m3/hr)**: Flow rate = Volume / Hours
- **Efficiency**: How well a station utilizes its available hours (CW Hours / 24h * 100)
- **Target Daily Hours**: Expected operating hours per day for each station

### Station Types
- **Full Treatment**: Draws raw water, treats it, produces clear water. Has both RW and CW metrics.
- **Borehole**: Pumps groundwater directly. Only CW metrics apply. Station losses don't apply.

### Non-Revenue Water (NRW) Losses
- **Station Loss**: RW Volume - CW Volume (treatment process losses). Doesn't apply to boreholes.
- **Distribution Loss**: CW Volume - Sales Volume (pipe leaks, theft, meter errors)
- **Total Loss**: RW - Sales for full treatment; CW - Sales for boreholes
- Loss percentages >= 20% are high (red alert), >= 10% are moderate (amber warning)
- Financial loss is estimated using tariff bands applied to lost volume

### Chemical Stock
- Three chemical types tracked: Aluminium Sulphate (Alum), HTH, Activated Carbon
- **Opening Balance**: Stock at start of month
- **Received**: Deliveries + transfers in - transfers out
- **Used**: Total consumed during production (from daily logs)
- **Current Balance**: Opening + Received - Used
- **Days Remaining**: Current Balance / Average Daily Usage
- **Low Stock**: <= 10 days remaining (urgent action needed)
- **Critical Stock**: <= 5 days remaining (emergency)

### Sales & Revenue
- **CW Sales**: Monthly sales volumes per station, tracked as returns (meter readings) and sage (after billing)
- **Effective Sales Volume**: Uses sage if available, otherwise returns
- **RW Sales**: Monthly raw water sales volumes per dam
- **Sales Targets**: Monthly target volumes set for each station (CW) and dam (RW)
- **Achievement %**: (Actual Sales / Target) * 100 - measures how close to target
- **Variance**: Actual - Target in m3 (positive = exceeded target, negative = below target)
- **Billing Variance**: Difference between returns and sage sales volumes

### Maintenance
- **Non-Functional Station**: Produced < 25% of expected capacity, or has zero production, or has an unresolved breakdown that stopped pumping
- **Downtime Types**: Load shedding (power cuts) and Other downtime (mechanical, electrical, etc.)
- **Breakdowns**: Tracked with impact levels (Stopped pumping, Reduced capacity, No impact)

### Organizational Hierarchy
- **National**: Top level, sees all data
- **Catchment**: Regional grouping of service centres
- **Service Centre (SC)**: Local operational unit managing multiple stations
- **Station**: Individual water production facility

### Key Thresholds
- Non-functional volume: < 25% of expected capacity
- Chemical low stock: <= 10 days remaining
- Chemical critical stock: <= 5 days remaining
- High downtime: > 24 hours/week
- Critical downtime: > 48 hours/week
- NRW high loss: >= 20%
- NRW moderate loss: >= 10%
- Fuel low balance: < 100 litres

## Response Guidelines
1. Be concise and actionable. Water operators need clear, direct answers.
2. When discussing numbers, always include units (m3, hours, kg, %, USD).
3. Highlight concerning metrics prominently (low stock, high losses, non-functional stations).
4. When making recommendations, consider practical constraints (rural settings, power instability, limited budgets).
5. Use simple language - many users are field operators, not data analysts.
6. If data shows anomalies, suggest possible causes and verification steps.
7. Format responses with clear structure - use bullet points and bold for key figures.
8. When you don't have enough data to answer precisely, say so and suggest what data would help.
9. Never fabricate numbers. Only reference data that was provided to you in the context.
10. For trend questions spanning multiple months, note if data is only available for the requested period.`;

async function resolveUserScope(adminClient: any, userId: string) {
  const { data: userRoles, error } = await adminClient
    .from("user_roles")
    .select("scope_type, scope_id, roles!inner(name)")
    .eq("user_id", userId)
    .is("effective_to", null);

  if (error || !userRoles || userRoles.length === 0) return null;

  const opRole =
    userRoles.find(
      (r: any) => r.scope_type && r.scope_type !== "NATIONAL"
    ) || userRoles[0];

  const scopeType = opRole.scope_type || "NATIONAL";
  const scopeId = opRole.scope_id || null;
  let allowedSCIds: string[] = [];

  if (scopeType === "SC" && scopeId) {
    allowedSCIds = [scopeId];
  } else if (scopeType === "CATCHMENT" && scopeId) {
    const { data: scs } = await adminClient
      .from("service_centres")
      .select("id")
      .eq("catchment_id", scopeId)
      .eq("is_active", true);
    allowedSCIds = (scs || []).map((s: any) => s.id);
  } else if (scopeType === "NATIONAL") {
    const { data: scs } = await adminClient
      .from("service_centres")
      .select("id")
      .eq("is_active", true);
    allowedSCIds = (scs || []).map((s: any) => s.id);
  }

  const roleName = opRole.roles?.name || "Unknown";
  return { scopeType, scopeId, allowedSCIds, roleName };
}

async function fetchMetricsContext(
  adminClient: any,
  scope: { scopeType: string; scopeId: string | null; allowedSCIds: string[] },
  year: number,
  month: number
) {
  const sections: string[] = [];

  try {
    const { data: prodData } = await adminClient
      .from("v_sc_monthly_summary")
      .select("*")
      .in("service_centre_id", scope.allowedSCIds)
      .eq("year", year)
      .eq("month", month);

    if (prodData && prodData.length > 0) {
      let cwVol = 0, rwVol = 0, cwHrs = 0, dt = 0, lc = 0;
      for (const r of prodData) {
        cwVol += Number(r.total_cw_volume) || 0;
        rwVol += Number(r.total_rw_volume) || 0;
        cwHrs += Number(r.total_cw_hours) || 0;
        dt += Number(r.total_downtime) || 0;
        lc += Number(r.log_count) || 0;
      }
      const eff = lc > 0 ? Math.round(((cwHrs / (lc * 24)) * 100) * 10) / 10 : 0;
      sections.push(
        `## Production Summary (${year}-${String(month).padStart(2, "0")})\n` +
        `- CW Volume: ${Math.round(cwVol).toLocaleString()} m3\n` +
        `- RW Volume: ${Math.round(rwVol).toLocaleString()} m3\n` +
        `- CW Hours: ${Math.round(cwHrs).toLocaleString()} hrs\n` +
        `- Total Downtime: ${Math.round(dt).toLocaleString()} hrs\n` +
        `- Log Count: ${lc}\n` +
        `- Avg Efficiency: ${eff}%\n` +
        `- Service Centres reporting: ${prodData.length}`
      );
    }
  } catch (_) {}

  try {
    const { data: stationProd } = await adminClient
      .from("v_monthly_production_by_station")
      .select("*")
      .in("service_centre_id", scope.allowedSCIds)
      .eq("year", year)
      .eq("month", month);

    if (stationProd && stationProd.length > 0) {
      const stationLines = stationProd
        .sort((a: any, b: any) => (Number(b.cw_volume) || 0) - (Number(a.cw_volume) || 0))
        .slice(0, 20)
        .map(
          (s: any) =>
            `  - ${s.station_name}: CW=${Math.round(Number(s.cw_volume) || 0)} m3, ` +
            `Hours=${Math.round(Number(s.cw_hours) || 0)}, ` +
            `Downtime=${Math.round(Number(s.total_downtime) || 0)} hrs, ` +
            `Logs=${s.log_count}`
        );
      sections.push(
        `## Station Production (Top ${Math.min(stationProd.length, 20)} of ${stationProd.length})\n` +
        stationLines.join("\n")
      );
    }
  } catch (_) {}

  for (const chemType of ["aluminium_sulphate", "hth", "activated_carbon"]) {
    try {
      const { data: chemData } = await adminClient
        .from("v_chemical_balances_current")
        .select("*")
        .in("service_centre_id", scope.allowedSCIds)
        .eq("chemical_type", chemType)
        .eq("year", year)
        .eq("month", month);

      if (chemData && chemData.length > 0) {
        const label = chemType.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
        const lowStock = chemData.filter(
          (r: any) => r.days_remaining !== null && Number(r.days_remaining) <= 10
        );
        const lines = chemData.map(
          (s: any) =>
            `  - ${s.station_name}: Balance=${Math.round(Number(s.current_balance) || 0)} kg, ` +
            `Used=${Math.round(Number(s.total_used) || 0)} kg, ` +
            `Days Remaining=${s.days_remaining !== null ? Math.round(Number(s.days_remaining)) : "N/A"}`
        );
        sections.push(
          `## Chemical Stock: ${label}\n` +
          `- Stations tracked: ${chemData.length}\n` +
          `- Low stock alerts: ${lowStock.length}\n` +
          lines.join("\n")
        );
      }
    } catch (_) {}
  }

  try {
    const { data: cwSalesData } = await adminClient
      .from("v_cw_sales_vs_target_monthly")
      .select("*")
      .in("service_centre_id", scope.allowedSCIds)
      .eq("year", year)
      .eq("month", month);

    if (cwSalesData && cwSalesData.length > 0) {
      let totalActual = 0, totalTarget = 0;
      const stationLines: string[] = [];
      const underperforming: string[] = [];

      for (const r of cwSalesData) {
        const actual = Number(r.actual_volume_m3) || 0;
        const target = Number(r.target_volume_m3) || 0;
        totalActual += actual;
        totalTarget += target;
        const ach = r.achievement_pct != null ? Number(r.achievement_pct) : null;
        stationLines.push(
          `  - ${r.station_name}: Actual=${Math.round(actual)} m3, Target=${Math.round(target)} m3, ` +
          `Achievement=${ach !== null ? ach + "%" : "N/A"}`
        );
        if (ach !== null && ach < 80) {
          underperforming.push(`${r.station_name} (${ach}%)`);
        }
      }

      const overallAch = totalTarget > 0 ? Math.round(((totalActual / totalTarget) * 100) * 10) / 10 : null;
      sections.push(
        `## CW Sales vs Targets (${year}-${String(month).padStart(2, "0")})\n` +
        `- Total Actual Sales: ${Math.round(totalActual).toLocaleString()} m3\n` +
        `- Total Target: ${Math.round(totalTarget).toLocaleString()} m3\n` +
        `- Variance: ${Math.round(totalActual - totalTarget).toLocaleString()} m3\n` +
        `- Overall Achievement: ${overallAch !== null ? overallAch + "%" : "No targets set"}\n` +
        `- Stations reporting: ${cwSalesData.length}\n` +
        (underperforming.length > 0 ? `- Below 80% target: ${underperforming.join(", ")}\n` : "") +
        stationLines.join("\n")
      );
    }
  } catch (_) {}

  try {
    const { data: rwSalesData } = await adminClient
      .from("v_rw_sales_vs_target_monthly")
      .select("*")
      .in("service_centre_id", scope.allowedSCIds)
      .eq("year", year)
      .eq("month", month);

    if (rwSalesData && rwSalesData.length > 0) {
      let totalActual = 0, totalTarget = 0;
      const damLines: string[] = [];

      for (const r of rwSalesData) {
        const actual = Number(r.actual_volume_m3) || 0;
        const target = Number(r.target_volume_m3) || 0;
        totalActual += actual;
        totalTarget += target;
        const ach = r.achievement_pct != null ? Number(r.achievement_pct) : null;
        damLines.push(
          `  - ${r.dam_name}: Actual=${Math.round(actual)} m3, Target=${Math.round(target)} m3, ` +
          `Achievement=${ach !== null ? ach + "%" : "N/A"}`
        );
      }

      const overallAch = totalTarget > 0 ? Math.round(((totalActual / totalTarget) * 100) * 10) / 10 : null;
      sections.push(
        `## RW Sales vs Targets (${year}-${String(month).padStart(2, "0")})\n` +
        `- Total Actual RW Sales: ${Math.round(totalActual).toLocaleString()} m3\n` +
        `- Total RW Target: ${Math.round(totalTarget).toLocaleString()} m3\n` +
        `- Variance: ${Math.round(totalActual - totalTarget).toLocaleString()} m3\n` +
        `- Overall Achievement: ${overallAch !== null ? overallAch + "%" : "No targets set"}\n` +
        `- Dams reporting: ${rwSalesData.length}\n` +
        damLines.join("\n")
      );
    }
  } catch (_) {}

  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const { data: stationsData } = await adminClient
      .from("stations")
      .select("id, station_name, target_daily_hours, cw_pump_rate_m3_hr")
      .in("service_centre_id", scope.allowedSCIds);

    if (stationsData && stationsData.length > 0) {
      const stIds = stationsData.map((s: any) => s.id);

      const [logsRes, bdRes] = await Promise.all([
        adminClient
          .from("production_logs")
          .select("station_id, cw_volume_m3, cw_hours_run")
          .in("station_id", stIds)
          .eq("date", yesterdayStr),
        adminClient
          .from("station_breakdowns")
          .select("station_id, breakdown_type, breakdown_impact")
          .in("station_id", stIds)
          .eq("breakdown_impact", "Stopped pumping")
          .eq("is_resolved", false)
          .lte("date_reported", yesterdayStr),
      ]);

      const bdSet = new Set((bdRes.data || []).map((b: any) => b.station_id));
      const logMap = new Map(
        (logsRes.data || []).map((l: any) => [l.station_id, l])
      );

      const nonFunc: string[] = [];
      for (const st of stationsData) {
        const log = logMap.get(st.id);
        if (!log) continue;
        const cwVol = Number(log.cw_volume_m3) || 0;
        const cwHrs = Number(log.cw_hours_run) || 0;
        const flow = cwHrs > 0 ? cwVol / cwHrs : Number(st.cw_pump_rate_m3_hr) || 0;
        const expected = Number(st.target_daily_hours || 0) * flow;
        const threshold = expected * 0.25;
        if (cwVol === 0 || (expected > 0 && cwVol < threshold) || bdSet.has(st.id)) {
          nonFunc.push(st.station_name);
        }
      }

      sections.push(
        `## Maintenance Overview (${yesterdayStr})\n` +
        `- Total stations: ${stationsData.length}\n` +
        `- Stations with logs yesterday: ${logMap.size}\n` +
        `- Non-functional stations: ${nonFunc.length}\n` +
        (nonFunc.length > 0 ? `- Non-functional list: ${nonFunc.join(", ")}` : "- All reporting stations are functional")
      );
    }
  } catch (_) {}

  return sections.join("\n\n");
}

function buildGeminiMessages(
  systemPrompt: string,
  contextMessage: string,
  history: { role: string; content: string }[]
) {
  const contents: { role: string; parts: { text: string }[] }[] = [];

  contents.push({
    role: "user",
    parts: [{ text: `[System Instructions]\n${systemPrompt}\n\n[Current Context]\n${contextMessage}` }],
  });
  contents.push({
    role: "model",
    parts: [{ text: "Understood. I have the system instructions and current data context loaded. I'm ready to help with water utility management questions." }],
  });

  for (const msg of history) {
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }

  return contents;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("Missing authorization header", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GOOGLE_API_KEY");

    if (!geminiApiKey) {
      return errorResponse(
        "AI service not configured. Please set the GOOGLE_API_KEY secret.",
        503
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse("Unauthorized", 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const userScope = await resolveUserScope(adminClient, user.id);
    if (!userScope) {
      return errorResponse("No roles assigned", 403);
    }

    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/ai-chat\/?/, "");

    if (req.method === "GET" && (path === "sessions" || path === "")) {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("id, title, page_context, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return jsonResponse({ sessions: data || [] });
    }

    if (req.method === "GET" && path.startsWith("sessions/")) {
      const sessionId = path.replace("sessions/", "").replace("/messages", "");

      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, role, content, metadata, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return jsonResponse({ messages: data || [] });
    }

    if (req.method === "DELETE" && path.startsWith("sessions/")) {
      const sessionId = path.replace("sessions/", "");
      const { error } = await supabase
        .from("chat_sessions")
        .delete()
        .eq("id", sessionId);

      if (error) throw error;
      return jsonResponse({ success: true });
    }

    if (req.method === "POST" && path === "chat") {
      const body = await req.json();
      const {
        message,
        session_id,
        page_context = "",
      } = body as {
        message: string;
        session_id?: string;
        page_context?: string;
      };

      if (!message || message.trim().length === 0) {
        return errorResponse("Message is required");
      }

      let sessionId = session_id;

      if (!sessionId) {
        const { data: newSession, error: sessError } = await supabase
          .from("chat_sessions")
          .insert({
            user_id: user.id,
            title: message.slice(0, 80),
            page_context,
          })
          .select("id")
          .single();

        if (sessError) throw sessError;
        sessionId = newSession.id;
      }

      const { error: userMsgError } = await supabase
        .from("chat_messages")
        .insert({
          session_id: sessionId,
          role: "user",
          content: message,
        });

      if (userMsgError) throw userMsgError;

      const { data: history } = await supabase
        .from("chat_messages")
        .select("role, content")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
        .limit(20);

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      const metricsContext = await fetchMetricsContext(
        adminClient,
        userScope,
        year,
        month
      );

      const scopeLabel =
        userScope.scopeType === "NATIONAL"
          ? "National level"
          : userScope.scopeType === "CATCHMENT"
          ? `Catchment scope (ID: ${userScope.scopeId})`
          : `Service Centre scope (ID: ${userScope.scopeId})`;

      const contextMessage =
        `Current date: ${now.toISOString().split("T")[0]}\n` +
        `User role: ${userScope.roleName}\n` +
        `Scope: ${scopeLabel}\n` +
        `Current page: ${page_context || "Unknown"}\n\n` +
        `--- LIVE SYSTEM DATA ---\n\n${metricsContext || "No data available for current period."}`;

      const geminiContents = buildGeminiMessages(
        SYSTEM_PROMPT,
        contextMessage,
        (history || []).slice(-16).map((m: any) => ({ role: m.role, content: m.content }))
      );

      const GEMINI_MODEL = "gemini-2.0-flash";
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${geminiApiKey}`;
      const geminiPayload = JSON.stringify({
        contents: geminiContents,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
        },
      });

      const MAX_RETRIES = 3;
      let geminiResponse: Response | null = null;
      let lastErrorStatus = 0;
      let lastErrorBody = "";

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
          await new Promise((r) => setTimeout(r, delay));
        }

        const res = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: geminiPayload,
        });

        if (res.ok) {
          geminiResponse = res;
          break;
        }

        lastErrorStatus = res.status;
        lastErrorBody = await res.text();
        console.error(
          `Gemini API attempt ${attempt + 1}/${MAX_RETRIES} failed:`,
          res.status,
          lastErrorBody
        );

        if (res.status !== 429 && res.status !== 503) {
          break;
        }
      }

      if (!geminiResponse) {
        const userMessage =
          lastErrorStatus === 429
            ? "The AI service is temporarily busy due to rate limits. Please wait a moment and try again."
            : lastErrorStatus === 503
            ? "The AI service is temporarily unavailable. Please try again shortly."
            : `AI service error (${lastErrorStatus})`;
        return errorResponse(userMessage, 502);
      }

      const reader = geminiResponse.body!.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "session", session_id: sessionId })}\n\n`
            )
          );

          try {
            let buffer = "";
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();
                if (!data) continue;

                try {
                  const parsed = JSON.parse(data);
                  const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (text) {
                    fullResponse += text;
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ type: "chunk", content: text })}\n\n`
                      )
                    );
                  }
                } catch (_) {}
              }
            }

            if (buffer.startsWith("data: ")) {
              const data = buffer.slice(6).trim();
              if (data) {
                try {
                  const parsed = JSON.parse(data);
                  const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (text) {
                    fullResponse += text;
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ type: "chunk", content: text })}\n\n`
                      )
                    );
                  }
                } catch (_) {}
              }
            }

            await adminClient.from("chat_messages").insert({
              session_id: sessionId,
              role: "assistant",
              content: fullResponse,
              metadata: {
                model: GEMINI_MODEL,
                scope: userScope.scopeType,
                tokens_approx: Math.ceil(fullResponse.length / 4),
              },
            });

            await adminClient
              .from("chat_sessions")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", sessionId);

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "done" })}\n\n`
              )
            );
            controller.close();
          } catch (err: any) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`
              )
            );
            controller.close();
          }
        },
      });

      return new Response(stream, { headers: streamHeaders() });
    }

    return jsonResponse({
      endpoints: [
        "GET  /ai-chat/sessions - List chat sessions",
        "GET  /ai-chat/sessions/:id/messages - Get session messages",
        "POST /ai-chat/chat - Send a message (body: {message, session_id?, page_context?})",
        "DELETE /ai-chat/sessions/:id - Delete a session",
      ],
      user_scope: {
        type: userScope.scopeType,
        role: userScope.roleName,
      },
    });
  } catch (err: any) {
    console.error("ai-chat error:", err);
    return errorResponse(err.message || "Internal server error", 500);
  }
});
