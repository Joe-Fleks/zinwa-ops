import { supabase } from './supabase';
import { ScopeType, getAllowedServiceCentreIds } from './scopeUtils';

export interface ProductionSummary {
  totalVolume: number;
  totalHours: number;
  totalDowntime: number;
  stationCount: number;
  averageEfficiency: number;
}

export interface ScopedQueryOptions {
  scopeType: ScopeType;
  scopeId: string | null;
  allowedServiceCentreIds?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export async function getProductionLogsByScope(options: ScopedQueryOptions) {
  const { scopeType, scopeId, dateFrom, dateTo } = options;

  let query = supabase
    .from('production_logs')
    .select(`
      *,
      stations!inner(
        id,
        station_name,
        service_centre_id
      )
    `);

  if (scopeType === 'SC' && scopeId) {
    query = query.eq('stations.service_centre_id', scopeId);
  } else if (scopeType === 'CATCHMENT' && scopeId) {
    const scIds = await getAllowedServiceCentreIds(scopeType, scopeId);
    if (scIds.length > 0) {
      query = query.in('stations.service_centre_id', scIds);
    }
  }

  if (dateFrom) {
    query = query.gte('date', dateFrom);
  }
  if (dateTo) {
    query = query.lte('date', dateTo);
  }

  query = query.order('date', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching production logs by scope:', error);
    return [];
  }

  return data || [];
}

export async function getStationsByScope(options: ScopedQueryOptions) {
  const { scopeType, scopeId } = options;

  let query = supabase
    .from('stations')
    .select('*')
    .eq('is_active', true);

  if (scopeType === 'SC' && scopeId) {
    query = query.eq('service_centre_id', scopeId);
  } else if (scopeType === 'CATCHMENT' && scopeId) {
    const scIds = await getAllowedServiceCentreIds(scopeType, scopeId);
    if (scIds.length > 0) {
      query = query.in('service_centre_id', scIds);
    }
  }

  query = query.order('station_name');

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching stations by scope:', error);
    return [];
  }

  return data || [];
}

export async function getDamsByScope(options: ScopedQueryOptions) {
  const { scopeType, scopeId } = options;

  let query = supabase
    .from('dams')
    .select('*');

  if (scopeType === 'SC' && scopeId) {
    query = query.eq('service_centre_id', scopeId);
  } else if (scopeType === 'CATCHMENT' && scopeId) {
    const scIds = await getAllowedServiceCentreIds(scopeType, scopeId);
    if (scIds.length > 0) {
      query = query.in('service_centre_id', scIds);
    }
  }

  query = query.order('name');

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching dams by scope:', error);
    return [];
  }

  return data || [];
}

export async function aggregateProductionByScope(options: ScopedQueryOptions): Promise<ProductionSummary> {
  const logs = await getProductionLogsByScope(options);

  if (logs.length === 0) {
    return {
      totalVolume: 0,
      totalHours: 0,
      totalDowntime: 0,
      stationCount: 0,
      averageEfficiency: 0,
    };
  }

  const uniqueStations = new Set(logs.map(l => l.station_id));

  const totalVolume = logs.reduce((sum, l) => sum + (Number(l.cw_volume_m3) || 0), 0);
  const totalHours = logs.reduce((sum, l) => sum + (Number(l.cw_hours_run) || 0), 0);
  const totalDowntime = logs.reduce((sum, l) =>
    sum + (Number(l.load_shedding_hours) || 0) + (Number(l.other_downtime_hours) || 0), 0);

  const potentialHours = logs.length * 24;
  const averageEfficiency = potentialHours > 0 ? ((totalHours / potentialHours) * 100) : 0;

  return {
    totalVolume: Math.round(totalVolume * 100) / 100,
    totalHours: Math.round(totalHours * 100) / 100,
    totalDowntime: Math.round(totalDowntime * 100) / 100,
    stationCount: uniqueStations.size,
    averageEfficiency: Math.round(averageEfficiency * 10) / 10,
  };
}

export function buildScopeFilter(
  scopeType: ScopeType,
  scopeId: string | null,
  allowedServiceCentreIds: string[]
): { field: string; value: string | string[] } | null {
  if (scopeType === 'SC' && scopeId) {
    return { field: 'service_centre_id', value: scopeId };
  }

  if (scopeType === 'CATCHMENT' && allowedServiceCentreIds.length > 0) {
    return { field: 'service_centre_id', value: allowedServiceCentreIds };
  }

  if (scopeType === 'NATIONAL') {
    return null;
  }

  return null;
}
