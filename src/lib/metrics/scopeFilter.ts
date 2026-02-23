import { supabase } from '../supabase';
import type { ScopeFilter } from '../metricsConfig';
import { getAllowedServiceCentreIds } from '../scopeUtils';
import type { ScopeType } from '../scopeUtils';

export async function resolveScopeFilter(
  scopeType: ScopeType,
  scopeId: string | null
): Promise<ScopeFilter> {
  const allowedServiceCentreIds = await getAllowedServiceCentreIds(scopeType, scopeId);
  return { scopeType, scopeId, allowedServiceCentreIds };
}

export function applyScopeToQuery(
  query: any,
  scope: ScopeFilter,
  scField: string = 'service_centre_id'
): any {
  if (scope.scopeType === 'SC' && scope.scopeId) {
    return query.eq(scField, scope.scopeId);
  }
  if (
    (scope.scopeType === 'CATCHMENT' || scope.scopeType === 'NATIONAL') &&
    scope.allowedServiceCentreIds.length > 0
  ) {
    return query.in(scField, scope.allowedServiceCentreIds);
  }
  return query;
}

export async function fetchStationIdsByScope(
  scope: ScopeFilter,
  stationType?: string
): Promise<string[]> {
  let query = supabase.from('stations').select('id, service_centre_id');

  if (stationType) {
    query = query.eq('station_type', stationType);
  }

  query = applyScopeToQuery(query, scope);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((s: any) => s.id);
}
