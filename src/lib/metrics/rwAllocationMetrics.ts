import { supabase } from '../supabase';
import type { ScopeFilter } from '../metricsConfig';
import { roundTo } from '../metricsConfig';
import { applyScopeToQuery } from './scopeFilter';

export interface RWAllocationMonthly {
  damId: string;
  damName: string;
  serviceCentreId: string;
  year: number;
  month: number;
  allocationVolume: number;
}

export interface RWAllocationVsSales {
  damId: string;
  damName: string;
  serviceCentreId: string;
  year: number;
  month: number;
  allocationVolume: number;
  salesVolume: number;
}

interface RawAllocation {
  allocation_id: string;
  source: string | null;
  water_allocated_ml: number;
  agreement_start_date: string | null;
  agreement_expiry_date: string | null;
  agreement_length_months: number | null;
  service_centre_id: string | null;
}

interface DamRecord {
  id: string;
  name: string;
  service_centre_id: string | null;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function isAllocationActiveInMonth(
  startDate: string | null,
  expiryDate: string | null,
  year: number,
  month: number
): boolean {
  if (!startDate || !expiryDate) return false;

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const allocStart = new Date(startDate + 'T00:00:00');
  const allocEnd = new Date(expiryDate + 'T00:00:00');

  return allocStart <= monthEnd && allocEnd >= monthStart;
}

function computeMonthlyAllocation(
  waterAllocatedMl: number,
  agreementLengthMonths: number | null,
  startDate: string | null,
  expiryDate: string | null
): number {
  if (!startDate || !expiryDate) return 0;
  if (waterAllocatedMl <= 0) return 0;

  let months = agreementLengthMonths;
  if (!months || months <= 0) {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(expiryDate + 'T00:00:00');
    months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
    if (months <= 0) return 0;
  }

  return waterAllocatedMl / months;
}

export async function fetchRWAllocationsByDamMonthly(
  scope: ScopeFilter,
  year: number,
  months: number[]
): Promise<RWAllocationMonthly[]> {
  let damsQuery = supabase
    .from('dams')
    .select('id, name, service_centre_id');
  damsQuery = applyScopeToQuery(damsQuery, scope);
  const { data: damsData, error: damsErr } = await damsQuery;
  if (damsErr) throw damsErr;

  const dams: DamRecord[] = (damsData || []).map((d: any) => ({
    id: d.id,
    name: d.name,
    service_centre_id: d.service_centre_id,
  }));

  const damNameToRecord = new Map<string, DamRecord>();
  for (const dam of dams) {
    damNameToRecord.set(dam.name.toLowerCase(), dam);
  }

  const { data: allocData, error: allocErr } = await supabase
    .from('rw_allocations')
    .select('allocation_id, source, water_allocated_ml, agreement_start_date, agreement_expiry_date, agreement_length_months, service_centre_id');
  if (allocErr) throw allocErr;

  const allocations: RawAllocation[] = (allocData || []).filter(
    (a: any) => a.source && a.source.trim() !== ''
  );

  const results: RWAllocationMonthly[] = [];

  for (const month of months) {
    const damTotals = new Map<string, number>();

    for (const alloc of allocations) {
      if (!alloc.source) continue;

      const dam = damNameToRecord.get(alloc.source.toLowerCase());
      if (!dam) continue;

      if (!isAllocationActiveInMonth(alloc.agreement_start_date, alloc.agreement_expiry_date, year, month)) {
        continue;
      }

      const monthlyAlloc = computeMonthlyAllocation(
        Number(alloc.water_allocated_ml) || 0,
        alloc.agreement_length_months,
        alloc.agreement_start_date,
        alloc.agreement_expiry_date
      );

      const current = damTotals.get(dam.id) || 0;
      damTotals.set(dam.id, current + monthlyAlloc);
    }

    for (const dam of dams) {
      const volume = damTotals.get(dam.id) || 0;
      results.push({
        damId: dam.id,
        damName: dam.name,
        serviceCentreId: dam.service_centre_id || '',
        year,
        month,
        allocationVolume: roundTo(volume, 2),
      });
    }
  }

  return results;
}

export function computeWeeklyAllocation(
  monthlyAllocation: number,
  year: number,
  month: number,
  weekStartDate: string,
  weekEndDate: string
): number {
  const daysInMonth = getDaysInMonth(year, month);
  const dailyAllocation = monthlyAllocation / daysInMonth;

  const weekStart = new Date(weekStartDate + 'T00:00:00');
  const weekEnd = new Date(weekEndDate + 'T00:00:00');
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);

  const overlapStart = weekStart > monthStart ? weekStart : monthStart;
  const overlapEnd = weekEnd < monthEnd ? weekEnd : monthEnd;

  if (overlapStart > overlapEnd) return 0;

  const overlapDays = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  return roundTo(dailyAllocation * overlapDays, 2);
}

export interface RWDamYTDAllocation {
  damId: string;
  damName: string;
  damCode: string | null;
  ytdAllocationVolume: number;
  agreementCount: number;
}

export async function fetchRWDamYTDAllocations(
  scope: ScopeFilter,
  year: number,
  throughMonth: number
): Promise<RWDamYTDAllocation[]> {
  const months = Array.from({ length: throughMonth }, (_, i) => i + 1);
  const monthlyData = await fetchRWAllocationsByDamMonthly(scope, year, months);

  let damsQuery = supabase.from('dams').select('id, name, dam_code');
  damsQuery = applyScopeToQuery(damsQuery, scope);
  const { data: damsData } = await damsQuery;
  const damCodeMap = new Map<string, string | null>();
  const damNameMap = new Map<string, string>();
  for (const d of (damsData || [])) {
    damCodeMap.set(d.id, d.dam_code);
    damNameMap.set(d.name.toLowerCase(), d.id);
  }

  const { data: allocData } = await supabase
    .from('rw_allocations')
    .select('allocation_id, source, agreement_start_date, agreement_expiry_date');

  const yearStart = new Date(year, 0, 1);
  const ytdEnd = new Date(year, throughMonth, 0);
  const agreementCountMap = new Map<string, number>();
  for (const alloc of (allocData || [])) {
    if (!alloc.source || !alloc.agreement_start_date || !alloc.agreement_expiry_date) continue;
    const start = new Date(alloc.agreement_start_date + 'T00:00:00');
    const expiry = new Date(alloc.agreement_expiry_date + 'T00:00:00');
    if (start > ytdEnd || expiry < yearStart) continue;

    const damId = damNameMap.get(alloc.source.toLowerCase());
    if (!damId) continue;
    agreementCountMap.set(damId, (agreementCountMap.get(damId) || 0) + 1);
  }

  const totals = new Map<string, { name: string; volume: number }>();
  for (const row of monthlyData) {
    const existing = totals.get(row.damId);
    if (existing) {
      existing.volume += row.allocationVolume;
    } else {
      totals.set(row.damId, { name: row.damName, volume: row.allocationVolume });
    }
  }

  const results: RWDamYTDAllocation[] = [];
  for (const [damId, val] of totals) {
    if (val.volume > 0) {
      results.push({
        damId,
        damName: val.name,
        damCode: damCodeMap.get(damId) || null,
        ytdAllocationVolume: roundTo(val.volume, 2),
        agreementCount: agreementCountMap.get(damId) || 0,
      });
    }
  }

  return results.sort((a, b) => a.damName.localeCompare(b.damName));
}

export interface RWMonthlyDamReport {
  damId: string;
  damName: string;
  damCode: string | null;
  allocationVolume: number;
  salesVolume: number;
  agreementCount: number;
}

export interface RWAgreementStats {
  totalActiveInYear: number;
  expiredInMonth: number;
  expiringNextMonth: number;
  currentlyActive: number;
}

export async function fetchRWMonthlyDamReport(
  scope: ScopeFilter,
  year: number,
  month: number
): Promise<RWMonthlyDamReport[]> {
  const vsSales = await fetchRWAllocationVsSales(scope, year, [month]);

  let damsQuery = supabase.from('dams').select('id, name, dam_code');
  damsQuery = applyScopeToQuery(damsQuery, scope);
  const { data: damsData } = await damsQuery;
  const damCodeMap = new Map<string, string | null>();
  const damNameMap = new Map<string, string>();
  for (const d of (damsData || [])) {
    damCodeMap.set(d.id, d.dam_code);
    damNameMap.set(d.name.toLowerCase(), d.id);
  }

  const { data: allocData } = await supabase
    .from('rw_allocations')
    .select('allocation_id, source, agreement_start_date, agreement_expiry_date');

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const agreementCountMap = new Map<string, number>();
  for (const alloc of (allocData || [])) {
    if (!alloc.source || !alloc.agreement_start_date || !alloc.agreement_expiry_date) continue;
    const start = new Date(alloc.agreement_start_date + 'T00:00:00');
    const expiry = new Date(alloc.agreement_expiry_date + 'T00:00:00');
    if (start > monthEnd || expiry < monthStart) continue;

    const damId = damNameMap.get(alloc.source.toLowerCase());
    if (!damId) continue;
    agreementCountMap.set(damId, (agreementCountMap.get(damId) || 0) + 1);
  }

  return vsSales
    .filter(r => r.allocationVolume > 0 || r.salesVolume > 0)
    .map(r => ({
      damId: r.damId,
      damName: r.damName,
      damCode: damCodeMap.get(r.damId) || null,
      allocationVolume: r.allocationVolume,
      salesVolume: r.salesVolume,
      agreementCount: agreementCountMap.get(r.damId) || 0,
    }))
    .sort((a, b) => a.damName.localeCompare(b.damName));
}

export async function fetchRWAgreementStats(
  scope: ScopeFilter,
  year: number,
  month: number
): Promise<RWAgreementStats> {
  let damsQuery = supabase.from('dams').select('id, name');
  damsQuery = applyScopeToQuery(damsQuery, scope);
  const { data: damsData } = await damsQuery;
  const damNames = new Set((damsData || []).map((d: any) => d.name.toLowerCase()));

  const { data: allocData, error: allocErr } = await supabase
    .from('rw_allocations')
    .select('allocation_id, source, agreement_start_date, agreement_expiry_date');
  if (allocErr) throw allocErr;

  const allocs = (allocData || []).filter(
    (a: any) => a.source && damNames.has(a.source.toLowerCase())
  );

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const nextMonthStart = new Date(year, month, 1);
  const nextMonthEnd = new Date(year, month + 1, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let totalActiveInYear = 0;
  let expiredInMonth = 0;
  let expiringNextMonth = 0;
  let currentlyActive = 0;

  for (const alloc of allocs) {
    if (!alloc.agreement_start_date || !alloc.agreement_expiry_date) continue;
    const start = new Date(alloc.agreement_start_date + 'T00:00:00');
    const expiry = new Date(alloc.agreement_expiry_date + 'T00:00:00');
    const yStart = new Date(yearStart + 'T00:00:00');
    const yEnd = new Date(yearEnd + 'T00:00:00');

    if (start <= yEnd && expiry >= yStart) {
      totalActiveInYear++;
    }

    if (expiry >= monthStart && expiry <= monthEnd) {
      expiredInMonth++;
    }

    if (expiry >= nextMonthStart && expiry <= nextMonthEnd) {
      expiringNextMonth++;
    }

    if (start <= today && expiry >= today) {
      currentlyActive++;
    }
  }

  return { totalActiveInYear, expiredInMonth, expiringNextMonth, currentlyActive };
}

export async function fetchRWAllocationVsSales(
  scope: ScopeFilter,
  year: number,
  months: number[]
): Promise<RWAllocationVsSales[]> {
  const allocations = await fetchRWAllocationsByDamMonthly(scope, year, months);

  const salesByDamMonth = new Map<string, number>();

  for (const month of months) {
    const monthKey = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][month - 1];

    let salesQuery = supabase
      .from('rw_sales_data')
      .select(`dam_id, ${monthKey}`)
      .eq('year', year);
    salesQuery = applyScopeToQuery(salesQuery, scope);

    const { data: salesData, error: salesErr } = await salesQuery;
    if (salesErr) throw salesErr;

    for (const row of (salesData || [])) {
      const key = `${row.dam_id}-${month}`;
      salesByDamMonth.set(key, Number((row as any)[monthKey]) || 0);
    }
  }

  return allocations.map(a => {
    const key = `${a.damId}-${a.month}`;
    return {
      ...a,
      salesVolume: roundTo(salesByDamMonth.get(key) || 0, 2),
    };
  });
}
