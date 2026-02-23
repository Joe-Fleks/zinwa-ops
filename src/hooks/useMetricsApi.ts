import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const METRICS_API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/metrics-api`;

async function fetchMetricsEndpoint<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const url = new URL(`${METRICS_API_BASE}/${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${response.status}`);
  }

  return response.json();
}

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useMetricsApiQuery<T>(
  endpoint: string,
  params: Record<string, string> = {}
) {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async (overrideParams?: Record<string, string>) => {
    setState({ data: null, loading: true, error: null });
    try {
      const finalParams = { ...params, ...overrideParams };
      const data = await fetchMetricsEndpoint<T>(endpoint, finalParams);
      setState({ data, loading: false, error: null });
      return data;
    } catch (err: any) {
      setState({ data: null, loading: false, error: err.message });
      return null;
    }
  }, [endpoint, JSON.stringify(params)]);

  return { ...state, execute };
}

export function useProductionApi(year?: number, month?: number) {
  const y = String(year || new Date().getFullYear());
  const m = String(month || new Date().getMonth() + 1);
  return useMetricsApiQuery('production', { year: y, month: m });
}

export function useChemicalsApi(chemicalType: string, year?: number, month?: number) {
  const y = String(year || new Date().getFullYear());
  const m = String(month || new Date().getMonth() + 1);
  return useMetricsApiQuery('chemicals', { year: y, month: m, chemical_type: chemicalType });
}

export function useNRWApi(year?: number, month?: number) {
  const y = String(year || new Date().getFullYear());
  const m = String(month || new Date().getMonth() + 1);
  return useMetricsApiQuery('nrw', { year: y, month: m });
}

export function useMaintenanceApi(date?: string) {
  const d = date || new Date().toISOString().split('T')[0];
  return useMetricsApiQuery('maintenance', { date: d });
}

export function useSummaryApi(year?: number, month?: number) {
  const y = String(year || new Date().getFullYear());
  const m = String(month || new Date().getMonth() + 1);
  return useMetricsApiQuery('summary', { year: y, month: m });
}

export function useCWSalesApi(
  year?: number,
  month?: number,
  granularity: string = 'monthly',
  level: string = 'station',
  quarter?: number
) {
  const y = String(year || new Date().getFullYear());
  const m = String(month || new Date().getMonth() + 1);
  const params: Record<string, string> = { year: y, month: m, granularity, level };
  if (quarter) params.quarter = String(quarter);
  return useMetricsApiQuery('cw-sales', params);
}

export function useCWSalesTargetsApi(
  year?: number,
  month?: number,
  granularity: string = 'monthly',
  level: string = 'station',
  quarter?: number
) {
  const y = String(year || new Date().getFullYear());
  const m = String(month || new Date().getMonth() + 1);
  const params: Record<string, string> = { year: y, month: m, granularity, level };
  if (quarter) params.quarter = String(quarter);
  return useMetricsApiQuery('cw-sales-targets', params);
}

export function useCWSalesVsTargetApi(year?: number, month?: number) {
  const y = String(year || new Date().getFullYear());
  const m = String(month || new Date().getMonth() + 1);
  return useMetricsApiQuery('cw-sales-vs-target', { year: y, month: m });
}

export function useRWSalesApi(
  year?: number,
  month?: number,
  granularity: string = 'monthly',
  level: string = 'dam',
  quarter?: number
) {
  const y = String(year || new Date().getFullYear());
  const m = String(month || new Date().getMonth() + 1);
  const params: Record<string, string> = { year: y, month: m, granularity, level };
  if (quarter) params.quarter = String(quarter);
  return useMetricsApiQuery('rw-sales', params);
}

export function useRWSalesTargetsApi(
  year?: number,
  month?: number,
  granularity: string = 'monthly',
  level: string = 'dam',
  quarter?: number
) {
  const y = String(year || new Date().getFullYear());
  const m = String(month || new Date().getMonth() + 1);
  const params: Record<string, string> = { year: y, month: m, granularity, level };
  if (quarter) params.quarter = String(quarter);
  return useMetricsApiQuery('rw-sales-targets', params);
}

export function useRWSalesVsTargetApi(year?: number, month?: number) {
  const y = String(year || new Date().getFullYear());
  const m = String(month || new Date().getMonth() + 1);
  return useMetricsApiQuery('rw-sales-vs-target', { year: y, month: m });
}
