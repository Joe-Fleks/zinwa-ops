import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Search, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AccessContext } from '../../lib/scopeUtils';
import {
  getWeekDateRangeForWeekNumber,
  getCurrentWeekNumber,
  shouldShowPreviousWeek,
  getMaxWeekNumberForYear,
} from '../../lib/dateUtils';

type ViewMode = 'week' | 'month' | 'quarter' | 'year';
type ScopeMode = 'sc' | 'station';
type TrendType = 'production' | 'sales';

interface ChartBar {
  label: string;
  sublabel?: string;
  actual: number;
  target: number;
}

interface Station {
  id: string;
  station_name: string;
}

interface Props {
  accessContext: AccessContext | null;
}

const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const QUARTER_LABELS = ['Q1 (Jan - Mar)', 'Q2 (Apr - Jun)', 'Q3 (Jul - Sep)', 'Q4 (Oct - Dec)'];

export default function ProductionTrendChart({ accessContext }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [productionViewMode, setProductionViewMode] = useState<ViewMode>('month');
  const [salesViewMode, setSalesViewMode] = useState<ViewMode>('quarter');
  const [scopeMode, setScopeMode] = useState<ScopeMode>('sc');
  const [trendType, setTrendType] = useState<TrendType>('production');
  const [showTrendDropdown, setShowTrendDropdown] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedWeek, setSelectedWeek] = useState(() => {
    const cw = getCurrentWeekNumber();
    return shouldShowPreviousWeek() ? cw - 1 : cw;
  });
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedQuarter, setSelectedQuarter] = useState(Math.floor(new Date().getMonth() / 3));
  const [chartData, setChartData] = useState<ChartBar[]>([]);
  const [loading, setLoading] = useState(false);

  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [showStationDropdown, setShowStationDropdown] = useState(false);
  const [periodSearchQuery, setPeriodSearchQuery] = useState('');
  const [stationSearchQuery, setStationSearchQuery] = useState('');

  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);

  useEffect(() => {
    if (accessContext) {
      loadStations();
    }
  }, [accessContext]);

  useEffect(() => {
    if (trendType === 'sales') {
      if (viewMode === 'week' || viewMode === 'month') {
        setViewMode(salesViewMode);
      }
    } else {
      setViewMode(productionViewMode);
    }
  }, [trendType]);

  useEffect(() => {
    if (trendType === 'production') {
      setProductionViewMode(viewMode);
    } else {
      if (viewMode !== 'week' && viewMode !== 'month') {
        setSalesViewMode(viewMode);
      }
    }
  }, [viewMode]);

  useEffect(() => {
    loadChartData();
  }, [viewMode, selectedYear, selectedWeek, selectedMonth, selectedQuarter, accessContext, scopeMode, selectedStation, trendType]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (
        !t.closest('.chart-year-dd') &&
        !t.closest('.chart-period-dd') &&
        !t.closest('.chart-station-dd') &&
        !t.closest('.chart-trend-dd')
      ) {
        setShowYearDropdown(false);
        setShowPeriodDropdown(false);
        setShowStationDropdown(false);
        setShowTrendDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadStations = async () => {
    if (!accessContext) return;
    let q = supabase
      .from('stations')
      .select('id, station_name')
      .order('station_name');

    if (accessContext.isSCScoped && accessContext.scopeId) {
      q = q.eq('service_centre_id', accessContext.scopeId);
    }

    const { data } = await q;
    const list = data || [];
    setStations(list);
    if (list.length > 0) {
      setSelectedStation(list[0]);
    }
  };

  const buildProductionQuery = (startDate: string, endDate: string) => {
    if (scopeMode === 'station' && selectedStation) {
      return supabase
        .from('production_logs')
        .select('date, cw_volume_m3, station_id')
        .eq('station_id', selectedStation.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });
    }

    let q = supabase
      .from('production_logs')
      .select('date, cw_volume_m3, station_id, stations(service_centre_id)')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (accessContext?.isSCScoped && accessContext.scopeId) {
      q = q.eq('stations.service_centre_id', accessContext.scopeId);
    }
    return q;
  };

  const buildSalesQuery = (year: number, monthStart: number, monthEnd: number) => {
    if (scopeMode === 'station' && selectedStation) {
      return supabase
        .from('sales_records')
        .select('year, month, sage_sales_volume_m3, station_id')
        .eq('station_id', selectedStation.id)
        .eq('year', year)
        .gte('month', monthStart + 1)
        .lte('month', monthEnd + 1);
    }

    let q = supabase
      .from('sales_records')
      .select('year, month, sage_sales_volume_m3, station_id, stations(service_centre_id)')
      .eq('year', year)
      .gte('month', monthStart + 1)
      .lte('month', monthEnd + 1);

    if (accessContext?.isSCScoped && accessContext.scopeId) {
      q = q.eq('stations.service_centre_id', accessContext.scopeId);
    }
    return q;
  };

  const buildTargetsQuery = (type: TrendType) => {
    const tableName = type === 'production' ? 'cw_production_targets' : 'cw_sales_targets';

    if (scopeMode === 'station' && selectedStation) {
      return supabase
        .from(tableName)
        .select('jan,feb,mar,apr,may,jun,jul,aug,sep,oct,nov,dec')
        .eq('station_id', selectedStation.id);
    }

    let q = supabase
      .from(tableName)
      .select('jan,feb,mar,apr,may,jun,jul,aug,sep,oct,nov,dec');

    if (accessContext?.isSCScoped && accessContext.scopeId) {
      q = q.eq('service_centre_id', accessContext.scopeId);
    }
    return q;
  };

  const loadChartData = async () => {
    if (!accessContext) return;
    if (scopeMode === 'station' && !selectedStation) return;
    setLoading(true);

    try {
      const { data: allTargetsData } = await buildTargetsQuery(trendType);
      const allTargets = allTargetsData || [];

      const getMonthTarget = (monthIndex: number, _year: number): number => {
        const key = MONTH_KEYS[monthIndex];
        return allTargets.reduce((sum: number, t: Record<string, unknown>) => sum + Number(t[key] || 0), 0);
      };

      switch (viewMode) {
        case 'week':
          await loadWeekData(getMonthTarget);
          break;
        case 'month':
          await loadMonthData(getMonthTarget);
          break;
        case 'quarter':
          await loadQuarterData(getMonthTarget);
          break;
        case 'year':
          await loadYearData(getMonthTarget);
          break;
      }
    } catch (err) {
      console.error('Error loading chart data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSalesVolumeForMonth = async (year: number, monthIdx: number): Promise<number> => {
    const { data } = await buildSalesQuery(year, monthIdx, monthIdx);
    return (data || []).reduce((sum: number, r: Record<string, unknown>) => sum + Number(r.sage_sales_volume_m3 || 0), 0);
  };

  const loadWeekData = async (getMonthTarget: (m: number, y: number) => number) => {
    const weekDates = getWeekDateRangeForWeekNumber(selectedWeek, selectedYear);
    const startParts = weekDates.start.split('-');
    const startDate = new Date(+startParts[0], +startParts[1] - 1, +startParts[2], 12);

    if (trendType === 'sales') {
      const monthsInWeek = new Set<number>();
      for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        monthsInWeek.add(d.getMonth());
      }

      const monthVolumes = new Map<number, number>();
      for (const mIdx of monthsInWeek) {
        const vol = await getSalesVolumeForMonth(selectedYear, mIdx);
        const daysInMonth = new Date(selectedYear, mIdx + 1, 0).getDate();
        monthVolumes.set(mIdx, vol / daysInMonth);
      }

      const bars: ChartBar[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
        const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const monthIdx = d.getMonth();
        const daysInMonth = new Date(d.getFullYear(), monthIdx + 1, 0).getDate();
        const dailyTarget = getMonthTarget(monthIdx, d.getFullYear()) / daysInMonth;
        bars.push({
          label: dayName,
          sublabel: dateLabel,
          actual: Math.round(monthVolumes.get(monthIdx) || 0),
          target: Math.round(dailyTarget),
        });
      }
      setChartData(bars);
      return;
    }

    const { data } = await buildProductionQuery(weekDates.start, weekDates.end);
    const dailyMap = new Map<string, number>();
    (data || []).forEach((log: Record<string, unknown>) => {
      const date = log.date as string;
      const cur = dailyMap.get(date) || 0;
      dailyMap.set(date, cur + Number(log.cw_volume_m3 || 0));
    });

    const bars: ChartBar[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const monthIdx = d.getMonth();
      const daysInMonth = new Date(d.getFullYear(), monthIdx + 1, 0).getDate();
      const dailyTarget = getMonthTarget(monthIdx, d.getFullYear()) / daysInMonth;
      bars.push({
        label: dayName,
        sublabel: dateLabel,
        actual: Math.round(dailyMap.get(ds) || 0),
        target: Math.round(dailyTarget),
      });
    }
    setChartData(bars);
  };

  const loadMonthData = async (getMonthTarget: (m: number, y: number) => number) => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const monthTarget = getMonthTarget(selectedMonth, selectedYear);
    const dailyTarget = monthTarget / daysInMonth;

    if (trendType === 'sales') {
      const totalSales = await getSalesVolumeForMonth(selectedYear, selectedMonth);
      const dailySales = totalSales / daysInMonth;

      const bars: ChartBar[] = [];
      const numWeeks = Math.ceil(daysInMonth / 7);
      for (let w = 0; w < numWeeks; w++) {
        const firstDay = w * 7 + 1;
        const lastDay = Math.min((w + 1) * 7, daysInMonth);
        const daysInWeek = lastDay - firstDay + 1;
        bars.push({
          label: `Week ${w + 1}`,
          sublabel: `${firstDay} - ${lastDay} ${MONTH_SHORT[selectedMonth]}`,
          actual: Math.round(dailySales * daysInWeek),
          target: Math.round(dailyTarget * daysInWeek),
        });
      }
      setChartData(bars);
      return;
    }

    const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
    const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    const { data } = await buildProductionQuery(startDate, endDate);

    const weekGroups = new Map<number, { days: Set<string>; volume: number }>();
    for (let day = 1; day <= daysInMonth; day++) {
      const weekNum = Math.ceil(day / 7);
      if (!weekGroups.has(weekNum)) {
        weekGroups.set(weekNum, { days: new Set(), volume: 0 });
      }
      const ds = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      weekGroups.get(weekNum)!.days.add(ds);
    }

    (data || []).forEach((log: Record<string, unknown>) => {
      const date = log.date as string;
      const dayNum = parseInt(date.split('-')[2]);
      const weekNum = Math.ceil(dayNum / 7);
      const group = weekGroups.get(weekNum);
      if (group) {
        group.volume += Number(log.cw_volume_m3 || 0);
      }
    });

    const bars: ChartBar[] = [];
    const sortedWeeks = Array.from(weekGroups.entries()).sort((a, b) => a[0] - b[0]);
    for (const [weekNum, group] of sortedWeeks) {
      const daysArr = Array.from(group.days).sort();
      const firstDay = parseInt(daysArr[0].split('-')[2]);
      const lastDay = parseInt(daysArr[daysArr.length - 1].split('-')[2]);
      bars.push({
        label: `Week ${weekNum}`,
        sublabel: `${firstDay} - ${lastDay} ${MONTH_SHORT[selectedMonth]}`,
        actual: Math.round(group.volume),
        target: Math.round(dailyTarget * group.days.size),
      });
    }
    setChartData(bars);
  };

  const loadQuarterData = async (getMonthTarget: (m: number, y: number) => number) => {
    const startMonth = selectedQuarter * 3;
    const endMonth = startMonth + 2;

    if (trendType === 'sales') {
      const { data } = await buildSalesQuery(selectedYear, startMonth, endMonth);
      const monthVolumes = new Map<number, number>();
      (data || []).forEach((r: Record<string, unknown>) => {
        const mIdx = (r.month as number) - 1;
        const cur = monthVolumes.get(mIdx) || 0;
        monthVolumes.set(mIdx, cur + Number(r.sage_sales_volume_m3 || 0));
      });
      const bars: ChartBar[] = [];
      for (let m = startMonth; m <= endMonth; m++) {
        bars.push({
          label: MONTH_SHORT[m],
          sublabel: MONTH_FULL[m],
          actual: Math.round(monthVolumes.get(m) || 0),
          target: Math.round(getMonthTarget(m, selectedYear)),
        });
      }
      setChartData(bars);
      return;
    }

    const startDate = `${selectedYear}-${String(startMonth + 1).padStart(2, '0')}-01`;
    const daysInEndMonth = new Date(selectedYear, endMonth + 1, 0).getDate();
    const endDate = `${selectedYear}-${String(endMonth + 1).padStart(2, '0')}-${String(daysInEndMonth).padStart(2, '0')}`;
    const { data } = await buildProductionQuery(startDate, endDate);

    const monthVolumes = new Map<number, number>();
    (data || []).forEach((log: Record<string, unknown>) => {
      const date = log.date as string;
      const monthIdx = parseInt(date.split('-')[1]) - 1;
      const cur = monthVolumes.get(monthIdx) || 0;
      monthVolumes.set(monthIdx, cur + Number(log.cw_volume_m3 || 0));
    });

    const bars: ChartBar[] = [];
    for (let m = startMonth; m <= endMonth; m++) {
      bars.push({
        label: MONTH_SHORT[m],
        sublabel: MONTH_FULL[m],
        actual: Math.round(monthVolumes.get(m) || 0),
        target: Math.round(getMonthTarget(m, selectedYear)),
      });
    }
    setChartData(bars);
  };

  const loadYearData = async (getMonthTarget: (m: number, y: number) => number) => {
    if (trendType === 'sales') {
      const { data } = await buildSalesQuery(selectedYear, 0, 11);
      const monthVolumes = new Map<number, number>();
      (data || []).forEach((r: Record<string, unknown>) => {
        const mIdx = (r.month as number) - 1;
        const cur = monthVolumes.get(mIdx) || 0;
        monthVolumes.set(mIdx, cur + Number(r.sage_sales_volume_m3 || 0));
      });
      const bars: ChartBar[] = [];
      for (let m = 0; m < 12; m++) {
        bars.push({
          label: MONTH_SHORT[m],
          actual: Math.round(monthVolumes.get(m) || 0),
          target: Math.round(getMonthTarget(m, selectedYear)),
        });
      }
      setChartData(bars);
      return;
    }

    const startDate = `${selectedYear}-01-01`;
    const endDate = `${selectedYear}-12-31`;
    const { data } = await buildProductionQuery(startDate, endDate);

    const monthVolumes = new Map<number, number>();
    (data || []).forEach((log: Record<string, unknown>) => {
      const date = log.date as string;
      const monthIdx = parseInt(date.split('-')[1]) - 1;
      const cur = monthVolumes.get(monthIdx) || 0;
      monthVolumes.set(monthIdx, cur + Number(log.cw_volume_m3 || 0));
    });

    const bars: ChartBar[] = [];
    for (let m = 0; m < 12; m++) {
      bars.push({
        label: MONTH_SHORT[m],
        actual: Math.round(monthVolumes.get(m) || 0),
        target: Math.round(getMonthTarget(m, selectedYear)),
      });
    }
    setChartData(bars);
  };

  const handlePrev = () => {
    switch (viewMode) {
      case 'week':
        if (selectedWeek > 1) {
          setSelectedWeek((p) => p - 1);
        } else {
          setSelectedYear((p) => p - 1);
          setSelectedWeek(getMaxWeekNumberForYear(selectedYear - 1));
        }
        break;
      case 'month':
        if (selectedMonth > 0) {
          setSelectedMonth((p) => p - 1);
        } else {
          setSelectedYear((p) => p - 1);
          setSelectedMonth(11);
        }
        break;
      case 'quarter':
        if (selectedQuarter > 0) {
          setSelectedQuarter((p) => p - 1);
        } else {
          setSelectedYear((p) => p - 1);
          setSelectedQuarter(3);
        }
        break;
      case 'year':
        setSelectedYear((p) => p - 1);
        break;
    }
  };

  const canGoNext = (): boolean => {
    const now = new Date();
    const cy = now.getFullYear();
    switch (viewMode) {
      case 'week': {
        const cw = shouldShowPreviousWeek() ? getCurrentWeekNumber() - 1 : getCurrentWeekNumber();
        return !(selectedYear === cy && selectedWeek >= cw);
      }
      case 'month':
        return !(selectedYear === cy && selectedMonth >= now.getMonth());
      case 'quarter':
        return !(selectedYear === cy && selectedQuarter >= Math.floor(now.getMonth() / 3));
      case 'year':
        return selectedYear < cy;
    }
  };

  const handleNext = () => {
    if (!canGoNext()) return;
    switch (viewMode) {
      case 'week': {
        const maxWeek = getMaxWeekNumberForYear(selectedYear);
        if (selectedWeek < maxWeek) {
          setSelectedWeek((p) => p + 1);
        } else {
          setSelectedYear((p) => p + 1);
          setSelectedWeek(1);
        }
        break;
      }
      case 'month':
        if (selectedMonth < 11) {
          setSelectedMonth((p) => p + 1);
        } else {
          setSelectedYear((p) => p + 1);
          setSelectedMonth(0);
        }
        break;
      case 'quarter':
        if (selectedQuarter < 3) {
          setSelectedQuarter((p) => p + 1);
        } else {
          setSelectedYear((p) => p + 1);
          setSelectedQuarter(0);
        }
        break;
      case 'year':
        setSelectedYear((p) => p + 1);
        break;
    }
  };

  const trendLabel = trendType === 'production' ? 'CW Production Trend' : 'CW Sales Trend';

  const getTitle = (): string => {
    const scopeLabel = scopeMode === 'station' && selectedStation
      ? selectedStation.station_name
      : (accessContext?.serviceCentre?.name ?? 'SC');

    switch (viewMode) {
      case 'week': {
        const wd = getWeekDateRangeForWeekNumber(selectedWeek, selectedYear);
        const s = new Date(wd.start + 'T12:00:00');
        const e = new Date(wd.end + 'T12:00:00');
        const sm = s.toLocaleDateString('en-US', { month: 'short' });
        const em = e.toLocaleDateString('en-US', { month: 'short' });
        const range = sm === em
          ? `${s.getDate()} to ${e.getDate()} ${em}`
          : `${s.getDate()} ${sm} to ${e.getDate()} ${em}`;
        return `${scopeLabel} - ${trendLabel} (${range})`;
      }
      case 'month':
        return `${scopeLabel} - ${trendLabel} - ${MONTH_FULL[selectedMonth]} ${selectedYear}`;
      case 'quarter':
        return `${scopeLabel} - ${trendLabel} - ${QUARTER_LABELS[selectedQuarter].split(' ')[0]} ${selectedYear}`;
      case 'year':
        return `${scopeLabel} - ${trendLabel} - ${selectedYear}`;
    }
  };

  const getPeriodLabel = (): string => {
    switch (viewMode) {
      case 'week':
        return `Week ${selectedWeek}`;
      case 'month':
        return MONTH_SHORT[selectedMonth];
      case 'quarter':
        return `Q${selectedQuarter + 1}`;
      case 'year':
        return '';
    }
  };

  const getPeriodOptions = (): { value: number; label: string }[] => {
    switch (viewMode) {
      case 'week': {
        const maxWeek = getMaxWeekNumberForYear(selectedYear);
        return Array.from({ length: maxWeek }, (_, i) => ({
          value: i + 1,
          label: `Week ${i + 1}`,
        }));
      }
      case 'month':
        return MONTH_FULL.map((m, i) => ({ value: i, label: m }));
      case 'quarter':
        return QUARTER_LABELS.map((q, i) => ({ value: i, label: q }));
      default:
        return [];
    }
  };

  const getSelectedPeriodValue = (): number => {
    switch (viewMode) {
      case 'week': return selectedWeek;
      case 'month': return selectedMonth;
      case 'quarter': return selectedQuarter;
      default: return 0;
    }
  };

  const handlePeriodSelect = (val: number) => {
    switch (viewMode) {
      case 'week': setSelectedWeek(val); break;
      case 'month': setSelectedMonth(val); break;
      case 'quarter': setSelectedQuarter(val); break;
    }
    setShowPeriodDropdown(false);
    setPeriodSearchQuery('');
  };

  const shortenSCName = (name: string): string => {
    return name
      .replace(/\bService\s+Cent(?:re|er)\b/gi, 'SC')
      .replace(/\bServiceCentre\b/gi, 'SC')
      .trim();
  };

  const scName = shortenSCName(accessContext?.serviceCentre?.name ?? 'SC');

  const filteredStations = stationSearchQuery
    ? stations.filter(s => s.station_name.toLowerCase().includes(stationSearchQuery.toLowerCase()))
    : stations;

  const periodOptions = getPeriodOptions();
  const filteredPeriodOptions = periodSearchQuery
    ? periodOptions.filter((o) => o.label.toLowerCase().includes(periodSearchQuery.toLowerCase()))
    : periodOptions;

  const availableYears = Array.from(
    { length: new Date().getFullYear() - 2019 },
    (_, i) => 2020 + i
  ).reverse();

  const maxVal = chartData.length > 0
    ? Math.max(...chartData.map((d) => d.actual), ...chartData.map((d) => d.target), 1)
    : 1;

  const BAR_MAX_PX = 550;

  const totalActual = chartData.reduce((s, d) => s + d.actual, 0);
  const totalTarget = chartData.reduce((s, d) => s + d.target, 0);
  const achievement = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;

  const getSummaryLabel = (): string => {
    switch (viewMode) {
      case 'week': return `Week ${selectedWeek}`;
      case 'month': return MONTH_SHORT[selectedMonth];
      case 'quarter': return `Q${selectedQuarter + 1}`;
      case 'year': return `${selectedYear}`;
    }
  };

  const actualLabel = trendType === 'production' ? 'Actual Production' : 'Actual Sales';
  const actualMetColor = trendType === 'production' ? 'bg-green-300' : 'bg-blue-400';
  const actualNotMetColor = 'bg-red-400';
  const actualMetTextColor = trendType === 'production' ? 'text-green-600' : 'text-blue-600';
  const actualNotMetTextColor = 'text-red-600';
  const legendMetColor = trendType === 'production' ? 'bg-green-300' : 'bg-blue-400';
  const legendNotMetColor = 'bg-red-400';

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
      <div className="flex flex-col gap-2 mb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-900 flex-1">{getTitle()}</h2>
          <div className="relative chart-trend-dd flex-shrink-0">
            <button
              onClick={() => setShowTrendDropdown(!showTrendDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-xs font-semibold text-gray-700"
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${trendType === 'production' ? 'bg-green-500' : 'bg-blue-500'}`} />
              {trendType === 'production' ? 'CW Production Trend' : 'CW Sales Trend'}
              <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${showTrendDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showTrendDropdown && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-20 w-52 overflow-hidden">
                {(['production', 'sales'] as TrendType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setTrendType(type);
                      setShowTrendDropdown(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2.5 transition-colors ${
                      trendType === type
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${type === 'production' ? 'bg-green-500' : 'bg-blue-500'}`} />
                    {type === 'production' ? 'CW Production Trend' : 'CW Sales Trend'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-gray-300 overflow-visible">
              <button
                onClick={() => setScopeMode('sc')}
                className={`px-3 py-1.5 text-xs font-semibold transition-all rounded-l-lg ${
                  scopeMode === 'sc'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {scName}
              </button>
              <div className="w-px h-5 bg-gray-300" />
              <div className="relative chart-station-dd">
                <button
                  onClick={() => {
                    if (scopeMode === 'station') {
                      setShowStationDropdown(!showStationDropdown);
                      setStationSearchQuery('');
                    } else {
                      setScopeMode('station');
                      setShowStationDropdown(false);
                    }
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1 rounded-r-lg ${
                    scopeMode === 'station'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="truncate max-w-[120px]">
                    {scopeMode === 'station' && selectedStation
                      ? selectedStation.station_name
                      : 'Station'}
                  </span>
                  <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${showStationDropdown ? 'rotate-180' : ''} ${scopeMode === 'station' ? 'text-white' : 'text-gray-500'}`} />
                </button>
                {showStationDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-20 w-64">
                    <div className="p-2 border-b border-gray-200">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={stationSearchQuery}
                          onChange={(e) => setStationSearchQuery(e.target.value)}
                          placeholder="Search stations..."
                          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      {filteredStations.length > 0 ? (
                        filteredStations.map((st) => (
                          <button
                            key={st.id}
                            onClick={() => {
                              setSelectedStation(st);
                              setShowStationDropdown(false);
                              setStationSearchQuery('');
                            }}
                            className={`w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors text-sm ${
                              selectedStation?.id === st.id
                                ? 'bg-blue-50 text-blue-700 font-medium'
                                : 'text-gray-700'
                            }`}
                          >
                            {st.station_name}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-6 text-center text-sm text-gray-500">No stations found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(['week', 'month', 'quarter', 'year'] as ViewMode[])
              .filter((mode) => trendType === 'sales' ? (mode === 'quarter' || mode === 'year') : true)
              .map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    viewMode === mode
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}

            <div className="w-px h-5 bg-gray-200 mx-1" />

            <div className="relative chart-year-dd">
              <button
                onClick={() => {
                  setShowYearDropdown(!showYearDropdown);
                  setShowPeriodDropdown(false);
                }}
                className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors flex items-center gap-2 text-xs font-medium text-gray-700"
              >
                <Calendar className="w-3.5 h-3.5" />
                {selectedYear}
              </button>
              {showYearDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                  {availableYears.map((year) => (
                    <button
                      key={year}
                      onClick={() => {
                        setSelectedYear(year);
                        setShowYearDropdown(false);
                        if (viewMode === 'week') {
                          const mw = getMaxWeekNumberForYear(year);
                          if (selectedWeek > mw) setSelectedWeek(mw);
                        }
                      }}
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

            {viewMode !== 'year' && (
              <div className="relative chart-period-dd">
                <button
                  onClick={() => {
                    setShowPeriodDropdown(!showPeriodDropdown);
                    setShowYearDropdown(false);
                    setPeriodSearchQuery('');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors flex items-center gap-2 text-xs font-medium text-gray-700 min-w-[100px]"
                >
                  {getPeriodLabel()}
                </button>
                {showPeriodDropdown && (
                  <div className="absolute top-full right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 w-64">
                    {viewMode === 'week' && (
                      <div className="p-2 border-b border-gray-200">
                        <div className="relative">
                          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            value={periodSearchQuery}
                            onChange={(e) => setPeriodSearchQuery(e.target.value)}
                            placeholder="Search..."
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    )}
                    <div className="max-h-64 overflow-y-auto">
                      {filteredPeriodOptions.length > 0 ? (
                        filteredPeriodOptions.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => handlePeriodSelect(opt.value)}
                            className={`w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors text-sm ${
                              opt.value === getSelectedPeriodValue()
                                ? 'bg-blue-50 text-blue-700 font-medium'
                                : 'text-gray-700'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-8 text-center text-sm text-gray-500">No results</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handlePrev}
              className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-gray-600" />
            </button>
            <button
              onClick={handleNext}
              disabled={!canGoNext()}
              className={`p-1.5 rounded-lg border border-gray-300 transition-colors ${
                canGoNext() ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-5 mb-2 text-xs font-medium">
        <div className="flex items-center gap-1.5">
          <div className={`w-3 h-3 rounded-sm ${legendMetColor}`} />
          <span className="text-gray-600">{actualLabel} (Target Met)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-3 h-3 rounded-sm ${legendNotMetColor}`} />
          <span className="text-gray-600">{actualLabel} (Target Not Met)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-gray-400" />
          <span className="text-gray-600">Target</span>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading data...</div>
      ) : chartData.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No {trendType} data available</div>
      ) : (
        <>
          <div className="space-y-0">
            {chartData.map((item, i) => {
              const actualPx = maxVal > 0 ? (item.actual / maxVal) * BAR_MAX_PX : 0;
              const targetPx = maxVal > 0 ? (item.target / maxVal) * BAR_MAX_PX : 0;
              const barAchievement = item.target > 0 ? (item.actual / item.target) * 100 : null;

              return (
                <div
                  key={`${item.label}-${i}`}
                  className="py-1.5"
                  style={i > 0 ? { borderTop: '1px solid #d1d5db' } : undefined}
                >
                  <div className="flex gap-2">
                    <div className="w-16 flex-shrink-0">
                      <div className="text-xs font-bold text-gray-800 leading-tight">{item.label}</div>
                      {item.sublabel && (
                        <div className="text-[10px] text-gray-500 leading-tight">{item.sublabel}</div>
                      )}
                    </div>
                    <div className="flex flex-col gap-[3px]">
                      <div className="flex items-center gap-1.5 leading-none">
                        <div className="bg-gray-100 rounded h-[3.5px] overflow-hidden flex-shrink-0" style={{ width: `${BAR_MAX_PX}px` }}>
                          <div
                            className={`h-full rounded transition-all duration-500 ${
                              item.actual >= item.target ? actualMetColor : actualNotMetColor
                            }`}
                            style={{ width: `${Math.max(actualPx, item.actual > 0 ? 2 : 0)}px` }}
                          />
                        </div>
                        <span className={`text-[11px] font-bold tabular-nums leading-none whitespace-nowrap ${
                          item.actual >= item.target ? actualMetTextColor : actualNotMetTextColor
                        }`}>
                          {item.actual.toLocaleString()} m³
                          {barAchievement !== null && (
                            <span className="text-[10px] font-medium ml-1 opacity-75">
                              ({barAchievement.toFixed(0)}%)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 leading-none">
                        <div className="bg-gray-100 rounded h-[3.5px] overflow-hidden flex-shrink-0" style={{ width: `${BAR_MAX_PX}px` }}>
                          <div
                            className="h-full bg-gray-400 rounded transition-all duration-500"
                            style={{ width: `${Math.max(targetPx, item.target > 0 ? 2 : 0)}px` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-gray-600 tabular-nums leading-none whitespace-nowrap">
                          {item.target.toLocaleString()} m³
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-2 pt-2 border-t border-gray-300">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-5">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">
                    {getSummaryLabel()} Total
                  </span>
                  <p className="text-sm font-bold text-gray-900">{totalActual.toLocaleString()} m³</p>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Target</span>
                  <p className="text-sm font-bold text-gray-600">{totalTarget.toLocaleString()} m³</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Achievement</span>
                <p className={`text-sm font-bold ${achievement >= 100 ? 'text-green-600' : achievement >= 75 ? 'text-blue-600' : 'text-red-600'}`}>
                  {achievement.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
