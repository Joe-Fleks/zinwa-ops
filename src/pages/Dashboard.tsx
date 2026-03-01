import { AlertTriangle, ExternalLink, Fuel, FlaskConical, ClipboardList, Plus, Pencil, Check, X, FileText, Download, Bell, Calendar, Flag, Search, Droplets, TestTube, Cog, Bot } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getYesterdayString, getWeekDateRangeForWeekNumber, getCurrentWeekNumber, shouldShowPreviousWeek, getMaxWeekNumberForYear, formatDateTime } from '../lib/dateUtils';
import { THRESHOLDS, CHEMICAL_PROD_FIELDS, CHEMICAL_TYPES } from '../lib/metricsConfig';
import { computeReceiptTotal, computeChemicalBalance, computeAvgUsagePerDay, computeDaysRemaining, isChemicalLowStock, isChemicalCriticalStock, computeTotalClients, computeDowntime, isStationNonFunctional } from '../lib/metrics';
import { fetchDailyDemandByStationId } from '../lib/metrics/demandMetrics';
import ProductionTrendChart from '../components/dashboard/ProductionTrendChart';
import ChemicalDosageKPI from '../components/dashboard/ChemicalDosageKPI';
import NRWDashboardKPI from '../components/dashboard/NRWDashboardKPI';
import LabourKPI from '../components/dashboard/LabourKPI';
import RevenueCollectionKPI from '../components/dashboard/RevenueCollectionKPI';
import BreakdownRateKPI from '../components/dashboard/BreakdownRateKPI';
import MeanTimeBetweenFailuresKPI from '../components/dashboard/MeanTimeBetweenFailuresKPI';
import MeanTimeToRepairKPI from '../components/dashboard/MeanTimeToRepairKPI';
import RawWaterNRWKPI from '../components/dashboard/RawWaterNRWKPI';
import UnitCostRWDeliveredKPI from '../components/dashboard/UnitCostRWDeliveredKPI';
import RWVolumeSoldKPI from '../components/dashboard/RWVolumeSoldKPI';
import { fetchPendingWeeklyReports, markReportDownloaded, checkAndTriggerWeeklyReport, refreshWeeklyReportData, type WeeklyReportRecord } from '../lib/weeklyReportService';
import { downloadWeeklyReport } from '../lib/weeklyReportDocument';
import { fetchPendingMonthlyReports, markMonthlyReportDownloaded, checkAndTriggerMonthlyReport, refreshMonthlyReportData, type MonthlyReportRecord } from '../lib/monthlyReportService';
import { downloadMonthlyReport } from '../lib/monthlyReportDocument';
import ReportViewer from '../components/reports/ReportViewer';
import EmbeddedChatPanel from '../components/chat/ChatPanel';

interface Alert {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  created_at: string;
}

interface NonFunctionalStats {
  nonFunctionalCount: number;
  totalStations: number;
  savedRecordsCount: number;
  savedPercentage: number;
  unmetDemandPct: number;
  yesterdayDate: string;
  yesterdayIso: string;
}

interface FuelBalance {
  diesel: number | null;
  petrol: number | null;
}

interface ChemicalStationAlert {
  station_name: string;
  days_remaining: number;
}

interface ChemicalAlerts {
  aluminium_sulphate: ChemicalStationAlert[];
  hth: ChemicalStationAlert[];
  activated_carbon: ChemicalStationAlert[];
}

interface PendingSummarySheets {
  pendingCount: number;
  totalCount: number;
  pendingClientWeight: number;
  totalClientWeight: number;
}

interface CustomFollowupAlert {
  id: string;
  subtitle: string;
  body: string;
  created_by: string;
  due_date: string | null;
  importance: 'High' | 'Medium' | 'Low';
}

export default function Dashboard() {
  const { accessContext, user } = useAuth();
  const { scId } = useParams();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [nonFunctionalStats, setNonFunctionalStats] = useState<NonFunctionalStats | null>(null);
  const [fuelBalances, setFuelBalances] = useState<FuelBalance | null>(null);
  const [chemicalAlerts, setChemicalAlerts] = useState<ChemicalAlerts | null>(null);
  const [pendingSummarySheets, setPendingSummarySheets] = useState<PendingSummarySheets | null>(null);
  const [loading, setLoading] = useState(true);

  const [customAlerts, setCustomAlerts] = useState<CustomFollowupAlert[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newImportance, setNewImportance] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubtitle, setEditSubtitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editImportance, setEditImportance] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReportRecord[]>([]);
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReportRecord[]>([]);
  const [allWeeklyReports, setAllWeeklyReports] = useState<WeeklyReportRecord[]>([]);
  const [allMonthlyReports, setAllMonthlyReports] = useState<MonthlyReportRecord[]>([]);
  const [equipmentAlerts, setEquipmentAlerts] = useState<{ type: string; label: string; station: string; tag: string; expiry: string; daysLeft: number }[]>([]);
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);
  const [refreshingReportId, setRefreshingReportId] = useState<string | null>(null);
  const [viewingReport, setViewingReport] = useState<{ type: 'weekly' | 'monthly'; record: WeeklyReportRecord | MonthlyReportRecord } | null>(null);
  const [alertsTab, setAlertsTab] = useState<'alerts' | 'followups'>('alerts');
  const [trendsTab, setTrendsTab] = useState<'cw' | 'rw' | 'kpis' | 'reports' | 'ai'>('cw');
  const [mergedTab, setMergedTab] = useState<'cw' | 'rw' | 'kpis' | 'reports' | 'ai' | 'alerts' | 'followups'>('cw');
  const [reportSection, setReportSection] = useState<'midweek' | 'endofweek' | 'monthly' | 'quarterly' | 'yearly' | 'station' | 'staff'>('endofweek');
  const [kpiSection, setKpiSection] = useState<'nrw' | 'chemical_usage' | 'labour' | 'revenue_collection' | 'breakdown_rate' | 'mtbf' | 'mttr' | 'rw_nrw' | 'rw_unit_cost' | 'rw_volume_sold'>('nrw');
  const [kpiSearch, setKpiSearch] = useState('');
  const [kpiFilter, setKpiFilter] = useState<'all' | 'cw' | 'rw' | 'maintenance' | 'finance'>('all');
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < 1024);
  const narrowRef = useRef(isNarrow);

  const serviceCentreId = accessContext?.scopeId ?? null;

  const today = new Date();
  const dayOfMonth = today.getDate();
  const showPendingSheets = dayOfMonth >= THRESHOLDS.PENDING_SHEETS_VISIBILITY_DAY;

  useEffect(() => {
    const onResize = () => {
      const narrow = window.innerWidth < 1024;
      if (narrow !== narrowRef.current) {
        narrowRef.current = narrow;
        setIsNarrow(narrow);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    loadData();
    loadCustomAlerts();
    if (serviceCentreId && accessContext) {
      triggerAndLoadReports(serviceCentreId);
    }
  }, [serviceCentreId]);

  const triggerAndLoadReports = async (scId: string) => {
    if (!accessContext) return;
    const scope = { isSCScoped: accessContext.isSCScoped, scopeId: accessContext.scopeId };
    const scName = accessContext.serviceCentre?.name ?? '';
    try {
      await Promise.allSettled([
        checkAndTriggerWeeklyReport(scope, scId, scName),
        checkAndTriggerMonthlyReport(scope, scId, scName),
      ]);
    } catch {
    }
    await Promise.all([
      loadWeeklyReports(scId),
      loadMonthlyReports(scId),
      loadAllReports(scId),
    ]);
  };

  const loadWeeklyReports = async (scId: string) => {
    try {
      const reports = await fetchPendingWeeklyReports(scId);
      setWeeklyReports(reports);
    } catch (err) {
      console.error('Error loading weekly reports:', err);
    }
  };

  const loadMonthlyReports = async (scId: string) => {
    try {
      const reports = await fetchPendingMonthlyReports(scId);
      setMonthlyReports(reports);
    } catch (err) {
      console.error('Error loading monthly reports:', err);
    }
  };

  const loadAllReports = async (scId: string) => {
    try {
      const [wRes, mRes] = await Promise.all([
        supabase
          .from('weekly_reports')
          .select('id, service_centre_id, week_number, year, report_type, period_start, period_end, report_data, status, generated_at, downloaded_at')
          .eq('service_centre_id', scId)
          .order('generated_at', { ascending: false })
          .limit(50),
        supabase
          .from('monthly_reports')
          .select('id, service_centre_id, month, year, report_data, status, generated_at, downloaded_at')
          .eq('service_centre_id', scId)
          .order('generated_at', { ascending: false })
          .limit(24),
      ]);
      setAllWeeklyReports((wRes.data || []) as WeeklyReportRecord[]);
      setAllMonthlyReports((mRes.data || []) as MonthlyReportRecord[]);
    } catch (err) {
      console.error('Error loading all reports:', err);
    }
  };

  const handleDownloadMonthlyReport = async (report: MonthlyReportRecord) => {
    if (!user) return;
    setDownloadingReportId(report.id);
    try {
      downloadMonthlyReport(report.report_data);
      await markMonthlyReportDownloaded(report.id, user.id);
      setMonthlyReports(prev => prev.filter(r => r.id !== report.id));
      setAllMonthlyReports(prev => prev.map(r => r.id === report.id ? { ...r, status: 'downloaded' } : r));
    } catch (err) {
      console.error('Error downloading monthly report:', err);
    } finally {
      setDownloadingReportId(null);
    }
  };

  const handleDownloadReport = async (report: WeeklyReportRecord) => {
    if (!user) return;
    setDownloadingReportId(report.id);
    try {
      downloadWeeklyReport(report.report_data);
      await markReportDownloaded(report.id, user.id);
      setWeeklyReports(prev => prev.filter(r => r.id !== report.id));
      setAllWeeklyReports(prev => prev.map(r => r.id === report.id ? { ...r, status: 'downloaded' } : r));
      if (viewingReport?.record.id === report.id) {
        setViewingReport(prev => prev ? { ...prev, record: { ...report, status: 'downloaded' } } : null);
      }
    } catch (err) {
      console.error('Error downloading report:', err);
    } finally {
      setDownloadingReportId(null);
    }
  };

  const handleDismissWeeklyReport = async (report: WeeklyReportRecord) => {
    if (!user) return;
    try {
      await markReportDownloaded(report.id, user.id);
      setWeeklyReports(prev => prev.filter(r => r.id !== report.id));
      setAllWeeklyReports(prev => prev.map(r => r.id === report.id ? { ...r, status: 'downloaded' } : r));
    } catch (err) {
      console.error('Error dismissing report:', err);
    }
  };

  const handleRefreshWeeklyReport = async (report: WeeklyReportRecord) => {
    if (!accessContext) return;
    setRefreshingReportId(report.id);
    try {
      const scope = { isSCScoped: accessContext.isSCScoped, scopeId: accessContext.scopeId, allowedServiceCentreIds: [] as string[] };
      const scName = accessContext.serviceCentre?.name ?? '';
      const newData = await refreshWeeklyReportData(
        scope, report.id, scName, report.week_number, report.year,
        report.report_type, report.period_start, report.period_end
      );
      const updated = { ...report, report_data: newData };
      setAllWeeklyReports(prev => prev.map(r => r.id === report.id ? updated : r));
      if (viewingReport?.record.id === report.id) {
        setViewingReport({ type: 'weekly', record: updated });
      }
    } catch (err) {
      console.error('Error refreshing weekly report:', err);
    } finally {
      setRefreshingReportId(null);
    }
  };

  const handleRefreshMonthlyReport = async (report: MonthlyReportRecord) => {
    if (!accessContext) return;
    setRefreshingReportId(report.id);
    try {
      const scope = { isSCScoped: accessContext.isSCScoped, scopeId: accessContext.scopeId, allowedServiceCentreIds: [] as string[] };
      const scName = accessContext.serviceCentre?.name ?? '';
      const newData = await refreshMonthlyReportData(scope, report.id, scName, report.year, report.month);
      const updated = { ...report, report_data: newData };
      setAllMonthlyReports(prev => prev.map(r => r.id === report.id ? updated : r));
      if (viewingReport?.record.id === report.id) {
        setViewingReport({ type: 'monthly', record: updated });
      }
    } catch (err) {
      console.error('Error refreshing monthly report:', err);
    } finally {
      setRefreshingReportId(null);
    }
  };

  const IMPORTANCE_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

  const sortFollowups = (items: CustomFollowupAlert[]): CustomFollowupAlert[] => {
    return [...items].sort((a, b) => {
      const impA = IMPORTANCE_ORDER[a.importance] ?? 1;
      const impB = IMPORTANCE_ORDER[b.importance] ?? 1;
      if (impA !== impB) return impA - impB;
      const dA = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const dB = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      if (dA !== dB) return dA - dB;
      return 0;
    });
  };

  const loadCustomAlerts = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('custom_followup_alerts')
      .select('id, subtitle, body, created_by, due_date, importance')
      .eq('created_by', user.id)
      .order('created_at', { ascending: true });

    setCustomAlerts(sortFollowups((data || []) as CustomFollowupAlert[]));
    loadEquipmentAlerts();
  };

  const loadEquipmentAlerts = async () => {
    const allowedSCIds = accessContext?.allowedServiceCentreIds || [];
    if (allowedSCIds.length === 0) return;

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const nextMonth = now.getMonth() === 11 ? new Date(now.getFullYear() + 1, 0, 1) : new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthEnd = nextMonth.toISOString().split('T')[0];

    const tables = [
      { table: 'equipment_pumps', type: 'Pump', labelField: 'pump_use' },
      { table: 'equipment_motors', type: 'Motor', labelField: 'motor_use' },
      { table: 'equipment_bearings', type: 'Bearing', labelField: 'parent_equipment' },
    ];

    const items: typeof equipmentAlerts = [];

    let stMap = new Map<string, string>();
    let stQ = supabase.from('stations').select('id, station_name');
    if (allowedSCIds.length <= 50) stQ = stQ.in('service_centre_id', allowedSCIds);
    const { data: stData } = await stQ;
    if (stData) stMap = new Map(stData.map((s: any) => [s.id, s.station_name]));

    for (const { table, type, labelField } of tables) {
      let q = supabase.from(table)
        .select(`station_id, tag_number, ${labelField}, manufacturer, model, design_life_expiry`)
        .not('design_life_expiry', 'is', null)
        .lte('design_life_expiry', monthEnd)
        .neq('condition', 'Decommissioned');
      if (allowedSCIds.length <= 50) q = q.in('service_centre_id', allowedSCIds);
      const { data } = await q;
      if (!data) continue;
      for (const row of data) {
        const exp = new Date(row.design_life_expiry + 'T12:00:00');
        const daysLeft = Math.round((exp.getTime() - now.getTime()) / 86400000);
        if (daysLeft > 60) continue;
        const lbl = [(row as any)[labelField], row.manufacturer, row.model].filter(Boolean).join(' - ');
        items.push({ type, label: lbl || type, station: stMap.get(row.station_id) || 'Unknown', tag: row.tag_number || '', expiry: row.design_life_expiry, daysLeft });
      }
    }
    items.sort((a, b) => a.daysLeft - b.daysLeft);
    setEquipmentAlerts(items);
  };

  const handleAddCustomAlert = async () => {
    if (!newSubtitle.trim() && !newBody.trim()) return;
    if (!user) return;

    const { data, error } = await supabase
      .from('custom_followup_alerts')
      .insert({
        service_centre_id: serviceCentreId,
        subtitle: newSubtitle.trim(),
        body: newBody.trim(),
        created_by: user.id,
        due_date: newDueDate || null,
        importance: newImportance,
      })
      .select('id, subtitle, body, created_by, due_date, importance')
      .single();

    if (!error && data) {
      setCustomAlerts(prev => sortFollowups([...prev, data as CustomFollowupAlert]));
      setNewSubtitle('');
      setNewBody('');
      setNewDueDate('');
      setNewImportance('Medium');
      setShowAddForm(false);
    }
  };

  const handleEditCustomAlert = async (id: string) => {
    const { error } = await supabase
      .from('custom_followup_alerts')
      .update({
        subtitle: editSubtitle.trim(),
        body: editBody.trim(),
        due_date: editDueDate || null,
        importance: editImportance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (!error) {
      setCustomAlerts(prev =>
        sortFollowups(prev.map(a =>
          a.id === id
            ? { ...a, subtitle: editSubtitle.trim(), body: editBody.trim(), due_date: editDueDate || null, importance: editImportance }
            : a
        ))
      );
      setEditingId(null);
    }
  };

  const handleDeleteCustomAlert = async (id: string) => {
    const { error } = await supabase
      .from('custom_followup_alerts')
      .delete()
      .eq('id', id);

    if (!error) {
      setCustomAlerts(prev => prev.filter(a => a.id !== id));
    }
  };

  const startEdit = (alert: CustomFollowupAlert) => {
    setEditingId(alert.id);
    setEditSubtitle(alert.subtitle);
    setEditBody(alert.body);
    setEditDueDate(alert.due_date || '');
    setEditImportance(alert.importance || 'Medium');
  };

  const loadData = async () => {
    try {
      if (!accessContext) return;

      const yesterday = getYesterdayString();

      const currentWeek = getCurrentWeekNumber();
      const prevWeekNum = currentWeek > 1 ? currentWeek - 1 : getMaxWeekNumberForYear(new Date().getFullYear() - 1);
      const prevWeekYear = currentWeek > 1 ? new Date().getFullYear() : new Date().getFullYear() - 1;
      const prevWeekDates = getWeekDateRangeForWeekNumber(prevWeekNum, prevWeekYear);

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      const endMonth = currentMonth === 12 ? 1 : currentMonth + 1;
      const endYear = currentMonth === 12 ? currentYear + 1 : currentYear;
      const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

      let prevWeekQuery = supabase
        .from('production_logs')
        .select('station_id, load_shedding_hours, other_downtime_hours, stations(station_name, service_centre_id)')
        .gte('date', prevWeekDates.start)
        .lte('date', prevWeekDates.end);

      let stationsQuery = supabase
        .from('stations')
        .select('id, station_name, station_type, service_centre_id')
        .eq('station_type', 'Clear Water');

      let ftStationsQuery = supabase
        .from('stations')
        .select('id, station_name, service_centre_id')
        .eq('station_type', 'Full Treatment');

      let dieselQuery = supabase
        .from('fuel_control_cards')
        .select('balance, entry_date, sort_order')
        .eq('fuel_type', 'diesel')
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .order('entry_date', { ascending: false })
        .order('sort_order', { ascending: false })
        .limit(1);

      let petrolQuery = supabase
        .from('fuel_control_cards')
        .select('balance, entry_date, sort_order')
        .eq('fuel_type', 'petrol')
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .order('entry_date', { ascending: false })
        .order('sort_order', { ascending: false })
        .limit(1);

      if (accessContext.isSCScoped && accessContext.scopeId) {
        prevWeekQuery = prevWeekQuery.eq('stations.service_centre_id', accessContext.scopeId);
        stationsQuery = stationsQuery.eq('service_centre_id', accessContext.scopeId);
        ftStationsQuery = ftStationsQuery.eq('service_centre_id', accessContext.scopeId);
        dieselQuery = dieselQuery.eq('service_centre_id', accessContext.scopeId);
        petrolQuery = petrolQuery.eq('service_centre_id', accessContext.scopeId);
      }

      const [prevWeekResult, stationsResult, ftStationsResult, dieselResult, petrolResult] = await Promise.all([
        prevWeekQuery,
        stationsQuery,
        ftStationsQuery,
        dieselQuery,
        petrolQuery,
      ]);

      const generatedAlerts: Alert[] = [];

      const isFriday = today.getDay() === 5;
      if (isFriday || shouldShowPreviousWeek()) {
        const stationDowntimeMap = new Map<string, { total: number; name: string }>();
        (prevWeekResult.data || []).forEach((log) => {
          const stationName = log.stations?.station_name || 'Unknown Station';
          const downtime = computeDowntime(log.load_shedding_hours, log.other_downtime_hours);
          const current = stationDowntimeMap.get(log.station_id) || { total: 0, name: stationName };
          stationDowntimeMap.set(log.station_id, { total: current.total + downtime, name: stationName });
        });

        const highDowntimeStations = Array.from(stationDowntimeMap.entries())
          .filter(([_, data]) => data.total > THRESHOLDS.HIGH_DOWNTIME_WEEKLY_HOURS)
          .sort((a, b) => b[1].total - a[1].total);

        if (highDowntimeStations.length > 0) {
          const topStation = highDowntimeStations[0];
          generatedAlerts.push({
            id: 'high-downtime-alert',
            title: 'High Downtime Alert',
            message: `${topStation[1].name} recorded ${topStation[1].total.toFixed(1)} hours downtime last week. Review required.`,
            severity: topStation[1].total > THRESHOLDS.CRITICAL_DOWNTIME_WEEKLY_HOURS ? 'critical' : 'warning',
            created_at: new Date().toISOString(),
          });
        }
      }

      const cwStations = stationsResult.data || [];
      if (cwStations.length > 0) {
        const randomStations = cwStations.sort(() => Math.random() - 0.5).slice(0, Math.min(2, cwStations.length));
        randomStations.forEach((station, index) => {
          generatedAlerts.push({
            id: `maintenance-due-${station.id}`,
            title: 'Maintenance Due',
            message: `${station.station_name} requires scheduled maintenance inspection within the next 7 days.`,
            severity: 'info',
            created_at: new Date(Date.now() - index * 86400000).toISOString(),
          });
        });
      }

      setAlerts(generatedAlerts.slice(0, 5));

      const dieselBalance = dieselResult.data && dieselResult.data.length > 0 ? Number(dieselResult.data[0].balance) : null;
      const petrolBalance = petrolResult.data && petrolResult.data.length > 0 ? Number(petrolResult.data[0].balance) : null;

      if (dieselBalance !== null || petrolBalance !== null) {
        setFuelBalances({ diesel: dieselBalance, petrol: petrolBalance });
      }

      const ftStations = ftStationsResult.data || [];
      if (ftStations.length > 0) {
        const ftStationIds = ftStations.map(s => s.id);
        const stationNameMap = new Map(ftStations.map(s => [s.id, s.station_name]));

        const [balancesResult, receiptsResult, prodLogsResult] = await Promise.all([
          supabase
            .from('chemical_stock_balances')
            .select('station_id, chemical_type, opening_balance, year, month')
            .in('station_id', ftStationIds)
            .in('chemical_type', ['aluminium_sulphate', 'hth', 'activated_carbon'])
            .order('year', { ascending: false })
            .order('month', { ascending: false }),
          supabase
            .from('chemical_stock_receipts')
            .select('station_id, chemical_type, quantity, receipt_type, year, month')
            .in('station_id', ftStationIds)
            .in('chemical_type', ['aluminium_sulphate', 'hth', 'activated_carbon'])
            .order('year', { ascending: false })
            .order('month', { ascending: false }),
          supabase
            .from('production_logs')
            .select('station_id, alum_kg, hth_kg, activated_carbon_kg, date')
            .in('station_id', ftStationIds)
            .order('date', { ascending: false })
            .limit(1000),
        ]);

        const newChemicalAlerts: ChemicalAlerts = {
          aluminium_sulphate: [],
          hth: [],
          activated_carbon: [],
        };

        for (const chemType of CHEMICAL_TYPES) {
          const prodField = CHEMICAL_PROD_FIELDS[chemType];

          for (const stationId of ftStationIds) {
            const stationName = stationNameMap.get(stationId) || 'Unknown';

            const balanceRow = (balancesResult.data || []).find(
              r => r.station_id === stationId && r.chemical_type === chemType
            );

            if (!balanceRow) continue;

            const balanceYear = balanceRow.year;
            const balanceMonth = balanceRow.month;
            const openingBalance = Number(balanceRow.opening_balance) || 0;

            const stationReceipts = (receiptsResult.data || [])
              .filter(r =>
                r.station_id === stationId &&
                r.chemical_type === chemType &&
                (r.year > balanceYear || (r.year === balanceYear && r.month >= balanceMonth))
              );
            const received = computeReceiptTotal(stationReceipts);

            const balanceStartDate = `${balanceYear}-${String(balanceMonth).padStart(2, '0')}-01`;
            let usedTotal = 0;
            let productionDays = 0;
            (prodLogsResult.data || [])
              .filter(r => r.station_id === stationId && r.date >= balanceStartDate)
              .forEach((r: any) => {
                const val = Number(r[prodField]) || 0;
                usedTotal += val;
                if (val > 0) productionDays++;
              });

            const currentBalance = computeChemicalBalance(openingBalance, received, usedTotal);
            if (currentBalance <= 0) continue;

            const avgUsage = computeAvgUsagePerDay(usedTotal, productionDays);
            const daysRemaining = computeDaysRemaining(currentBalance, avgUsage);

            if (isChemicalLowStock(daysRemaining)) {
              newChemicalAlerts[chemType].push({
                station_name: stationName,
                days_remaining: Math.round(daysRemaining!),
              });
            }
          }

          newChemicalAlerts[chemType].sort((a, b) => a.days_remaining - b.days_remaining);
        }

        const hasAnyLow =
          newChemicalAlerts.aluminium_sulphate.length > 0 ||
          newChemicalAlerts.hth.length > 0 ||
          newChemicalAlerts.activated_carbon.length > 0;

        if (hasAnyLow) {
          setChemicalAlerts(newChemicalAlerts);
        }
      }

      let allStationsQuery = supabase
        .from('stations')
        .select('id, target_daily_hours, cw_pump_rate_m3_hr, service_centre_id');

      if (accessContext.isSCScoped && accessContext.scopeId) {
        allStationsQuery = allStationsQuery.eq('service_centre_id', accessContext.scopeId);
      }

      const { data: allStations } = await allStationsQuery;
      const totalStations = (allStations || []).length;

      if (totalStations > 0) {
        const stationIds = allStations!.map(s => s.id);

        const { data: yesterdayLogs } = await supabase
          .from('production_logs')
          .select('station_id, cw_volume_m3, cw_hours_run, load_shedding_hours, other_downtime_hours')
          .in('station_id', stationIds)
          .eq('date', yesterday);

        const { data: breakdowns } = await supabase
          .from('station_breakdowns')
          .select('station_id')
          .in('station_id', stationIds)
          .eq('breakdown_impact', 'Stopped pumping')
          .eq('is_resolved', false)
          .lte('date_reported', yesterday);

        const stoppingBreakdownStationIds = new Set(
          (breakdowns || []).map((b: any) => b.station_id)
        );

        const logsByStation = new Map<string, any>();
        for (const log of (yesterdayLogs || [])) {
          logsByStation.set(log.station_id, log);
        }

        const savedRecordsCount = logsByStation.size;
        let nonFunctionalCount = 0;

        for (const station of allStations!) {
          const log = logsByStation.get(station.id);
          if (!log) continue;

          if (isStationNonFunctional({
            cwVolume: Number(log.cw_volume_m3 || 0),
            cwHours: Number(log.cw_hours_run || 0),
            targetDailyHours: Number(station.target_daily_hours || 0),
            pumpRate: station.cw_pump_rate_m3_hr || 0,
            hasStoppingBreakdown: stoppingBreakdownStationIds.has(station.id),
          })) {
            nonFunctionalCount++;
          }
        }

        const savedPercentage = totalStations > 0 ? (savedRecordsCount / totalStations) * 100 : 0;

        const nonFunctionalStationIds = allStations!
          .filter(station => {
            const log = logsByStation.get(station.id);
            if (!log) return false;
            return isStationNonFunctional({
              cwVolume: Number(log.cw_volume_m3 || 0),
              cwHours: Number(log.cw_hours_run || 0),
              targetDailyHours: Number(station.target_daily_hours || 0),
              pumpRate: station.cw_pump_rate_m3_hr || 0,
              hasStoppingBreakdown: stoppingBreakdownStationIds.has(station.id),
            });
          })
          .map(s => s.id);

        const todayDate = new Date(yesterday);
        const demandYear = todayDate.getFullYear();
        const demandMonth = todayDate.getMonth() + 1;

        const { totalDailyDemandM3, demandByStationId } = await fetchDailyDemandByStationId(
          stationIds,
          demandYear,
          demandMonth
        );

        const nonFunctionalDailyDemand = nonFunctionalStationIds.reduce(
          (sum, id) => sum + (demandByStationId.get(id) || 0),
          0
        );

        const unmetDemandPct = totalDailyDemandM3 > 0
          ? Math.round((nonFunctionalDailyDemand / totalDailyDemandM3) * 100)
          : 0;

        const yesterdayDateObj = new Date(yesterday);
        const formattedDate = yesterdayDateObj.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });

        setNonFunctionalStats({
          nonFunctionalCount,
          totalStations,
          savedRecordsCount,
          savedPercentage,
          unmetDemandPct,
          yesterdayDate: formattedDate,
          yesterdayIso: yesterday,
        });
      }

      let cwStationsForSalesQuery = supabase
        .from('stations')
        .select('id, clients_domestic, clients_school, clients_business, clients_industry, clients_church, clients_parastatal, clients_government, clients_other');

      if (accessContext.isSCScoped && accessContext.scopeId) {
        cwStationsForSalesQuery = cwStationsForSalesQuery.eq('service_centre_id', accessContext.scopeId);
      }

      const { data: cwStationsForSales } = await cwStationsForSalesQuery;
      const cwStationIds = (cwStationsForSales || []).map(s => s.id);
      const cwStationClientMap = new Map<string, number>(
        (cwStationsForSales || []).map(s => [s.id, computeTotalClients(s)])
      );

      if (cwStationIds.length > 0) {
        const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const prevMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
        const prevMonthStart = `${prevMonthYear}-${String(prevMonth).padStart(2, '0')}-01`;
        const prevMonthEnd = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;

        const [currentSalesRes, prevProdRes] = await Promise.all([
          supabase
            .from('sales_records')
            .select('station_id, returns_volume_m3')
            .eq('year', currentYear)
            .eq('month', currentMonth)
            .in('station_id', cwStationIds),
          supabase
            .from('production_logs')
            .select('station_id, cw_volume_m3')
            .in('station_id', cwStationIds)
            .gte('date', prevMonthStart)
            .lt('date', prevMonthEnd),
        ]);

        const salesMap = new Map(
          (currentSalesRes.data || []).map(r => [r.station_id, Number(r.returns_volume_m3)])
        );

        const prevProdMap = new Map<string, number>();
        for (const log of (prevProdRes.data || [])) {
          const existing = prevProdMap.get(log.station_id) || 0;
          prevProdMap.set(log.station_id, existing + Number(log.cw_volume_m3 || 0));
        }

        let pendingCount = 0;
        let eligibleTotal = 0;
        let pendingClientWeight = 0;
        let totalClientWeight = 0;
        for (const id of cwStationIds) {
          const prevVol = prevProdMap.get(id) || 0;
          if (prevVol > 0) {
            eligibleTotal++;
            const clientCount = cwStationClientMap.get(id) || 1;
            totalClientWeight += clientCount;
            const returns = salesMap.get(id) ?? null;
            if (returns === null) {
              pendingCount++;
              pendingClientWeight += clientCount;
            }
          }
        }

        if (eligibleTotal > 0) {
          setPendingSummarySheets({ pendingCount, totalCount: eligibleTotal, pendingClientWeight, totalClientWeight });
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 border-red-400 text-red-800';
      case 'warning': return 'bg-yellow-100 border-yellow-400 text-yellow-800';
      default: return 'bg-blue-100 border-blue-400 text-blue-800';
    }
  };

  const CHEM_SECTIONS = [
    { key: 'aluminium_sulphate' as const, label: 'Alum', chemParam: 'aluminium_sulphate' },
    { key: 'hth' as const, label: 'HTH', chemParam: 'hth' },
    { key: 'activated_carbon' as const, label: 'Activated Carbon', chemParam: 'activated_carbon' },
  ];

  const showFollowups = showPendingSheets
    ? (pendingSummarySheets && pendingSummarySheets.pendingCount > 0) || customAlerts.length > 0
    : customAlerts.length > 0;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const dueTomorrowAlerts = customAlerts.filter(a => a.due_date === tomorrowStr);

  const importanceColor = (imp: 'High' | 'Medium' | 'Low') => {
    if (imp === 'High') return 'text-red-600';
    if (imp === 'Medium') return 'text-amber-600';
    return 'text-gray-500';
  };

  const importanceBadge = (imp: 'High' | 'Medium' | 'Low') => {
    if (imp === 'High') return 'bg-red-100 text-red-700 border border-red-200';
    if (imp === 'Medium') return 'bg-amber-50 text-amber-700 border border-amber-200';
    return 'bg-gray-100 text-gray-500 border border-gray-200';
  };

  const renderAlertsContent = () => (
    <div className="space-y-3">
      {dueTomorrowAlerts.map(a => (
        <div key={`due-${a.id}`} className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5">
          <div className="flex items-start gap-2">
            <Bell className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-800 uppercase" style={{ fontSize: '11px' }}>Deadline Tomorrow</p>
              <p className="text-sm font-semibold text-gray-700 mt-0.5">{a.subtitle || 'Follow-up'}</p>
              {a.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.body}</p>}
            </div>
            <button
              onClick={() => { setAlertsTab('followups'); setMergedTab('followups'); startEdit(a); }}
              className="text-xs font-semibold px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 ring-1 ring-blue-200 rounded transition-colors whitespace-nowrap"
            >
              View
            </button>
          </div>
        </div>
      ))}
      {equipmentAlerts.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-lg px-3 py-2.5">
          <div className="flex items-start gap-2">
            <Cog className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-amber-900 uppercase" style={{ fontSize: '11px' }}>
                Equipment reaching design life in {new Date().toLocaleString('en-US', { month: 'long' })}
              </p>
              <div className="mt-1.5 space-y-1">
                {equipmentAlerts.slice(0, 3).map((ea, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ea.daysLeft < 0 ? 'bg-red-500' : 'bg-amber-500'}`} />
                    <span className="text-gray-700 truncate">{ea.type}: {ea.label}</span>
                    <span className="text-gray-400 flex-shrink-0">@ {ea.station}</span>
                    <span className={`ml-auto font-semibold flex-shrink-0 ${ea.daysLeft < 0 ? 'text-red-700' : 'text-amber-700'}`}>
                      {ea.daysLeft < 0 ? `${Math.abs(ea.daysLeft)}d overdue` : `${ea.daysLeft}d left`}
                    </span>
                  </div>
                ))}
                {equipmentAlerts.length > 3 && (
                  <p className="text-[10px] text-amber-600 mt-0.5">+{equipmentAlerts.length - 3} more items</p>
                )}
              </div>
            </div>
          </div>
          <Link
            to="/maintenance?tab=equipment"
            className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-900 text-xs font-semibold rounded transition-colors"
          >
            <Calendar className="w-3.5 h-3.5" />View Design Life Calendar
          </Link>
        </div>
      )}
      {weeklyReports.length > 0 && weeklyReports.map(report => {
        const reportTypeLbl = report.report_type === 'friday' ? 'Friday' : 'Tuesday';
        const periodStart = new Date(report.period_start + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        const periodEnd = new Date(report.period_end + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const isDownloading = downloadingReportId === report.id;
        return (
          <div key={report.id} className="bg-sky-50 border-2 border-sky-400 rounded-lg px-3 py-2.5">
            <div className="flex items-start gap-2 mb-2">
              <FileText className="w-4 h-4 text-sky-700 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sky-900 uppercase" style={{ fontSize: '11px' }}>Weekly Report Ready</p>
                <p className="text-sm font-semibold text-sky-800 mt-0.5">{reportTypeLbl} Report — Week {report.week_number}, {report.year}</p>
                <p className="text-xs text-sky-700 mt-0.5">{periodStart} – {periodEnd}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleDismissWeeklyReport(report)}
                disabled={isDownloading}
                className="flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 text-xs font-semibold rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />Dismiss
              </button>
              <button
                onClick={() => handleDownloadReport(report)}
                disabled={isDownloading}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 disabled:bg-blue-50/50 disabled:ring-blue-100 text-blue-700 ring-1 ring-blue-200 text-xs font-semibold rounded transition-colors"
              >
                {isDownloading ? (
                  <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>Preparing...</>
                ) : (
                  <><Download className="w-3.5 h-3.5" />Download Word Report (.docx)</>
                )}
              </button>
            </div>
          </div>
        );
      })}
      {monthlyReports.length > 0 && monthlyReports.map(report => {
        const isDownloading = downloadingReportId === report.id;
        const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const monthLabel = MONTH_NAMES[report.month] || `Month ${report.month}`;
        return (
          <div key={report.id} className="bg-teal-50 border-2 border-teal-400 rounded-lg px-3 py-2.5">
            <div className="flex items-start gap-2 mb-2">
              <FileText className="w-4 h-4 text-teal-700 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-teal-900 uppercase" style={{ fontSize: '11px' }}>Monthly Report Ready</p>
                <p className="text-sm font-semibold text-teal-800 mt-0.5">{monthLabel} {report.year} Operations Report</p>
                <p className="text-xs text-teal-700 mt-0.5">{report.report_data?.production?.stationCount ?? 0} stations · {report.report_data?.completionPct ?? 0}% data coverage</p>
              </div>
            </div>
            <button
              onClick={() => handleDownloadMonthlyReport(report)}
              disabled={isDownloading}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 disabled:bg-blue-50/50 disabled:ring-blue-100 text-blue-700 ring-1 ring-blue-200 text-xs font-semibold rounded transition-colors"
            >
              {isDownloading ? (
                <><span className="w-3 h-3 border-2 border-blue-900 border-t-transparent rounded-full animate-spin"></span>Preparing...</>
              ) : (
                <><Download className="w-3.5 h-3.5" />Download Monthly Report (.docx)</>
              )}
            </button>
          </div>
        );
      })}
      {nonFunctionalStats && (nonFunctionalStats.savedPercentage < 100 || nonFunctionalStats.nonFunctionalCount > 0) && (
        <div className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 space-y-1">
          <div className="font-bold text-gray-800 uppercase mb-1" style={{ fontSize: '11px' }}>
            Non-functional Stations — {nonFunctionalStats.yesterdayDate}
          </div>
          {nonFunctionalStats.savedPercentage < 100 && (
            <div className="py-0.5">
              <p className="text-sm font-bold text-gray-700">Production records saved</p>
              <div className="flex items-center justify-between gap-3 mt-0.5">
                <p className="text-sm text-gray-700">{nonFunctionalStats.savedRecordsCount} out of {nonFunctionalStats.totalStations} stations updated: {Math.round(nonFunctionalStats.savedPercentage)}%</p>
                <Link
                  to={`/sc/${scId}/clearwater?tab=production&date=${nonFunctionalStats.yesterdayIso}`}
                  className="px-2.5 py-1 bg-blue-50 text-blue-700 ring-1 ring-blue-200 text-xs font-semibold rounded hover:bg-blue-100 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  Update Logs<ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
          {nonFunctionalStats.nonFunctionalCount > 0 && (
            <>
              {nonFunctionalStats.savedPercentage < 100 && <div className="border-t border-gray-300 my-1"></div>}
              <div className="py-0.5">
                <p className="text-sm font-bold text-gray-700">{nonFunctionalStats.nonFunctionalCount} out of {nonFunctionalStats.savedRecordsCount} stations not producing</p>
                <div className="flex items-center justify-between gap-3 mt-0.5">
                  <p className="text-sm text-red-700">{nonFunctionalStats.unmetDemandPct}% of daily demand</p>
                  <Link to={`/sc/${scId}/maintenance?tab=non-functional`} className="px-2.5 py-1 bg-blue-50 text-blue-700 ring-1 ring-blue-200 text-xs font-semibold rounded hover:bg-blue-400 transition-colors flex items-center gap-1.5 whitespace-nowrap">
                    More Details<ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {fuelBalances && (
        <div className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 mb-2">
            <Fuel className="w-4 h-4 text-gray-700" />
            <span className="font-bold text-gray-800 uppercase" style={{ fontSize: '11px' }}>Fuel Balances</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xs font-bold text-gray-800 w-14">Diesel</span>
                <span className={`text-sm font-bold ${fuelBalances.diesel !== null && fuelBalances.diesel < THRESHOLDS.FUEL_LOW_BALANCE_LITRES ? 'text-red-600' : 'text-green-700'}`}>
                  {fuelBalances.diesel !== null ? `${fuelBalances.diesel.toFixed(1)} L` : 'N/A'}
                </span>
              </div>
              <Link to={`/sc/${scId}/stock-control?tab=fuel&fuel=diesel`} className="text-xs font-semibold px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 ring-1 ring-blue-200 rounded transition-colors flex items-center gap-1 whitespace-nowrap">
                See control card<ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            <div className="border-t border-gray-300"></div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xs font-bold text-gray-800 w-14">Petrol</span>
                <span className={`text-sm font-bold ${fuelBalances.petrol !== null && fuelBalances.petrol < THRESHOLDS.FUEL_LOW_BALANCE_LITRES ? 'text-red-600' : 'text-green-700'}`}>
                  {fuelBalances.petrol !== null ? `${fuelBalances.petrol.toFixed(1)} L` : 'N/A'}
                </span>
              </div>
              <Link to={`/sc/${scId}/stock-control?tab=fuel&fuel=petrol`} className="text-xs font-semibold px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 ring-1 ring-blue-200 rounded transition-colors flex items-center gap-1 whitespace-nowrap">
                See control card<ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      )}
      {chemicalAlerts && (
        <div className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 mb-2">
            <FlaskConical className="w-4 h-4 text-gray-700" />
            <span className="font-bold text-gray-800 uppercase" style={{ fontSize: '11px' }}>Low Chemical Balances</span>
          </div>
          <div className="space-y-2">
            {CHEM_SECTIONS.filter(s => chemicalAlerts[s.key].length > 0).map((section, idx) => {
              const stations = chemicalAlerts[section.key];
              const hasCritical = stations.some(s => isChemicalCriticalStock(s.days_remaining));
              return (
                <div key={section.key}>
                  {idx > 0 && <div className="border-t border-gray-300 mb-2"></div>}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-gray-800">{section.label}</span>
                    <Link
                      to={`/sc/${scId}/stock-control?tab=chemicals&chemical=${section.chemParam}`}
                      className="text-xs font-semibold rounded px-2.5 py-1 flex items-center gap-1 whitespace-nowrap transition-colors bg-blue-50 text-blue-700 ring-1 ring-blue-200 hover:bg-blue-400"
                    >
                      View Balances<ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                  <div className="space-y-0.5">
                    {stations.map((st) => (
                      <div key={st.station_name} className="flex items-center justify-between">
                        <span className="text-xs text-gray-600 truncate flex-1 mr-2">{st.station_name}</span>
                        <span className={`text-xs whitespace-nowrap flex items-center gap-1 ${isChemicalCriticalStock(st.days_remaining) ? 'text-red-600' : 'text-orange-500'}`}>
                          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                          {st.days_remaining} day{st.days_remaining !== 1 ? 's' : ''} left
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {alerts.map((alert) => (
        <div key={alert.id} className={`p-4 rounded-lg border ${getSeverityColor(alert.severity)}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm uppercase">{alert.title}</h3>
              <p className="text-xs mt-1 opacity-90">{alert.message}</p>
              <p className="text-xs mt-2 opacity-75">{formatDateTime(alert.created_at)}</p>
            </div>
          </div>
        </div>
      ))}
      {dueTomorrowAlerts.length === 0 && weeklyReports.length === 0 && monthlyReports.length === 0 && !nonFunctionalStats && !fuelBalances && !chemicalAlerts && alerts.length === 0 && (
        <div className="text-center py-8">
          <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No active alerts</p>
        </div>
      )}
    </div>
  );

  const renderFollowupsContent = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 font-medium">Your personal follow-up items</span>
        <button
          onClick={() => { setShowAddForm(true); setNewSubtitle(''); setNewBody(''); setNewDueDate(''); setNewImportance('Medium'); }}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 ring-1 ring-blue-200 rounded transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add Follow-up
        </button>
      </div>
      {showAddForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
          <p className="text-xs font-bold text-blue-800 uppercase">New Follow-up</p>
          <input
            type="text"
            value={newSubtitle}
            onChange={e => setNewSubtitle(e.target.value)}
            placeholder="Title"
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <textarea
            value={newBody}
            onChange={e => setNewBody(e.target.value)}
            placeholder="Details (optional)"
            rows={2}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-0.5 font-medium">Due Date</label>
              <input
                type="date"
                value={newDueDate}
                onChange={e => setNewDueDate(e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5 font-medium">Importance</label>
              <select
                value={newImportance}
                onChange={e => setNewImportance(e.target.value as 'High' | 'Medium' | 'Low')}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button onClick={handleAddCustomAlert} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 ring-1 ring-blue-200 rounded transition-colors">
              <Check className="w-3 h-3" />Save
            </button>
            <button onClick={() => setShowAddForm(false)} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-200 hover:bg-gray-300 rounded transition-colors">
              <X className="w-3 h-3" />Cancel
            </button>
          </div>
        </div>
      )}
      {showPendingSheets && pendingSummarySheets && pendingSummarySheets.pendingCount > 0 && (
        <div className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-2">
          <p className="text-xs font-bold text-gray-700">Pending summary sheets</p>
          <div className="flex items-center justify-between gap-3 mt-0.5">
            <p className="text-sm text-gray-800">
              <span className="text-amber-700">{pendingSummarySheets.pendingCount}/{pendingSummarySheets.totalCount} stations</span>
              {' '}<span className="text-gray-500 text-xs">— {pendingSummarySheets.totalClientWeight > 0 ? Math.round((pendingSummarySheets.pendingClientWeight / pendingSummarySheets.totalClientWeight) * 100) : Math.round((pendingSummarySheets.pendingCount / pendingSummarySheets.totalCount) * 100)}% outstanding</span>
            </p>
            <Link to={`/sc/${scId}/clearwater?tab=sales&filter=pending`} className="text-xs font-semibold px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 ring-1 ring-blue-200 rounded transition-colors flex items-center gap-1 whitespace-nowrap">
              See Details<ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
      {customAlerts.length === 0 && !showAddForm && (
        <div className="text-center py-8">
          <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No follow-ups yet</p>
          <p className="text-gray-400 text-xs mt-1">Add items to track your personal action items</p>
        </div>
      )}
      {customAlerts.map((alert) => (
        <div key={alert.id} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
          {editingId === alert.id ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editSubtitle}
                onChange={e => setEditSubtitle(e.target.value)}
                placeholder="Title"
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <textarea
                value={editBody}
                onChange={e => setEditBody(e.target.value)}
                placeholder="Details"
                rows={2}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5 font-medium">Due Date</label>
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={e => setEditDueDate(e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5 font-medium">Importance</label>
                  <select
                    value={editImportance}
                    onChange={e => setEditImportance(e.target.value as 'High' | 'Medium' | 'Low')}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => handleEditCustomAlert(alert.id)} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 ring-1 ring-blue-200 rounded transition-colors">
                  <Check className="w-3 h-3" />Save
                </button>
                <button onClick={() => setEditingId(null)} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-200 hover:bg-gray-300 rounded transition-colors">
                  <X className="w-3 h-3" />Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <Flag className={`w-3 h-3 flex-shrink-0 ${importanceColor(alert.importance)}`} />
                  {alert.subtitle && <p className="text-xs font-bold text-gray-800 truncate">{alert.subtitle}</p>}
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${importanceBadge(alert.importance)}`}>
                  {alert.importance}
                </span>
              </div>
              {alert.body && <p className="text-xs text-gray-600 mt-0.5 mb-1.5 line-clamp-3">{alert.body}</p>}
              {alert.due_date && (
                <div className="flex items-center gap-1 mb-2">
                  <Calendar className="w-3 h-3 text-gray-400" />
                  <span className={`text-xs ${alert.due_date === tomorrowStr ? 'text-amber-600 font-semibold' : alert.due_date < today.toISOString().split('T')[0] ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                    Due {new Date(alert.due_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {alert.due_date === tomorrowStr && ' — Tomorrow!'}
                    {alert.due_date < today.toISOString().split('T')[0] && ' — Overdue'}
                  </span>
                </div>
              )}
              <div className="flex gap-1.5">
                <button onClick={() => startEdit(alert)} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded transition-colors">
                  <Pencil className="w-3 h-3" />Edit
                </button>
                <button onClick={() => handleDeleteCustomAlert(alert.id)} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 ring-1 ring-blue-200 rounded transition-colors">
                  <Check className="w-3 h-3" />Done
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );

  const MONTH_NAMES_FULL = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const midweekReports = allWeeklyReports.filter(r => r.report_type === 'tuesday');
  const endOfWeekReports = allWeeklyReports.filter(r => r.report_type === 'friday');

  const REPORT_SECTIONS: { key: typeof reportSection; label: string; count?: number }[] = [
    { key: 'midweek', label: 'Mid-week Reports', count: midweekReports.length },
    { key: 'endofweek', label: 'End of Week Reports', count: endOfWeekReports.length },
    { key: 'monthly', label: 'Monthly Reports', count: allMonthlyReports.length },
    { key: 'station', label: 'Station Reports' },
    { key: 'staff', label: 'Staff Performance' },
    { key: 'quarterly', label: 'Quarterly Reports', count: 0 },
    { key: 'yearly', label: 'Yearly Reports', count: 0 },
  ];

  const renderWeeklyReportList = (reports: WeeklyReportRecord[], accentColor: { bg: string; border: string; readyBg: string; readyText: string; badgeBg: string; badgeText: string; btnBg: string; btnHover: string; btnDisabled: string; iconColor: string }) => {
    if (reports.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="w-10 h-10 text-gray-200 mb-3" />
          <p className="text-sm font-medium text-gray-400">No reports available</p>
          <p className="text-xs text-gray-300 mt-1">Reports are generated automatically</p>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {reports.map(report => {
          const periodStart = new Date(report.period_start + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
          const periodEnd = new Date(report.period_end + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
          const isDownloading = downloadingReportId === report.id;
          const isReady = report.status === 'ready';
          return (
            <div key={report.id} className={`rounded-lg px-3 py-2.5 border ${isReady ? `${accentColor.readyBg} ${accentColor.border}` : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-start gap-2">
                <FileText className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isReady ? accentColor.iconColor : 'text-gray-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-xs font-bold uppercase ${isReady ? accentColor.readyText : 'text-gray-600'}`}>Week {report.week_number}, {report.year}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${isReady ? `${accentColor.badgeBg} ${accentColor.badgeText}` : 'bg-gray-200 text-gray-500'}`}>{isReady ? 'Ready' : 'Downloaded'}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{periodStart} – {periodEnd}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setViewingReport({ type: 'weekly', record: report })}
                    className="flex items-center gap-1 px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 ring-1 ring-blue-200 text-xs font-semibold rounded transition-colors whitespace-nowrap"
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleDownloadReport(report)}
                    disabled={isDownloading}
                    className="flex items-center gap-1 px-2 py-1 bg-blue-50 hover:bg-blue-100 disabled:bg-blue-50/50 disabled:ring-blue-100 text-blue-700 ring-1 ring-blue-200 text-xs font-semibold rounded transition-colors whitespace-nowrap"
                  >
                    {isDownloading ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Download className="w-3 h-3" />}
                    {isDownloading ? '' : 'Download'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  type KpiKey = 'nrw' | 'chemical_usage' | 'labour' | 'revenue_collection' | 'breakdown_rate' | 'mtbf' | 'mttr' | 'rw_nrw' | 'rw_unit_cost' | 'rw_volume_sold';
  const KPI_ITEMS: { key: KpiKey; label: string; icon: React.ReactNode; category: 'cw' | 'rw' | 'maintenance' | 'finance' }[] = [
    { key: 'nrw', label: 'Non-Revenue Water (NRW)', icon: <Droplets className="w-3.5 h-3.5" />, category: 'cw' },
    { key: 'chemical_usage', label: 'Chemical Dosage', icon: <TestTube className="w-3.5 h-3.5" />, category: 'cw' },
    { key: 'labour', label: 'Labour Productivity', icon: <span className="w-3.5 h-3.5 flex items-center justify-center text-[10px] font-bold">L</span>, category: 'cw' },
    { key: 'revenue_collection', label: 'Revenue Collection Efficiency', icon: <span className="w-3.5 h-3.5 flex items-center justify-center text-[10px] font-bold">$</span>, category: 'finance' },
    { key: 'breakdown_rate', label: 'Breakdown Rate', icon: <AlertTriangle className="w-3.5 h-3.5" />, category: 'maintenance' },
    { key: 'mtbf', label: 'Mean Time Between Failures', icon: <Cog className="w-3.5 h-3.5" />, category: 'maintenance' },
    { key: 'mttr', label: 'Mean Time to Repair', icon: <Cog className="w-3.5 h-3.5" />, category: 'maintenance' },
    { key: 'rw_nrw', label: 'Raw Water NRW', icon: <Droplets className="w-3.5 h-3.5" />, category: 'rw' },
    { key: 'rw_unit_cost', label: 'Unit Cost of RW Delivered', icon: <span className="w-3.5 h-3.5 flex items-center justify-center text-[10px] font-bold">C</span>, category: 'rw' },
    { key: 'rw_volume_sold', label: 'RW Volume Sold', icon: <span className="w-3.5 h-3.5 flex items-center justify-center text-[10px] font-bold">V</span>, category: 'rw' },
  ];

  const KPI_FILTER_OPTIONS: { value: typeof kpiFilter; label: string }[] = [
    { value: 'all', label: 'All KPIs' },
    { value: 'cw', label: 'CW KPIs' },
    { value: 'rw', label: 'RW KPIs' },
    { value: 'maintenance', label: 'Maintenance KPIs' },
    { value: 'finance', label: 'Finance KPIs' },
  ];

  const filteredKpis = KPI_ITEMS.filter(k => {
    const matchesCategory = kpiFilter === 'all' || k.category === kpiFilter;
    const matchesSearch = k.label.toLowerCase().includes(kpiSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const renderKpisContent = () => (
    <div className="flex h-full min-h-[400px]">
      <div className="w-44 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col">
        <div className="p-2 border-b border-gray-200 space-y-1.5">
          <select
            value={kpiFilter}
            onChange={e => {
              const newFilter = e.target.value as typeof kpiFilter;
              setKpiFilter(newFilter);
              const firstMatch = KPI_ITEMS.find(k => newFilter === 'all' || k.category === newFilter);
              if (firstMatch) setKpiSection(firstMatch.key);
            }}
            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-700 font-medium"
          >
            {KPI_FILTER_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={kpiSearch}
              onChange={e => setKpiSearch(e.target.value)}
              placeholder="Search KPIs..."
              className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>
        <div className="flex-1 py-1 overflow-y-auto thin-scrollbar">
          {filteredKpis.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4 px-2">No KPIs available</p>
          ) : (
            filteredKpis.map(kpi => {
              const isActive = kpiSection === kpi.key;
              return (
                <button
                  key={kpi.key}
                  onClick={() => setKpiSection(kpi.key)}
                  className={`w-full text-left px-3 py-2.5 transition-colors flex items-center gap-2 ${
                    isActive
                      ? 'bg-blue-50 border-r-2 border-blue-400 text-blue-700 font-semibold'
                      : 'text-gray-600 hover:bg-white hover:text-gray-800'
                  }`}
                >
                  <span className={isActive ? 'text-blue-700' : 'text-gray-400'}>{kpi.icon}</span>
                  <span className="text-xs leading-tight">{kpi.label}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto thin-scrollbar px-4 py-4">
        {filteredKpis.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
            <p className="text-sm font-medium">No KPIs available</p>
            <p className="text-xs mt-1">No KPIs have been added to this category yet.</p>
          </div>
        ) : (
          <>
            {kpiSection === 'nrw' && filteredKpis.some(k => k.key === 'nrw') && <NRWDashboardKPI />}
            {kpiSection === 'chemical_usage' && filteredKpis.some(k => k.key === 'chemical_usage') && <ChemicalDosageKPI />}
            {kpiSection === 'labour' && filteredKpis.some(k => k.key === 'labour') && <LabourKPI />}
            {kpiSection === 'revenue_collection' && filteredKpis.some(k => k.key === 'revenue_collection') && <RevenueCollectionKPI />}
            {kpiSection === 'breakdown_rate' && filteredKpis.some(k => k.key === 'breakdown_rate') && <BreakdownRateKPI />}
            {kpiSection === 'mtbf' && filteredKpis.some(k => k.key === 'mtbf') && <MeanTimeBetweenFailuresKPI />}
            {kpiSection === 'mttr' && filteredKpis.some(k => k.key === 'mttr') && <MeanTimeToRepairKPI />}
            {kpiSection === 'rw_nrw' && filteredKpis.some(k => k.key === 'rw_nrw') && <RawWaterNRWKPI />}
            {kpiSection === 'rw_unit_cost' && filteredKpis.some(k => k.key === 'rw_unit_cost') && <UnitCostRWDeliveredKPI />}
            {kpiSection === 'rw_volume_sold' && filteredKpis.some(k => k.key === 'rw_volume_sold') && <RWVolumeSoldKPI />}
          </>
        )}
      </div>
    </div>
  );

  const renderReportsContent = () => {
    if (viewingReport) {
      const { type, record } = viewingReport;
      const isWeekly = type === 'weekly';
      const wr = record as WeeklyReportRecord;
      const mr = record as MonthlyReportRecord;
      const title = isWeekly
        ? `Week ${wr.week_number}, ${wr.year} — ${wr.report_type === 'friday' ? 'End of Week' : 'Mid-week'} Report`
        : `${(record as MonthlyReportRecord).report_data?.monthName} ${mr.year} — Monthly Operations Report`;
      const subtitle = isWeekly
        ? `${new Date(wr.period_start + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – ${new Date(wr.period_end + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
        : record.report_data?.serviceCentreName ?? '';
      const reportData = record.report_data;
      const isRefreshing = refreshingReportId === record.id;
      const isDownloading = downloadingReportId === record.id;

      return (
        <ReportViewer
          reportType={type}
          reportData={reportData}
          title={title}
          subtitle={subtitle}
          onBack={() => setViewingReport(null)}
          onDownload={() => isWeekly ? handleDownloadReport(wr) : handleDownloadMonthlyReport(mr)}
          onRefresh={isWeekly
            ? () => handleRefreshWeeklyReport(wr)
            : () => handleRefreshMonthlyReport(mr)
          }
          isDownloading={isDownloading}
          isRefreshing={isRefreshing}
        />
      );
    }

    return (
    <div className="flex h-full min-h-[400px]">
      <div className="w-44 flex-shrink-0 border-r border-gray-200 bg-gray-50 py-3">
        {REPORT_SECTIONS.map(section => {
          const isActive = reportSection === section.key;
          const hasReady = section.key === 'midweek'
            ? midweekReports.some(r => r.status === 'ready')
            : section.key === 'endofweek'
            ? endOfWeekReports.some(r => r.status === 'ready')
            : section.key === 'monthly'
            ? allMonthlyReports.some(r => r.status === 'ready')
            : false;
          return (
            <button
              key={section.key}
              onClick={() => setReportSection(section.key)}
              className={`w-full text-left px-3 py-2.5 transition-colors flex items-center justify-between gap-1 ${
                isActive
                  ? 'bg-blue-50 border-r-2 border-blue-400 text-blue-700 font-semibold'
                  : 'text-gray-600 hover:bg-white hover:text-gray-800'
              }`}
            >
              <span className="text-xs leading-tight">{section.label}</span>
              {hasReady && (
                <span className="w-2 h-2 rounded-full bg-sky-500 flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto thin-scrollbar px-4 py-4">
        {reportSection === 'midweek' && renderWeeklyReportList(midweekReports, {
          bg: 'bg-blue-50',
          border: 'border-blue-300',
          readyBg: 'bg-blue-50',
          readyText: 'text-blue-800',
          badgeBg: 'bg-blue-100',
          badgeText: 'text-blue-800',
          btnBg: 'bg-blue-50',
          btnHover: 'hover:bg-blue-100',
          btnDisabled: 'disabled:bg-blue-50/50 disabled:ring-blue-100',
          iconColor: 'text-blue-600',
        })}

        {reportSection === 'endofweek' && renderWeeklyReportList(endOfWeekReports, {
          bg: 'bg-sky-50',
          border: 'border-sky-300',
          readyBg: 'bg-sky-50',
          readyText: 'text-sky-800',
          badgeBg: 'bg-sky-200',
          badgeText: 'text-sky-800',
          btnBg: 'bg-blue-50',
          btnHover: 'hover:bg-blue-100',
          btnDisabled: 'disabled:bg-blue-50/50 disabled:ring-blue-100',
          iconColor: 'text-blue-600',
        })}

        {reportSection === 'monthly' && (
          allMonthlyReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="w-10 h-10 text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-400">No reports available</p>
              <p className="text-xs text-gray-300 mt-1">Reports are generated on the 2nd of each month</p>
            </div>
          ) : (
            <div className="space-y-2">
              {allMonthlyReports.map(report => {
                const isDownloading = downloadingReportId === report.id;
                const isReady = report.status === 'ready';
                return (
                  <div key={report.id} className={`rounded-lg px-3 py-2.5 border ${isReady ? 'bg-teal-50 border-teal-300' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-start gap-2">
                      <FileText className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isReady ? 'text-teal-600' : 'text-gray-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-xs font-bold uppercase ${isReady ? 'text-teal-800' : 'text-gray-600'}`}>{MONTH_NAMES_FULL[report.month]} {report.year}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${isReady ? 'bg-teal-200 text-teal-800' : 'bg-gray-200 text-gray-500'}`}>{isReady ? 'Ready' : 'Downloaded'}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{report.report_data?.production?.stationCount ?? 0} stations · {report.report_data?.completionPct ?? 0}% coverage</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => setViewingReport({ type: 'monthly', record: report })}
                          className="flex items-center gap-1 px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 ring-1 ring-blue-200 text-xs font-semibold rounded transition-colors whitespace-nowrap"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleDownloadMonthlyReport(report)}
                          disabled={isDownloading}
                          className="flex items-center gap-1 px-2 py-1 bg-blue-50 hover:bg-blue-100 disabled:bg-blue-50/50 disabled:ring-blue-100 text-blue-700 ring-1 ring-blue-200 text-xs font-semibold rounded transition-colors whitespace-nowrap"
                        >
                          {isDownloading ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Download className="w-3 h-3" />}
                          {isDownloading ? '' : 'Download'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {reportSection === 'station' && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="w-10 h-10 text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-400">Station Reports</p>
            <p className="text-xs text-gray-300 mt-1 max-w-[260px]">
              Generate comprehensive reports for a specific station covering assets, pumping equipment, infrastructure, production, sales, and finance data for a specified period.
            </p>
            <p className="text-xs text-gray-300 mt-3">Coming soon</p>
          </div>
        )}

        {reportSection === 'staff' && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="w-10 h-10 text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-400">Staff Performance Reports</p>
            <p className="text-xs text-gray-300 mt-1 max-w-[260px]">
              Quarterly performance review reports for staff, covering key performance indicators, attendance, productivity, and appraisal outcomes.
            </p>
            <p className="text-xs text-gray-300 mt-3">Coming soon</p>
          </div>
        )}

        {(reportSection === 'quarterly' || reportSection === 'yearly') && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="w-10 h-10 text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-400">Coming soon</p>
            <p className="text-xs text-gray-300 mt-1">
              {reportSection === 'quarterly' ? 'Quarterly' : 'Yearly'} reports will be available in a future update
            </p>
          </div>
        )}
      </div>
    </div>
    );
  };

  return (
    <div className="h-full flex flex-col pt-8 px-6 pb-6 gap-6 overflow-hidden">
      <style dangerouslySetInnerHTML={{__html: `
        .thin-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .thin-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .thin-scrollbar::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 2px;
        }
        .thin-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
        .thin-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #d1d5db transparent;
        }
      `}} />
      {isNarrow ? (
        /* ── NARROW / MERGED LAYOUT ── */
        <div className="flex flex-col flex-1 min-h-0">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden flex-1 min-h-0">
            <div className="flex flex-shrink-0 border-b border-gray-200 overflow-x-auto">
              {(['cw', 'rw', 'kpis', 'reports', 'ai', 'alerts', 'followups'] as const).map((tab) => {
                const alertCount = weeklyReports.length + monthlyReports.length + alerts.length + (nonFunctionalStats && nonFunctionalStats.nonFunctionalCount > 0 ? 1 : 0);
                const readyReportCount = allWeeklyReports.filter(r => r.status === 'ready').length + allMonthlyReports.filter(r => r.status === 'ready').length;
                return (
                  <button
                    key={tab}
                    onClick={() => setMergedTab(tab)}
                    className={`flex-shrink-0 flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                      mergedTab === tab
                        ? 'text-blue-700 border-b-2 border-blue-500 bg-blue-50'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {tab === 'ai' && <Bot className="w-3.5 h-3.5" />}
                    {tab === 'alerts' && <Bell className="w-3.5 h-3.5" />}
                    {tab === 'followups' && <ClipboardList className="w-3.5 h-3.5" />}
                    {tab === 'cw' && 'CW Trends'}
                    {tab === 'rw' && 'RW Trends'}
                    {tab === 'kpis' && 'KPIs'}
                    {tab === 'reports' && 'Reports'}
                    {tab === 'ai' && 'AI Assistant'}
                    {tab === 'alerts' && 'Alerts'}
                    {tab === 'followups' && 'Follow-ups'}
                    {tab === 'reports' && readyReportCount > 0 && (
                      <span className="ml-0.5 bg-sky-500 text-white rounded-full w-4 h-4 flex items-center justify-center" style={{ fontSize: '10px' }}>{readyReportCount}</span>
                    )}
                    {tab === 'alerts' && alertCount > 0 && (
                      <span className="ml-0.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center" style={{ fontSize: '10px' }}>{alertCount}</span>
                    )}
                    {tab === 'followups' && customAlerts.length > 0 && (
                      <span className="ml-0.5 bg-blue-400 text-white rounded-full w-4 h-4 flex items-center justify-center" style={{ fontSize: '10px' }}>{customAlerts.length}</span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="overflow-y-auto thin-scrollbar flex-1">
              {mergedTab === 'cw' && <ProductionTrendChart accessContext={accessContext} />}
              {mergedTab === 'rw' && (
                <div className="flex items-center justify-center h-full min-h-[200px] text-gray-400 text-sm">RW Trends coming soon</div>
              )}
              {mergedTab === 'kpis' && renderKpisContent()}
              {mergedTab === 'reports' && renderReportsContent()}
              {mergedTab === 'ai' && <EmbeddedChatPanel />}
              {(mergedTab === 'alerts' || mergedTab === 'followups') && (
                loading ? (
                  <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
                ) : (
                  <div className="overflow-y-auto thin-scrollbar flex-1 px-4 py-4">
                    {mergedTab === 'alerts' && renderAlertsContent()}
                    {mergedTab === 'followups' && renderFollowupsContent()}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ── WIDE / SPLIT LAYOUT ── */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        <div className="lg:col-span-2 lg:overflow-hidden lg:flex lg:flex-col min-h-0">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden h-full">
            {/* Trends Tab Headers */}
            <div className="flex flex-shrink-0 border-b border-gray-200">
              <button
                onClick={() => setTrendsTab('cw')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-semibold transition-colors ${
                  trendsTab === 'cw'
                    ? 'text-blue-700 border-b-2 border-blue-500 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                CW Trends
              </button>
              <button
                onClick={() => setTrendsTab('rw')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-semibold transition-colors ${
                  trendsTab === 'rw'
                    ? 'text-blue-700 border-b-2 border-blue-500 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                RW Trends
              </button>
              <button
                onClick={() => setTrendsTab('kpis')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-semibold transition-colors ${
                  trendsTab === 'kpis'
                    ? 'text-blue-700 border-b-2 border-blue-500 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                KPIs
              </button>
              <button
                onClick={() => setTrendsTab('reports')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-semibold transition-colors ${
                  trendsTab === 'reports'
                    ? 'text-blue-700 border-b-2 border-blue-500 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                Reports
                {(allWeeklyReports.filter(r => r.status === 'ready').length + allMonthlyReports.filter(r => r.status === 'ready').length) > 0 && (
                  <span className="ml-0.5 bg-sky-500 text-white rounded-full w-4 h-4 flex items-center justify-center" style={{ fontSize: '10px' }}>
                    {allWeeklyReports.filter(r => r.status === 'ready').length + allMonthlyReports.filter(r => r.status === 'ready').length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setTrendsTab('ai')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-semibold transition-colors ${
                  trendsTab === 'ai'
                    ? 'text-blue-700 border-b-2 border-blue-500 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                AI Assistant
              </button>
            </div>
            <div className="overflow-y-auto thin-scrollbar flex-1">
              {trendsTab === 'cw' && (
                <ProductionTrendChart accessContext={accessContext} />
              )}
              {trendsTab === 'rw' && (
                <div className="flex items-center justify-center h-full min-h-[200px] text-gray-400 text-sm">
                  RW Trends coming soon
                </div>
              )}
              {trendsTab === 'kpis' && renderKpisContent()}
              {trendsTab === 'reports' && renderReportsContent()}
              {trendsTab === 'ai' && <EmbeddedChatPanel />}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          {/* Tab Headers */}
          <div className="flex flex-shrink-0 border-b border-gray-200">
            <button
              onClick={() => setAlertsTab('alerts')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-semibold transition-colors ${
                alertsTab === 'alerts'
                  ? 'text-blue-700 border-b-2 border-blue-500 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              Alerts
              {(weeklyReports.length > 0 || monthlyReports.length > 0 || (nonFunctionalStats && nonFunctionalStats.nonFunctionalCount > 0) || alerts.length > 0) && (
                <span className="ml-0.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center" style={{ fontSize: '10px' }}>
                  {weeklyReports.length + monthlyReports.length + alerts.length + (nonFunctionalStats && nonFunctionalStats.nonFunctionalCount > 0 ? 1 : 0)}
                </span>
              )}
            </button>
            <button
              onClick={() => setAlertsTab('followups')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-semibold transition-colors ${
                alertsTab === 'followups'
                  ? 'text-blue-700 border-b-2 border-blue-500 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Follow-ups
              {customAlerts.length > 0 && (
                <span className="ml-0.5 bg-blue-400 text-white rounded-full w-4 h-4 flex items-center justify-center" style={{ fontSize: '10px' }}>
                  {customAlerts.length}
                </span>
              )}
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
          ) : (
            <div className="overflow-y-auto thin-scrollbar flex-1 pr-1 px-4 py-4">

              {/* ── ALERTS TAB ── */}
              {alertsTab === 'alerts' && renderAlertsContent()}

              {/* ── FOLLOW-UPS TAB ── */}
              {alertsTab === 'followups' && renderFollowupsContent()}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
