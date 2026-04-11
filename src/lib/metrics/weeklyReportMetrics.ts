import { supabase } from '../supabase';
import type { ScopeFilter, DateRange } from '../metricsConfig';
import { roundTo, CHEMICAL_PROD_FIELDS, CHEMICAL_TYPES } from '../metricsConfig';
import { applyScopeToQuery, fetchAllRows } from './scopeFilter';
import {
  computeProductionEfficiency,
  computePumpRate,
  computeChemicalBalance,
  computeReceiptTotal,
  computeAvgUsagePerDay,
  computeDaysRemaining,
  isChemicalLowStock,
  computeBreakdownHoursLostForPeriod,
} from './coreCalculations';
import type { WeekOnWeekChemicalUsage } from './chemicalMetrics';
import { fetchWeekOnWeekChemicalUsage } from './chemicalMetrics';
import { fetchRWDamYTDAllocations } from './rwAllocationMetrics';
import type { RWDamYTDAllocation } from './rwAllocationMetrics';

const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export interface WeeklyStationProduction {
  stationId: string;
  stationName: string;
  stationType: string;
  logCount: number;
  cwVolume: number;
  cwVolumeYTD: number;
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
  breakdownHoursLost: number;
}

export interface WeeklyProductionSummary {
  totalCWVolume: number;
  totalCWVolumeYTD: number;
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
  avgRWPumpRate: number | null;
  totalNewConnections: number;
  cwWeeklyTarget: number;
  cwPerformancePct: number | null;
  totalBreakdownHoursLost: number;
  stations: WeeklyStationProduction[];
}

export interface WeeklyBreakdown {
  stationName: string;
  component: string;
  description: string;
  dateReported: string;
  isResolved: boolean;
  dateResolved: string | null;
  impact: string;
  hoursLost: number;
}

export interface WeeklyChemicalSummary {
  chemicalType: string;
  label: string;
  totalUsed: number;
  totalBalance: number;
  usedPerM3: number | null;
  lowStockCount: number;
  lowStockStations: Array<{ stationName: string; daysRemaining: number }>;
}

export interface WeeklyNonFunctionalDay {
  date: string;
  nonFunctionalCount: number;
  totalLogged: number;
}

export interface CapacityUtilizationStation {
  stationId: string;
  stationName: string;
  stationType: string;
  installedCapacity: number;
  weeklyRWCapacity: number | null;
  weeklyCWCapacity: number | null;
  ytdRWCapacity: number | null;
  ytdCWCapacity: number | null;
  rwUtilizationPct: number | null;
  cwUtilizationPct: number | null;
}

export interface CapacityUtilizationSummary {
  rwInstalledTotal: number;
  rwWeeklyActualTotal: number | null;
  rwYtdAvgTotal: number | null;
  cwInstalledTotal: number;
  cwWeeklyActualTotal: number | null;
  cwYtdAvgTotal: number | null;
  rwUtilizationPct: number | null;
  cwUtilizationPct: number | null;
  stations: CapacityUtilizationStation[];
}

export interface PowerSupplyStation {
  stationId: string;
  stationName: string;
  requiredHours: number;
  actualHoursRun: number;
  loadSheddingHours: number;
  powerAvailableHours: number;
  powerAvailabilityPct: number;
  gridUtilizationPct: number;
}

export interface PowerSupplySummary {
  totalRequiredHours: number;
  totalActualHours: number;
  totalLoadSheddingHours: number;
  totalPowerAvailableHours: number;
  overallAvailabilityPct: number;
  overallGridUtilizationPct: number;
  stations: PowerSupplyStation[];
}

export interface ConnectionStation {
  stationId: string;
  stationName: string;
  currentConnections: number;
  newConnectionsThisWeek: number;
  newTotal: number;
  ytdNewConnections: number;
}

export interface ConnectionsSummary {
  totalCurrentConnections: number;
  totalNewThisWeek: number;
  totalNewTotal: number;
  totalYTDNew: number;
  stations: ConnectionStation[];
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

export interface WeeklyReportData {
  serviceCentreName: string;
  serviceCentreId: string;
  weekNumber: number;
  year: number;
  reportType: 'friday' | 'tuesday';
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  production: WeeklyProductionSummary;
  breakdowns: WeeklyBreakdown[];
  chemicals: WeeklyChemicalSummary[];
  weekOnWeekChemicals: WeekOnWeekChemicalUsage;
  nonFunctionalByDay: WeeklyNonFunctionalDay[];
  capacityUtilization: CapacityUtilizationSummary;
  powerSupply: PowerSupplySummary;
  connections: ConnectionsSummary;
  ytdProductionVsTarget: YTDProductionVsTarget;
  rwYTDAllocations: RWDamYTDAllocation[];
  totalExpectedLogs: number;
  totalActualLogs: number;
  completionPct: number;
}

export async function fetchWeeklyReportData(
  scope: ScopeFilter,
  dateRange: DateRange,
  weekNumber: number,
  year: number,
  reportType: 'friday' | 'tuesday',
  serviceCentreName: string
): Promise<WeeklyReportData> {
  let stationsQuery = supabase
    .from('stations')
    .select('id, station_name, station_type, service_centre_id, design_capacity_m3_hr, target_daily_hours, clients_domestic, clients_school, clients_business, clients_industry, clients_church, clients_parastatal, clients_government, clients_other');
  stationsQuery = applyScopeToQuery(stationsQuery, scope);

  const { data: stations, error: stErr } = await stationsQuery;
  if (stErr) throw stErr;

  const allStations = stations || [];
  const stationIds = allStations.map(s => s.id);
  const stationMap = new Map(allStations.map(s => [s.id, s]));

  if (stationIds.length === 0) {
    return buildEmptyReport(scope.scopeId || '', serviceCentreName, weekNumber, year, reportType, dateRange);
  }

  const ytdStart = `${year}-01-01`;

  const [logs, breakdownsRes, balancesRes, receiptsRes, targetsRes, ytdPriorLogs] = await Promise.all([
    fetchAllRows(
      supabase
        .from('production_logs')
        .select('station_id, date, cw_volume_m3, rw_volume_m3, cw_hours_run, rw_hours_run, load_shedding_hours, other_downtime_hours, alum_kg, hth_kg, activated_carbon_kg, new_connections')
        .in('station_id', stationIds)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)
        .order('date', { ascending: true })
    ),
    supabase
      .from('station_breakdowns')
      .select('station_id, nature_of_breakdown, description, date_reported, is_resolved, date_resolved, breakdown_impact, hours_lost')
      .in('station_id', stationIds)
      .lte('date_reported', dateRange.end)
      .or(`is_resolved.eq.false,date_resolved.gte.${dateRange.start}`),
    supabase
      .from('chemical_stock_balances')
      .select('station_id, chemical_type, opening_balance, year, month')
      .in('station_id', stationIds)
      .in('chemical_type', ['aluminium_sulphate', 'hth', 'activated_carbon']),
    supabase
      .from('chemical_stock_receipts')
      .select('station_id, chemical_type, quantity, receipt_type, year, month')
      .in('station_id', stationIds)
      .in('chemical_type', ['aluminium_sulphate', 'hth', 'activated_carbon']),
    supabase
      .from('cw_production_targets')
      .select('station_id, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec')
      .in('station_id', stationIds)
      .eq('year', year),
    fetchAllRows(
      supabase
        .from('production_logs')
        .select('station_id, cw_volume_m3, rw_volume_m3, cw_hours_run, rw_hours_run, new_connections')
        .in('station_id', stationIds)
        .gte('date', ytdStart)
        .lte('date', dateRange.end)
    ),
  ]);

  const stationAgg = new Map<string, {
    cwVol: number; rwVol: number; cwHrs: number; rwHrs: number;
    ls: number; other: number; count: number; connections: number;
    alumUsed: number; hthUsed: number; acUsed: number;
  }>();

  for (const log of logs) {
    const sid = log.station_id;
    const existing = stationAgg.get(sid) || {
      cwVol: 0, rwVol: 0, cwHrs: 0, rwHrs: 0,
      ls: 0, other: 0, count: 0, connections: 0,
      alumUsed: 0, hthUsed: 0, acUsed: 0,
    };
    existing.cwVol += Number(log.cw_volume_m3) || 0;
    existing.rwVol += Number(log.rw_volume_m3) || 0;
    existing.cwHrs += Number(log.cw_hours_run) || 0;
    existing.rwHrs += Number(log.rw_hours_run) || 0;
    existing.ls += Number(log.load_shedding_hours) || 0;
    existing.other += Number(log.other_downtime_hours) || 0;
    existing.count++;
    existing.connections += Number(log.new_connections) || 0;
    existing.alumUsed += Number(log.alum_kg) || 0;
    existing.hthUsed += Number(log.hth_kg) || 0;
    existing.acUsed += Number(log.activated_carbon_kg) || 0;
    stationAgg.set(sid, existing);
  }

  const ytdFullAgg = new Map<string, { cwVol: number; rwVol: number; cwHrs: number; rwHrs: number; connections: number }>();
  for (const log of ytdPriorLogs) {
    const sid = log.station_id;
    const existing = ytdFullAgg.get(sid) || { cwVol: 0, rwVol: 0, cwHrs: 0, rwHrs: 0, connections: 0 };
    existing.cwVol += Number(log.cw_volume_m3) || 0;
    existing.rwVol += Number(log.rw_volume_m3) || 0;
    existing.cwHrs += Number(log.cw_hours_run) || 0;
    existing.rwHrs += Number(log.rw_hours_run) || 0;
    existing.connections += Number(log.new_connections) || 0;
    ytdFullAgg.set(sid, existing);
  }

  const breakdownHoursLostByStation = computeBreakdownHoursLostForPeriod(
    (breakdownsRes.data || []).map((b: any) => ({
      station_id: b.station_id,
      date_reported: b.date_reported,
      date_resolved: b.date_resolved || null,
      is_resolved: !!b.is_resolved,
      breakdown_impact: b.breakdown_impact || '',
    })),
    logs.map(l => ({ station_id: l.station_id, date: l.date, cw_hours_run: Number(l.cw_hours_run) || 0 })),
    allStations.map(s => ({ id: s.id, target_daily_hours: Number(s.target_daily_hours) || 0 })),
    dateRange.start,
    dateRange.end
  );

  const stationMetrics: WeeklyStationProduction[] = [];
  let totalCWVol = 0, totalRWVol = 0, totalCWHrs = 0, totalRWHrs = 0;
  let totalLS = 0, totalOther = 0, totalLogCount = 0, totalConnections = 0;
  let totalBreakdownHoursLost = 0;

  for (const station of allStations) {
    const agg = stationAgg.get(station.id);
    if (!agg) continue;
    const downtime = agg.ls + agg.other;
    const ytdFull = ytdFullAgg.get(station.id);
    const cwVolumeYTD = roundTo(ytdFull?.cwVol || 0, 0);
    const stBreakdownHrs = roundTo(breakdownHoursLostByStation.get(station.id) || 0, 1);
    stationMetrics.push({
      stationId: station.id,
      stationName: station.station_name,
      stationType: station.station_type,
      logCount: agg.count,
      cwVolume: roundTo(agg.cwVol, 0),
      cwVolumeYTD,
      rwVolume: roundTo(agg.rwVol, 0),
      cwHours: roundTo(agg.cwHrs, 2),
      rwHours: roundTo(agg.rwHrs, 2),
      loadSheddingHours: roundTo(agg.ls, 1),
      otherDowntimeHours: roundTo(agg.other, 1),
      totalDowntime: roundTo(downtime, 1),
      efficiency: computeProductionEfficiency(agg.cwHrs, agg.count),
      cwPumpRate: computePumpRate(agg.cwVol, agg.cwHrs),
      rwPumpRate: computePumpRate(agg.rwVol, agg.rwHrs),
      newConnections: agg.connections,
      breakdownHoursLost: stBreakdownHrs,
    });
    totalCWVol += agg.cwVol;
    totalRWVol += agg.rwVol;
    totalCWHrs += agg.cwHrs;
    totalRWHrs += agg.rwHrs;
    totalLS += agg.ls;
    totalOther += agg.other;
    totalLogCount += agg.count;
    totalConnections += agg.connections;
    totalBreakdownHoursLost += stBreakdownHrs;
  }

  stationMetrics.sort((a, b) => b.cwVolume - a.cwVolume);

  const periodDays = Math.round(
    (new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / 86400000
  ) + 1;

  const cwWeeklyTarget = computeCWWeeklyTarget(targetsRes.data || [], dateRange, periodDays);
  const cwPerformancePct = cwWeeklyTarget > 0 ? roundTo((totalCWVol / cwWeeklyTarget) * 100, 1) : null;

  let totalCWVolYTD = 0;
  for (const [, ytdEntry] of ytdFullAgg) {
    totalCWVolYTD += ytdEntry.cwVol;
  }

  const production: WeeklyProductionSummary = {
    totalCWVolume: roundTo(totalCWVol, 2),
    totalCWVolumeYTD: roundTo(totalCWVolYTD, 0),
    totalRWVolume: roundTo(totalRWVol, 2),
    totalCWHours: roundTo(totalCWHrs, 2),
    totalRWHours: roundTo(totalRWHrs, 2),
    totalLoadShedding: roundTo(totalLS, 2),
    totalOtherDowntime: roundTo(totalOther, 2),
    totalDowntime: roundTo(totalLS + totalOther, 2),
    stationCount: stationMetrics.length,
    logCount: totalLogCount,
    avgEfficiency: computeProductionEfficiency(totalCWHrs, totalLogCount),
    avgCWPumpRate: computePumpRate(totalCWVol, totalCWHrs),
    avgRWPumpRate: computePumpRate(totalRWVol, totalRWHrs),
    totalNewConnections: totalConnections,
    cwWeeklyTarget: roundTo(cwWeeklyTarget, 0),
    cwPerformancePct,
    totalBreakdownHoursLost: roundTo(totalBreakdownHoursLost, 1),
    stations: stationMetrics,
  };

  const breakdowns: WeeklyBreakdown[] = (breakdownsRes.data || []).map((b: any) => {
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
            const logMatch = logs.find(l => l.station_id === b.station_id && l.date === ds);
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

  const reportStartDate = new Date(dateRange.start + 'T12:00:00');
  const reportMonth = reportStartDate.getMonth();
  const currentYear = reportStartDate.getFullYear();
  const currentMonth = reportMonth;

  const weekOnWeekChemicals = await fetchWeekOnWeekChemicalUsage(scope, year, weekNumber);

  const chemicals: WeeklyChemicalSummary[] = [];
  const chemLabels: Record<string, string> = {
    aluminium_sulphate: 'Aluminium Sulphate',
    hth: 'HTH (Calcium Hypochlorite)',
    activated_carbon: 'Activated Carbon',
  };

  for (const chemType of CHEMICAL_TYPES) {
    const prodField = CHEMICAL_PROD_FIELDS[chemType];
    let totalUsed = 0;
    let totalBalance = 0;
    const lowStockStations: Array<{ stationName: string; daysRemaining: number }> = [];

    for (const station of allStations) {
      if (station.station_type !== 'Full Treatment') continue;
      const sid = station.id;

      const balRow = (balancesRes.data || []).find(
        (r: any) => r.station_id === sid && r.chemical_type === chemType &&
          r.year === currentYear && r.month === (currentMonth + 1)
      );
      const opening = balRow ? Number(balRow.opening_balance) : 0;

      const stationReceipts = (receiptsRes.data || []).filter(
        (r: any) => r.station_id === sid && r.chemical_type === chemType &&
          r.year === currentYear && r.month === (currentMonth + 1)
      );
      const received = computeReceiptTotal(stationReceipts);

      let used = 0;
      let prodDays = 0;
      for (const log of logs) {
        if (log.station_id !== sid) continue;
        const val = Number((log as any)[prodField]) || 0;
        used += val;
        if (val > 0) prodDays++;
      }

      const balance = computeChemicalBalance(opening, received, used);
      const avgUsage = computeAvgUsagePerDay(used, prodDays);
      const daysRemaining = computeDaysRemaining(balance, avgUsage);

      totalUsed += used;
      totalBalance += balance > 0 ? balance : 0;

      if (daysRemaining !== null && isChemicalLowStock(daysRemaining)) {
        lowStockStations.push({
          stationName: station.station_name,
          daysRemaining: Math.round(daysRemaining),
        });
      }
    }

    lowStockStations.sort((a, b) => a.daysRemaining - b.daysRemaining);

    const usedPerM3 = totalUsed > 0 && totalCWVol > 0
      ? roundTo((totalUsed * 1000) / totalCWVol, 2)
      : null;

    chemicals.push({
      chemicalType: chemType,
      label: chemLabels[chemType] || chemType,
      totalUsed: roundTo(totalUsed, 1),
      totalBalance: roundTo(totalBalance, 1),
      usedPerM3,
      lowStockCount: lowStockStations.length,
      lowStockStations,
    });
  }

  const datesByDay = new Map<string, string[]>();
  for (const log of logs) {
    const existing = datesByDay.get(log.date) || [];
    existing.push(log.station_id);
    datesByDay.set(log.date, existing);
  }

  const nonFunctionalByDay: WeeklyNonFunctionalDay[] = Array.from(datesByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, sIds]) => ({
      date,
      nonFunctionalCount: 0,
      totalLogged: sIds.length,
    }));

  const capacityUtilization = buildCapacityUtilization(allStations, stationAgg, ytdFullAgg);
  const powerSupply = buildPowerSupply(allStations, stationAgg, periodDays);
  const connections = buildConnections(allStations, stationAgg, ytdFullAgg);
  const ytdProductionVsTarget = buildYTDProductionVsTarget(allStations, ytdFullAgg, targetsRes.data || [], dateRange.end);

  const totalExpectedLogs = allStations.length * periodDays;
  const completionPct = totalExpectedLogs > 0
    ? roundTo((totalLogCount / totalExpectedLogs) * 100, 1)
    : 0;

  const endMonth = new Date(dateRange.end + 'T00:00:00').getMonth() + 1;
  const rwYTDAllocations = await fetchRWDamYTDAllocations(scope, year, endMonth);

  return {
    serviceCentreName,
    serviceCentreId: scope.scopeId || '',
    weekNumber,
    year,
    reportType,
    periodStart: dateRange.start,
    periodEnd: dateRange.end,
    generatedAt: new Date().toISOString(),
    production,
    breakdowns,
    chemicals,
    weekOnWeekChemicals,
    nonFunctionalByDay,
    capacityUtilization,
    powerSupply,
    connections,
    ytdProductionVsTarget,
    rwYTDAllocations,
    totalExpectedLogs,
    totalActualLogs: totalLogCount,
    completionPct,
  };
}

function computeCWWeeklyTarget(
  targetsData: any[],
  dateRange: DateRange,
  periodDays: number
): number {
  if (targetsData.length === 0) return 0;

  const startDate = new Date(dateRange.start + 'T12:00:00');
  const endDate = new Date(dateRange.end + 'T12:00:00');

  const daysByMonth = new Map<number, number>();
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const mIdx = d.getMonth();
    daysByMonth.set(mIdx, (daysByMonth.get(mIdx) || 0) + 1);
  }

  let weeklyTarget = 0;
  for (const [mIdx, daysInWeek] of daysByMonth.entries()) {
    const monthKey = MONTH_KEYS[mIdx];
    const daysInMonth = new Date(startDate.getFullYear(), mIdx + 1, 0).getDate();
    let monthTarget = 0;
    for (const t of targetsData) {
      monthTarget += Number(t[monthKey]) || 0;
    }
    weeklyTarget += (monthTarget / daysInMonth) * daysInWeek;
  }

  return weeklyTarget;
}

type StationRow = any;
type AggMap = Map<string, { cwVol: number; rwVol: number; cwHrs: number; rwHrs: number; [k: string]: any }>;

function buildCapacityUtilization(
  allStations: StationRow[],
  weekAgg: AggMap,
  ytdFullAgg: Map<string, { cwVol: number; rwVol: number; cwHrs: number; rwHrs: number; connections: number }>
): CapacityUtilizationSummary {
  const stationsResult: CapacityUtilizationStation[] = [];
  let rwInstalledTotal = 0, cwInstalledTotal = 0;
  let rwWeeklySum = 0, cwWeeklySum = 0;
  let rwYtdSum = 0, cwYtdSum = 0;
  let rwWeeklyCount = 0, cwWeeklyCount = 0;
  let rwYtdCount = 0, cwYtdCount = 0;

  for (const station of allStations) {
    const installed = Number(station.design_capacity_m3_hr) || 0;
    const agg = weekAgg.get(station.id);
    const ytd = ytdFullAgg.get(station.id);

    const weekCW = agg && agg.cwHrs > 0 ? roundTo(agg.cwVol / agg.cwHrs, 2) : null;
    const weekRW = (station.station_type === 'Full Treatment' && agg && agg.rwHrs > 0)
      ? roundTo(agg.rwVol / agg.rwHrs, 2) : null;

    const ytdCWVol = ytd?.cwVol || 0;
    const ytdCWHrs = ytd?.cwHrs || 0;
    const ytdRWVol = ytd?.rwVol || 0;
    const ytdRWHrs = ytd?.rwHrs || 0;

    const ytdCW = ytdCWHrs > 0 ? roundTo(ytdCWVol / ytdCWHrs, 2) : null;
    const ytdRW = (station.station_type === 'Full Treatment' && ytdRWHrs > 0)
      ? roundTo(ytdRWVol / ytdRWHrs, 2) : null;

    const rwUtilPct = (station.station_type === 'Full Treatment' && installed > 0 && weekRW != null)
      ? roundTo((weekRW / installed) * 100, 1) : null;
    const cwUtilPct = (installed > 0 && weekCW != null)
      ? roundTo((weekCW / installed) * 100, 1) : null;

    if (station.station_type === 'Full Treatment') {
      rwInstalledTotal += installed;
      if (weekRW != null) { rwWeeklySum += weekRW; rwWeeklyCount++; }
      if (ytdRW != null) { rwYtdSum += ytdRW; rwYtdCount++; }
    }
    cwInstalledTotal += installed;
    if (weekCW != null) { cwWeeklySum += weekCW; cwWeeklyCount++; }
    if (ytdCW != null) { cwYtdSum += ytdCW; cwYtdCount++; }

    stationsResult.push({
      stationId: station.id,
      stationName: station.station_name,
      stationType: station.station_type,
      installedCapacity: installed,
      weeklyRWCapacity: weekRW,
      weeklyCWCapacity: weekCW,
      ytdRWCapacity: ytdRW,
      ytdCWCapacity: ytdCW,
      rwUtilizationPct: rwUtilPct,
      cwUtilizationPct: cwUtilPct,
    });
  }

  stationsResult.sort((a, b) => b.installedCapacity - a.installedCapacity);

  const rwWeeklyTotal = rwWeeklyCount > 0 ? roundTo(rwWeeklySum, 1) : null;
  const cwWeeklyTotal = cwWeeklyCount > 0 ? roundTo(cwWeeklySum, 1) : null;
  const rwYtdTotal = rwYtdCount > 0 ? roundTo(rwYtdSum, 1) : null;
  const cwYtdTotal = cwYtdCount > 0 ? roundTo(cwYtdSum, 1) : null;

  const rwUtilPct = (rwInstalledTotal > 0 && rwWeeklyTotal != null)
    ? roundTo((rwWeeklyTotal / rwInstalledTotal) * 100, 1) : null;
  const cwUtilPct = (cwInstalledTotal > 0 && cwWeeklyTotal != null)
    ? roundTo((cwWeeklyTotal / cwInstalledTotal) * 100, 1) : null;

  return {
    rwInstalledTotal: roundTo(rwInstalledTotal, 1),
    rwWeeklyActualTotal: rwWeeklyTotal,
    rwYtdAvgTotal: rwYtdTotal,
    cwInstalledTotal: roundTo(cwInstalledTotal, 1),
    cwWeeklyActualTotal: cwWeeklyTotal,
    cwYtdAvgTotal: cwYtdTotal,
    rwUtilizationPct: rwUtilPct,
    cwUtilizationPct: cwUtilPct,
    stations: stationsResult,
  };
}

function buildPowerSupply(
  allStations: StationRow[],
  weekAgg: AggMap,
  periodDays: number
): PowerSupplySummary {
  const stationsResult: PowerSupplyStation[] = [];
  let totalRequired = 0, totalActual = 0, totalLS = 0;

  for (const station of allStations) {
    const targetDaily = Number(station.target_daily_hours) || 0;
    const required = targetDaily * periodDays;
    const agg = weekAgg.get(station.id);
    const actual = agg ? agg.cwHrs : 0;
    const ls = agg ? agg.ls : 0;
    const powerAvailable = Math.max(0, required - ls);
    const powerAvailabilityPct = required > 0 ? roundTo((powerAvailable / required) * 100, 1) : 0;
    const gridUtilizationPct = powerAvailable > 0 ? roundTo((actual / powerAvailable) * 100, 1) : 0;

    totalRequired += required;
    totalActual += actual;
    totalLS += ls;

    stationsResult.push({
      stationId: station.id,
      stationName: station.station_name,
      requiredHours: roundTo(required, 1),
      actualHoursRun: roundTo(actual, 1),
      loadSheddingHours: roundTo(ls, 1),
      powerAvailableHours: roundTo(powerAvailable, 1),
      powerAvailabilityPct,
      gridUtilizationPct,
    });
  }

  stationsResult.sort((a, b) => a.gridUtilizationPct - b.gridUtilizationPct);

  const totalPowerAvailable = Math.max(0, totalRequired - totalLS);

  return {
    totalRequiredHours: roundTo(totalRequired, 1),
    totalActualHours: roundTo(totalActual, 1),
    totalLoadSheddingHours: roundTo(totalLS, 1),
    totalPowerAvailableHours: roundTo(totalPowerAvailable, 1),
    overallAvailabilityPct: totalRequired > 0 ? roundTo((totalPowerAvailable / totalRequired) * 100, 1) : 0,
    overallGridUtilizationPct: totalPowerAvailable > 0 ? roundTo((totalActual / totalPowerAvailable) * 100, 1) : 0,
    stations: stationsResult,
  };
}

function buildConnections(
  allStations: StationRow[],
  weekAgg: AggMap,
  ytdFullAgg: Map<string, { cwVol: number; rwVol: number; cwHrs: number; rwHrs: number; connections: number }>
): ConnectionsSummary {
  const stationsResult: ConnectionStation[] = [];
  let totalCurrent = 0, totalNewWeek = 0, totalYTD = 0;

  for (const station of allStations) {
    const currentConns =
      (Number(station.clients_domestic) || 0) +
      (Number(station.clients_school) || 0) +
      (Number(station.clients_business) || 0) +
      (Number(station.clients_industry) || 0) +
      (Number(station.clients_church) || 0) +
      (Number(station.clients_parastatal) || 0) +
      (Number(station.clients_government) || 0) +
      (Number(station.clients_other) || 0);

    const agg = weekAgg.get(station.id);
    const newWeek = agg?.connections || 0;
    const ytdEntry = ytdFullAgg.get(station.id);
    const ytdNew = ytdEntry?.connections || 0;

    totalCurrent += currentConns;
    totalNewWeek += newWeek;
    totalYTD += ytdNew;

    stationsResult.push({
      stationId: station.id,
      stationName: station.station_name,
      currentConnections: currentConns,
      newConnectionsThisWeek: newWeek,
      newTotal: currentConns + newWeek,
      ytdNewConnections: ytdNew,
    });
  }

  stationsResult.sort((a, b) => b.newConnectionsThisWeek - a.newConnectionsThisWeek);

  return {
    totalCurrentConnections: totalCurrent,
    totalNewThisWeek: totalNewWeek,
    totalNewTotal: totalCurrent + totalNewWeek,
    totalYTDNew: totalYTD,
    stations: stationsResult,
  };
}

function buildYTDProductionVsTarget(
  allStations: StationRow[],
  ytdFullAgg: Map<string, { cwVol: number; rwVol: number; cwHrs: number; rwHrs: number; connections: number }>,
  targetsData: any[],
  periodEnd: string
): YTDProductionVsTarget {
  const endDate = new Date(periodEnd + 'T12:00:00');
  const endMonthIdx = endDate.getMonth();

  const targetsByStation = new Map<string, number>();
  for (const t of targetsData) {
    const sid = t.station_id;
    let ytdTarget = targetsByStation.get(sid) || 0;
    for (let m = 0; m <= endMonthIdx; m++) {
      ytdTarget += Number(t[MONTH_KEYS[m]]) || 0;
    }
    targetsByStation.set(sid, ytdTarget);
  }

  const stations: YTDProductionVsTargetStation[] = [];
  let totalProd = 0, totalTarget = 0;

  for (const station of allStations) {
    const ytdEntry = ytdFullAgg.get(station.id);
    const ytdProd = roundTo(ytdEntry?.cwVol || 0, 0);
    const ytdTgt = roundTo(targetsByStation.get(station.id) || 0, 0);
    const variance = roundTo(ytdProd - ytdTgt, 0);
    const achievement = ytdTgt > 0 ? roundTo((ytdProd / ytdTgt) * 100, 1) : null;

    stations.push({
      stationId: station.id,
      stationName: station.station_name,
      ytdProduction: ytdProd,
      ytdTarget: ytdTgt,
      variance,
      achievementPct: achievement,
    });

    totalProd += ytdProd;
    totalTarget += ytdTgt;
  }

  stations.sort((a, b) => (a.achievementPct ?? 999) - (b.achievementPct ?? 999));

  return {
    stations,
    totalYTDProduction: roundTo(totalProd, 0),
    totalYTDTarget: roundTo(totalTarget, 0),
    totalVariance: roundTo(totalProd - totalTarget, 0),
    totalAchievementPct: totalTarget > 0 ? roundTo((totalProd / totalTarget) * 100, 1) : null,
  };
}

function buildEmptyReport(
  serviceCentreId: string,
  serviceCentreName: string,
  weekNumber: number,
  year: number,
  reportType: 'friday' | 'tuesday',
  dateRange: DateRange
): WeeklyReportData {
  return {
    serviceCentreName,
    serviceCentreId,
    weekNumber,
    year,
    reportType,
    periodStart: dateRange.start,
    periodEnd: dateRange.end,
    generatedAt: new Date().toISOString(),
    production: {
      totalCWVolume: 0, totalCWVolumeYTD: 0, totalRWVolume: 0, totalCWHours: 0, totalRWHours: 0,
      totalLoadShedding: 0, totalOtherDowntime: 0, totalDowntime: 0,
      stationCount: 0, logCount: 0, avgEfficiency: 0,
      avgCWPumpRate: null, avgRWPumpRate: null, totalNewConnections: 0,
      cwWeeklyTarget: 0, cwPerformancePct: null, totalBreakdownHoursLost: 0, stations: [],
    },
    breakdowns: [],
    chemicals: [],
    weekOnWeekChemicals: { weeks: [], avgAlumKg: 0, avgHthKg: 0, avgActivatedCarbonKg: 0 },
    nonFunctionalByDay: [],
    capacityUtilization: {
      rwInstalledTotal: 0, rwWeeklyActualTotal: null, rwYtdAvgTotal: null,
      cwInstalledTotal: 0, cwWeeklyActualTotal: null, cwYtdAvgTotal: null,
      rwUtilizationPct: null, cwUtilizationPct: null,
      stations: [],
    },
    powerSupply: {
      totalRequiredHours: 0, totalActualHours: 0, totalLoadSheddingHours: 0,
      totalPowerAvailableHours: 0, overallAvailabilityPct: 0, overallGridUtilizationPct: 0, stations: [],
    },
    connections: {
      totalCurrentConnections: 0, totalNewThisWeek: 0, totalNewTotal: 0, totalYTDNew: 0, stations: [],
    },
    ytdProductionVsTarget: {
      stations: [], totalYTDProduction: 0, totalYTDTarget: 0, totalVariance: 0, totalAchievementPct: null,
    },
    rwYTDAllocations: [],
    totalExpectedLogs: 0,
    totalActualLogs: 0,
    completionPct: 0,
  };
}
