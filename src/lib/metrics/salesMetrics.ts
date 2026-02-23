import { supabase } from '../supabase';
import type { ScopeFilter } from '../metricsConfig';
import { roundTo } from '../metricsConfig';
import { applyScopeToQuery } from './scopeFilter';

export type SalesGranularity = 'monthly' | 'quarterly' | 'yearly';

export interface CWSalesStationMetrics {
  stationId: string;
  stationName: string;
  stationType: string;
  serviceCentreId: string;
  year: number;
  month?: number;
  quarter?: number;
  returnsVolume: number;
  sageSalesVolume: number;
  effectiveSalesVolume: number;
}

export interface CWSalesSCMetrics {
  serviceCentreId: string;
  serviceCentreName: string;
  year: number;
  month?: number;
  quarter?: number;
  stationCount: number;
  totalReturnsVolume: number;
  totalSageSalesVolume: number;
  totalEffectiveSalesVolume: number;
}

export interface CWSalesTargetStationMetrics {
  stationId: string;
  stationName: string;
  stationType: string;
  serviceCentreId: string;
  year: number;
  month?: number;
  quarter?: number;
  targetVolume: number;
}

export interface CWSalesTargetSCMetrics {
  serviceCentreId: string;
  serviceCentreName: string;
  year: number;
  month?: number;
  quarter?: number;
  stationCount: number;
  totalTargetVolume: number;
}

export interface CWSalesVsTargetMetrics {
  stationId: string;
  stationName: string;
  stationType: string;
  serviceCentreId: string;
  year: number;
  month: number;
  actualVolume: number;
  targetVolume: number;
  varianceM3: number;
  achievementPct: number | null;
}

export interface RWSalesMetrics {
  damId: string;
  damName: string;
  serviceCentreId: string;
  year: number;
  month?: number;
  quarter?: number;
  salesVolume: number;
}

export interface RWSalesSCMetrics {
  serviceCentreId: string;
  serviceCentreName: string;
  year: number;
  month?: number;
  quarter?: number;
  damCount: number;
  totalSalesVolume: number;
}

export interface RWSalesTargetMetrics {
  damId: string;
  damName: string;
  serviceCentreId: string;
  year: number;
  month?: number;
  quarter?: number;
  targetVolume: number;
}

export interface RWSalesTargetSCMetrics {
  serviceCentreId: string;
  serviceCentreName: string;
  year: number;
  month?: number;
  quarter?: number;
  damCount: number;
  totalTargetVolume: number;
}

export interface RWSalesVsTargetMetrics {
  damId: string;
  damName: string;
  serviceCentreId: string;
  year: number;
  month: number;
  actualVolume: number;
  targetVolume: number;
  varianceM3: number;
  achievementPct: number | null;
}

export interface CWSalesSummary {
  totalReturnsVolume: number;
  totalSageSalesVolume: number;
  totalEffectiveSalesVolume: number;
  totalTargetVolume: number;
  overallVarianceM3: number;
  overallAchievementPct: number | null;
  stationCount: number;
  stations: CWSalesVsTargetMetrics[];
}

export interface RWSalesSummary {
  totalSalesVolume: number;
  totalTargetVolume: number;
  overallVarianceM3: number;
  overallAchievementPct: number | null;
  damCount: number;
  dams: RWSalesVsTargetMetrics[];
}

function viewForCWSales(granularity: SalesGranularity, level: 'station' | 'sc'): string {
  const g = granularity === 'monthly' ? 'monthly' : granularity === 'quarterly' ? 'quarterly' : 'yearly';
  const l = level === 'station' ? 'by_station' : 'by_sc';
  return `v_cw_sales_${g}_${l}`;
}

function viewForCWSalesTargets(granularity: SalesGranularity, level: 'station' | 'sc'): string {
  const g = granularity === 'monthly' ? 'monthly' : granularity === 'quarterly' ? 'quarterly' : 'yearly';
  const l = level === 'station' ? 'by_station' : 'by_sc';
  return `v_cw_sales_targets_${g}_${l}`;
}

function viewForRWSales(granularity: SalesGranularity, level: 'dam' | 'sc'): string {
  const g = granularity === 'monthly' ? 'monthly' : granularity === 'quarterly' ? 'quarterly' : 'yearly';
  const l = level === 'dam' ? 'by_dam' : 'by_sc';
  return `v_rw_sales_${g}_${l}`;
}

function viewForRWSalesTargets(granularity: SalesGranularity, level: 'dam' | 'sc'): string {
  const g = granularity === 'monthly' ? 'monthly' : granularity === 'quarterly' ? 'quarterly' : 'yearly';
  const l = level === 'dam' ? 'by_dam' : 'by_sc';
  return `v_rw_sales_targets_${g}_${l}`;
}

export async function fetchCWSalesByStation(
  scope: ScopeFilter,
  year: number,
  granularity: SalesGranularity,
  period?: number
): Promise<CWSalesStationMetrics[]> {
  const view = viewForCWSales(granularity, 'station');
  let query = supabase.from(view).select('*').eq('year', year);
  query = applyScopeToQuery(query, scope);

  if (granularity === 'monthly' && period) query = query.eq('month', period);
  if (granularity === 'quarterly' && period) query = query.eq('quarter', period);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((r: any) => ({
    stationId: r.station_id,
    stationName: r.station_name,
    stationType: r.station_type,
    serviceCentreId: r.service_centre_id,
    year: r.year,
    month: r.month,
    quarter: r.quarter,
    returnsVolume: Number(r.returns_volume_m3) || 0,
    sageSalesVolume: Number(r.sage_sales_volume_m3) || 0,
    effectiveSalesVolume: Number(r.effective_sales_volume_m3) || 0,
  }));
}

export async function fetchCWSalesBySC(
  scope: ScopeFilter,
  year: number,
  granularity: SalesGranularity,
  period?: number
): Promise<CWSalesSCMetrics[]> {
  const view = viewForCWSales(granularity, 'sc');
  let query = supabase.from(view).select('*').eq('year', year);
  query = applyScopeToQuery(query, scope);

  if (granularity === 'monthly' && period) query = query.eq('month', period);
  if (granularity === 'quarterly' && period) query = query.eq('quarter', period);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((r: any) => ({
    serviceCentreId: r.service_centre_id,
    serviceCentreName: r.service_centre_name,
    year: r.year,
    month: r.month,
    quarter: r.quarter,
    stationCount: Number(r.station_count) || 0,
    totalReturnsVolume: Number(r.total_returns_volume_m3) || 0,
    totalSageSalesVolume: Number(r.total_sage_sales_volume_m3) || 0,
    totalEffectiveSalesVolume: Number(r.total_effective_sales_volume_m3) || 0,
  }));
}

export async function fetchCWSalesTargetsByStation(
  scope: ScopeFilter,
  year: number,
  granularity: SalesGranularity,
  period?: number
): Promise<CWSalesTargetStationMetrics[]> {
  const view = viewForCWSalesTargets(granularity, 'station');
  let query = supabase.from(view).select('*').eq('year', year);
  query = applyScopeToQuery(query, scope);

  if (granularity === 'monthly' && period) query = query.eq('month', period);
  if (granularity === 'quarterly' && period) query = query.eq('quarter', period);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((r: any) => ({
    stationId: r.station_id,
    stationName: r.station_name,
    stationType: r.station_type,
    serviceCentreId: r.service_centre_id,
    year: r.year,
    month: r.month,
    quarter: r.quarter,
    targetVolume: Number(r.target_volume_m3) || 0,
  }));
}

export async function fetchCWSalesTargetsBySC(
  scope: ScopeFilter,
  year: number,
  granularity: SalesGranularity,
  period?: number
): Promise<CWSalesTargetSCMetrics[]> {
  const view = viewForCWSalesTargets(granularity, 'sc');
  let query = supabase.from(view).select('*').eq('year', year);
  query = applyScopeToQuery(query, scope);

  if (granularity === 'monthly' && period) query = query.eq('month', period);
  if (granularity === 'quarterly' && period) query = query.eq('quarter', period);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((r: any) => ({
    serviceCentreId: r.service_centre_id,
    serviceCentreName: r.service_centre_name,
    year: r.year,
    month: r.month,
    quarter: r.quarter,
    stationCount: Number(r.station_count) || 0,
    totalTargetVolume: Number(r.total_target_volume_m3) || 0,
  }));
}

export async function fetchCWSalesVsTarget(
  scope: ScopeFilter,
  year: number,
  month: number
): Promise<CWSalesVsTargetMetrics[]> {
  let query = supabase
    .from('v_cw_sales_vs_target_monthly')
    .select('*')
    .eq('year', year)
    .eq('month', month);
  query = applyScopeToQuery(query, scope);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((r: any) => ({
    stationId: r.station_id,
    stationName: r.station_name,
    stationType: r.station_type,
    serviceCentreId: r.service_centre_id,
    year: r.year,
    month: r.month,
    actualVolume: Number(r.actual_volume_m3) || 0,
    targetVolume: Number(r.target_volume_m3) || 0,
    varianceM3: Number(r.variance_m3) || 0,
    achievementPct: r.achievement_pct != null ? Number(r.achievement_pct) : null,
  }));
}

export async function fetchCWSalesSummary(
  scope: ScopeFilter,
  year: number,
  month: number
): Promise<CWSalesSummary> {
  const stations = await fetchCWSalesVsTarget(scope, year, month);

  let totalReturns = 0, totalSage = 0, totalEffective = 0, totalTarget = 0;
  const uniqueStations = new Set<string>();

  for (const s of stations) {
    totalEffective += s.actualVolume;
    totalTarget += s.targetVolume;
    uniqueStations.add(s.stationId);
  }

  const salesByStation = await fetchCWSalesByStation(scope, year, 'monthly', month);
  for (const s of salesByStation) {
    totalReturns += s.returnsVolume;
    totalSage += s.sageSalesVolume;
  }

  const variance = roundTo(totalEffective - totalTarget, 2);
  const achievement = totalTarget > 0 ? roundTo((totalEffective / totalTarget) * 100, 1) : null;

  return {
    totalReturnsVolume: roundTo(totalReturns, 2),
    totalSageSalesVolume: roundTo(totalSage, 2),
    totalEffectiveSalesVolume: roundTo(totalEffective, 2),
    totalTargetVolume: roundTo(totalTarget, 2),
    overallVarianceM3: variance,
    overallAchievementPct: achievement,
    stationCount: uniqueStations.size,
    stations,
  };
}

export async function fetchRWSalesByDam(
  scope: ScopeFilter,
  year: number,
  granularity: SalesGranularity,
  period?: number
): Promise<RWSalesMetrics[]> {
  const view = viewForRWSales(granularity, 'dam');
  let query = supabase.from(view).select('*').eq('year', year);
  query = applyScopeToQuery(query, scope);

  if (granularity === 'monthly' && period) query = query.eq('month', period);
  if (granularity === 'quarterly' && period) query = query.eq('quarter', period);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((r: any) => ({
    damId: r.dam_id,
    damName: r.dam_name,
    serviceCentreId: r.service_centre_id,
    year: r.year,
    month: r.month,
    quarter: r.quarter,
    salesVolume: Number(r.sales_volume_m3) || 0,
  }));
}

export async function fetchRWSalesBySC(
  scope: ScopeFilter,
  year: number,
  granularity: SalesGranularity,
  period?: number
): Promise<RWSalesSCMetrics[]> {
  const view = viewForRWSales(granularity, 'sc');
  let query = supabase.from(view).select('*').eq('year', year);
  query = applyScopeToQuery(query, scope);

  if (granularity === 'monthly' && period) query = query.eq('month', period);
  if (granularity === 'quarterly' && period) query = query.eq('quarter', period);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((r: any) => ({
    serviceCentreId: r.service_centre_id,
    serviceCentreName: r.service_centre_name,
    year: r.year,
    month: r.month,
    quarter: r.quarter,
    damCount: Number(r.dam_count) || 0,
    totalSalesVolume: Number(r.total_sales_volume_m3) || 0,
  }));
}

export async function fetchRWSalesTargetsByDam(
  scope: ScopeFilter,
  year: number,
  granularity: SalesGranularity,
  period?: number
): Promise<RWSalesTargetMetrics[]> {
  const view = viewForRWSalesTargets(granularity, 'dam');
  let query = supabase.from(view).select('*').eq('year', year);
  query = applyScopeToQuery(query, scope);

  if (granularity === 'monthly' && period) query = query.eq('month', period);
  if (granularity === 'quarterly' && period) query = query.eq('quarter', period);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((r: any) => ({
    damId: r.dam_id,
    damName: r.dam_name,
    serviceCentreId: r.service_centre_id,
    year: r.year,
    month: r.month,
    quarter: r.quarter,
    targetVolume: Number(r.target_volume_m3) || 0,
  }));
}

export async function fetchRWSalesTargetsBySC(
  scope: ScopeFilter,
  year: number,
  granularity: SalesGranularity,
  period?: number
): Promise<RWSalesTargetSCMetrics[]> {
  const view = viewForRWSalesTargets(granularity, 'sc');
  let query = supabase.from(view).select('*').eq('year', year);
  query = applyScopeToQuery(query, scope);

  if (granularity === 'monthly' && period) query = query.eq('month', period);
  if (granularity === 'quarterly' && period) query = query.eq('quarter', period);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((r: any) => ({
    serviceCentreId: r.service_centre_id,
    serviceCentreName: r.service_centre_name,
    year: r.year,
    month: r.month,
    quarter: r.quarter,
    damCount: Number(r.dam_count) || 0,
    totalTargetVolume: Number(r.total_target_volume_m3) || 0,
  }));
}

export async function fetchRWSalesVsTarget(
  scope: ScopeFilter,
  year: number,
  month: number
): Promise<RWSalesVsTargetMetrics[]> {
  let query = supabase
    .from('v_rw_sales_vs_target_monthly')
    .select('*')
    .eq('year', year)
    .eq('month', month);
  query = applyScopeToQuery(query, scope);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((r: any) => ({
    damId: r.dam_id,
    damName: r.dam_name,
    serviceCentreId: r.service_centre_id,
    year: r.year,
    month: r.month,
    actualVolume: Number(r.actual_volume_m3) || 0,
    targetVolume: Number(r.target_volume_m3) || 0,
    varianceM3: Number(r.variance_m3) || 0,
    achievementPct: r.achievement_pct != null ? Number(r.achievement_pct) : null,
  }));
}

export async function fetchRWSalesSummary(
  scope: ScopeFilter,
  year: number,
  month: number
): Promise<RWSalesSummary> {
  const dams = await fetchRWSalesVsTarget(scope, year, month);

  let totalSales = 0, totalTarget = 0;
  const uniqueDams = new Set<string>();

  for (const d of dams) {
    totalSales += d.actualVolume;
    totalTarget += d.targetVolume;
    uniqueDams.add(d.damId);
  }

  const variance = roundTo(totalSales - totalTarget, 2);
  const achievement = totalTarget > 0 ? roundTo((totalSales / totalTarget) * 100, 1) : null;

  return {
    totalSalesVolume: roundTo(totalSales, 2),
    totalTargetVolume: roundTo(totalTarget, 2),
    overallVarianceM3: variance,
    overallAchievementPct: achievement,
    damCount: uniqueDams.size,
    dams,
  };
}
