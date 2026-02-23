import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { ScopeFilter, DateRange } from '../lib/metricsConfig';
import { buildMonthDateRange } from '../lib/metricsConfig';
import { resolveScopeFilter } from '../lib/metrics/scopeFilter';
import {
  fetchProductionSummary,
  type ProductionSummaryMetrics,
} from '../lib/metrics/productionMetrics';
import {
  fetchChemicalSummary,
  type ChemicalSummaryMetrics,
} from '../lib/metrics/chemicalMetrics';
import {
  fetchNonFunctionalSummary,
  fetchDowntimeByStation,
  type NonFunctionalSummary,
  type DowntimeStationMetrics,
} from '../lib/metrics/maintenanceMetrics';
import {
  fetchCWSalesSummary,
  fetchCWSalesByStation,
  fetchCWSalesBySC,
  fetchRWSalesSummary,
  fetchRWSalesByDam,
  fetchRWSalesBySC,
  type CWSalesSummary,
  type CWSalesStationMetrics,
  type CWSalesSCMetrics,
  type RWSalesSummary,
  type RWSalesMetrics,
  type RWSalesSCMetrics,
  type SalesGranularity,
} from '../lib/metrics/salesMetrics';

interface MetricsState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useMetricsBase<T>(
  fetcher: (scope: ScopeFilter) => Promise<T>,
  deps: any[] = []
): MetricsState<T> & { refresh: () => void } {
  const { accessContext } = useAuth();
  const [state, setState] = useState<MetricsState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    if (!accessContext) return;

    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const scope = await resolveScopeFilter(
        accessContext.scopeType,
        accessContext.scopeId
      );
      const data = await fetcher(scope);
      setState({ data, loading: false, error: null });
    } catch (err: any) {
      setState({ data: null, loading: false, error: err.message || 'Failed to load metrics' });
    }
  }, [accessContext, ...deps]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refresh: load };
}

export function useProductionMetrics(year: number, month: number) {
  const dateRange = buildMonthDateRange(year, month);
  return useMetricsBase<ProductionSummaryMetrics>(
    (scope) => fetchProductionSummary(scope, dateRange),
    [year, month]
  );
}

export function useProductionMetricsForRange(dateRange: DateRange) {
  return useMetricsBase<ProductionSummaryMetrics>(
    (scope) => fetchProductionSummary(scope, dateRange),
    [dateRange.start, dateRange.end]
  );
}

export function useChemicalMetrics(chemicalType: string, year: number, month: number) {
  return useMetricsBase<ChemicalSummaryMetrics>(
    (scope) => fetchChemicalSummary(scope, chemicalType, year, month),
    [chemicalType, year, month]
  );
}

export function useNonFunctionalMetrics(date: string) {
  return useMetricsBase<NonFunctionalSummary>(
    (scope) => fetchNonFunctionalSummary(scope, date),
    [date]
  );
}

export function useDowntimeMetrics(dateStart: string, dateEnd: string) {
  return useMetricsBase<DowntimeStationMetrics[]>(
    (scope) => fetchDowntimeByStation(scope, dateStart, dateEnd),
    [dateStart, dateEnd]
  );
}

export function useCWSalesSummary(year: number, month: number) {
  return useMetricsBase<CWSalesSummary>(
    (scope) => fetchCWSalesSummary(scope, year, month),
    [year, month]
  );
}

export function useCWSalesByStation(year: number, granularity: SalesGranularity, period?: number) {
  return useMetricsBase<CWSalesStationMetrics[]>(
    (scope) => fetchCWSalesByStation(scope, year, granularity, period),
    [year, granularity, period]
  );
}

export function useCWSalesBySC(year: number, granularity: SalesGranularity, period?: number) {
  return useMetricsBase<CWSalesSCMetrics[]>(
    (scope) => fetchCWSalesBySC(scope, year, granularity, period),
    [year, granularity, period]
  );
}

export function useRWSalesSummary(year: number, month: number) {
  return useMetricsBase<RWSalesSummary>(
    (scope) => fetchRWSalesSummary(scope, year, month),
    [year, month]
  );
}

export function useRWSalesByDam(year: number, granularity: SalesGranularity, period?: number) {
  return useMetricsBase<RWSalesMetrics[]>(
    (scope) => fetchRWSalesByDam(scope, year, granularity, period),
    [year, granularity, period]
  );
}

export function useRWSalesBySC(year: number, granularity: SalesGranularity, period?: number) {
  return useMetricsBase<RWSalesSCMetrics[]>(
    (scope) => fetchRWSalesBySC(scope, year, granularity, period),
    [year, granularity, period]
  );
}
