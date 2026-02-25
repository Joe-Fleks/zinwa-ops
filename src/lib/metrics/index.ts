export { resolveScopeFilter, applyScopeToQuery, fetchStationIdsByScope } from './scopeFilter';

export {
  computeTotalClients,
  computeDowntime,
  computeChemicalBalance,
  computeReceiptTotal,
  computeAvgUsagePerDay,
  computeDaysRemaining,
  isChemicalLowStock,
  isChemicalCriticalStock,
  isStationNonFunctional,
  computeNRWLosses,
  computeProductionEfficiency,
  computeCapacityVariancePct,
  computePumpRate,
  computeCategoryDailyDemand,
} from './coreCalculations';
export type { StationClientFields, NonFunctionalInput, NRWLossResult } from './coreCalculations';

export { fetchProductionSummary, fetchStationProductionMetrics, fetchLabourMetrics } from './productionMetrics';
export type { ProductionSummaryMetrics, StationProductionMetrics, LabourSummaryMetrics, LabourStationMetrics } from './productionMetrics';

export { fetchChemicalStationMetrics, fetchChemicalSummary, fetchChemicalDosageRates } from './chemicalMetrics';
export type { ChemicalStationMetrics, ChemicalSummaryMetrics, ChemicalDosageSummary, ChemicalDosageStation } from './chemicalMetrics';

export { fetchNRWMetrics, fetchNRWByMonth, aggregateNRWByQuarter } from './nrwMetrics';
export type { NRWStationMetrics, NRWSummaryMetrics, NRWMonthResult } from './nrwMetrics';

export {
  fetchNonFunctionalSummary,
  fetchDowntimeByStation,
  fetchCapacityVarianceMetrics,
} from './maintenanceMetrics';
export type {
  NonFunctionalSummary,
  DowntimeStationMetrics,
  CapacityVarianceStationMetrics,
} from './maintenanceMetrics';

export { fetchMonthlyReportData } from './monthlyReportMetrics';
export type {
  MonthlyReportData,
  MonthlyProductionSummary,
  MonthlyStationProduction,
  MonthlySalesSummary,
  MonthlySalesStation,
  MonthlyNRWSummary,
  MonthlyChemicalSummary,
  MonthlyBreakdown,
} from './monthlyReportMetrics';

export { fetchWeeklyReportData } from './weeklyReportMetrics';
export type {
  WeeklyReportData,
  WeeklyProductionSummary,
  WeeklyStationProduction,
  WeeklyBreakdown,
  WeeklyChemicalSummary,
  WeeklyNonFunctionalDay,
  CapacityUtilizationSummary,
  CapacityUtilizationStation,
  PowerSupplySummary,
  PowerSupplyStation,
  ConnectionsSummary,
  ConnectionStation,
} from './weeklyReportMetrics';

export { fetchDemandByStation } from './demandMetrics';
export type { StationDemandRow, DemandSummary } from './demandMetrics';
export { DEMAND_CATEGORY_LABELS } from './demandMetrics';

export {
  fetchCWSalesByStation,
  fetchCWSalesBySC,
  fetchCWSalesTargetsByStation,
  fetchCWSalesTargetsBySC,
  fetchCWSalesVsTarget,
  fetchCWSalesSummary,
  fetchRWSalesByDam,
  fetchRWSalesBySC,
  fetchRWSalesTargetsByDam,
  fetchRWSalesTargetsBySC,
  fetchRWSalesVsTarget,
  fetchRWSalesSummary,
} from './salesMetrics';
export type {
  SalesGranularity,
  CWSalesStationMetrics,
  CWSalesSCMetrics,
  CWSalesTargetStationMetrics,
  CWSalesTargetSCMetrics,
  CWSalesVsTargetMetrics,
  CWSalesSummary,
  RWSalesMetrics,
  RWSalesSCMetrics,
  RWSalesTargetMetrics,
  RWSalesTargetSCMetrics,
  RWSalesVsTargetMetrics,
  RWSalesSummary,
} from './salesMetrics';
