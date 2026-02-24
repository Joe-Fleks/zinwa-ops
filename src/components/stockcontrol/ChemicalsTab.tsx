import { useState, useEffect, useCallback } from 'react';
import { Pencil, X, Save, Loader2, PackagePlus, Truck, Download } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  getChemicalLabel,
  getChemicalShortLabel,
  fetchFullTreatmentStations,
  fetchOpeningBalances,
  fetchPreviousMonthClosingBalances,
  fetchReceivedTotals,
  fetchUsedTotals,
  fetchProductionDayCount,
  saveOpeningBalances,
  getDaysInMonth,
  isPastMonth,
} from '../../lib/chemicalStockService';
import type { ChemicalType, ChemicalStationRow } from '../../lib/chemicalStockService';
import ChemicalTrackerFAT from './ChemicalTrackerFAT';
import ChemicalTrackerFET from './ChemicalTrackerFET';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

interface ChemicalsTabProps {
  chemicalType: ChemicalType;
}

export default function ChemicalsTab({ chemicalType }: ChemicalsTabProps) {
  const { user, accessContext } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<ChemicalStationRow[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const allowedScIds = accessContext?.allowedServiceCentreIds ?? [];
  const serviceCentreId = accessContext?.scopeType === 'SC' ? accessContext.scopeId : null;

  useEffect(() => {
    setSelectedMonth(CURRENT_MONTH);
    setSelectedYear(CURRENT_YEAR);
    setEditing(false);
  }, [chemicalType]);

  useEffect(() => {
    if (allowedScIds.length > 0) {
      loadData();
    }
  }, [allowedScIds.length, chemicalType, selectedMonth, selectedYear]);

  const loadData = useCallback(async () => {
    if (allowedScIds.length === 0) return;
    setLoading(true);
    setMessage(null);

    try {
      const stations = await fetchFullTreatmentStations(allowedScIds);
      if (stations.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const stationIds = stations.map(s => s.id);

      const [balances, prevClosing, received, used, dayCounts] = await Promise.all([
        fetchOpeningBalances(stationIds, chemicalType, selectedYear, selectedMonth),
        fetchPreviousMonthClosingBalances(stationIds, chemicalType, selectedYear, selectedMonth),
        fetchReceivedTotals(stationIds, chemicalType, selectedYear, selectedMonth),
        fetchUsedTotals(stationIds, chemicalType, selectedYear, selectedMonth),
        fetchProductionDayCount(stationIds, chemicalType, selectedYear, selectedMonth),
      ]);

      const past = isPastMonth(selectedYear, selectedMonth);
      const totalDays = getDaysInMonth(selectedYear, selectedMonth);

      const built: ChemicalStationRow[] = stations.map(st => {
        const existing = balances.get(st.id);
        const prevClose = prevClosing.get(st.id) ?? 0;
        const openBal = existing ? existing.opening_balance : prevClose;
        const rec = received.get(st.id) ?? 0;
        const usedKg = used.get(st.id) ?? 0;
        const currentBal = openBal + rec - usedKg;
        const days = dayCounts.get(st.id) ?? 0;
        const avgUsage = past
          ? (totalDays > 0 ? usedKg / totalDays : 0)
          : (days > 0 ? usedKg / days : 0);
        const daysRemaining = avgUsage > 0 ? currentBal / avgUsage : null;

        return {
          station_id: st.id,
          station_name: st.station_name,
          balance_id: existing?.id,
          opening_balance: openBal,
          received: rec,
          used: usedKg,
          current_balance: currentBal,
          avg_usage_per_day: avgUsage,
          days_remaining: daysRemaining,
          isModified: false,
          isTouched: false,
        };
      });

      setRows(built);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to load chemical stock data' });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [allowedScIds, chemicalType, selectedMonth, selectedYear]);

  const handleUpdate = useCallback((index: number, _field: string, value: any) => {
    setRows(prev => {
      const updated = [...prev];
      const row = { ...updated[index] };
      row.opening_balance = Number(value) || 0;
      row.current_balance = row.opening_balance + row.received - row.used;
      row.days_remaining = row.avg_usage_per_day > 0 ? row.current_balance / row.avg_usage_per_day : null;
      row.isTouched = true;
      row.isModified = true;
      updated[index] = row;
      return updated;
    });
  }, []);

  const handleSave = async () => {
    if (!user || !serviceCentreId) return;
    setSaving(true);
    setMessage(null);

    try {
      await saveOpeningBalances(rows, serviceCentreId, chemicalType, selectedYear, selectedMonth, user.id);
      setMessage({ type: 'success', text: 'Balances saved successfully' });
      setEditing(false);
      await loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEdit = () => {
    if (editing) {
      loadData();
    } else {
      setRows(prev => prev.map(r => ({ ...r, isTouched: true })));
    }
    setEditing(!editing);
  };

  const navigateToNewStock = () => {
    const basePath = location.pathname.replace(/\/stock-control.*$/, '/stock-control');
    navigate(`${basePath}/chemical-new-stock?chemical=${chemicalType}&month=${selectedMonth}&year=${selectedYear}`);
  };

  const navigateToDistributor = () => {
    const basePath = location.pathname.replace(/\/stock-control.*$/, '/stock-control');
    navigate(`${basePath}/chemical-distributor?chemical=${chemicalType}`);
  };

  const handleExport = () => {
    const monthName = MONTHS[selectedMonth - 1];
    const label = getChemicalLabel(chemicalType);
    const showDays = !rows.every(r => r.days_remaining === null);

    const headers = ['Station', `Bal. 01/${String(selectedMonth).padStart(2,'0')}/${selectedYear}`, 'Received', 'Used (Kg)', 'Current Bal.', 'Avg. Usage/Day'];
    if (showDays) headers.push('Days Remaining');

    const dataRows = rows.map(r => {
      const cols = [
        r.station_name,
        r.opening_balance,
        r.received,
        r.used,
        r.current_balance,
        r.avg_usage_per_day > 0 ? r.avg_usage_per_day.toFixed(1) : '0',
      ];
      if (showDays) cols.push(r.days_remaining !== null ? Math.round(r.days_remaining).toString() : '');
      return cols;
    });

    const totals: (string | number)[] = [
      'Total',
      rows.reduce((s, r) => s + r.opening_balance, 0),
      rows.reduce((s, r) => s + r.received, 0),
      rows.reduce((s, r) => s + r.used, 0),
      rows.reduce((s, r) => s + r.current_balance, 0),
      rows.reduce((s, r) => s + r.avg_usage_per_day, 0).toFixed(1),
    ];
    if (showDays) {
      const totalAvg = rows.reduce((s, r) => s + r.avg_usage_per_day, 0);
      const totalBal = rows.reduce((s, r) => s + r.current_balance, 0);
      totals.push(totalAvg > 0 ? Math.round(totalBal / totalAvg).toString() : '');
    }

    const csvLines = [
      [`${label} Stock - ${monthName} ${selectedYear}`],
      [],
      headers,
      ...dataRows,
      totals,
    ].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','));

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${label.replace(/\s+/g, '_')}_Stock_${monthName}_${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const label = getChemicalLabel(chemicalType);
  const shortLabel = getChemicalShortLabel(chemicalType);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <p className="text-lg font-bold text-gray-900">
            <span className="hidden lg:inline">{label} Stock</span>
            <span className="lg:hidden">{shortLabel} Stock</span>
          </p>
          <select
            value={selectedMonth}
            onChange={(e) => { setSelectedMonth(Number(e.target.value)); setEditing(false); }}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => { setSelectedYear(Number(e.target.value)); setEditing(false); }}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            {YEARS.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={navigateToNewStock}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium bg-blue-200 text-blue-900 hover:bg-blue-300 transition-colors"
          >
            <PackagePlus className="w-4 h-4" />
            Log New Stock
          </button>
          <button
            type="button"
            onClick={navigateToDistributor}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors"
          >
            <Truck className="w-4 h-4" />
            Chemical Distributor
          </button>
          {!editing && rows.length > 0 && (
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium bg-blue-200 text-blue-900 hover:bg-blue-300 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          )}
          {editing && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          )}
          <button
            type="button"
            onClick={handleToggleEdit}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              editing
                ? 'bg-gray-700 text-white hover:bg-gray-800'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {editing ? (
              <><X className="w-4 h-4" /> Cancel</>
            ) : (
              <><Pencil className="w-4 h-4" /> Edit</>
            )}
          </button>
        </div>
      </div>

      {message && (
        <div className={`px-4 py-2 rounded-md text-sm font-medium ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-500">Loading {label.toLowerCase()} stock data...</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center border border-gray-200">
          <p className="text-sm text-gray-500">No full treatment stations found for your service centre.</p>
        </div>
      ) : editing ? (
        <ChemicalTrackerFET
          data={rows}
          year={selectedYear}
          month={selectedMonth}
          onUpdate={handleUpdate}
        />
      ) : (
        <ChemicalTrackerFAT
          data={rows}
          year={selectedYear}
          month={selectedMonth}
        />
      )}
    </div>
  );
}
