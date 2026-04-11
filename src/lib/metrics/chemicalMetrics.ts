import { supabase } from '../supabase';
import type { ScopeFilter } from '../metricsConfig';
import { buildMonthDateRange, CHEMICAL_PROD_FIELDS, THRESHOLDS, roundTo } from '../metricsConfig';
import { applyScopeToQuery, fetchStationIdsByScope, fetchAllRows } from './scopeFilter';
import {
  computeChemicalBalance,
  computeReceiptTotal,
  computeAvgUsagePerDay,
  computeDaysRemaining,
} from './coreCalculations';

export interface ChemicalStationMetrics {
  stationId: string;
  stationName: string;
  chemicalType: string;
  openingBalance: number;
  received: number;
  used: number;
  currentBalance: number;
  productionDays: number;
  avgUsagePerDay: number;
  daysRemaining: number | null;
}

export interface ChemicalSummaryMetrics {
  chemicalType: string;
  totalOpening: number;
  totalReceived: number;
  totalUsed: number;
  totalCurrentBalance: number;
  stationCount: number;
  avgDaysRemaining: number | null;
  lowStockStations: Array<{ stationId: string; stationName: string; daysRemaining: number }>;
}

export async function fetchChemicalStationMetrics(
  scope: ScopeFilter,
  chemicalType: string,
  year: number,
  month: number
): Promise<ChemicalStationMetrics[]> {
  const prodField = CHEMICAL_PROD_FIELDS[chemicalType];
  if (!prodField) return [];

  const stationIds = await fetchStationIdsByScope(scope, 'Full Treatment');
  if (stationIds.length === 0) return [];

  const dateRange = buildMonthDateRange(year, month);

  let stationQuery = supabase
    .from('stations')
    .select('id, station_name')
    .in('id', stationIds);

  const [stationsData, balancesData, receiptsData, prodData] = await Promise.all([
    fetchAllRows(stationQuery),
    fetchAllRows(
      supabase
        .from('chemical_stock_balances')
        .select('station_id, opening_balance')
        .in('station_id', stationIds)
        .eq('chemical_type', chemicalType)
        .eq('year', year)
        .eq('month', month)
    ),
    fetchAllRows(
      supabase
        .from('chemical_stock_receipts')
        .select('station_id, quantity, receipt_type')
        .in('station_id', stationIds)
        .eq('chemical_type', chemicalType)
        .eq('year', year)
        .eq('month', month)
    ),
    fetchAllRows(
      supabase
        .from('production_logs')
        .select(`station_id, ${prodField}`)
        .in('station_id', stationIds)
        .gte('date', dateRange.start)
        .lt('date', dateRange.end)
    ),
  ]);

  const stationNameMap = new Map(
    stationsData.map((s: any) => [s.id, s.station_name])
  );

  const openingMap = new Map<string, number>();
  for (const r of balancesData) {
    openingMap.set(r.station_id, Number(r.opening_balance) || 0);
  }

  const receiptsByStation = new Map<string, Array<{ quantity: number; receipt_type: string }>>();
  for (const r of receiptsData) {
    const existing = receiptsByStation.get(r.station_id) || [];
    existing.push({ quantity: Number(r.quantity), receipt_type: r.receipt_type });
    receiptsByStation.set(r.station_id, existing);
  }

  const usedMap = new Map<string, number>();
  const prodDaysMap = new Map<string, number>();
  for (const r of prodData as any[]) {
    const val = Number(r[prodField]) || 0;
    usedMap.set(r.station_id, (usedMap.get(r.station_id) || 0) + val);
    if (val > 0) {
      prodDaysMap.set(r.station_id, (prodDaysMap.get(r.station_id) || 0) + 1);
    }
  }

  return stationIds.map(sid => {
    const opening = openingMap.get(sid) ?? 0;
    const received = computeReceiptTotal(receiptsByStation.get(sid) || []);
    const used = usedMap.get(sid) ?? 0;
    const productionDays = prodDaysMap.get(sid) ?? 0;
    const currentBalance = computeChemicalBalance(opening, received, used);
    const avgUsage = computeAvgUsagePerDay(used, productionDays);
    const daysRemaining = computeDaysRemaining(currentBalance, avgUsage);

    return {
      stationId: sid,
      stationName: stationNameMap.get(sid) || '',
      chemicalType,
      openingBalance: opening,
      received: roundTo(received, 1),
      used: roundTo(used, 1),
      currentBalance: roundTo(currentBalance, 1),
      productionDays,
      avgUsagePerDay: roundTo(avgUsage, 2),
      daysRemaining,
    };
  });
}

export interface ChemicalDosageStation {
  stationId: string;
  stationName: string;
  alumDosage: number | null;
  hthDosage: number | null;
  acDosage: number | null;
  cwVolume: number;
}

export interface ChemicalDosageSummary {
  scAlumDosage: number | null;
  scHthDosage: number | null;
  scAcDosage: number | null;
  stations: ChemicalDosageStation[];
}

export async function fetchChemicalDosageRates(
  scope: ScopeFilter,
  year: number,
  monthsOrNull: number[] | null,
): Promise<ChemicalDosageSummary> {
  const stationIds = await fetchStationIdsByScope(scope, 'Full Treatment');
  if (stationIds.length === 0) {
    return { scAlumDosage: null, scHthDosage: null, scAcDosage: null, stations: [] };
  }

  let stationQuery = supabase.from('stations').select('id, station_name').in('id', stationIds);
  const { data: stationsData } = await stationQuery;
  const stationNameMap = new Map((stationsData || []).map((s: any) => [s.id, s.station_name]));

  let prodQuery = supabase
    .from('production_logs')
    .select('station_id, cw_volume_m3, alum_kg, hth_kg, activated_carbon_kg, date')
    .in('station_id', stationIds);

  if (monthsOrNull === null || monthsOrNull.length === 0) {
    prodQuery = prodQuery.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`);
  } else {
    const starts = monthsOrNull.map(m => `${year}-${String(m).padStart(2, '0')}-01`);
    const ends = monthsOrNull.map(m => {
      const endM = m === 12 ? 1 : m + 1;
      const endY = m === 12 ? year + 1 : year;
      return `${endY}-${String(endM).padStart(2, '0')}-01`;
    });
    const minStart = starts.reduce((a, b) => a < b ? a : b);
    const maxEnd = ends.reduce((a, b) => a > b ? a : b);
    prodQuery = prodQuery.gte('date', minStart).lt('date', maxEnd);
    const validMonths = monthsOrNull;
    const rawLogs = await fetchAllRows(prodQuery);
    const filteredLogs = rawLogs.filter((r: any) => {
      const m = parseInt(r.date.split('-')[1], 10);
      return validMonths.includes(m);
    });
    return buildDosageSummary(filteredLogs, stationIds, stationNameMap);
  }

  const rawLogs = await fetchAllRows(prodQuery);
  return buildDosageSummary(rawLogs, stationIds, stationNameMap);
}

function buildDosageSummary(
  logs: any[],
  stationIds: string[],
  stationNameMap: Map<string, string>
): ChemicalDosageSummary {
  const agg = new Map<string, { cwVol: number; alum: number; hth: number; ac: number }>();
  for (const r of logs) {
    const sid = r.station_id;
    const e = agg.get(sid) || { cwVol: 0, alum: 0, hth: 0, ac: 0 };
    e.cwVol += Number(r.cw_volume_m3) || 0;
    e.alum += Number(r.alum_kg) || 0;
    e.hth += Number(r.hth_kg) || 0;
    e.ac += Number(r.activated_carbon_kg) || 0;
    agg.set(sid, e);
  }

  let totCW = 0, totAlum = 0, totHth = 0, totAc = 0;
  const stations: ChemicalDosageStation[] = stationIds.map(sid => {
    const e = agg.get(sid) || { cwVol: 0, alum: 0, hth: 0, ac: 0 };
    totCW += e.cwVol;
    totAlum += e.alum;
    totHth += e.hth;
    totAc += e.ac;
    return {
      stationId: sid,
      stationName: stationNameMap.get(sid) || '',
      alumDosage: e.cwVol > 0 ? roundTo((e.alum / e.cwVol) * 1000, 3) : null,
      hthDosage: e.cwVol > 0 ? roundTo((e.hth / e.cwVol) * 1000, 3) : null,
      acDosage: e.cwVol > 0 ? roundTo((e.ac / e.cwVol) * 1000, 3) : null,
      cwVolume: roundTo(e.cwVol, 0),
    };
  });

  stations.sort((a, b) => b.cwVolume - a.cwVolume);

  return {
    scAlumDosage: totCW > 0 ? roundTo((totAlum / totCW) * 1000, 3) : null,
    scHthDosage: totCW > 0 ? roundTo((totHth / totCW) * 1000, 3) : null,
    scAcDosage: totCW > 0 ? roundTo((totAc / totCW) * 1000, 3) : null,
    stations,
  };
}

export async function fetchChemicalSummary(
  scope: ScopeFilter,
  chemicalType: string,
  year: number,
  month: number
): Promise<ChemicalSummaryMetrics> {
  const stationMetrics = await fetchChemicalStationMetrics(scope, chemicalType, year, month);

  let totalOpening = 0, totalReceived = 0, totalUsed = 0, totalBalance = 0;
  const lowStock: ChemicalSummaryMetrics['lowStockStations'] = [];
  const daysRemainingValues: number[] = [];

  for (const sm of stationMetrics) {
    totalOpening += sm.openingBalance;
    totalReceived += sm.received;
    totalUsed += sm.used;
    totalBalance += sm.currentBalance;

    if (sm.daysRemaining !== null) {
      daysRemainingValues.push(sm.daysRemaining);
      if (sm.daysRemaining <= THRESHOLDS.CHEMICAL_LOW_STOCK_DAYS) {
        lowStock.push({
          stationId: sm.stationId,
          stationName: sm.stationName,
          daysRemaining: Math.round(sm.daysRemaining),
        });
      }
    }
  }

  lowStock.sort((a, b) => a.daysRemaining - b.daysRemaining);

  const avgDays = daysRemainingValues.length > 0
    ? roundTo(daysRemainingValues.reduce((s, v) => s + v, 0) / daysRemainingValues.length, 1)
    : null;

  return {
    chemicalType,
    totalOpening: roundTo(totalOpening, 1),
    totalReceived: roundTo(totalReceived, 1),
    totalUsed: roundTo(totalUsed, 1),
    totalCurrentBalance: roundTo(totalBalance, 1),
    stationCount: stationMetrics.length,
    avgDaysRemaining: avgDays,
    lowStockStations: lowStock,
  };
}

export interface WeeklyChemicalUsage {
  weekNumber: number;
  weekLabel: string;
  alumKg: number;
  hthKg: number;
  activatedCarbonKg: number;
}

export interface WeekOnWeekChemicalUsage {
  weeks: WeeklyChemicalUsage[];
  avgAlumKg: number;
  avgHthKg: number;
  avgActivatedCarbonKg: number;
}

export async function fetchWeekOnWeekChemicalUsage(
  scope: ScopeFilter,
  year: number,
  currentWeekNumber: number
): Promise<WeekOnWeekChemicalUsage> {
  const stationIds = await fetchStationIdsByScope(scope, 'Full Treatment');
  if (stationIds.length === 0) {
    return { weeks: [], avgAlumKg: 0, avgHthKg: 0, avgActivatedCarbonKg: 0 };
  }

  const NUM_WEEKS = 10;
  const startWeek = Math.max(1, currentWeekNumber - NUM_WEEKS + 1);

  const weekRanges: Array<{ weekNum: number; start: string; end: string }> = [];
  for (let w = startWeek; w <= currentWeekNumber; w++) {
    const range = getWeekDateRange(w, year);
    weekRanges.push({ weekNum: w, ...range });
  }

  const queryStart = weekRanges[0].start;
  const queryEnd = weekRanges[weekRanges.length - 1].end;

  const logs = await fetchAllRows(
    supabase
      .from('production_logs')
      .select('date, alum_kg, hth_kg, activated_carbon_kg')
      .in('station_id', stationIds)
      .gte('date', queryStart)
      .lte('date', queryEnd)
      .order('date', { ascending: true })
  );

  const weeklyData = new Map<number, { alum: number; hth: number; ac: number }>();

  for (const log of logs) {
    const logDate = log.date;
    for (const wr of weekRanges) {
      if (logDate >= wr.start && logDate <= wr.end) {
        const existing = weeklyData.get(wr.weekNum) || { alum: 0, hth: 0, ac: 0 };
        existing.alum += Number(log.alum_kg) || 0;
        existing.hth += Number(log.hth_kg) || 0;
        existing.ac += Number(log.activated_carbon_kg) || 0;
        weeklyData.set(wr.weekNum, existing);
        break;
      }
    }
  }

  const weeks: WeeklyChemicalUsage[] = [];
  for (const wr of weekRanges) {
    const data = weeklyData.get(wr.weekNum) || { alum: 0, hth: 0, ac: 0 };
    weeks.push({
      weekNumber: wr.weekNum,
      weekLabel: `Wk ${wr.weekNum}`,
      alumKg: roundTo(data.alum, 0),
      hthKg: roundTo(data.hth, 0),
      activatedCarbonKg: roundTo(data.ac, 0),
    });
  }

  const totalAlum = weeks.reduce((s, w) => s + w.alumKg, 0);
  const totalHth = weeks.reduce((s, w) => s + w.hthKg, 0);
  const totalAc = weeks.reduce((s, w) => s + w.activatedCarbonKg, 0);

  const weeksWithData = weeks.filter(w => w.alumKg > 0 || w.hthKg > 0 || w.activatedCarbonKg > 0).length;
  const divisor = weeksWithData > 0 ? weeksWithData : weeks.length;

  return {
    weeks,
    avgAlumKg: roundTo(totalAlum / divisor, 0),
    avgHthKg: roundTo(totalHth / divisor, 0),
    avgActivatedCarbonKg: roundTo(totalAc / divisor, 0),
  };
}

function getWeekDateRange(weekNumber: number, year: number): { start: string; end: string } {
  const jan1 = new Date(year, 0, 1, 12, 0, 0);
  const dayOfWeek = jan1.getDay();
  const daysToFirstFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 12 - dayOfWeek;
  const firstFriday = new Date(year, 0, 1 + daysToFirstFriday, 12, 0, 0);

  const weekStart = new Date(firstFriday);
  weekStart.setDate(firstFriday.getDate() + ((weekNumber - 1) * 7));

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return {
    start: weekStart.toISOString().split('T')[0],
    end: weekEnd.toISOString().split('T')[0],
  };
}
