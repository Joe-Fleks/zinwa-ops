import { supabase } from '../supabase';
import type { ScopeFilter } from '../metricsConfig';
import { buildMonthDateRange, CHEMICAL_PROD_FIELDS, THRESHOLDS, roundTo } from '../metricsConfig';
import { applyScopeToQuery, fetchStationIdsByScope } from './scopeFilter';
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

  const [stationsRes, balancesRes, receiptsRes, prodRes] = await Promise.all([
    stationQuery,
    supabase
      .from('chemical_stock_balances')
      .select('station_id, opening_balance')
      .in('station_id', stationIds)
      .eq('chemical_type', chemicalType)
      .eq('year', year)
      .eq('month', month),
    supabase
      .from('chemical_stock_receipts')
      .select('station_id, quantity, receipt_type')
      .in('station_id', stationIds)
      .eq('chemical_type', chemicalType)
      .eq('year', year)
      .eq('month', month),
    supabase
      .from('production_logs')
      .select(`station_id, ${prodField}`)
      .in('station_id', stationIds)
      .gte('date', dateRange.start)
      .lt('date', dateRange.end),
  ]);

  if (stationsRes.error) throw stationsRes.error;
  if (balancesRes.error) throw balancesRes.error;
  if (receiptsRes.error) throw receiptsRes.error;
  if (prodRes.error) throw prodRes.error;

  const stationNameMap = new Map(
    (stationsRes.data || []).map((s: any) => [s.id, s.station_name])
  );

  const openingMap = new Map<string, number>();
  for (const r of (balancesRes.data || [])) {
    openingMap.set(r.station_id, Number(r.opening_balance) || 0);
  }

  const receiptsByStation = new Map<string, Array<{ quantity: number; receipt_type: string }>>();
  for (const r of (receiptsRes.data || [])) {
    const existing = receiptsByStation.get(r.station_id) || [];
    existing.push({ quantity: Number(r.quantity), receipt_type: r.receipt_type });
    receiptsByStation.set(r.station_id, existing);
  }

  const usedMap = new Map<string, number>();
  const prodDaysMap = new Map<string, number>();
  for (const r of (prodRes.data || []) as any[]) {
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
