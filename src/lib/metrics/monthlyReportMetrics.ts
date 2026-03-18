import { supabase } from '../supabase';
import type { ScopeFilter } from '../metricsConfig';
import { roundTo, CHEMICAL_PROD_FIELDS, CHEMICAL_TYPES, buildMonthDateRange, getPreviousMonthPeriod } from '../metricsConfig';
import { applyScopeToQuery } from './scopeFilter';
import {
  computeDowntime,
  computeProductionEfficiency,
  computePumpRate,
  computeChemicalBalance,
  computeReceiptTotal,
  computeAvgUsagePerDay,
  computeDaysRemaining,
  isChemicalLowStock,
  computeNRWLosses,
  computeBreakdownHoursLostForPeriod,
} from './coreCalculations';
import { fetchMonthlyEnergySummary, type MonthlyEnergySummary } from './energyMetrics';
import { fetchRWMonthlyDamReport, fetchRWAgreementStats } from './rwAllocationMetrics';
import type { RWMonthlyDamReport, RWAgreementStats } from './rwAllocationMetrics';
import { fetchYTDProduction } from './productionMetrics';

export interface MonthlyStationProduction {
  stationId: string;
  stationName: string;
  stationType: string;
  logCount: number;
  cwVolume: number;
  rwVolume: number;
  cwHours: number;
  rwHours: number;
  loadSheddingHours: number;
  otherDowntimeHours: number;
  totalDowntime: number;
  efficiency: number;
  cwPumpRate: number | null;
  rwPumpRate: number | null;
  newConnections: number;
  newConnectionsYTD?: number;
}

export interface MonthlyProductionSummary {
  totalCWVolume: number;
  totalRWVolume: number;
  totalCWHours: number;
  totalRWHours: number;
  totalLoadShedding: number;
  totalOtherDowntime: number;
  totalDowntime: number;
  stationCount: number;
  logCount: number;
  avgEfficiency: number;
  avgCWPumpRate: number | null;
  totalNewConnections: number;
  totalNewConnectionsYTD: number;
  totalBreakdownHoursLost: number;
  stations: MonthlyStationProduction[];
}

export interface MonthlySalesStation {
  stationId: string;
  stationName: string;
  stationType: string;
  returnsVolume: number;
  sageSalesVolume: number;
  effectiveSalesVolume: number;
  targetVolume: number;
  varianceM3: number;
  achievementPct: number | null;
  usingSageData: boolean;
}

export interface MonthlySalesSummary {
  totalEffectiveSalesVolume: number;
  totalTargetVolume: number;
  overallVarianceM3: number;
  overallAchievementPct: number | null;
  stationsWithSage: number;
  stationsWithReturnsOnly: number;
  stations: MonthlySalesStation[];
}

export interface MonthlyNRWSummary {
  totalRWVolume: number;
  totalCWVolume: number;
  totalSalesVolume: number;
  stationLossVol: number;
  stationLossPct: number;
  distributionLossVol: number;
  distributionLossPct: number;
  totalLossVol: number;
  totalLossPct: number;
}

export interface MonthlyChemicalSummary {
  chemicalType: string;
  label: string;
  totalOpening: number;
  totalReceived: number;
  totalUsed: number;
  totalClosingBalance: number;
  usedPerM3: number | null;
  lowStockCount: number;
  lowStockStations: Array<{ stationName: string; daysRemaining: number }>;
  stations: Array<{
    stationName: string;
    opening: number;
    received: number;
    used: number;
    closing: number;
    daysRemaining: number | null;
    usedPerM3: number | null;
    cwVolume: number;
  }>;
}

export interface MonthlyBreakdown {
  stationName: string;
  component: string;
  description: string;
  dateReported: string;
  isResolved: boolean;
  dateResolved: string | null;
  impact: string;
  hoursLost: number;
}

export interface KPIWorstStation {
  stationName: string;
  value: number;
  unit: string;
  context?: string;
}

export interface KPISummaryAnalysis {
  worstNRW: KPIWorstStation | null;
  worstSalesAchievement: KPIWorstStation | null;
  worstEfficiency: KPIWorstStation | null;
  worstDowntime: KPIWorstStation | null;
  worstFinancialLoss: KPIWorstStation | null;
  mostBreakdowns: KPIWorstStation | null;
}

export interface YTDProductionVsTargetStation {
  stationId: string;
  stationName: string;
  ytdProduction: number;
  ytdTarget: number;
  variance: number;
  achievementPct: number | null;
}

export interface YTDProductionVsTarget {
  stations: YTDProductionVsTargetStation[];
  totalYTDProduction: number;
  totalYTDTarget: number;
  totalVariance: number;
  totalAchievementPct: number | null;
}

export interface MonthlyReportData {
  serviceCentreName: string;
  serviceCentreId: string;
  month: number;
  year: number;
  monthName: string;
  generatedAt: string;
  production: MonthlyProductionSummary;
  sales: MonthlySalesSummary;
  nrw: MonthlyNRWSummary;
  chemicals: MonthlyChemicalSummary[];
  breakdowns: MonthlyBreakdown[];
  ytdProductionVsTarget: YTDProductionVsTarget;
  energy: MonthlyEnergySummary;
  rwDamReport: RWMonthlyDamReport[];
  rwAgreementStats: RWAgreementStats;
  totalExpectedLogs: number;
  totalActualLogs: number;
  completionPct: number;
  kpiAnalysis: KPISummaryAnalysis;
}

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CHEM_LABELS: Record<string, string> = {
  aluminium_sulphate: 'Aluminium Sulphate',
  hth: 'HTH (Calcium Hypochlorite)',
  activated_carbon: 'Activated Carbon',
};

export async function fetchMonthlyReportData(
  scope: ScopeFilter,
  year: number,
  month: number,
  serviceCentreName: string
): Promise<MonthlyReportData> {
  const dateRange = buildMonthDateRange(year, month);

  let stationsQuery = supabase
    .from('stations')
    .select('id, station_name, station_type, service_centre_id, target_daily_hours, clients_domestic, clients_school, clients_business, clients_industry, clients_church, clients_parastatal, clients_government, clients_other');
  stationsQuery = applyScopeToQuery(stationsQuery, scope);

  const { data: stationsData, error: stErr } = await stationsQuery;
  if (stErr) throw stErr;

  const allStations = stationsData || [];
  const stationIds = allStations.map(s => s.id);

  if (stationIds.length === 0) {
    return buildEmptyMonthlyReport(scope.scopeId || '', serviceCentreName, year, month);
  }

  const ytdStartDate = `${year}-01-01`;
  const ytdEndDate = dateRange.end;

  const prevPeriod = getPreviousMonthPeriod(year, month);
  const prevDateRange = buildMonthDateRange(prevPeriod.year, prevPeriod.month);

  const [logsRes, ytdLogsRes, breakdownsRes, salesRes, targetsRes, balancesRes, receiptsRes, prevProdRes] = await Promise.all([
    supabase
      .from('production_logs')
      .select('station_id, date, cw_volume_m3, rw_volume_m3, cw_hours_run, rw_hours_run, load_shedding_hours, other_downtime_hours, alum_kg, hth_kg, activated_carbon_kg, new_connections')
      .in('station_id', stationIds)
      .gte('date', dateRange.start)
      .lt('date', dateRange.end),
    supabase
      .from('production_logs')
      .select('station_id, new_connections')
      .in('station_id', stationIds)
      .gte('date', ytdStartDate)
      .lt('date', ytdEndDate),
    supabase
      .from('station_breakdowns')
      .select('station_id, nature_of_breakdown, description, date_reported, is_resolved, date_resolved, breakdown_impact, hours_lost')
      .in('station_id', stationIds)
      .lte('date_reported', dateRange.end)
      .or(`is_resolved.eq.false,date_resolved.gte.${dateRange.start}`),
    supabase
      .from('sales_records')
      .select('station_id, returns_volume_m3, sage_sales_volume_m3')
      .in('station_id', stationIds)
      .eq('year', year)
      .eq('month', month),
    supabase
      .from('cw_sales_targets')
      .select('station_id, target_volume_m3')
      .in('station_id', stationIds)
      .eq('year', year)
      .eq('month', month),
    supabase
      .from('chemical_stock_balances')
      .select('station_id, chemical_type, opening_balance')
      .in('station_id', stationIds)
      .in('chemical_type', ['aluminium_sulphate', 'hth', 'activated_carbon'])
      .eq('year', year)
      .eq('month', month),
    supabase
      .from('chemical_stock_receipts')
      .select('station_id, chemical_type, quantity, receipt_type')
      .in('station_id', stationIds)
      .in('chemical_type', ['aluminium_sulphate', 'hth', 'activated_carbon'])
      .eq('year', year)
      .eq('month', month),
    supabase
      .from('production_logs')
      .select('station_id, cw_volume_m3, rw_volume_m3')
      .in('station_id', stationIds)
      .gte('date', prevDateRange.start)
      .lt('date', prevDateRange.end),
  ]);

  const logs = logsRes.data || [];
  const ytdLogs = ytdLogsRes.data || [];
  const prevProdLogs = prevProdRes.data || [];

  const stationAgg = new Map<string, {
    cwVol: number; rwVol: number; cwHrs: number; rwHrs: number;
    ls: number; other: number; count: number; connections: number;
    alumUsed: number; hthUsed: number; acUsed: number;
  }>();

  for (const log of logs) {
    const sid = log.station_id;
    const ex = stationAgg.get(sid) || {
      cwVol: 0, rwVol: 0, cwHrs: 0, rwHrs: 0,
      ls: 0, other: 0, count: 0, connections: 0,
      alumUsed: 0, hthUsed: 0, acUsed: 0,
    };
    ex.cwVol += Number(log.cw_volume_m3) || 0;
    ex.rwVol += Number(log.rw_volume_m3) || 0;
    ex.cwHrs += Number(log.cw_hours_run) || 0;
    ex.rwHrs += Number(log.rw_hours_run) || 0;
    ex.ls += Number(log.load_shedding_hours) || 0;
    ex.other += Number(log.other_downtime_hours) || 0;
    ex.count++;
    ex.connections += Number(log.new_connections) || 0;
    ex.alumUsed += Number(log.alum_kg) || 0;
    ex.hthUsed += Number(log.hth_kg) || 0;
    ex.acUsed += Number(log.activated_carbon_kg) || 0;
    stationAgg.set(sid, ex);
  }

  const ytdConnectionsMap = new Map<string, number>();
  for (const log of ytdLogs) {
    ytdConnectionsMap.set(
      log.station_id,
      (ytdConnectionsMap.get(log.station_id) || 0) + (Number(log.new_connections) || 0)
    );
  }

  const stationList: MonthlyStationProduction[] = [];
  let totCWVol = 0, totRWVol = 0, totCWHrs = 0, totRWHrs = 0;
  let totLS = 0, totOther = 0, totLogCount = 0, totConn = 0, totConnYTD = 0;

  for (const station of allStations) {
    const agg = stationAgg.get(station.id);
    if (!agg) continue;
    const downtime = agg.ls + agg.other;
    const ytdConn = ytdConnectionsMap.get(station.id) || 0;

    stationList.push({
      stationId: station.id,
      stationName: station.station_name,
      stationType: station.station_type,
      logCount: agg.count,
      cwVolume: roundTo(agg.cwVol, 0),
      rwVolume: roundTo(agg.rwVol, 0),
      cwHours: roundTo(agg.cwHrs, 1),
      rwHours: roundTo(agg.rwHrs, 1),
      loadSheddingHours: roundTo(agg.ls, 1),
      otherDowntimeHours: roundTo(agg.other, 1),
      totalDowntime: roundTo(downtime, 1),
      efficiency: computeProductionEfficiency(agg.cwHrs, agg.count),
      cwPumpRate: computePumpRate(agg.cwVol, agg.cwHrs),
      rwPumpRate: computePumpRate(agg.rwVol, agg.rwHrs),
      newConnections: agg.connections,
      newConnectionsYTD: ytdConn,
    });

    totCWVol += agg.cwVol;
    totRWVol += agg.rwVol;
    totCWHrs += agg.cwHrs;
    totRWHrs += agg.rwHrs;
    totLS += agg.ls;
    totOther += agg.other;
    totLogCount += agg.count;
    totConn += agg.connections;
    totConnYTD += ytdConn;
  }

  stationList.sort((a, b) => b.cwVolume - a.cwVolume);

  const daysInMonth = new Date(year, month, 0).getDate();
  const totalExpectedLogs = allStations.length * daysInMonth;

  const production: MonthlyProductionSummary = {
    totalCWVolume: roundTo(totCWVol, 0),
    totalRWVolume: roundTo(totRWVol, 0),
    totalCWHours: roundTo(totCWHrs, 1),
    totalRWHours: roundTo(totRWHrs, 1),
    totalLoadShedding: roundTo(totLS, 1),
    totalOtherDowntime: roundTo(totOther, 1),
    totalDowntime: roundTo(totLS + totOther, 1),
    stationCount: stationList.length,
    logCount: totLogCount,
    avgEfficiency: computeProductionEfficiency(totCWHrs, totLogCount),
    avgCWPumpRate: computePumpRate(totCWVol, totCWHrs),
    totalNewConnections: totConn,
    totalNewConnectionsYTD: totConnYTD,
    totalBreakdownHoursLost: 0,
    stations: stationList,
  };

  const salesMap = new Map<string, { returns: number; sage: number }>();
  for (const r of (salesRes.data || [])) {
    salesMap.set(r.station_id, {
      returns: Number(r.returns_volume_m3) || 0,
      sage: Number(r.sage_sales_volume_m3) || 0,
    });
  }

  const targetsMap = new Map<string, number>();
  for (const r of (targetsRes.data || [])) {
    targetsMap.set(r.station_id, Number(r.target_volume_m3) || 0);
  }

  const salesStations: MonthlySalesStation[] = [];
  let totEffective = 0, totTarget = 0, withSage = 0, withReturnsOnly = 0;

  for (const station of allStations) {
    const sale = salesMap.get(station.id);
    if (!sale) continue;
    const usingSage = sale.sage > 0;
    const effective = usingSage ? sale.sage : sale.returns;
    const target = targetsMap.get(station.id) || 0;
    const variance = roundTo(effective - target, 0);
    const achievement = target > 0 ? roundTo((effective / target) * 100, 1) : null;

    salesStations.push({
      stationId: station.id,
      stationName: station.station_name,
      stationType: station.station_type,
      returnsVolume: roundTo(sale.returns, 0),
      sageSalesVolume: roundTo(sale.sage, 0),
      effectiveSalesVolume: roundTo(effective, 0),
      targetVolume: roundTo(target, 0),
      varianceM3: variance,
      achievementPct: achievement,
      usingSageData: usingSage,
    });

    totEffective += effective;
    totTarget += target;
    if (usingSage) withSage++; else withReturnsOnly++;
  }

  salesStations.sort((a, b) => b.effectiveSalesVolume - a.effectiveSalesVolume);

  const salesVariance = roundTo(totEffective - totTarget, 0);
  const salesAchievement = totTarget > 0 ? roundTo((totEffective / totTarget) * 100, 1) : null;

  const sales: MonthlySalesSummary = {
    totalEffectiveSalesVolume: roundTo(totEffective, 0),
    totalTargetVolume: roundTo(totTarget, 0),
    overallVarianceM3: salesVariance,
    overallAchievementPct: salesAchievement,
    stationsWithSage: withSage,
    stationsWithReturnsOnly: withReturnsOnly,
    stations: salesStations,
  };

  const prevProdAgg = new Map<string, { rwVol: number; cwVol: number }>();
  for (const log of prevProdLogs) {
    const sid = log.station_id;
    const ex = prevProdAgg.get(sid) || { rwVol: 0, cwVol: 0 };
    ex.rwVol += Number(log.rw_volume_m3) || 0;
    ex.cwVol += Number(log.cw_volume_m3) || 0;
    prevProdAgg.set(sid, ex);
  }

  const stationAggForNRW = new Map<string, { rw: number; cw: number; sales: number }>();
  for (const station of allStations) {
    const prevProd = prevProdAgg.get(station.id);
    const sale = salesMap.get(station.id);
    const usingSage = sale && sale.sage > 0;
    const salesVol = sale ? (usingSage ? sale.sage : sale.returns) : 0;
    stationAggForNRW.set(station.id, {
      rw: prevProd?.rwVol || 0,
      cw: prevProd?.cwVol || 0,
      sales: salesVol,
    });
  }

  let nrwRWTot = 0, nrwCWTot = 0, nrwSalesTot = 0;
  let nrwStLoss = 0, nrwDistLoss = 0, nrwTotLoss = 0;
  let nrwSurfaceRW = 0, nrwBoreholeCW = 0;

  for (const station of allStations) {
    const vol = stationAggForNRW.get(station.id) || { rw: 0, cw: 0, sales: 0 };
    const isBorehole = station.station_type === 'Borehole';
    const losses = computeNRWLosses(vol.rw, vol.cw, vol.sales, isBorehole);
    nrwRWTot += vol.rw;
    nrwCWTot += vol.cw;
    nrwSalesTot += vol.sales;
    nrwStLoss += losses.stationLossVol;
    nrwDistLoss += losses.distributionLossVol;
    nrwTotLoss += losses.totalLossVol;
    if (isBorehole) {
      nrwBoreholeCW += vol.cw;
    } else {
      nrwSurfaceRW += vol.rw;
    }
  }

  const nrwTotalDenominator = nrwSurfaceRW + nrwBoreholeCW;

  const nrwStationBreakdown: Array<{ stationName: string; totalLossPct: number; totalLossVol: number }> = [];
  for (const station of allStations) {
    const vol = stationAggForNRW.get(station.id) || { rw: 0, cw: 0, sales: 0 };
    const isBorehole = station.station_type === 'Borehole';
    const losses = computeNRWLosses(vol.rw, vol.cw, vol.sales, isBorehole);
    const denominator = isBorehole ? vol.cw : vol.rw;
    const pct = denominator > 0 ? roundTo((losses.totalLossVol / denominator) * 100, 1) : 0;
    if (denominator > 0) {
      nrwStationBreakdown.push({
        stationName: station.station_name,
        totalLossPct: pct,
        totalLossVol: losses.totalLossVol,
      });
    }
  }

  const nrw: MonthlyNRWSummary = {
    totalRWVolume: roundTo(nrwRWTot, 0),
    totalCWVolume: roundTo(nrwCWTot, 0),
    totalSalesVolume: roundTo(nrwSalesTot, 0),
    stationLossVol: roundTo(nrwStLoss, 0),
    stationLossPct: nrwRWTot > 0 ? roundTo((nrwStLoss / nrwRWTot) * 100, 1) : 0,
    distributionLossVol: roundTo(nrwDistLoss, 0),
    distributionLossPct: nrwCWTot > 0 ? roundTo((nrwDistLoss / nrwCWTot) * 100, 1) : 0,
    totalLossVol: roundTo(nrwTotLoss, 0),
    totalLossPct: nrwTotalDenominator > 0 ? roundTo((nrwTotLoss / nrwTotalDenominator) * 100, 1) : 0,
  };

  const chemicals: MonthlyChemicalSummary[] = [];

  for (const chemType of CHEMICAL_TYPES) {
    const prodField = CHEMICAL_PROD_FIELDS[chemType];
    let totOpening = 0, totReceived = 0, totUsed = 0, totBalance = 0;
    const lowStockStations: Array<{ stationName: string; daysRemaining: number }> = [];
    const stationRows: MonthlyChemicalSummary['stations'] = [];

    for (const station of allStations) {
      if (station.station_type !== 'Full Treatment') continue;
      const sid = station.id;

      const balRow = (balancesRes.data || []).find(
        (r: any) => r.station_id === sid && r.chemical_type === chemType
      );
      const opening = balRow ? Number(balRow.opening_balance) : 0;

      const stRcpts = (receiptsRes.data || []).filter(
        (r: any) => r.station_id === sid && r.chemical_type === chemType
      );
      const received = computeReceiptTotal(stRcpts);

      let used = 0, prodDays = 0;
      for (const log of logs) {
        if (log.station_id !== sid) continue;
        const val = Number((log as any)[prodField]) || 0;
        used += val;
        if (val > 0) prodDays++;
      }

      const closing = computeChemicalBalance(opening, received, used);
      const avgUsage = computeAvgUsagePerDay(used, prodDays);
      const daysRemaining = computeDaysRemaining(closing, avgUsage);

      const stCWVol = stationAgg.get(sid)?.cwVol || 0;
      const stUsedPerM3 = used > 0 && stCWVol > 0 ? roundTo((used * 1000) / stCWVol, 2) : null;

      totOpening += opening;
      totReceived += received;
      totUsed += used;
      totBalance += closing > 0 ? closing : 0;

      stationRows.push({
        stationName: station.station_name,
        opening: roundTo(opening, 1),
        received: roundTo(received, 1),
        used: roundTo(used, 1),
        closing: roundTo(closing, 1),
        daysRemaining,
        usedPerM3: stUsedPerM3,
        cwVolume: roundTo(stCWVol, 0),
      });

      if (daysRemaining !== null && isChemicalLowStock(daysRemaining)) {
        lowStockStations.push({
          stationName: station.station_name,
          daysRemaining: Math.round(daysRemaining),
        });
      }
    }

    lowStockStations.sort((a, b) => a.daysRemaining - b.daysRemaining);

    const totalCWVolForChem = stationRows.reduce((s, r) => s + r.cwVolume, 0);
    const totalUsedPerM3 = totUsed > 0 && totalCWVolForChem > 0
      ? roundTo((totUsed * 1000) / totalCWVolForChem, 2)
      : null;

    chemicals.push({
      chemicalType: chemType,
      label: CHEM_LABELS[chemType] || chemType,
      totalOpening: roundTo(totOpening, 1),
      totalReceived: roundTo(totReceived, 1),
      totalUsed: roundTo(totUsed, 1),
      totalClosingBalance: roundTo(totBalance, 1),
      usedPerM3: totalUsedPerM3,
      lowStockCount: lowStockStations.length,
      lowStockStations,
      stations: stationRows,
    });
  }

  const stationMap = new Map(allStations.map(s => [s.id, s]));

  const breakdownHoursLostByStation = computeBreakdownHoursLostForPeriod(
    (breakdownsRes.data || []).map((b: any) => ({
      station_id: b.station_id,
      date_reported: b.date_reported,
      date_resolved: b.date_resolved || null,
      is_resolved: !!b.is_resolved,
      breakdown_impact: b.breakdown_impact || '',
    })),
    logs.map((l: any) => ({ station_id: l.station_id, date: l.date, cw_hours_run: Number(l.cw_hours_run) || 0 })),
    allStations.map(s => ({ id: s.id, target_daily_hours: Number(s.target_daily_hours) || 0 })),
    dateRange.start,
    dateRange.end
  );

  const breakdowns: MonthlyBreakdown[] = (breakdownsRes.data || []).map((b: any) => {
    let hoursLost = Number(b.hours_lost) || 0;
    if (b.breakdown_impact === 'Stopped pumping') {
      const stationTarget = Number(stationMap.get(b.station_id)?.target_daily_hours) || 0;
      if (stationTarget > 0) {
        const bdStart = b.date_reported;
        const bdEnd = b.is_resolved && b.date_resolved ? b.date_resolved : dateRange.end;
        const effStart = bdStart > dateRange.start ? bdStart : dateRange.start;
        const effEnd = bdEnd < dateRange.end ? bdEnd : dateRange.end;
        if (effStart <= effEnd) {
          let computed = 0;
          const cursor = new Date(effStart + 'T12:00:00');
          const endD = new Date(effEnd + 'T12:00:00');
          while (cursor <= endD) {
            const ds = cursor.toISOString().split('T')[0];
            const logMatch = logs.find((l: any) => l.station_id === b.station_id && l.date === ds);
            const hrsRun = logMatch ? Number(logMatch.cw_hours_run) || 0 : 0;
            computed += Math.max(0, stationTarget - hrsRun);
            cursor.setDate(cursor.getDate() + 1);
          }
          hoursLost = computed;
        }
      }
    }
    return {
      stationName: stationMap.get(b.station_id)?.station_name || 'Unknown',
      component: b.nature_of_breakdown || '',
      description: b.description || '',
      dateReported: b.date_reported,
      isResolved: !!b.is_resolved,
      dateResolved: b.date_resolved || null,
      impact: b.breakdown_impact || '',
      hoursLost: roundTo(hoursLost, 1),
    };
  });

  let totalBreakdownHoursLost = 0;
  for (const [, hrs] of breakdownHoursLostByStation) {
    totalBreakdownHoursLost += hrs;
  }
  production.totalBreakdownHoursLost = roundTo(totalBreakdownHoursLost, 1);

  const ytdResult = await fetchYTDProduction(scope, year, month - 1);
  const ytdProductionVsTarget: YTDProductionVsTarget = {
    stations: ytdResult.stations.map(s => ({
      stationId: s.stationId,
      stationName: s.stationName,
      ytdProduction: s.ytdProduction,
      ytdTarget: s.ytdTarget,
      variance: s.variance,
      achievementPct: s.achievementPct,
    })),
    totalYTDProduction: ytdResult.totalYTDProduction,
    totalYTDTarget: ytdResult.totalYTDTarget,
    totalVariance: ytdResult.totalVariance,
    totalAchievementPct: ytdResult.totalAchievementPct,
  };

  const kpiAnalysis = computeKPISummaryAnalysis(
    production.stations,
    sales.stations,
    nrwStationBreakdown,
    breakdowns
  );

  const energy = await fetchMonthlyEnergySummary(scope, year, month);

  const [rwDamReport, rwAgreementStats] = await Promise.all([
    fetchRWMonthlyDamReport(scope, year, month),
    fetchRWAgreementStats(scope, year, month),
  ]);

  return {
    serviceCentreName,
    serviceCentreId: scope.scopeId || '',
    month,
    year,
    monthName: MONTH_NAMES[month],
    generatedAt: new Date().toISOString(),
    production,
    sales,
    nrw,
    chemicals,
    breakdowns,
    ytdProductionVsTarget,
    energy,
    rwDamReport,
    rwAgreementStats,
    totalExpectedLogs,
    totalActualLogs: totLogCount,
    completionPct: totalExpectedLogs > 0 ? roundTo((totLogCount / totalExpectedLogs) * 100, 1) : 0,
    kpiAnalysis,
  };
}

function computeKPISummaryAnalysis(
  productionStations: MonthlyStationProduction[],
  salesStations: MonthlySalesStation[],
  nrwStations: Array<{ stationName: string; totalLossPct: number; totalLossVol: number }>,
  breakdowns: MonthlyBreakdown[]
): KPISummaryAnalysis {
  let worstNRW: KPIWorstStation | null = null;
  if (nrwStations.length > 0) {
    const worst = nrwStations.reduce((a, b) => b.totalLossPct > a.totalLossPct ? b : a);
    if (worst.totalLossPct > 0) {
      worstNRW = {
        stationName: worst.stationName,
        value: worst.totalLossPct,
        unit: '%',
        context: `${worst.totalLossVol.toLocaleString(undefined, { maximumFractionDigits: 0 })} m\u00b3 lost`,
      };
    }
  }

  let worstSalesAchievement: KPIWorstStation | null = null;
  const eligibleSales = salesStations.filter(s => s.targetVolume > 0 && s.achievementPct !== null);
  if (eligibleSales.length > 0) {
    const worst = eligibleSales.reduce((a, b) => (b.achievementPct! < a.achievementPct! ? b : a));
    worstSalesAchievement = {
      stationName: worst.stationName,
      value: worst.achievementPct!,
      unit: '%',
      context: `${worst.varianceM3 < 0 ? '' : '+'}${worst.varianceM3.toLocaleString(undefined, { maximumFractionDigits: 0 })} m\u00b3 vs target`,
    };
  }

  let worstEfficiency: KPIWorstStation | null = null;
  const eligibleEff = productionStations.filter(s => s.cwHours > 0);
  if (eligibleEff.length > 0) {
    const worst = eligibleEff.reduce((a, b) => b.efficiency < a.efficiency ? b : a);
    worstEfficiency = {
      stationName: worst.stationName,
      value: roundTo(worst.efficiency, 1),
      unit: '%',
      context: `${worst.cwVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })} m\u00b3 produced`,
    };
  }

  let worstDowntime: KPIWorstStation | null = null;
  const eligibleDt = productionStations.filter(s => s.totalDowntime > 0);
  if (eligibleDt.length > 0) {
    const worst = eligibleDt.reduce((a, b) => b.totalDowntime > a.totalDowntime ? b : a);
    worstDowntime = {
      stationName: worst.stationName,
      value: roundTo(worst.totalDowntime, 1),
      unit: 'hrs',
      context: `${roundTo(worst.loadSheddingHours, 1)} hrs load shedding, ${roundTo(worst.otherDowntimeHours, 1)} hrs other`,
    };
  }

  let worstFinancialLoss: KPIWorstStation | null = null;
  if (nrwStations.length > 0) {
    const worst = nrwStations.reduce((a, b) => b.totalLossVol > a.totalLossVol ? b : a);
    if (worst.totalLossVol > 0) {
      worstFinancialLoss = {
        stationName: worst.stationName,
        value: worst.totalLossVol,
        unit: 'm\u00b3',
        context: `Highest unaccounted water volume`,
      };
    }
  }

  let mostBreakdowns: KPIWorstStation | null = null;
  if (breakdowns.length > 0) {
    const countByStation = new Map<string, number>();
    for (const b of breakdowns) {
      countByStation.set(b.stationName, (countByStation.get(b.stationName) || 0) + 1);
    }
    let topStation = '';
    let topCount = 0;
    for (const [name, count] of countByStation) {
      if (count > topCount) { topStation = name; topCount = count; }
    }
    const openCount = breakdowns.filter(b => b.stationName === topStation && !b.isResolved).length;
    mostBreakdowns = {
      stationName: topStation,
      value: topCount,
      unit: 'breakdown(s)',
      context: `${openCount} unresolved`,
    };
  }

  return { worstNRW, worstSalesAchievement, worstEfficiency, worstDowntime, worstFinancialLoss, mostBreakdowns };
}

function buildEmptyMonthlyReport(
  serviceCentreId: string,
  serviceCentreName: string,
  year: number,
  month: number
): MonthlyReportData {
  return {
    serviceCentreName,
    serviceCentreId,
    month,
    year,
    monthName: MONTH_NAMES[month],
    generatedAt: new Date().toISOString(),
    production: {
      totalCWVolume: 0, totalRWVolume: 0, totalCWHours: 0, totalRWHours: 0,
      totalLoadShedding: 0, totalOtherDowntime: 0, totalDowntime: 0,
      stationCount: 0, logCount: 0, avgEfficiency: 0, avgCWPumpRate: null,
      totalNewConnections: 0, totalNewConnectionsYTD: 0, totalBreakdownHoursLost: 0, stations: [],
    },
    sales: {
      totalEffectiveSalesVolume: 0, totalTargetVolume: 0, overallVarianceM3: 0,
      overallAchievementPct: null, stationsWithSage: 0, stationsWithReturnsOnly: 0, stations: [],
    },
    nrw: {
      totalRWVolume: 0, totalCWVolume: 0, totalSalesVolume: 0,
      stationLossVol: 0, stationLossPct: 0, distributionLossVol: 0, distributionLossPct: 0,
      totalLossVol: 0, totalLossPct: 0,
    },
    chemicals: [],
    breakdowns: [],
    ytdProductionVsTarget: {
      stations: [], totalYTDProduction: 0, totalYTDTarget: 0, totalVariance: 0, totalAchievementPct: null,
    },
    energy: {
      totalEstimatedKWh: 0, totalEstimatedCost: 0, totalActualBill: 0, totalActualKWh: 0,
      overallVariancePct: null, stations: [],
    },
    rwDamReport: [],
    rwAgreementStats: { totalActiveInYear: 0, expiredInMonth: 0, expiringNextMonth: 0, currentlyActive: 0 },
    totalExpectedLogs: 0,
    totalActualLogs: 0,
    completionPct: 0,
    kpiAnalysis: {
      worstNRW: null,
      worstSalesAchievement: null,
      worstEfficiency: null,
      worstDowntime: null,
      worstFinancialLoss: null,
      mostBreakdowns: null,
    },
  };
}
