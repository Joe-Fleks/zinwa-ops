import { AlertTriangle, ExternalLink, Fuel, FlaskConical, ClipboardList, Plus, Pencil, Check, X, FileText, Download, Bell, Calendar, Flag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getYesterdayString, getWeekDateRangeForWeekNumber, getCurrentWeekNumber, shouldShowPreviousWeek, getMaxWeekNumberForYear, formatDateTime } from '../lib/dateUtils';
import { THRESHOLDS, CHEMICAL_PROD_FIELDS, CHEMICAL_TYPES } from '../lib/metricsConfig';
import { computeReceiptTotal, computeChemicalBalance, computeAvgUsagePerDay, computeDaysRemaining, isChemicalLowStock, isChemicalCriticalStock, computeTotalClients, computeDowntime, isStationNonFunctional } from '../lib/metrics';
import { fetchDailyDemandByStationId } from '../lib/metrics/demandMetrics';
import ProductionTrendChart from '../components/dashboard/ProductionTrendChart';
import { fetchPendingWeeklyReports, markReportDownloaded, type WeeklyReportRecord } from '../lib/weeklyReportService';
import { downloadWeeklyReport } from '../lib/weeklyReportDocument';
import { fetchPendingMonthlyReports, markMonthlyReportDownloaded, type MonthlyReportRecord } from '../lib/monthlyReportService';
import { downloadMonthlyReport } from '../lib/monthlyReportDocument';

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
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);
  const [alertsTab, setAlertsTab] = useState<'alerts' | 'followups'>('alerts');
  const [trendsTab, setTrendsTab] = useState<'cw' | 'rw' | 'kpis'>('cw');

  const serviceCentreId = accessContext?.scopeId ?? null;

  const today = new Date();
  const dayOfMonth = today.getDate();
  const showPendingSheets = dayOfMonth >= THRESHOLDS.PENDING_SHEETS_VISIBILITY_DAY;

  useEffect(() => {
    loadData();
    loadCustomAlerts();
    if (serviceCentreId) {
      loadWeeklyReports(serviceCentreId);
      loadMonthlyReports(serviceCentreId);
    }
  }, [serviceCentreId]);

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

  const handleDownloadMonthlyReport = async (report: MonthlyReportRecord) => {
    if (!user) return;
    setDownloadingReportId(report.id);
    try {
      downloadMonthlyReport(report.report_data);
      await markMonthlyReportDownloaded(report.id, user.id);
      setMonthlyReports(prev => prev.filter(r => r.id !== report.id));
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
    } catch (err) {
      console.error('Error downloading report:', err);
    } finally {
      setDownloadingReportId(null);
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
        .eq('year', currentYear)
        .eq('month', currentMonth)
        .order('entry_date', { ascending: false })
        .order('sort_order', { ascending: false })
        .limit(1);

      let petrolQuery = supabase
        .from('fuel_control_cards')
        .select('balance, entry_date, sort_order')
        .eq('fuel_type', 'petrol')
        .eq('year', currentYear)
        .eq('month', currentMonth)
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
            .select('station_id, chemical_type, opening_balance')
            .in('station_id', ftStationIds)
            .in('chemical_type', ['aluminium_sulphate', 'hth', 'activated_carbon'])
            .eq('year', currentYear)
            .eq('month', currentMonth),
          supabase
            .from('chemical_stock_receipts')
            .select('station_id, chemical_type, quantity, receipt_type')
            .in('station_id', ftStationIds)
            .in('chemical_type', ['aluminium_sulphate', 'hth', 'activated_carbon'])
            .eq('year', currentYear)
            .eq('month', currentMonth),
          supabase
            .from('production_logs')
            .select('station_id, alum_kg, hth_kg, activated_carbon_kg')
            .in('station_id', ftStationIds)
            .gte('date', startDate)
            .lt('date', endDate),
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
            const openingBalance = balanceRow ? Number(balanceRow.opening_balance) : 0;

            const stationReceipts = (receiptsResult.data || [])
              .filter(r => r.station_id === stationId && r.chemical_type === chemType);
            const received = computeReceiptTotal(stationReceipts);

            let usedTotal = 0;
            let productionDays = 0;
            (prodLogsResult.data || [])
              .filter(r => r.station_id === stationId)
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

  return (
    <div className="h-full flex flex-col p-6 gap-6 overflow-hidden">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        <div className="lg:col-span-2 lg:overflow-hidden lg:flex lg:flex-col min-h-0">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden h-full">
            {/* Trends Tab Headers */}
            <div className="flex flex-shrink-0 border-b border-gray-200">
              <button
                onClick={() => setTrendsTab('cw')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-semibold transition-colors ${
                  trendsTab === 'cw'
                    ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                CW Trends
              </button>
              <button
                onClick={() => setTrendsTab('rw')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-semibold transition-colors ${
                  trendsTab === 'rw'
                    ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                RW Trends
              </button>
              <button
                onClick={() => setTrendsTab('kpis')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-semibold transition-colors ${
                  trendsTab === 'kpis'
                    ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                KPIs
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
              {trendsTab === 'kpis' && (
                <div className="flex items-center justify-center h-full min-h-[200px] text-gray-400 text-sm">
                  KPIs coming soon
                </div>
              )}
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
                  ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50'
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
                  ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Follow-ups
              {customAlerts.length > 0 && (
                <span className="ml-0.5 bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center" style={{ fontSize: '10px' }}>
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
              {alertsTab === 'alerts' && (
                <div className="space-y-3">
                  {/* Due-tomorrow notifications */}
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
                          onClick={() => { setAlertsTab('followups'); startEdit(a); }}
                          className="text-xs font-semibold px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors whitespace-nowrap"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  ))}

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
                        <button
                          onClick={() => handleDownloadReport(report)}
                          disabled={isDownloading}
                          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-sky-700 hover:bg-sky-800 disabled:bg-sky-400 text-white text-xs font-semibold rounded transition-colors"
                        >
                          {isDownloading ? (
                            <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>Preparing...</>
                          ) : (
                            <><Download className="w-3.5 h-3.5" />Download Word Report (.docx)</>
                          )}
                        </button>
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
                          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 disabled:bg-teal-400 text-white text-xs font-semibold rounded transition-colors"
                        >
                          {isDownloading ? (
                            <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>Preparing...</>
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
                          <p className="text-sm text-gray-700">{nonFunctionalStats.savedRecordsCount} out of {nonFunctionalStats.totalStations} stations updated: {Math.round(nonFunctionalStats.savedPercentage)}%</p>
                        </div>
                      )}
                      {nonFunctionalStats.nonFunctionalCount > 0 && (
                        <>
                          {nonFunctionalStats.savedPercentage < 100 && <div className="border-t border-gray-300 my-1"></div>}
                          <div className="py-0.5">
                            <p className="text-sm font-bold text-gray-700">{nonFunctionalStats.nonFunctionalCount} out of {nonFunctionalStats.savedRecordsCount} stations not producing</p>
                            <div className="flex items-center justify-between gap-3 mt-0.5">
                              <p className="text-sm text-red-700">{nonFunctionalStats.unmetDemandPct}% of daily demand</p>
                              <Link to={`/sc/${scId}/maintenance?tab=non-functional`} className="px-2.5 py-1 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 transition-colors flex items-center gap-1.5 whitespace-nowrap">
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
                          <Link to={`/sc/${scId}/stock-control?tab=fuel&fuel=diesel`} className="text-xs font-semibold px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center gap-1 whitespace-nowrap">
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
                          <Link to={`/sc/${scId}/stock-control?tab=fuel&fuel=petrol`} className="text-xs font-semibold px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center gap-1 whitespace-nowrap">
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
                                  className="text-xs font-semibold rounded px-2.5 py-1 flex items-center gap-1 whitespace-nowrap transition-colors bg-blue-600 text-white hover:bg-blue-700"
                                >
                                  View Balances<ExternalLink className="w-3 h-3" />
                                </Link>
                              </div>
                              <div className="space-y-0.5">
                                {stations.map((st) => (
                                  <div key={st.station_name} className="flex items-center justify-between">
                                    <span className="text-xs text-gray-600 truncate flex-1 mr-2">{st.station_name}</span>
                                    <span className={`text-xs whitespace-nowrap ${isChemicalCriticalStock(st.days_remaining) ? 'text-red-600' : 'text-orange-500'}`}>
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
              )}

              {/* ── FOLLOW-UPS TAB ── */}
              {alertsTab === 'followups' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 font-medium">Your personal follow-up items</span>
                    <button
                      onClick={() => { setShowAddForm(true); setNewSubtitle(''); setNewBody(''); setNewDueDate(''); setNewImportance('Medium'); }}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
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
                        <button onClick={handleAddCustomAlert} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors">
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
                        <Link to={`/sc/${scId}/clearwater?tab=sales&filter=pending`} className="text-xs font-semibold px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center gap-1 whitespace-nowrap">
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
                            <button onClick={() => handleEditCustomAlert(alert.id)} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors">
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
                            <button onClick={() => handleDeleteCustomAlert(alert.id)} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors">
                              <Check className="w-3 h-3" />Done
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
