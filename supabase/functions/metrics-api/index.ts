import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const THRESHOLDS = {
  NON_FUNCTIONAL_VOLUME_PCT: 0.25,
  CHEMICAL_LOW_STOCK_DAYS: 10,
  NRW_HIGH_LOSS_PCT: 20,
  NRW_MODERATE_LOSS_PCT: 10,
} as const;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

async function resolveUserScope(supabase: any, userId: string) {
  const { data: userRoles, error } = await supabase
    .from("user_roles")
    .select("scope_type, scope_id, roles!inner(name)")
    .eq("user_id", userId)
    .is("effective_to", null);

  if (error || !userRoles || userRoles.length === 0) {
    return null;
  }

  const opRole = userRoles.find(
    (r: any) => r.scope_type && r.scope_type !== "NATIONAL"
  ) || userRoles[0];

  const scopeType = opRole.scope_type || "NATIONAL";
  const scopeId = opRole.scope_id || null;

  let allowedSCIds: string[] = [];

  if (scopeType === "SC" && scopeId) {
    allowedSCIds = [scopeId];
  } else if (scopeType === "CATCHMENT" && scopeId) {
    const { data: scs } = await supabase
      .from("service_centres")
      .select("id")
      .eq("catchment_id", scopeId)
      .eq("is_active", true);
    allowedSCIds = (scs || []).map((s: any) => s.id);
  } else if (scopeType === "NATIONAL") {
    const { data: scs } = await supabase
      .from("service_centres")
      .select("id")
      .eq("is_active", true);
    allowedSCIds = (scs || []).map((s: any) => s.id);
  }

  return { scopeType, scopeId, allowedSCIds };
}

function filterByScopeIds(scIds: string[], requestedSCId?: string) {
  if (requestedSCId) {
    if (!scIds.includes(requestedSCId)) {
      return null;
    }
    return [requestedSCId];
  }
  return scIds;
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

    const userScope = await resolveUserScope(supabase, user.id);
    if (!userScope) {
      return errorResponse("No roles assigned", 403);
    }

    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/metrics-api\/?/, "");
    const params = url.searchParams;

    const requestedSCId = params.get("service_centre_id") || undefined;
    const effectiveSCIds = filterByScopeIds(
      userScope.allowedSCIds,
      requestedSCId
    );

    if (effectiveSCIds === null) {
      return errorResponse(
        "Access denied: service centre not in your scope",
        403
      );
    }

    const year = parseInt(params.get("year") || "") || new Date().getFullYear();
    const month =
      parseInt(params.get("month") || "") || new Date().getMonth() + 1;

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    switch (path) {
      case "production": {
        const dateFrom =
          params.get("date_from") ||
          `${year}-${String(month).padStart(2, "0")}-01`;
        const dateTo =
          params.get("date_to") ||
          new Date(year, month, 0).toISOString().split("T")[0];

        const { data, error } = await adminClient
          .from("v_monthly_production_by_station")
          .select("*")
          .in("service_centre_id", effectiveSCIds)
          .eq("year", year)
          .eq("month", month);

        if (error) throw error;

        const summary = {
          scope: {
            type: userScope.scopeType,
            id: userScope.scopeId,
            service_centre_ids: effectiveSCIds,
          },
          period: { year, month, date_from: dateFrom, date_to: dateTo },
          totals: {
            cw_volume: 0,
            rw_volume: 0,
            cw_hours: 0,
            rw_hours: 0,
            total_downtime: 0,
            station_count: 0,
            log_count: 0,
            avg_efficiency: 0,
          },
          stations: data || [],
        };

        const stationIds = new Set<string>();
        for (const row of data || []) {
          summary.totals.cw_volume += Number(row.cw_volume) || 0;
          summary.totals.rw_volume += Number(row.rw_volume) || 0;
          summary.totals.cw_hours += Number(row.cw_hours) || 0;
          summary.totals.rw_hours += Number(row.rw_hours) || 0;
          summary.totals.total_downtime += Number(row.total_downtime) || 0;
          summary.totals.log_count += Number(row.log_count) || 0;
          stationIds.add(row.station_id);
        }
        summary.totals.station_count = stationIds.size;
        if (summary.totals.log_count > 0) {
          summary.totals.avg_efficiency = Math.round(
            ((summary.totals.cw_hours / (summary.totals.log_count * 24)) *
              100 *
              10) /
              10
          );
        }

        return jsonResponse(summary);
      }

      case "chemicals": {
        const chemType = params.get("chemical_type") || "aluminium_sulphate";

        const { data, error } = await adminClient
          .from("v_chemical_balances_current")
          .select("*")
          .in("service_centre_id", effectiveSCIds)
          .eq("chemical_type", chemType)
          .eq("year", year)
          .eq("month", month);

        if (error) throw error;

        const lowStock = (data || []).filter(
          (r: any) =>
            r.days_remaining !== null && Number(r.days_remaining) <= THRESHOLDS.CHEMICAL_LOW_STOCK_DAYS
        );

        return jsonResponse({
          scope: {
            type: userScope.scopeType,
            id: userScope.scopeId,
            service_centre_ids: effectiveSCIds,
          },
          period: { year, month },
          chemical_type: chemType,
          stations: data || [],
          alerts: {
            low_stock_count: lowStock.length,
            low_stock_stations: lowStock.map((s: any) => ({
              station_id: s.station_id,
              station_name: s.station_name,
              days_remaining: Number(s.days_remaining),
              current_balance: Number(s.current_balance),
            })),
          },
        });
      }

      case "nrw": {
        const { data: stationsData } = await adminClient
          .from("stations")
          .select(
            "id, station_name, station_type, service_centre_id"
          )
          .in("service_centre_id", effectiveSCIds);

        const stationIds = (stationsData || []).map((s: any) => s.id);

        if (stationIds.length === 0) {
          return jsonResponse({
            scope: {
              type: userScope.scopeType,
              id: userScope.scopeId,
            },
            period: { year, month },
            stations: [],
            totals: {
              station_loss_vol: 0,
              station_loss_pct: 0,
              distribution_loss_vol: 0,
              distribution_loss_pct: 0,
              total_loss_vol: 0,
              total_loss_pct: 0,
            },
          });
        }

        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const prodStart = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
        const prodEnd = new Date(prevYear, prevMonth, 0)
          .toISOString()
          .split("T")[0];

        const [prodRes, salesRes] = await Promise.all([
          adminClient
            .from("production_logs")
            .select("station_id, rw_volume_m3, cw_volume_m3")
            .in("station_id", stationIds)
            .gte("date", prodStart)
            .lte("date", prodEnd),
          adminClient
            .from("sales_records")
            .select("station_id, returns_volume_m3, sage_sales_volume_m3")
            .in("station_id", stationIds)
            .eq("year", year)
            .eq("month", month),
        ]);

        const prodByStation = new Map<
          string,
          { rw: number; cw: number }
        >();
        for (const l of prodRes.data || []) {
          const e = prodByStation.get(l.station_id) || { rw: 0, cw: 0 };
          e.rw += Number(l.rw_volume_m3) || 0;
          e.cw += Number(l.cw_volume_m3) || 0;
          prodByStation.set(l.station_id, e);
        }

        const salesByStation = new Map<string, number>();
        for (const r of salesRes.data || []) {
          const sage = Number(r.sage_sales_volume_m3) || 0;
          const returns = Number(r.returns_volume_m3) || 0;
          const vol = sage > 0 ? sage : returns;
          salesByStation.set(
            r.station_id,
            (salesByStation.get(r.station_id) || 0) + vol
          );
        }

        const nrwStations = (stationsData || []).map((st: any) => {
          const prod = prodByStation.get(st.id) || { rw: 0, cw: 0 };
          const sales = salesByStation.get(st.id) || 0;
          const isBH = st.station_type === "Borehole";

          const stLoss = isBH ? 0 : Math.max(0, prod.rw - prod.cw);
          const stLossPct =
            !isBH && prod.rw > 0 ? (stLoss / prod.rw) * 100 : 0;
          const distLoss = Math.max(0, prod.cw - sales);
          const distLossPct =
            prod.cw > 0 ? (distLoss / prod.cw) * 100 : 0;
          const totLoss = isBH
            ? distLoss
            : Math.max(0, prod.rw - sales);
          const totLossPct = isBH
            ? prod.cw > 0
              ? (totLoss / prod.cw) * 100
              : 0
            : prod.rw > 0
            ? (totLoss / prod.rw) * 100
            : 0;

          return {
            station_id: st.id,
            station_name: st.station_name,
            station_type: st.station_type,
            rw_volume: prod.rw,
            cw_volume: prod.cw,
            sales_volume: sales,
            station_loss_vol: Math.round(stLoss * 10) / 10,
            station_loss_pct: Math.round(stLossPct * 10) / 10,
            distribution_loss_vol: Math.round(distLoss * 10) / 10,
            distribution_loss_pct: Math.round(distLossPct * 10) / 10,
            total_loss_vol: Math.round(totLoss * 10) / 10,
            total_loss_pct: Math.round(totLossPct * 10) / 10,
          };
        });

        const totalRW = nrwStations.reduce(
          (s: number, r: any) => s + r.rw_volume,
          0
        );
        const totalCW = nrwStations.reduce(
          (s: number, r: any) => s + r.cw_volume,
          0
        );
        const totalStLoss = nrwStations.reduce(
          (s: number, r: any) => s + r.station_loss_vol,
          0
        );
        const totalDistLoss = nrwStations.reduce(
          (s: number, r: any) => s + r.distribution_loss_vol,
          0
        );
        const totalTotLoss = nrwStations.reduce(
          (s: number, r: any) => s + r.total_loss_vol,
          0
        );

        return jsonResponse({
          scope: {
            type: userScope.scopeType,
            id: userScope.scopeId,
            service_centre_ids: effectiveSCIds,
          },
          period: { year, month },
          stations: nrwStations,
          totals: {
            station_loss_vol: Math.round(totalStLoss * 10) / 10,
            station_loss_pct:
              totalRW > 0
                ? Math.round(((totalStLoss / totalRW) * 100) * 10) / 10
                : 0,
            distribution_loss_vol: Math.round(totalDistLoss * 10) / 10,
            distribution_loss_pct:
              totalCW > 0
                ? Math.round(((totalDistLoss / totalCW) * 100) * 10) / 10
                : 0,
            total_loss_vol: Math.round(totalTotLoss * 10) / 10,
            total_loss_pct:
              totalRW > 0
                ? Math.round(((totalTotLoss / totalRW) * 100) * 10) / 10
                : 0,
          },
        });
      }

      case "maintenance": {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];
        const dateStr = params.get("date") || yesterdayStr;

        const { data: stationsData } = await adminClient
          .from("stations")
          .select(
            "id, station_name, target_daily_hours, cw_pump_rate_m3_hr, service_centre_id"
          )
          .in("service_centre_id", effectiveSCIds);

        const stIds = (stationsData || []).map((s: any) => s.id);

        if (stIds.length === 0) {
          return jsonResponse({
            scope: { type: userScope.scopeType, id: userScope.scopeId },
            date: dateStr,
            non_functional: {
              count: 0,
              total_stations: 0,
              saved_records: 0,
            },
          });
        }

        const [logsRes, bdRes] = await Promise.all([
          adminClient
            .from("production_logs")
            .select("station_id, cw_volume_m3, cw_hours_run")
            .in("station_id", stIds)
            .eq("date", dateStr),
          adminClient
            .from("station_breakdowns")
            .select("station_id")
            .in("station_id", stIds)
            .eq("breakdown_impact", "Stopped pumping")
            .eq("is_resolved", false)
            .lte("date_reported", dateStr),
        ]);

        const bdSet = new Set(
          (bdRes.data || []).map((b: any) => b.station_id)
        );
        const logMap = new Map(
          (logsRes.data || []).map((l: any) => [l.station_id, l])
        );

        let nonFuncCount = 0;
        for (const st of stationsData || []) {
          const log = logMap.get(st.id);
          if (!log) continue;
          const cwVol = Number(log.cw_volume_m3) || 0;
          const cwHrs = Number(log.cw_hours_run) || 0;
          const flow =
            cwHrs > 0
              ? cwVol / cwHrs
              : Number(st.cw_pump_rate_m3_hr) || 0;
          const expected = Number(st.target_daily_hours || 0) * flow;
          const threshold = expected * THRESHOLDS.NON_FUNCTIONAL_VOLUME_PCT;

          if (
            cwVol === 0 ||
            (expected > 0 && cwVol < threshold) ||
            bdSet.has(st.id)
          ) {
            nonFuncCount++;
          }
        }

        return jsonResponse({
          scope: {
            type: userScope.scopeType,
            id: userScope.scopeId,
            service_centre_ids: effectiveSCIds,
          },
          date: dateStr,
          non_functional: {
            count: nonFuncCount,
            total_stations: stIds.length,
            saved_records: logMap.size,
            saved_pct:
              stIds.length > 0
                ? Math.round((logMap.size / stIds.length) * 100)
                : 0,
            non_functional_pct:
              logMap.size > 0
                ? Math.round((nonFuncCount / logMap.size) * 100)
                : 0,
          },
        });
      }

      case "summary": {
        const dateFrom = `${year}-${String(month).padStart(2, "0")}-01`;
        const dateTo = new Date(year, month, 0)
          .toISOString()
          .split("T")[0];

        const [prodRes, chemAlumRes, chemHthRes, chemACRes] =
          await Promise.all([
            adminClient
              .from("v_sc_monthly_summary")
              .select("*")
              .in("service_centre_id", effectiveSCIds)
              .eq("year", year)
              .eq("month", month),
            adminClient
              .from("v_chemical_balances_current")
              .select("*")
              .in("service_centre_id", effectiveSCIds)
              .eq("chemical_type", "aluminium_sulphate")
              .eq("year", year)
              .eq("month", month),
            adminClient
              .from("v_chemical_balances_current")
              .select("*")
              .in("service_centre_id", effectiveSCIds)
              .eq("chemical_type", "hth")
              .eq("year", year)
              .eq("month", month),
            adminClient
              .from("v_chemical_balances_current")
              .select("*")
              .in("service_centre_id", effectiveSCIds)
              .eq("chemical_type", "activated_carbon")
              .eq("year", year)
              .eq("month", month),
          ]);

        const prodData = prodRes.data || [];
        let cwVol = 0,
          rwVol = 0,
          cwHrs = 0,
          rwHrs = 0,
          dt = 0,
          lc = 0;
        const scSet = new Set<string>();
        const stSet = new Set<string>();
        for (const r of prodData) {
          cwVol += Number(r.total_cw_volume) || 0;
          rwVol += Number(r.total_rw_volume) || 0;
          cwHrs += Number(r.total_cw_hours) || 0;
          rwHrs += Number(r.total_rw_hours) || 0;
          dt += Number(r.total_downtime) || 0;
          lc += Number(r.log_count) || 0;
          scSet.add(r.service_centre_id);
        }
        for (const r of prodData) {
          stSet.add(r.service_centre_id);
        }

        const countLowStock = (data: any[]) =>
          (data || []).filter(
            (r: any) => r.days_remaining !== null && Number(r.days_remaining) <= THRESHOLDS.CHEMICAL_LOW_STOCK_DAYS
          ).length;

        return jsonResponse({
          scope: {
            type: userScope.scopeType,
            id: userScope.scopeId,
            service_centre_ids: effectiveSCIds,
          },
          period: { year, month, date_from: dateFrom, date_to: dateTo },
          production: {
            total_cw_volume: Math.round(cwVol * 100) / 100,
            total_rw_volume: Math.round(rwVol * 100) / 100,
            total_cw_hours: Math.round(cwHrs * 100) / 100,
            total_downtime: Math.round(dt * 100) / 100,
            log_count: lc,
            sc_count: scSet.size,
            avg_efficiency:
              lc > 0 ? Math.round(((cwHrs / (lc * 24)) * 100) * 10) / 10 : 0,
          },
          chemicals: {
            aluminium_sulphate: {
              station_count: (chemAlumRes.data || []).length,
              low_stock_count: countLowStock(chemAlumRes.data || []),
            },
            hth: {
              station_count: (chemHthRes.data || []).length,
              low_stock_count: countLowStock(chemHthRes.data || []),
            },
            activated_carbon: {
              station_count: (chemACRes.data || []).length,
              low_stock_count: countLowStock(chemACRes.data || []),
            },
          },
        });
      }

      case "cw-sales": {
        const granularity = params.get("granularity") || "monthly";
        const quarter = parseInt(params.get("quarter") || "") || undefined;
        const level = params.get("level") || "station";

        if (level === "sc") {
          const viewName = `v_cw_sales_${granularity}_by_sc`;
          let q = adminClient.from(viewName).select("*").eq("year", year);
          q = q.in("service_centre_id", effectiveSCIds);
          if (granularity === "monthly") q = q.eq("month", month);
          if (granularity === "quarterly" && quarter) q = q.eq("quarter", quarter);

          const { data, error } = await q;
          if (error) throw error;

          return jsonResponse({
            scope: { type: userScope.scopeType, id: userScope.scopeId, service_centre_ids: effectiveSCIds },
            period: { year, month, quarter, granularity },
            level: "sc",
            data: data || [],
          });
        }

        const viewName = `v_cw_sales_${granularity}_by_station`;
        let q = adminClient.from(viewName).select("*").eq("year", year);
        q = q.in("service_centre_id", effectiveSCIds);
        if (granularity === "monthly") q = q.eq("month", month);
        if (granularity === "quarterly" && quarter) q = q.eq("quarter", quarter);

        const { data, error } = await q;
        if (error) throw error;

        let totalEffective = 0, totalReturns = 0, totalSage = 0;
        for (const r of data || []) {
          totalEffective += Number(r.effective_sales_volume_m3) || 0;
          totalReturns += Number(r.returns_volume_m3) || 0;
          totalSage += Number(r.sage_sales_volume_m3) || 0;
        }

        return jsonResponse({
          scope: { type: userScope.scopeType, id: userScope.scopeId, service_centre_ids: effectiveSCIds },
          period: { year, month, quarter, granularity },
          level: "station",
          totals: {
            effective_sales_volume: Math.round(totalEffective * 100) / 100,
            returns_volume: Math.round(totalReturns * 100) / 100,
            sage_sales_volume: Math.round(totalSage * 100) / 100,
            station_count: new Set((data || []).map((r: any) => r.station_id)).size,
          },
          stations: data || [],
        });
      }

      case "cw-sales-targets": {
        const granularity = params.get("granularity") || "monthly";
        const quarter = parseInt(params.get("quarter") || "") || undefined;
        const level = params.get("level") || "station";

        const suffix = level === "sc" ? "by_sc" : "by_station";
        const viewName = `v_cw_sales_targets_${granularity}_${suffix}`;
        let q = adminClient.from(viewName).select("*").eq("year", year);
        q = q.in("service_centre_id", effectiveSCIds);
        if (granularity === "monthly") q = q.eq("month", month);
        if (granularity === "quarterly" && quarter) q = q.eq("quarter", quarter);

        const { data, error } = await q;
        if (error) throw error;

        return jsonResponse({
          scope: { type: userScope.scopeType, id: userScope.scopeId, service_centre_ids: effectiveSCIds },
          period: { year, month, quarter, granularity },
          level,
          data: data || [],
        });
      }

      case "cw-sales-vs-target": {
        const { data, error } = await adminClient
          .from("v_cw_sales_vs_target_monthly")
          .select("*")
          .eq("year", year)
          .eq("month", month)
          .in("service_centre_id", effectiveSCIds);

        if (error) throw error;

        let totalActual = 0, totalTarget = 0;
        for (const r of data || []) {
          totalActual += Number(r.actual_volume_m3) || 0;
          totalTarget += Number(r.target_volume_m3) || 0;
        }

        return jsonResponse({
          scope: { type: userScope.scopeType, id: userScope.scopeId, service_centre_ids: effectiveSCIds },
          period: { year, month },
          totals: {
            actual_volume: Math.round(totalActual * 100) / 100,
            target_volume: Math.round(totalTarget * 100) / 100,
            variance: Math.round((totalActual - totalTarget) * 100) / 100,
            achievement_pct: totalTarget > 0 ? Math.round(((totalActual / totalTarget) * 100) * 10) / 10 : null,
          },
          stations: data || [],
        });
      }

      case "rw-sales": {
        const granularity = params.get("granularity") || "monthly";
        const quarter = parseInt(params.get("quarter") || "") || undefined;
        const level = params.get("level") || "dam";

        const suffix = level === "sc" ? "by_sc" : "by_dam";
        const viewName = `v_rw_sales_${granularity}_${suffix}`;
        let q = adminClient.from(viewName).select("*").eq("year", year);
        q = q.in("service_centre_id", effectiveSCIds);
        if (granularity === "monthly") q = q.eq("month", month);
        if (granularity === "quarterly" && quarter) q = q.eq("quarter", quarter);

        const { data, error } = await q;
        if (error) throw error;

        let totalSales = 0;
        for (const r of data || []) {
          totalSales += Number(r.sales_volume_m3 || r.total_sales_volume_m3) || 0;
        }

        return jsonResponse({
          scope: { type: userScope.scopeType, id: userScope.scopeId, service_centre_ids: effectiveSCIds },
          period: { year, month, quarter, granularity },
          level,
          totals: { total_sales_volume: Math.round(totalSales * 100) / 100 },
          data: data || [],
        });
      }

      case "rw-sales-targets": {
        const granularity = params.get("granularity") || "monthly";
        const quarter = parseInt(params.get("quarter") || "") || undefined;
        const level = params.get("level") || "dam";

        const suffix = level === "sc" ? "by_sc" : "by_dam";
        const viewName = `v_rw_sales_targets_${granularity}_${suffix}`;
        let q = adminClient.from(viewName).select("*").eq("year", year);
        q = q.in("service_centre_id", effectiveSCIds);
        if (granularity === "monthly") q = q.eq("month", month);
        if (granularity === "quarterly" && quarter) q = q.eq("quarter", quarter);

        const { data, error } = await q;
        if (error) throw error;

        return jsonResponse({
          scope: { type: userScope.scopeType, id: userScope.scopeId, service_centre_ids: effectiveSCIds },
          period: { year, month, quarter, granularity },
          level,
          data: data || [],
        });
      }

      case "rw-sales-vs-target": {
        const { data, error } = await adminClient
          .from("v_rw_sales_vs_target_monthly")
          .select("*")
          .eq("year", year)
          .eq("month", month)
          .in("service_centre_id", effectiveSCIds);

        if (error) throw error;

        let totalActual = 0, totalTarget = 0;
        for (const r of data || []) {
          totalActual += Number(r.actual_volume_m3) || 0;
          totalTarget += Number(r.target_volume_m3) || 0;
        }

        return jsonResponse({
          scope: { type: userScope.scopeType, id: userScope.scopeId, service_centre_ids: effectiveSCIds },
          period: { year, month },
          totals: {
            actual_volume: Math.round(totalActual * 100) / 100,
            target_volume: Math.round(totalTarget * 100) / 100,
            variance: Math.round((totalActual - totalTarget) * 100) / 100,
            achievement_pct: totalTarget > 0 ? Math.round(((totalActual / totalTarget) * 100) * 10) / 10 : null,
          },
          dams: data || [],
        });
      }

      default:
        return jsonResponse(
          {
            endpoints: [
              "GET /metrics-api/production?year=&month=&service_centre_id=",
              "GET /metrics-api/chemicals?year=&month=&chemical_type=&service_centre_id=",
              "GET /metrics-api/nrw?year=&month=&service_centre_id=",
              "GET /metrics-api/maintenance?date=&service_centre_id=",
              "GET /metrics-api/summary?year=&month=&service_centre_id=",
              "GET /metrics-api/cw-sales?year=&month=&granularity=monthly|quarterly|yearly&level=station|sc&quarter=",
              "GET /metrics-api/cw-sales-targets?year=&month=&granularity=monthly|quarterly|yearly&level=station|sc&quarter=",
              "GET /metrics-api/cw-sales-vs-target?year=&month=",
              "GET /metrics-api/rw-sales?year=&month=&granularity=monthly|quarterly|yearly&level=dam|sc&quarter=",
              "GET /metrics-api/rw-sales-targets?year=&month=&granularity=monthly|quarterly|yearly&level=dam|sc&quarter=",
              "GET /metrics-api/rw-sales-vs-target?year=&month=",
            ],
            scope: {
              type: userScope.scopeType,
              id: userScope.scopeId,
              allowed_sc_count: userScope.allowedSCIds.length,
            },
          },
          200
        );
    }
  } catch (err: any) {
    return errorResponse(err.message || "Internal server error", 500);
  }
});
