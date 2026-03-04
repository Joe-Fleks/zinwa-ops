import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Search, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AccessContext } from '../../lib/scopeUtils';
import { fetchRWAllocationsByDamMonthly } from '../../lib/metrics';
import type { ScopeFilter } from '../../lib/metricsConfig';

type ViewMode = 'quarter' | 'year';
type ScopeMode = 'sc' | 'dam';
type TrendType = 'sales' | 'allocations-vs-sales';

interface ChartBar {
  label: string;
  sublabel?: string;
  actual: number;
  target: number;
}

interface DualBar {
  allocLabel: string;
  salesLabel: string;
  allocation: number;
  sales: number;
}

interface Dam {
  id: string;
  name: string;
  service_centre_id: string | null;
}

interface Props {
  accessContext: AccessContext | null;
}

const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const QUARTER_LABELS = ['Q1 (Jan - Mar)', 'Q2 (Apr - Jun)', 'Q3 (Jul - Sep)', 'Q4 (Oct - Dec)'];

export default function RWTrendChart({ accessContext }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('quarter');
  const [scopeMode, setScopeMode] = useState<ScopeMode>('sc');
  const [trendType, setTrendType] = useState<TrendType>('sales');
  const [showTrendDropdown, setShowTrendDropdown] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(Math.floor(new Date().getMonth() / 3));
  const [chartData, setChartData] = useState<ChartBar[]>([]);
  const [dualData, setDualData] = useState<DualBar[]>([]);
  const [loading, setLoading] = useState(false);

  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [showDamDropdown, setShowDamDropdown] = useState(false);
  const [damSearchQuery, setDamSearchQuery] = useState('');

  const [dams, setDams] = useState<Dam[]>([]);
  const [selectedDam, setSelectedDam] = useState<Dam | null>(null);

  useEffect(() => {
    if (accessContext) loadDams();
  }, [accessContext]);

  useEffect(() => {
    loadChartData();
  }, [viewMode, selectedYear, selectedQuarter, accessContext, scopeMode, selectedDam, trendType]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (
        !t.closest('.rw-year-dd') &&
        !t.closest('.rw-period-dd') &&
        !t.closest('.rw-dam-dd') &&
        !t.closest('.rw-trend-dd')
      ) {
        setShowYearDropdown(false);
        setShowPeriodDropdown(false);
        setShowDamDropdown(false);
        setShowTrendDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadDams = async () => {
    if (!accessContext) return;
    let q = supabase.from('dams').select('id, name, service_centre_id').order('name');
    if (accessContext.isSCScoped && accessContext.scopeId) {
      q = q.eq('service_centre_id', accessContext.scopeId);
    } else if (accessContext.isCatchmentScoped && accessContext.allowedServiceCentreIds.length > 0) {
      q = q.in('service_centre_id', accessContext.allowedServiceCentreIds);
    }
    const { data } = await q;
    const list: Dam[] = (data || []).map((d: any) => ({ id: d.id, name: d.name, service_centre_id: d.service_centre_id }));
    setDams(list);
    if (list.length > 0) setSelectedDam(list[0]);
  };

  const buildScope = (): ScopeFilter => {
    if (!accessContext) return { scopeType: 'NATIONAL', scopeId: null, allowedServiceCentreIds: [] };
    return {
      scopeType: accessContext.isSCScoped ? 'SC' : accessContext.isCatchmentScoped ? 'CATCHMENT' : 'NATIONAL',
      scopeId: accessContext.scopeId || null,
      allowedServiceCentreIds: accessContext.allowedServiceCentreIds || [],
    };
  };

  const buildSalesQuery = (year: number, damId?: string) => {
    let q = supabase.from('rw_sales_data').select('*').eq('year', year);
    if (damId) {
      q = q.eq('dam_id', damId);
    } else if (accessContext?.isSCScoped && accessContext.scopeId) {
      q = q.eq('service_centre_id', accessContext.scopeId);
    } else if (accessContext?.isCatchmentScoped && accessContext.allowedServiceCentreIds.length > 0) {
      q = q.in('service_centre_id', accessContext.allowedServiceCentreIds);
    }
    return q;
  };

  const buildTargetsQuery = (damId?: string) => {
    let q = supabase.from('rw_sales_targets').select('dam_id, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec');
    if (damId) {
      q = q.eq('dam_id', damId);
    }
    return q;
  };

  const getMonthSalesTotal = (salesRows: any[], monthKey: string): number => {
    return salesRows.reduce((sum: number, row: any) => sum + (Number(row[monthKey]) || 0), 0);
  };

  const getMonthTargetTotal = (targetRows: any[], monthKey: string): number => {
    return targetRows.reduce((sum: number, row: any) => sum + (Number(row[monthKey]) || 0), 0);
  };

  const filterTargetsByScope = async (targetRows: any[]): Promise<any[]> => {
    if (scopeMode === 'dam' && selectedDam) {
      return targetRows.filter((t: any) => t.dam_id === selectedDam.id);
    }
    const damIds = new Set(dams.map(d => d.id));
    return targetRows.filter((t: any) => damIds.has(t.dam_id));
  };

  const loadChartData = async () => {
    if (!accessContext) return;
    if (scopeMode === 'dam' && !selectedDam) return;
    setLoading(true);

    try {
      if (trendType === 'allocations-vs-sales') {
        await loadAllocationsVsSalesData();
        return;
      }
      await loadSalesVsTargetsData();
    } catch (err) {
      console.error('Error loading RW chart data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSalesVsTargetsData = async () => {
    const damId = scopeMode === 'dam' && selectedDam ? selectedDam.id : undefined;
    const { data: salesData } = await buildSalesQuery(selectedYear, damId);
    const salesRows = salesData || [];

    const { data: allTargetsData } = await buildTargetsQuery(damId);
    const filteredTargets = damId ? (allTargetsData || []) : await filterTargetsByScope(allTargetsData || []);

    const monthRange = viewMode === 'quarter'
      ? [selectedQuarter * 3, selectedQuarter * 3 + 1, selectedQuarter * 3 + 2]
      : Array.from({ length: 12 }, (_, i) => i);

    const bars: ChartBar[] = monthRange.map(m => ({
      label: viewMode === 'year' ? MONTH_SHORT[m] : MONTH_FULL[m],
      actual: Math.round(getMonthSalesTotal(salesRows, MONTH_KEYS[m])),
      target: Math.round(getMonthTargetTotal(filteredTargets, MONTH_KEYS[m])),
    }));

    setChartData(bars);
    setDualData([]);
  };

  const loadAllocationsVsSalesData = async () => {
    const scope = buildScope();
    const monthRange = viewMode === 'quarter'
      ? [selectedQuarter * 3 + 1, selectedQuarter * 3 + 2, selectedQuarter * 3 + 3]
      : Array.from({ length: 12 }, (_, i) => i + 1);

    const allocations = await fetchRWAllocationsByDamMonthly(scope, selectedYear, monthRange);

    const damId = scopeMode === 'dam' && selectedDam ? selectedDam.id : undefined;
    const { data: salesData } = await buildSalesQuery(selectedYear, damId);
    const salesRows = salesData || [];

    const bars: DualBar[] = monthRange.map((month1Based, idx) => {
      const monthIdx = month1Based - 1;
      const monthKey = MONTH_KEYS[monthIdx];

      let allocTotal: number;
      if (damId) {
        allocTotal = allocations
          .filter(a => a.damId === damId && a.month === month1Based)
          .reduce((sum, a) => sum + a.allocationVolume, 0);
      } else {
        allocTotal = allocations
          .filter(a => a.month === month1Based)
          .reduce((sum, a) => sum + a.allocationVolume, 0);
      }

      const salesTotal = getMonthSalesTotal(salesRows, monthKey);

      return {
        allocLabel: viewMode === 'year' ? `Alloc ${MONTH_SHORT[monthIdx]}` : `Allocation ${MONTH_SHORT[monthIdx]}`,
        salesLabel: viewMode === 'year' ? `Sales ${MONTH_SHORT[monthIdx]}` : `Sage Sales ${MONTH_SHORT[monthIdx]}`,
        allocation: Math.round(allocTotal),
        sales: Math.round(salesTotal),
      };
    });

    setDualData(bars);
    setChartData([]);
  };

  const handlePrev = () => {
    if (viewMode === 'quarter') {
      if (selectedQuarter > 0) setSelectedQuarter(p => p - 1);
      else { setSelectedYear(p => p - 1); setSelectedQuarter(3); }
    } else {
      setSelectedYear(p => p - 1);
    }
  };

  const canGoNext = (): boolean => {
    const now = new Date();
    const cy = now.getFullYear();
    if (viewMode === 'quarter') {
      return !(selectedYear === cy && selectedQuarter >= Math.floor(now.getMonth() / 3));
    }
    return selectedYear < cy;
  };

  const handleNext = () => {
    if (!canGoNext()) return;
    if (viewMode === 'quarter') {
      if (selectedQuarter < 3) setSelectedQuarter(p => p + 1);
      else { setSelectedYear(p => p + 1); setSelectedQuarter(0); }
    } else {
      setSelectedYear(p => p + 1);
    }
  };

  const trendLabel = trendType === 'sales' ? 'RW Sales Trend' : 'RW Allocations/Sage Sales';

  const getScopeLabel = (): string => {
    return scopeMode === 'dam' && selectedDam
      ? selectedDam.name
      : (accessContext?.serviceCentre?.name ?? 'SC');
  };

  const getSubtitle = (): string => {
    const period = viewMode === 'quarter'
      ? `Q${selectedQuarter + 1} ${selectedYear}`
      : `${selectedYear}`;
    return `${trendLabel} - ${period}`;
  };

  const shortenSCName = (name: string): string => {
    return name.replace(/\bService\s+Cent(?:re|er)\b/gi, 'SC').replace(/\bServiceCentre\b/gi, 'SC').trim();
  };

  const scName = shortenSCName(accessContext?.serviceCentre?.name ?? 'SC');

  const filteredDams = damSearchQuery
    ? dams.filter(d => d.name.toLowerCase().includes(damSearchQuery.toLowerCase()))
    : dams;

  const availableYears = Array.from({ length: new Date().getFullYear() - 2019 }, (_, i) => 2020 + i).reverse();

  const totalActual = chartData.reduce((s, d) => s + d.actual, 0);
  const totalTarget = chartData.reduce((s, d) => s + d.target, 0);
  const achievement = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;

  const totalDualAlloc = dualData.reduce((s, d) => s + d.allocation, 0);
  const totalDualSales = dualData.reduce((s, d) => s + d.sales, 0);

  const isAllocVsSales = trendType === 'allocations-vs-sales';

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
      <div className="flex flex-col gap-2 mb-3">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-gray-900">{getScopeLabel()}</h2>
            <p className="text-xs text-gray-500 mt-0.5 leading-tight">{getSubtitle()}</p>
          </div>
          <div className="relative rw-trend-dd flex-shrink-0">
            <button
              onClick={() => setShowTrendDropdown(!showTrendDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-xs font-semibold text-gray-700"
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${trendType === 'sales' ? 'bg-teal-500' : 'bg-amber-500'}`} />
              {trendLabel}
              <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${showTrendDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showTrendDropdown && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-20 w-60 overflow-hidden">
                {(['sales', 'allocations-vs-sales'] as TrendType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => { setTrendType(type); setShowTrendDropdown(false); }}
                    className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2.5 transition-colors ${
                      trendType === type ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${type === 'sales' ? 'bg-teal-500' : 'bg-amber-500'}`} />
                    {type === 'sales' ? 'RW Sales Trend' : 'RW Allocations/Sage Sales'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-gray-300 overflow-visible">
              <button
                onClick={() => setScopeMode('sc')}
                className={`px-3 py-1.5 text-xs font-semibold transition-all rounded-l-lg ${
                  scopeMode === 'sc' ? 'bg-blue-50 text-blue-700' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {scName}
              </button>
              <div className="w-px h-5 bg-gray-300" />
              <div className="relative rw-dam-dd">
                <button
                  onClick={() => {
                    if (scopeMode === 'dam') {
                      setShowDamDropdown(!showDamDropdown);
                      setDamSearchQuery('');
                    } else {
                      setScopeMode('dam');
                      setShowDamDropdown(false);
                    }
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1 rounded-r-lg ${
                    scopeMode === 'dam' ? 'bg-blue-50 text-blue-700' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="truncate max-w-[120px]">
                    {scopeMode === 'dam' && selectedDam ? selectedDam.name : 'Dam'}
                  </span>
                  <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${showDamDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showDamDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-20 w-64">
                    <div className="p-2 border-b border-gray-200">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={damSearchQuery}
                          onChange={e => setDamSearchQuery(e.target.value)}
                          placeholder="Search dams..."
                          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      {filteredDams.length > 0 ? (
                        filteredDams.map(dam => (
                          <button
                            key={dam.id}
                            onClick={() => { setSelectedDam(dam); setShowDamDropdown(false); setDamSearchQuery(''); }}
                            className={`w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors text-sm ${
                              selectedDam?.id === dam.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                            }`}
                          >
                            {dam.name}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-6 text-center text-sm text-gray-500">No dams found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-gray-300 overflow-hidden">
              {(['quarter', 'year'] as ViewMode[]).map((mode, idx) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-all ${
                    viewMode === mode ? 'bg-blue-50 text-blue-700' : 'bg-white text-gray-600 hover:bg-gray-50'
                  } ${idx > 0 ? 'border-l border-gray-300' : ''}`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-gray-200 mx-1" />

            <div className="relative rw-year-dd">
              <button
                onClick={() => { setShowYearDropdown(!showYearDropdown); setShowPeriodDropdown(false); }}
                className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors flex items-center gap-2 text-xs font-medium text-gray-700"
              >
                <Calendar className="w-3.5 h-3.5" />
                {selectedYear}
              </button>
              {showYearDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                  {availableYears.map(year => (
                    <button
                      key={year}
                      onClick={() => { setSelectedYear(year); setShowYearDropdown(false); }}
                      className={`w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors text-sm ${
                        year === selectedYear ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                      }`}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {viewMode === 'quarter' && (
              <div className="relative rw-period-dd">
                <button
                  onClick={() => { setShowPeriodDropdown(!showPeriodDropdown); setShowYearDropdown(false); }}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors flex items-center gap-2 text-xs font-medium text-gray-700 min-w-[100px]"
                >
                  Q{selectedQuarter + 1}
                </button>
                {showPeriodDropdown && (
                  <div className="absolute top-full right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 w-64">
                    <div className="max-h-64 overflow-y-auto">
                      {QUARTER_LABELS.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => { setSelectedQuarter(i); setShowPeriodDropdown(false); }}
                          className={`w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors text-sm ${
                            i === selectedQuarter ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button onClick={handlePrev} className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
              <ChevronLeft className="w-3.5 h-3.5 text-gray-600" />
            </button>
            <button
              onClick={handleNext}
              disabled={!canGoNext()}
              className={`p-1.5 rounded-lg border border-gray-300 transition-colors ${canGoNext() ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'}`}
            >
              <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {isAllocVsSales ? (
        <>
          <div className="flex items-center gap-5 mb-2 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-amber-400" />
              <span className="text-gray-600">RW Allocation</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-teal-400" />
              <span className="text-gray-600">Sage Sales</span>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading data...</div>
          ) : dualData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No data available</div>
          ) : (
            <>
              <div className="space-y-0">
                {dualData.map((item, i) => {
                  const rowMax = Math.max(item.allocation, item.sales, 1);
                  const allocPct = (item.allocation / rowMax) * 100;
                  const salesPct = (item.sales / rowMax) * 100;

                  return (
                    <div key={`dual-${i}`} className="py-3" style={i > 0 ? { borderTop: '1px solid #e5e7eb' } : undefined}>
                      <div className="flex flex-col gap-1 w-full">
                        <div className="flex items-center gap-2 w-full">
                          <div className="w-28 flex-shrink-0">
                            <span className="text-[10px] font-semibold text-amber-700 leading-none whitespace-nowrap">{item.allocLabel}</span>
                          </div>
                          <div className="flex-1 bg-gray-100 rounded-full h-[5px] lg:h-[6px] overflow-hidden">
                            <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${Math.max(allocPct, item.allocation > 0 ? 2 : 0)}%` }} />
                          </div>
                          <div className="w-28 flex-shrink-0 text-right">
                            <span className="text-[11px] font-bold text-amber-600 tabular-nums leading-none whitespace-nowrap">
                              {item.allocation.toLocaleString()} ML
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 w-full">
                          <div className="w-28 flex-shrink-0">
                            <span className="text-[10px] font-semibold text-teal-700 leading-none whitespace-nowrap">{item.salesLabel}</span>
                          </div>
                          <div className="flex-1 bg-gray-100 rounded-full h-[5px] lg:h-[6px] overflow-hidden">
                            <div className="h-full bg-teal-400 rounded-full transition-all duration-500" style={{ width: `${Math.max(salesPct, item.sales > 0 ? 2 : 0)}%` }} />
                          </div>
                          <div className="w-28 flex-shrink-0 text-right">
                            <span className="text-[11px] font-bold text-teal-600 tabular-nums leading-none whitespace-nowrap">
                              {item.sales.toLocaleString()} ML
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 pt-2 border-t-2 border-gray-400">
                <div className="flex flex-col gap-[3px] w-full py-1.5">
                  <div className="flex items-center gap-2 w-full">
                    <div className="w-28 flex-shrink-0">
                      <span className="text-[10px] font-bold text-amber-800 leading-none whitespace-nowrap uppercase tracking-wide">
                        {viewMode === 'quarter' ? `Q${selectedQuarter + 1} ` : ''}{selectedYear} Allocation
                      </span>
                    </div>
                    <div className="flex-1 bg-gray-200 rounded-full h-[7px] lg:h-[9px] overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${Math.max((totalDualAlloc / Math.max(totalDualAlloc, totalDualSales, 1)) * 100, totalDualAlloc > 0 ? 2 : 0)}%` }} />
                    </div>
                    <div className="w-28 flex-shrink-0 text-right">
                      <span className="text-[12px] font-extrabold text-amber-700 tabular-nums leading-none whitespace-nowrap">
                        {totalDualAlloc.toLocaleString()} ML
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full">
                    <div className="w-28 flex-shrink-0">
                      <span className="text-[10px] font-bold text-teal-800 leading-none whitespace-nowrap uppercase tracking-wide">
                        {viewMode === 'quarter' ? `Q${selectedQuarter + 1} ` : ''}{selectedYear} Sage Sales
                      </span>
                    </div>
                    <div className="flex-1 bg-gray-200 rounded-full h-[7px] lg:h-[9px] overflow-hidden">
                      <div className="h-full bg-teal-500 rounded-full transition-all duration-500" style={{ width: `${Math.max((totalDualSales / Math.max(totalDualAlloc, totalDualSales, 1)) * 100, totalDualSales > 0 ? 2 : 0)}%` }} />
                    </div>
                    <div className="w-28 flex-shrink-0 text-right">
                      <span className={`text-[12px] font-extrabold tabular-nums leading-none whitespace-nowrap ${
                        totalDualAlloc > 0 && (totalDualSales / totalDualAlloc) >= 0.9 ? 'text-emerald-700'
                        : totalDualAlloc > 0 && (totalDualSales / totalDualAlloc) >= 0.7 ? 'text-teal-600'
                        : 'text-rose-600'
                      }`}>
                        {totalDualSales.toLocaleString()} ML
                        <span className="text-[10px] font-semibold ml-1 opacity-80">
                          ({totalDualAlloc > 0 ? ((totalDualSales / totalDualAlloc) * 100).toFixed(1) : '0.0'}%)
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center gap-5 mb-2 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-teal-400" />
              <span className="text-gray-600">Actual Sales (Target Met)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-rose-400" />
              <span className="text-gray-600">Actual Sales (Target Not Met)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-gray-400" />
              <span className="text-gray-600">Target</span>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading data...</div>
          ) : chartData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No RW sales data available</div>
          ) : (
            <>
              <div className="space-y-0">
                {chartData.map((item, i) => {
                  const rowMax = Math.max(item.actual, item.target, 1);
                  const actualPct = (item.actual / rowMax) * 100;
                  const targetPct = (item.target / rowMax) * 100;
                  const barAchievement = item.target > 0 ? (item.actual / item.target) * 100 : null;

                  return (
                    <div key={`${item.label}-${i}`} className="py-3" style={i > 0 ? { borderTop: '1px solid #e5e7eb' } : undefined}>
                      <div className="flex items-start gap-2 w-full">
                        <div className="w-16 flex-shrink-0">
                          <div className="text-xs font-bold text-gray-800 leading-tight">{item.label}</div>
                          {item.sublabel && <div className="text-[10px] text-gray-500 leading-tight">{item.sublabel}</div>}
                        </div>
                        <div className="flex-1 flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2 leading-none">
                            <div className="flex-1 bg-gray-100 rounded-full h-[5px] lg:h-[6px] overflow-hidden">
                              <div className="h-full bg-gray-400 rounded-full transition-all duration-500" style={{ width: `${Math.max(targetPct, item.target > 0 ? 2 : 0)}%` }} />
                            </div>
                            <div className="w-36 flex-shrink-0">
                              <span className="text-[11px] font-bold text-gray-600 tabular-nums leading-none whitespace-nowrap">
                                {item.target.toLocaleString()} ML
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 leading-none">
                            <div className="flex-1 bg-gray-100 rounded-full h-[5px] lg:h-[6px] overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${item.actual >= item.target ? 'bg-teal-400' : 'bg-rose-400'}`}
                                style={{ width: `${Math.max(actualPct, item.actual > 0 ? 2 : 0)}%` }}
                              />
                            </div>
                            <div className="w-36 flex-shrink-0">
                              <span className={`text-[11px] font-bold tabular-nums leading-none whitespace-nowrap ${item.actual >= item.target ? 'text-teal-600' : 'text-rose-500'}`}>
                                {item.actual.toLocaleString()} ML
                                {barAchievement !== null && (
                                  <span className="text-[10px] font-medium ml-1 opacity-75">({barAchievement.toFixed(0)}%)</span>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 pt-2 border-t-2 border-gray-400">
                <div className="flex flex-col gap-1 w-full py-1.5">
                  <div className="flex items-center gap-2 w-full leading-none">
                    <div className="w-24 flex-shrink-0">
                      <span className="text-[10px] font-bold text-gray-700 leading-none whitespace-nowrap uppercase tracking-wide">Target</span>
                      <div className="text-[9px] text-gray-400 leading-tight">
                        {viewMode === 'quarter' ? `Q${selectedQuarter + 1}` : `${selectedYear}`}
                      </div>
                    </div>
                    <div className="flex-1 bg-gray-200 rounded-full h-[7px] lg:h-[9px] overflow-hidden">
                      <div className="h-full bg-gray-500 rounded-full transition-all duration-500" style={{ width: `${Math.max((totalTarget / Math.max(totalTarget, totalActual, 1)) * 100, totalTarget > 0 ? 2 : 0)}%` }} />
                    </div>
                    <div className="w-36 flex-shrink-0">
                      <span className="text-[12px] font-extrabold text-gray-600 tabular-nums leading-none whitespace-nowrap">
                        {totalTarget.toLocaleString()} ML
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full leading-none">
                    <div className="w-24 flex-shrink-0">
                      <span className="text-[10px] font-bold leading-none uppercase tracking-wide block" style={{ color: totalActual >= totalTarget ? '#0d9488' : '#e11d48' }}>
                        Actual Sales
                      </span>
                      <div className="text-[9px] text-gray-400 leading-tight">
                        {viewMode === 'quarter' ? `Q${selectedQuarter + 1}` : `${selectedYear}`}
                      </div>
                    </div>
                    <div className="flex-1 bg-gray-200 rounded-full h-[7px] lg:h-[9px] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${totalActual >= totalTarget ? 'bg-teal-500' : 'bg-rose-500'}`}
                        style={{ width: `${Math.max((totalActual / Math.max(totalTarget, totalActual, 1)) * 100, totalActual > 0 ? 2 : 0)}%` }}
                      />
                    </div>
                    <div className="w-36 flex-shrink-0">
                      <span className={`text-[12px] font-extrabold tabular-nums leading-none whitespace-nowrap ${totalActual >= totalTarget ? 'text-teal-700' : 'text-rose-600'}`}>
                        {totalActual.toLocaleString()} ML
                        <span className={`text-[10px] font-semibold ml-1 opacity-80 ${achievement >= 100 ? 'text-emerald-600' : achievement >= 75 ? 'text-teal-600' : 'text-rose-500'}`}>
                          ({achievement.toFixed(1)}%)
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
