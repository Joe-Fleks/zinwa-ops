import { supabase } from '../supabase';
import type { ScopeFilter } from '../metricsConfig';
import { roundTo } from '../metricsConfig';
import { applyScopeToQuery } from './scopeFilter';

const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;

export interface RWNRWDamMetrics {
  damId: string;
  damName: string;
  damCode: string | null;
  fullSupplyCapacityMl: number;
  openingLevelMl: number | null;
  closingLevelMl: number | null;
  changeMl: number | null;
  rwSalesMl: number;
  nrwVolumeMl: number | null;
  nrwPct: number | null;
  hasCompleteData: boolean;
  agreementCount: number;
}

export interface RWNRWSummaryMetrics {
  totalOpeningMl: number;
  totalClosingMl: number;
  totalChangeMl: number;
  totalRWSalesMl: number;
  totalNRWVolumeMl: number;
  nrwPct: number | null;
  damsWithData: number;
  totalDams: number;
  totalAgreements: number;
  dams: RWNRWDamMetrics[];
}

export async function fetchRWNRWMetrics(
  scope: ScopeFilter,
  year: number,
  month: number
): Promise<RWNRWSummaryMetrics> {
  let damsQuery = supabase
    .from('dams')
    .select('id, dam_code, name, full_supply_capacity_ml, service_centre_id')
    .not('full_supply_capacity_ml', 'is', null)
    .gt('full_supply_capacity_ml', 0)
    .order('name');

  damsQuery = applyScopeToQuery(damsQuery, scope);
  const { data: damsData, error: damsErr } = await damsQuery;
  if (damsErr) throw damsErr;

  const dams = damsData || [];
  if (dams.length === 0) return emptyRWNRWSummary();

  const damIds = dams.map((d: any) => d.id);

  const { data: levelsData, error: levelsErr } = await supabase
    .from('dam_monthly_levels')
    .select('dam_id, opening_level_ml, closing_level_ml')
    .in('dam_id', damIds)
    .eq('year', year)
    .eq('month', month);
  if (levelsErr) throw levelsErr;

  const needsPrevMonth = (levelsData || []).some(r => r.opening_level_ml === null);
  let prevClosingMap = new Map<string, number>();
  if (needsPrevMonth) {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const { data: prevData } = await supabase
      .from('dam_monthly_levels')
      .select('dam_id, closing_level_ml')
      .in('dam_id', damIds)
      .eq('year', prevYear)
      .eq('month', prevMonth);
    for (const row of (prevData || [])) {
      if (row.closing_level_ml !== null) {
        prevClosingMap.set(row.dam_id, Number(row.closing_level_ml));
      }
    }
  }

  const levelsMap = new Map<string, { opening: number | null; closing: number | null }>();
  for (const row of (levelsData || [])) {
    const opening = row.opening_level_ml !== null
      ? Number(row.opening_level_ml)
      : prevClosingMap.get(row.dam_id) ?? null;
    levelsMap.set(row.dam_id, {
      opening,
      closing: row.closing_level_ml !== null ? Number(row.closing_level_ml) : null,
    });
  }

  const monthKey = MONTH_KEYS[month - 1];
  let salesQuery = supabase
    .from('rw_sales_data')
    .select(`dam_id, ${monthKey}`)
    .in('dam_id', damIds)
    .eq('year', year);

  const { data: salesData, error: salesErr } = await salesQuery;
  if (salesErr) throw salesErr;

  const salesMap = new Map<string, number>();
  for (const row of (salesData || [])) {
    const vol = Number((row as any)[monthKey]) || 0;
    salesMap.set(row.dam_id, vol);
  }

  const { data: allocData, error: allocErr } = await supabase
    .from('rw_allocations')
    .select('allocation_id, source, agreement_start_date, agreement_expiry_date');
  if (allocErr) throw allocErr;

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);

  const agreementCountMap = new Map<string, number>();
  for (const alloc of (allocData || [])) {
    if (!alloc.source || !alloc.agreement_start_date || !alloc.agreement_expiry_date) continue;
    const start = new Date(alloc.agreement_start_date + 'T00:00:00');
    const expiry = new Date(alloc.agreement_expiry_date + 'T00:00:00');
    if (start > monthEnd || expiry < monthStart) continue;

    const damMatch = dams.find((d: any) => d.name.toLowerCase() === alloc.source.toLowerCase());
    if (!damMatch) continue;

    agreementCountMap.set(damMatch.id, (agreementCountMap.get(damMatch.id) || 0) + 1);
  }

  const damMetrics: RWNRWDamMetrics[] = dams.map((dam: any) => {
    const levels = levelsMap.get(dam.id);
    const opening = levels?.opening ?? null;
    const closing = levels?.closing ?? null;
    const rwSales = salesMap.get(dam.id) || 0;
    const fsc = Number(dam.full_supply_capacity_ml);

    let changeMl: number | null = null;
    let nrwVolumeMl: number | null = null;
    let nrwPct: number | null = null;
    const hasCompleteData = opening !== null && closing !== null;

    if (hasCompleteData) {
      changeMl = opening! - closing!;
      nrwVolumeMl = changeMl - rwSales;
      if (changeMl > 0) {
        nrwPct = roundTo((nrwVolumeMl / changeMl) * 100, 1);
      } else if (changeMl === 0 && rwSales === 0) {
        nrwPct = 0;
      } else {
        nrwPct = null;
      }
    }

    return {
      damId: dam.id,
      damName: dam.name,
      damCode: dam.dam_code,
      fullSupplyCapacityMl: fsc,
      openingLevelMl: opening,
      closingLevelMl: closing,
      changeMl,
      rwSalesMl: rwSales,
      nrwVolumeMl,
      nrwPct,
      hasCompleteData,
      agreementCount: agreementCountMap.get(dam.id) || 0,
    };
  });

  const completeDams = damMetrics.filter(d => d.hasCompleteData);

  if (completeDams.length === 0) {
    return {
      ...emptyRWNRWSummary(),
      totalDams: dams.length,
      dams: damMetrics,
    };
  }

  const totalOpening = completeDams.reduce((s, d) => s + (d.openingLevelMl || 0), 0);
  const totalClosing = completeDams.reduce((s, d) => s + (d.closingLevelMl || 0), 0);
  const totalChange = totalOpening - totalClosing;
  const totalSales = completeDams.reduce((s, d) => s + d.rwSalesMl, 0);
  const totalNRW = totalChange - totalSales;

  let overallPct: number | null = null;
  if (totalChange > 0) {
    overallPct = roundTo((totalNRW / totalChange) * 100, 1);
  } else if (totalChange === 0 && totalSales === 0) {
    overallPct = 0;
  }

  const totalAgreements = damMetrics.reduce((s, d) => s + d.agreementCount, 0);

  return {
    totalOpeningMl: totalOpening,
    totalClosingMl: totalClosing,
    totalChangeMl: totalChange,
    totalRWSalesMl: totalSales,
    totalNRWVolumeMl: totalNRW,
    nrwPct: overallPct,
    damsWithData: completeDams.length,
    totalDams: dams.length,
    totalAgreements,
    dams: damMetrics,
  };
}

export async function fetchRWNRWByMonth(
  scope: ScopeFilter,
  year: number,
  months: number[]
): Promise<Map<number, RWNRWSummaryMetrics>> {
  const result = new Map<number, RWNRWSummaryMetrics>();

  for (const month of months) {
    const metrics = await fetchRWNRWMetrics(scope, year, month);
    result.set(month, metrics);
  }

  return result;
}

function emptyRWNRWSummary(): RWNRWSummaryMetrics {
  return {
    totalOpeningMl: 0,
    totalClosingMl: 0,
    totalChangeMl: 0,
    totalRWSalesMl: 0,
    totalNRWVolumeMl: 0,
    nrwPct: null,
    damsWithData: 0,
    totalDams: 0,
    totalAgreements: 0,
    dams: [],
  };
}
