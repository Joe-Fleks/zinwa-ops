import { supabase } from './supabase';
import { fetchAllRows, applyScopeToQuery } from './metrics/scopeFilter';
import type { ScopeFilter, DateRange } from './metricsConfig';

export interface ProductionLogRow {
  station_id: string;
  date: string;
  cw_volume_m3: number;
  rw_volume_m3: number;
  cw_hours_run: number;
  rw_hours_run: number;
  load_shedding_hours: number;
  other_downtime_hours: number;
  alum_kg: number;
  hth_kg: number;
  activated_carbon_kg: number;
  new_connections: number;
  new_connection_category: string | null;
  reason_for_downtime: string | null;
}

export interface SalesRecordRow {
  station_id: string;
  year: number;
  month: number;
  sage_sales_volume_m3: number;
  returns_volume_m3: number;
}

export interface TargetRow {
  station_id: string;
  year?: number;
  service_centre_id?: string;
  jan: number;
  feb: number;
  mar: number;
  apr: number;
  may: number;
  jun: number;
  jul: number;
  aug: number;
  sep: number;
  oct: number;
  nov: number;
  dec: number;
}

export interface StationRow {
  id: string;
  station_name: string;
  service_centre_id: string;
}

export async function queryProductionLogs(opts: {
  stationIds: string[];
  dateRange: DateRange;
  fields?: string[];
  orderBy?: string;
  dateEndInclusive?: boolean;
  filters?: Record<string, { op: 'gt' | 'gte' | 'lte' | 'lt' | 'eq'; value: any }>;
}): Promise<any[]> {
  if (opts.stationIds.length === 0) return [];

  const selectFields = opts.fields
    ? opts.fields.join(', ')
    : 'station_id, date, cw_volume_m3, rw_volume_m3, cw_hours_run, rw_hours_run, load_shedding_hours, other_downtime_hours';

  let query = supabase
    .from('production_logs')
    .select(selectFields)
    .in('station_id', opts.stationIds)
    .gte('date', opts.dateRange.start);

  if (opts.dateEndInclusive) {
    query = query.lte('date', opts.dateRange.end);
  } else {
    query = query.lt('date', opts.dateRange.end);
  }

  if (opts.filters) {
    for (const [field, filter] of Object.entries(opts.filters)) {
      switch (filter.op) {
        case 'gt': query = query.gt(field, filter.value); break;
        case 'gte': query = query.gte(field, filter.value); break;
        case 'lte': query = query.lte(field, filter.value); break;
        case 'lt': query = query.lt(field, filter.value); break;
        case 'eq': query = query.eq(field, filter.value); break;
      }
    }
  }

  if (opts.orderBy) {
    query = query.order(opts.orderBy, { ascending: true });
  }

  return fetchAllRows(query);
}

export async function queryProductionLogsByDateLte(opts: {
  stationIds: string[];
  dateStart: string;
  dateEnd: string;
  fields?: string[];
}): Promise<any[]> {
  if (opts.stationIds.length === 0) return [];

  const selectFields = opts.fields
    ? opts.fields.join(', ')
    : 'station_id, date, cw_volume_m3';

  const query = supabase
    .from('production_logs')
    .select(selectFields)
    .in('station_id', opts.stationIds)
    .gte('date', opts.dateStart)
    .lte('date', opts.dateEnd);

  return fetchAllRows(query);
}

export async function queryProductionLogsByScope(opts: {
  scope: ScopeFilter;
  dateRange: DateRange;
  fields: string;
  joinStations?: boolean;
  dateEndInclusive?: boolean;
}): Promise<any[]> {
  const stationSelect = opts.joinStations
    ? ', stations!inner(station_name, service_centre_id)'
    : ', stations!inner(service_centre_id)';

  let query = supabase
    .from('production_logs')
    .select(opts.fields + stationSelect)
    .gte('date', opts.dateRange.start);

  if (opts.dateEndInclusive) {
    query = query.lte('date', opts.dateRange.end);
  } else {
    query = query.lt('date', opts.dateRange.end);
  }

  query = applyScopeToQuery(query, opts.scope, 'stations.service_centre_id');

  return fetchAllRows(query);
}

export async function querySalesRecords(opts: {
  stationIds: string[];
  year: number;
  months: number[];
  fields?: string[];
}): Promise<any[]> {
  if (opts.stationIds.length === 0) return [];

  const selectFields = opts.fields
    ? opts.fields.join(', ')
    : 'station_id, year, month, sage_sales_volume_m3, returns_volume_m3';

  let query = supabase
    .from('sales_records')
    .select(selectFields)
    .in('station_id', opts.stationIds)
    .eq('year', opts.year);

  if (opts.months.length === 1) {
    query = query.eq('month', opts.months[0]);
  } else if (opts.months.length > 1) {
    const minMonth = Math.min(...opts.months);
    const maxMonth = Math.max(...opts.months);
    query = query.gte('month', minMonth).lte('month', maxMonth);
  }

  return fetchAllRows(query);
}

export async function querySalesRecordsByScope(opts: {
  scope: ScopeFilter;
  year: number;
  monthStart: number;
  monthEnd: number;
  fields?: string[];
  scopeMode?: 'station' | 'sc';
  stationId?: string;
}): Promise<any[]> {
  const selectFields = opts.fields
    ? opts.fields.join(', ')
    : 'station_id, year, month, sage_sales_volume_m3, returns_volume_m3';

  if (opts.scopeMode === 'station' && opts.stationId) {
    return fetchAllRows(
      supabase
        .from('sales_records')
        .select(selectFields)
        .eq('station_id', opts.stationId)
        .eq('year', opts.year)
        .gte('month', opts.monthStart)
        .lte('month', opts.monthEnd)
    );
  }

  let query = supabase
    .from('sales_records')
    .select(selectFields + ', stations!inner(service_centre_id)')
    .eq('year', opts.year)
    .gte('month', opts.monthStart)
    .lte('month', opts.monthEnd);

  if (opts.scope.scopeType === 'SC' && opts.scope.scopeId) {
    query = query.eq('stations.service_centre_id', opts.scope.scopeId);
  }

  return fetchAllRows(query);
}

export async function queryProductionTargets(opts: {
  stationIds: string[];
  year: number;
  targetType: 'production' | 'sales';
}): Promise<any[]> {
  if (opts.stationIds.length === 0) return [];

  const tableName = opts.targetType === 'production'
    ? 'cw_production_targets'
    : 'cw_sales_targets';

  return fetchAllRows(
    supabase
      .from(tableName)
      .select('station_id, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec')
      .in('station_id', opts.stationIds)
      .eq('year', opts.year)
  );
}

export async function queryProductionTargetsByScope(opts: {
  scope: ScopeFilter;
  targetType: 'production' | 'sales';
  stationId?: string;
}): Promise<any[]> {
  const tableName = opts.targetType === 'production'
    ? 'cw_production_targets'
    : 'cw_sales_targets';

  if (opts.stationId) {
    return fetchAllRows(
      supabase
        .from(tableName)
        .select('jan,feb,mar,apr,may,jun,jul,aug,sep,oct,nov,dec')
        .eq('station_id', opts.stationId)
    );
  }

  let query = supabase
    .from(tableName)
    .select('jan,feb,mar,apr,may,jun,jul,aug,sep,oct,nov,dec');

  if (opts.scope.scopeType === 'SC' && opts.scope.scopeId) {
    query = query.eq('service_centre_id', opts.scope.scopeId);
  }

  return fetchAllRows(query);
}

export async function queryStationsByScope(opts: {
  scope: ScopeFilter;
  fields?: string;
  stationId?: string;
  orderBy?: string;
}): Promise<any[]> {
  const selectFields = opts.fields || 'id, station_name, service_centre_id';

  let query = supabase
    .from('stations')
    .select(selectFields);

  if (opts.stationId) {
    query = query.eq('id', opts.stationId);
  } else {
    query = applyScopeToQuery(query, opts.scope);
  }

  if (opts.orderBy) {
    query = query.order(opts.orderBy);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function queryStationIdsByScope(opts: {
  scope: ScopeFilter;
  isSCScoped?: boolean;
  scopeId?: string | null;
}): Promise<string[]> {
  let q = supabase.from('stations').select('id');
  if (opts.isSCScoped && opts.scopeId) {
    q = q.eq('service_centre_id', opts.scopeId);
  } else {
    q = applyScopeToQuery(q, opts.scope);
  }
  const { data } = await q;
  return (data || []).map((s: { id: string }) => s.id);
}

export async function queryBreakdowns(opts: {
  stationIds: string[];
  dateReportedLte: string;
  unresolvedOnly?: boolean;
  fields?: string[];
}): Promise<any[]> {
  if (opts.stationIds.length === 0) return [];

  const selectFields = opts.fields
    ? opts.fields.join(', ')
    : 'station_id, nature_of_breakdown, description, date_reported, is_resolved, date_resolved, breakdown_impact, hours_lost';

  let query = supabase
    .from('station_breakdowns')
    .select(selectFields)
    .in('station_id', opts.stationIds)
    .lte('date_reported', opts.dateReportedLte);

  if (opts.unresolvedOnly) {
    query = query.eq('is_resolved', false);
  }

  return fetchAllRows(query);
}

export async function queryStoppedBreakdowns(opts: {
  stationIds: string[];
  date: string;
}): Promise<any[]> {
  if (opts.stationIds.length === 0) return [];

  return fetchAllRows(
    supabase
      .from('station_breakdowns')
      .select('station_id')
      .in('station_id', opts.stationIds)
      .eq('breakdown_impact', 'Stopped pumping')
      .eq('is_resolved', false)
      .lte('date_reported', opts.date)
  );
}

export async function queryProductionLogsForDate(opts: {
  stationIds: string[];
  date: string;
  fields?: string[];
}): Promise<any[]> {
  if (opts.stationIds.length === 0) return [];

  const selectFields = opts.fields
    ? opts.fields.join(', ')
    : 'station_id, cw_volume_m3, cw_hours_run, load_shedding_hours, other_downtime_hours';

  return fetchAllRows(
    supabase
      .from('production_logs')
      .select(selectFields)
      .in('station_id', opts.stationIds)
      .eq('date', opts.date)
  );
}

export async function queryChemicalBalances(opts: {
  stationIds: string[];
  chemicalTypes: string[];
  year?: number;
  month?: number;
}): Promise<any[]> {
  if (opts.stationIds.length === 0) return [];

  let query = supabase
    .from('chemical_stock_balances')
    .select('station_id, chemical_type, opening_balance, year, month')
    .in('station_id', opts.stationIds)
    .in('chemical_type', opts.chemicalTypes);

  if (opts.year !== undefined) query = query.eq('year', opts.year);
  if (opts.month !== undefined) query = query.eq('month', opts.month);

  return fetchAllRows(query);
}

export async function queryChemicalReceipts(opts: {
  stationIds: string[];
  chemicalTypes: string[];
  year?: number;
  month?: number;
}): Promise<any[]> {
  if (opts.stationIds.length === 0) return [];

  let query = supabase
    .from('chemical_stock_receipts')
    .select('station_id, chemical_type, quantity, receipt_type, year, month')
    .in('station_id', opts.stationIds)
    .in('chemical_type', opts.chemicalTypes);

  if (opts.year !== undefined) query = query.eq('year', opts.year);
  if (opts.month !== undefined) query = query.eq('month', opts.month);

  return fetchAllRows(query);
}

export async function queryFuelControlCards(opts: {
  fuelType: string;
  year: number;
  month?: number;
  serviceCentreId?: string | null;
  dateStart?: string;
  dateEnd?: string;
  fields?: string;
}): Promise<any[]> {
  const selectFields = opts.fields || 'entry_date, is_opening_balance, receipts, issues, balance, sort_order, month';

  let query = supabase
    .from('fuel_control_cards')
    .select(selectFields)
    .eq('fuel_type', opts.fuelType);

  if (opts.dateStart && opts.dateEnd) {
    query = query.gte('entry_date', opts.dateStart).lte('entry_date', opts.dateEnd);
  } else {
    query = query.eq('year', opts.year);
    if (opts.month !== undefined) query = query.eq('month', opts.month);
  }

  query = query.order('entry_date', { ascending: true }).order('sort_order', { ascending: true });

  if (opts.serviceCentreId) query = query.eq('service_centre_id', opts.serviceCentreId);

  return fetchAllRows(query);
}
