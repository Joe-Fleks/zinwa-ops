import { supabase } from './supabase';
import type { ChemicalType } from './chemicalStockService';
import {
  getChemicalProdField,
  fetchOpeningBalances,
  fetchPreviousMonthClosingBalances,
  fetchReceivedTotals,
  fetchUsedTotals,
} from './chemicalStockService';

export interface StationDistributionData {
  station_id: string;
  station_name: string;
  design_capacity_m3_hr: number;
  target_daily_hours: number;
  current_balance_kg: number;
  projected_daily_usage_kg: number;
  days_remaining_before: number;
  allocated_kg: number;
  days_remaining_after: number;
  downtime_flagged: boolean;
  downtime_pct_48h: number;
  user_confirmed_rate_kg: number | null;
  user_confirmed_offline_days: number | null;
  suggested_rates: SuggestedRate[];
}

export interface SuggestedRate {
  label: string;
  value: number;
  basis: string;
}

export interface DistributionResult {
  stations: StationDistributionData[];
  total_available_stock: number;
  target_equalization_days: number;
  variance_tolerance_pct: number;
  unallocated_kg: number;
}

interface StationRawData {
  id: string;
  station_name: string;
  design_capacity_m3_hr: number | null;
  target_daily_hours: number | null;
  service_centre_id: string;
}

interface ProductionLogRow {
  station_id: string;
  date: string;
  cw_hours_run: number;
  load_shedding_hours: number;
  other_downtime_hours: number;
  [key: string]: any;
}

export async function fetchStationsWithCapacity(
  allowedServiceCentreIds: string[]
): Promise<StationRawData[]> {
  if (allowedServiceCentreIds.length === 0) return [];

  const { data, error } = await supabase
    .from('stations')
    .select('id, station_name, design_capacity_m3_hr, target_daily_hours, service_centre_id')
    .in('service_centre_id', allowedServiceCentreIds)
    .eq('station_type', 'Full Treatment')
    .order('station_name');

  if (error) throw error;
  return data || [];
}

export async function fetch48hDowntime(
  stationIds: string[]
): Promise<Map<string, { totalDowntimeHrs: number; totalPossibleHrs: number; pct: number }>> {
  if (stationIds.length === 0) return new Map();

  const today = new Date();
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const startDate = twoDaysAgo.toISOString().split('T')[0];
  const endDate = today.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('production_logs')
    .select('station_id, date, cw_hours_run, load_shedding_hours, other_downtime_hours')
    .in('station_id', stationIds)
    .gte('date', startDate)
    .lt('date', endDate);

  if (error) throw error;

  const map = new Map<string, { totalDowntimeHrs: number; totalPossibleHrs: number; pct: number }>();

  for (const sid of stationIds) {
    const logs = (data || []).filter((l: ProductionLogRow) => l.station_id === sid);
    const dayCount = logs.length || 1;
    const totalPossible = dayCount * 24;

    let totalDowntime = 0;
    for (const log of logs) {
      totalDowntime +=
        (Number(log.load_shedding_hours) || 0) +
        (Number(log.other_downtime_hours) || 0);
    }

    map.set(sid, {
      totalDowntimeHrs: totalDowntime,
      totalPossibleHrs: totalPossible,
      pct: totalPossible > 0 ? (totalDowntime / totalPossible) * 100 : 0,
    });
  }

  return map;
}

export async function fetchHistoricalDosingRate(
  stationIds: string[],
  chemicalType: ChemicalType,
  lookbackDays: number = 30
): Promise<Map<string, number>> {
  if (stationIds.length === 0) return new Map();

  const prodField = getChemicalProdField(chemicalType);
  if (!prodField) return new Map();

  const endDate = new Date().toISOString().split('T')[0];
  const start = new Date();
  start.setDate(start.getDate() - lookbackDays);
  const startDate = start.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('production_logs')
    .select('station_id, cw_volume_m3, alum_kg, hth_kg, activated_carbon_kg')
    .in('station_id', stationIds)
    .gte('date', startDate)
    .lt('date', endDate)
    .gt('cw_volume_m3', 0);

  if (error) throw error;

  const stationAgg = new Map<string, { totalChemical: number; totalVolume: number }>();

  for (const row of (data || []) as any[]) {
    const sid = row.station_id;
    const existing = stationAgg.get(sid) || { totalChemical: 0, totalVolume: 0 };
    existing.totalChemical += Number(row[prodField]) || 0;
    existing.totalVolume += Number(row.cw_volume_m3) || 0;
    stationAgg.set(sid, existing);
  }

  const rateMap = new Map<string, number>();
  for (const [sid, agg] of stationAgg) {
    if (agg.totalVolume > 0) {
      rateMap.set(sid, agg.totalChemical / agg.totalVolume);
    }
  }

  return rateMap;
}

export async function fetchCurrentBalances(
  stationIds: string[],
  chemicalType: ChemicalType
): Promise<Map<string, number>> {
  if (stationIds.length === 0) return new Map();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [balances, prevClosing, received, used] = await Promise.all([
    fetchOpeningBalances(stationIds, chemicalType, year, month),
    fetchPreviousMonthClosingBalances(stationIds, chemicalType, year, month),
    fetchReceivedTotals(stationIds, chemicalType, year, month),
    fetchUsedTotals(stationIds, chemicalType, year, month),
  ]);

  const balanceMap = new Map<string, number>();
  for (const sid of stationIds) {
    const existing = balances.get(sid);
    const openBal = existing ? existing.opening_balance : (prevClosing.get(sid) ?? 0);
    const rec = received.get(sid) ?? 0;
    const usedKg = used.get(sid) ?? 0;
    balanceMap.set(sid, openBal + rec - usedKg);
  }

  return balanceMap;
}

function getVarianceTolerance(chemicalType: ChemicalType): number {
  return chemicalType === 'aluminium_sulphate' ? 5 : 10;
}

function buildSuggestedRates(
  station: StationRawData,
  dosingRate: number,
  historicalAvgUsage: number
): SuggestedRate[] {
  const suggestions: SuggestedRate[] = [];
  const designCap = station.design_capacity_m3_hr || 0;
  const targetHrs = station.target_daily_hours || 0;

  if (designCap > 0 && targetHrs > 0 && dosingRate > 0) {
    const designBasedRate = targetHrs * designCap * dosingRate;
    suggestions.push({
      label: `${designBasedRate.toFixed(1)} kg/day`,
      value: Math.round(designBasedRate * 10) / 10,
      basis: `Target hours (${targetHrs}h) x Design capacity (${designCap} m3/h) x Dosing rate (${dosingRate.toFixed(4)} kg/m3)`,
    });
  }

  if (historicalAvgUsage > 0) {
    suggestions.push({
      label: `${historicalAvgUsage.toFixed(1)} kg/day`,
      value: Math.round(historicalAvgUsage * 10) / 10,
      basis: '30-day historical average daily usage',
    });
  }

  if (designCap > 0 && dosingRate > 0) {
    const reducedRate = (targetHrs * 0.5) * designCap * dosingRate;
    if (reducedRate > 0) {
      suggestions.push({
        label: `${reducedRate.toFixed(1)} kg/day`,
        value: Math.round(reducedRate * 10) / 10,
        basis: 'Reduced operation (50% of target hours)',
      });
    }
  }

  suggestions.push({
    label: '0 kg/day',
    value: 0,
    basis: 'Station offline / no chemical needed',
  });

  return suggestions;
}

export async function buildDistributionData(
  allowedServiceCentreIds: string[],
  chemicalType: ChemicalType,
  newStockKg: number
): Promise<DistributionResult> {
  const stations = await fetchStationsWithCapacity(allowedServiceCentreIds);
  if (stations.length === 0) {
    return { stations: [], total_available_stock: 0, target_equalization_days: 0, variance_tolerance_pct: 0, unallocated_kg: 0 };
  }

  const stationIds = stations.map(s => s.id);

  const [downtimeMap, dosingRateMap, balanceMap] = await Promise.all([
    fetch48hDowntime(stationIds),
    fetchHistoricalDosingRate(stationIds, chemicalType),
    fetchCurrentBalances(stationIds, chemicalType),
  ]);

  const prodField = getChemicalProdField(chemicalType);
  const now = new Date();
  const lookbackStart = new Date(now);
  lookbackStart.setDate(lookbackStart.getDate() - 30);

  const { data: usageLogs } = await supabase
    .from('production_logs')
    .select('station_id, alum_kg, hth_kg, activated_carbon_kg, cw_volume_m3, rw_volume_m3, date')
    .in('station_id', stationIds)
    .gte('date', lookbackStart.toISOString().split('T')[0])
    .lt('date', now.toISOString().split('T')[0]);

  const dailyUsageMap = new Map<string, number>();
  const stationDayCounts = new Map<string, number>();
  for (const row of (usageLogs || []) as any[]) {
    const sid = row.station_id;
    const usage = Number(row[prodField]) || 0;
    const cwVolume = Number(row.cw_volume_m3) || 0;

    if (usage > 0) {
      dailyUsageMap.set(sid, (dailyUsageMap.get(sid) || 0) + usage);
      stationDayCounts.set(sid, (stationDayCounts.get(sid) || 0) + 1);
    } else if (cwVolume > 0) {
      stationDayCounts.set(sid, (stationDayCounts.get(sid) || 0) + 1);
    }
  }

  const varianceTolerance = getVarianceTolerance(chemicalType);

  const stationData: StationDistributionData[] = stations.map(st => {
    const balance = balanceMap.get(st.id) ?? 0;
    const dosingRate = dosingRateMap.get(st.id) ?? 0;
    const designCap = st.design_capacity_m3_hr || 0;
    const targetHrs = st.target_daily_hours || 0;
    const downtime = downtimeMap.get(st.id);
    const downtimePct = downtime?.pct ?? 0;
    const isDowntimeFlagged = downtimePct > 50;

    let projectedDailyUsage = 0;
    if (designCap > 0 && targetHrs > 0 && dosingRate > 0) {
      projectedDailyUsage = targetHrs * designCap * dosingRate;
    } else {
      const totalUsage = dailyUsageMap.get(st.id) || 0;
      const dayCount = stationDayCounts.get(st.id) || 1;
      projectedDailyUsage = totalUsage / dayCount;
    }

    const historicalAvg = (() => {
      const totalUsage = dailyUsageMap.get(st.id) || 0;
      const dayCount = stationDayCounts.get(st.id) || 0;
      return dayCount > 0 ? totalUsage / dayCount : 0;
    })();

    const daysRemainingBefore = projectedDailyUsage > 0 ? balance / projectedDailyUsage : 0;

    return {
      station_id: st.id,
      station_name: st.station_name,
      design_capacity_m3_hr: designCap,
      target_daily_hours: targetHrs,
      current_balance_kg: Math.round(balance * 10) / 10,
      projected_daily_usage_kg: Math.round(projectedDailyUsage * 10) / 10,
      days_remaining_before: Math.round(daysRemainingBefore * 10) / 10,
      allocated_kg: 0,
      days_remaining_after: 0,
      downtime_flagged: isDowntimeFlagged,
      downtime_pct_48h: Math.round(downtimePct),
      user_confirmed_rate_kg: null,
      user_confirmed_offline_days: null,
      suggested_rates: buildSuggestedRates(st, dosingRate, historicalAvg),
    };
  });

  const totalExistingStock = stationData.reduce((s, st) => s + Math.max(0, st.current_balance_kg), 0);
  const totalAvailable = totalExistingStock + newStockKg;

  return {
    stations: stationData,
    total_available_stock: Math.round(totalAvailable * 10) / 10,
    target_equalization_days: 0,
    variance_tolerance_pct: varianceTolerance,
    unallocated_kg: 0,
  };
}

export function runEqualization(
  stations: StationDistributionData[],
  newStockKg: number,
  varianceTolerancePct: number
): { stations: StationDistributionData[]; targetDays: number; unallocated: number } {
  const activeStations = stations.filter(s => {
    const effectiveRate = s.user_confirmed_rate_kg !== null ? s.user_confirmed_rate_kg : s.projected_daily_usage_kg;
    return effectiveRate > 0;
  });

  const offlineStations = stations.filter(s => {
    const effectiveRate = s.user_confirmed_rate_kg !== null ? s.user_confirmed_rate_kg : s.projected_daily_usage_kg;
    return effectiveRate <= 0;
  });

  if (activeStations.length === 0) {
    return {
      stations: stations.map(s => ({ ...s, allocated_kg: 0, days_remaining_after: 0 })),
      targetDays: 0,
      unallocated: newStockKg,
    };
  }

  const stationsWithRates = activeStations.map(s => {
    const effectiveRate = s.user_confirmed_rate_kg !== null ? s.user_confirmed_rate_kg : s.projected_daily_usage_kg;
    const offlineDays = s.user_confirmed_offline_days || 0;
    return { ...s, effectiveRate, offlineDays };
  });

  const totalDailyConsumption = stationsWithRates.reduce((sum, s) => sum + s.effectiveRate, 0);
  const totalExistingStock = stationsWithRates.reduce((sum, s) => sum + Math.max(0, s.current_balance_kg), 0);
  const totalPool = totalExistingStock + newStockKg;

  if (totalDailyConsumption <= 0) {
    return {
      stations: stations.map(s => ({ ...s, allocated_kg: 0, days_remaining_after: 0 })),
      targetDays: 0,
      unallocated: newStockKg,
    };
  }

  const targetDays = totalPool / totalDailyConsumption;

  let remaining = newStockKg;
  const allocations = stationsWithRates.map(s => {
    const neededTotal = (targetDays - s.offlineDays) * s.effectiveRate;
    const deficit = Math.max(0, neededTotal - Math.max(0, s.current_balance_kg));
    return { ...s, idealAllocation: deficit };
  });

  const totalIdealAllocation = allocations.reduce((sum, a) => sum + a.idealAllocation, 0);

  const result = allocations.map(a => {
    let allocated: number;
    if (totalIdealAllocation <= 0) {
      allocated = 0;
    } else if (totalIdealAllocation <= remaining) {
      allocated = a.idealAllocation;
    } else {
      allocated = (a.idealAllocation / totalIdealAllocation) * remaining;
    }

    allocated = Math.round(allocated * 10) / 10;
    const effectiveBalance = Math.max(0, a.current_balance_kg) + allocated;
    const daysAfter = a.effectiveRate > 0
      ? (effectiveBalance / a.effectiveRate) - a.offlineDays
      : 0;

    return {
      ...a,
      allocated_kg: allocated,
      days_remaining_after: Math.round(Math.max(0, daysAfter) * 10) / 10,
    };
  });

  remaining = newStockKg - result.reduce((sum, r) => sum + r.allocated_kg, 0);

  const lowerBound = targetDays * (1 - varianceTolerancePct / 100);
  const upperBound = targetDays * (1 + varianceTolerancePct / 100);

  for (let iteration = 0; iteration < 10 && Math.abs(remaining) > 0.5; iteration++) {
    const belowBand = result.filter(s => s.days_remaining_after < lowerBound && s.effectiveRate > 0);
    const aboveBand = result.filter(s => s.days_remaining_after > upperBound && s.effectiveRate > 0);

    if (remaining > 0 && belowBand.length > 0) {
      const share = remaining / belowBand.length;
      for (const s of belowBand) {
        const added = Math.round(Math.min(share, (lowerBound - s.days_remaining_after) * s.effectiveRate) * 10) / 10;
        s.allocated_kg += added;
        remaining -= added;
        const bal = Math.max(0, s.current_balance_kg) + s.allocated_kg;
        s.days_remaining_after = Math.round(Math.max(0, (bal / s.effectiveRate) - s.offlineDays) * 10) / 10;
      }
    } else if (remaining < 0 && aboveBand.length > 0) {
      const take = Math.abs(remaining) / aboveBand.length;
      for (const s of aboveBand) {
        const removed = Math.round(Math.min(take, (s.days_remaining_after - upperBound) * s.effectiveRate) * 10) / 10;
        s.allocated_kg = Math.max(0, s.allocated_kg - removed);
        remaining += removed;
        const bal = Math.max(0, s.current_balance_kg) + s.allocated_kg;
        s.days_remaining_after = Math.round(Math.max(0, (bal / s.effectiveRate) - s.offlineDays) * 10) / 10;
      }
    } else {
      break;
    }
  }

  const finalStations: StationDistributionData[] = stations.map(s => {
    const matched = result.find(r => r.station_id === s.station_id);
    if (matched) {
      return {
        ...s,
        allocated_kg: matched.allocated_kg,
        days_remaining_after: matched.days_remaining_after,
        projected_daily_usage_kg: matched.user_confirmed_rate_kg !== null
          ? matched.user_confirmed_rate_kg
          : matched.projected_daily_usage_kg,
        user_confirmed_rate_kg: matched.user_confirmed_rate_kg,
        user_confirmed_offline_days: matched.user_confirmed_offline_days,
      };
    }
    const offlineMatch = offlineStations.find(o => o.station_id === s.station_id);
    if (offlineMatch) {
      return { ...s, allocated_kg: 0, days_remaining_after: 0 };
    }
    return s;
  });

  return {
    stations: finalStations,
    targetDays: Math.round(targetDays * 10) / 10,
    unallocated: Math.round(Math.max(0, remaining) * 10) / 10,
  };
}

export async function saveDistribution(
  serviceCentreId: string,
  chemicalType: ChemicalType,
  userId: string,
  stations: StationDistributionData[],
  totalAvailableStock: number,
  targetEqualizationDays: number,
  varianceTolerancePct: number,
  notes: string
): Promise<string> {
  const { data: dist, error: distError } = await supabase
    .from('chemical_distributions')
    .insert({
      service_centre_id: serviceCentreId,
      chemical_type: chemicalType,
      total_available_stock: totalAvailableStock,
      target_equalization_days: targetEqualizationDays,
      variance_tolerance_pct: varianceTolerancePct,
      created_by: userId,
      notes,
    })
    .select('id')
    .single();

  if (distError) throw distError;

  const items = stations.map(s => ({
    distribution_id: dist.id,
    station_id: s.station_id,
    current_balance_kg: s.current_balance_kg,
    projected_daily_usage_kg: s.projected_daily_usage_kg,
    days_remaining_before: s.days_remaining_before,
    allocated_kg: s.allocated_kg,
    days_remaining_after: s.days_remaining_after,
    downtime_flagged: s.downtime_flagged,
    user_confirmed_rate_kg: s.user_confirmed_rate_kg,
    user_confirmed_offline_days: s.user_confirmed_offline_days,
  }));

  const { error: itemsError } = await supabase
    .from('chemical_distribution_items')
    .insert(items);

  if (itemsError) throw itemsError;

  return dist.id;
}
