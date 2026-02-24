import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Pencil, X, Plus, Save, Loader2, Trash2, Download } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import type { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  CHEMICAL_OPTIONS,
  getChemicalLabel,
  fetchFullTreatmentStations,
} from '../lib/chemicalStockService';
import type { ChemicalType } from '../lib/chemicalStockService';
ModuleRegistry.registerModules([AllCommunityModule]);

interface ReceiptRow {
  id?: string;
  station_id: string;
  station_name: string;
  quantity: number;
  receipt_type: 'receipt' | 'transfer_in' | 'transfer_out';
  counterpart_station_id: string;
  counterpart_station_name: string;
  receipt_date: string;
  notes: string;
  isNew?: boolean;
  isModified?: boolean;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

export default function ChemicalNewStock() {
  const { user, accessContext } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const gridRef = useRef<AgGridReact>(null);

  const paramChemical = (searchParams.get('chemical') || 'aluminium_sulphate') as ChemicalType;
  const paramMonth = Number(searchParams.get('month')) || CURRENT_MONTH;
  const paramYear = Number(searchParams.get('year')) || CURRENT_YEAR;

  const [selectedChemical, setSelectedChemical] = useState<ChemicalType>(paramChemical);
  const [selectedMonth, setSelectedMonth] = useState(paramMonth);
  const [selectedYear, setSelectedYear] = useState(paramYear);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [stations, setStations] = useState<{ id: string; station_name: string; service_centre_id: string }[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const allowedScIds = accessContext?.allowedServiceCentreIds ?? [];
  const serviceCentreId = accessContext?.scopeType === 'SC' ? accessContext.scopeId : null;

  useEffect(() => {
    if (allowedScIds.length > 0) loadStations();
  }, [allowedScIds.length]);

  useEffect(() => {
    if (stations.length > 0) loadData();
  }, [stations.length, selectedChemical, selectedMonth, selectedYear]);

  const loadStations = async () => {
    const data = await fetchFullTreatmentStations(allowedScIds);
    setStations(data);
  };

  const loadData = useCallback(async () => {
    if (!serviceCentreId) return;
    setLoading(true);
    setMessage(null);

    try {
      const { data, error } = await supabase
        .from('chemical_stock_receipts')
        .select('*')
        .eq('service_centre_id', serviceCentreId)
        .eq('chemical_type', selectedChemical)
        .eq('year', selectedYear)
        .eq('month', selectedMonth)
        .order('receipt_date', { ascending: true });

      if (error) throw error;

      const stationMap = new Map(stations.map(s => [s.id, s.station_name]));

      const mapped: ReceiptRow[] = (data || []).map(r => ({
        id: r.id,
        station_id: r.station_id,
        station_name: stationMap.get(r.station_id) || 'Unknown',
        quantity: Number(r.quantity) || 0,
        receipt_type: r.receipt_type,
        counterpart_station_id: r.counterpart_station_id || '',
        counterpart_station_name: r.counterpart_station_id ? (stationMap.get(r.counterpart_station_id) || '') : '',
        receipt_date: r.receipt_date,
        notes: r.notes || '',
        isNew: false,
        isModified: false,
      }));

      setRows(mapped);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [serviceCentreId, selectedChemical, selectedMonth, selectedYear, stations]);

  const handleAddRow = () => {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setRows(prev => [...prev, {
      station_id: stations[0]?.id || '',
      station_name: stations[0]?.station_name || '',
      quantity: 0,
      receipt_type: 'receipt',
      counterpart_station_id: '',
      counterpart_station_name: '',
      receipt_date: dateStr,
      notes: '',
      isNew: true,
      isModified: true,
    }]);
  };

  const handleDeleteRow = (index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleCellChange = (index: number, field: string, value: any) => {
    setRows(prev => {
      const updated = [...prev];
      const row = { ...updated[index], [field]: value, isModified: true };

      if (field === 'station_id') {
        row.station_name = stations.find(s => s.id === value)?.station_name || '';
      }
      if (field === 'counterpart_station_id') {
        row.counterpart_station_name = stations.find(s => s.id === value)?.station_name || '';
      }

      updated[index] = row;
      return updated;
    });
  };

  const handleSave = async () => {
    if (!serviceCentreId || !user) return;
    setSaving(true);
    setMessage(null);

    try {
      const existingIds = rows.filter(r => r.id).map(r => r.id!);
      const { data: dbRows } = await supabase
        .from('chemical_stock_receipts')
        .select('id')
        .eq('service_centre_id', serviceCentreId)
        .eq('chemical_type', selectedChemical)
        .eq('year', selectedYear)
        .eq('month', selectedMonth);

      const toDelete = (dbRows || []).map(r => r.id).filter(id => !existingIds.includes(id));
      if (toDelete.length > 0) {
        await supabase.from('chemical_stock_receipts').delete().in('id', toDelete);
      }

      for (const row of rows) {
        const payload = {
          service_centre_id: serviceCentreId,
          station_id: row.station_id,
          chemical_type: selectedChemical,
          year: selectedYear,
          month: selectedMonth,
          quantity: row.quantity,
          receipt_type: row.receipt_type,
          counterpart_station_id: row.counterpart_station_id || null,
          receipt_date: row.receipt_date,
          notes: row.notes,
          updated_at: new Date().toISOString(),
        };

        if (row.id) {
          const { error } = await supabase.from('chemical_stock_receipts').update(payload).eq('id', row.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('chemical_stock_receipts').insert({ ...payload, created_by: user.id });
          if (error) throw error;
        }

        if (
          (row.receipt_type === 'transfer_out' || row.receipt_type === 'transfer_in') &&
          row.counterpart_station_id &&
          (row.isNew || row.isModified)
        ) {
          const mirrorType = row.receipt_type === 'transfer_out' ? 'transfer_in' : 'transfer_out';
          const mirrorNotes = row.notes
            ? `${row.notes} (auto-paired from ${row.station_name})`
            : `Auto-paired from ${row.station_name}`;

          const { data: existingMirror } = await supabase
            .from('chemical_stock_receipts')
            .select('id')
            .eq('station_id', row.counterpart_station_id)
            .eq('counterpart_station_id', row.station_id)
            .eq('chemical_type', selectedChemical)
            .eq('year', selectedYear)
            .eq('month', selectedMonth)
            .eq('receipt_type', mirrorType)
            .eq('quantity', row.quantity)
            .eq('receipt_date', row.receipt_date)
            .limit(1);

          if (!existingMirror || existingMirror.length === 0) {
            const counterpartStation = stations.find(s => s.id === row.counterpart_station_id);
            const counterpartScId = counterpartStation?.service_centre_id || serviceCentreId;

            const { error: mirrorError } = await supabase
              .from('chemical_stock_receipts')
              .insert({
                service_centre_id: counterpartScId,
                station_id: row.counterpart_station_id,
                chemical_type: selectedChemical,
                year: selectedYear,
                month: selectedMonth,
                quantity: row.quantity,
                receipt_type: mirrorType,
                counterpart_station_id: row.station_id,
                receipt_date: row.receipt_date,
                notes: mirrorNotes,
                created_by: user.id,
              });
            if (mirrorError) throw mirrorError;
          }
        }
      }

      setMessage({ type: 'success', text: 'Stock records saved' });
      setEditing(false);
      await loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    const basePath = location.pathname.replace(/\/chemical-new-stock.*$/, '');
    navigate(`${basePath}?tab=chemicals&chemical=${selectedChemical}`);
  };

  const handleExport = () => {
    const monthName = MONTHS[selectedMonth - 1];
    const label = getChemicalLabel(selectedChemical);
    const formatType = (t: string) => {
      if (t === 'receipt') return 'Receipt';
      if (t === 'transfer_in') return 'Transfer In';
      if (t === 'transfer_out') return 'Transfer Out';
      return t;
    };
    const headers = ['Date', 'Station', 'Type', 'Quantity (Kg)', 'From/To Station', 'Notes'];
    const dataRows = rows.map(r => [
      r.receipt_date,
      r.station_name,
      formatType(r.receipt_type),
      r.quantity,
      r.counterpart_station_name || '',
      r.notes || '',
    ]);
    const csvLines = [
      [`${label} New Stock - ${monthName} ${selectedYear}`],
      [],
      headers,
      ...dataRows,
    ].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','));

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${label.replace(/\s+/g, '_')}_NewStock_${monthName}_${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const label = getChemicalLabel(selectedChemical);

  const columnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: 'Date',
      field: 'receipt_date',
      width: 120,
      valueFormatter: (p: any) => {
        if (!p.value) return '';
        const d = new Date(p.value + 'T00:00:00');
        return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
      },
    },
    { headerName: 'Station', field: 'station_name', width: 170, minWidth: 140 },
    {
      headerName: 'Type',
      field: 'receipt_type',
      width: 130,
      valueFormatter: (p: any) => {
        if (p.value === 'receipt') return 'Receipt';
        if (p.value === 'transfer_in') return 'Transfer In';
        if (p.value === 'transfer_out') return 'Transfer Out';
        return p.value;
      },
    },
    {
      headerName: 'Quantity (Kg)',
      field: 'quantity',
      width: 120,
      type: 'numericColumn',
      valueFormatter: (p: any) => Number(p.value).toLocaleString(),
    },
    { headerName: 'From/To Station', field: 'counterpart_station_name', width: 170 },
    { headerName: 'Notes', field: 'notes', width: 200 },
  ], []);

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <button onClick={goBack} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to Stock Control
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Log New {label} Stock</h1>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <select
            value={selectedChemical}
            onChange={(e) => { setSelectedChemical(e.target.value as ChemicalType); setEditing(false); }}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-500"
          >
            {CHEMICAL_OPTIONS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => { setSelectedMonth(Number(e.target.value)); setEditing(false); }}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-500"
          >
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => { setSelectedYear(Number(e.target.value)); setEditing(false); }}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-500"
          >
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {!editing && rows.length > 0 && (
            <button onClick={handleExport} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium bg-blue-200 text-blue-900 hover:bg-blue-300 transition-colors">
              <Download className="w-4 h-4" /> Export
            </button>
          )}
          {editing && (
            <>
              <button onClick={handleAddRow} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium bg-blue-200 text-blue-900 hover:bg-blue-300 transition-colors">
                <Plus className="w-4 h-4" /> New Entry
              </button>
              <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
              </button>
            </>
          )}
          <button
            onClick={() => { if (editing) loadData(); setEditing(!editing); }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              editing ? 'bg-gray-700 text-white hover:bg-gray-800' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {editing ? <><X className="w-4 h-4" /> Cancel</> : <><Pencil className="w-4 h-4" /> Edit</>}
          </button>
        </div>
      </div>

      {message && (
        <div className={`px-4 py-2 rounded-md text-sm font-medium ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>{message.text}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-500">Loading stock records...</span>
        </div>
      ) : !editing ? (
        <div className="ag-theme-alpine" style={{ height: 'calc(100vh - 340px)', width: '100%' }}>
          <AgGridReact
            ref={gridRef}
            rowData={rows}
            columnDefs={columnDefs}
            defaultColDef={{ sortable: true, filter: true, resizable: true, suppressMovable: true }}
            enableCellTextSelection={true}
            ensureDomOrder={true}
          />
        </div>
      ) : (
        <div className="overflow-auto" style={{ height: 'calc(100vh - 340px)' }}>
          <table className="w-full border-collapse bg-white shadow-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="border border-gray-300 px-2 py-1 text-xs font-bold text-gray-700" style={{ minWidth: '130px' }}>Date</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-bold text-gray-700" style={{ minWidth: '160px' }}>Station</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-bold text-gray-700" style={{ minWidth: '130px' }}>Type</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-bold text-gray-700" style={{ minWidth: '100px' }}>Quantity (Kg)</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-bold text-gray-700" style={{ minWidth: '160px' }}>From/To Station</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-bold text-gray-700" style={{ minWidth: '180px' }}>Notes</th>
                <th className="border border-gray-300 px-1 py-1 text-xs font-bold text-gray-700 w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id || `new-${i}`} className={row.isNew ? 'bg-yellow-50' : 'bg-white'}>
                  <td className="border border-gray-300 py-0 px-0">
                    <input type="date" value={row.receipt_date} onChange={(e) => handleCellChange(i, 'receipt_date', e.target.value)}
                      className="w-full px-2 py-0 text-sm border-0 focus:ring-1 focus:ring-blue-500" style={{ height: '26px' }} />
                  </td>
                  <td className="border border-gray-300 py-0 px-0">
                    <select value={row.station_id} onChange={(e) => handleCellChange(i, 'station_id', e.target.value)}
                      className="w-full px-1 py-0 text-sm border-0 focus:ring-1 focus:ring-blue-500" style={{ height: '26px' }}>
                      <option value="">Select...</option>
                      {stations.map(s => <option key={s.id} value={s.id}>{s.station_name}</option>)}
                    </select>
                  </td>
                  <td className="border border-gray-300 py-0 px-0">
                    <select value={row.receipt_type} onChange={(e) => handleCellChange(i, 'receipt_type', e.target.value)}
                      className="w-full px-1 py-0 text-sm border-0 focus:ring-1 focus:ring-blue-500" style={{ height: '26px' }}>
                      <option value="receipt">Receipt</option>
                      <option value="transfer_in">Transfer In</option>
                      <option value="transfer_out">Transfer Out</option>
                    </select>
                  </td>
                  <td className="border border-gray-300 py-0 px-0">
                    <input type="number" value={row.quantity} onChange={(e) => handleCellChange(i, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-0 text-sm text-right font-mono border-0 focus:ring-1 focus:ring-blue-500" style={{ height: '26px' }} />
                  </td>
                  <td className="border border-gray-300 py-0 px-0">
                    {(row.receipt_type === 'transfer_in' || row.receipt_type === 'transfer_out') ? (
                      <select value={row.counterpart_station_id} onChange={(e) => handleCellChange(i, 'counterpart_station_id', e.target.value)}
                        className="w-full px-1 py-0 text-sm border-0 focus:ring-1 focus:ring-blue-500" style={{ height: '26px' }}>
                        <option value="">Select...</option>
                        {stations.filter(s => s.id !== row.station_id).map(s => <option key={s.id} value={s.id}>{s.station_name}</option>)}
                      </select>
                    ) : (
                      <div className="px-2 py-0 text-sm bg-gray-50" style={{ height: '26px' }} />
                    )}
                  </td>
                  <td className="border border-gray-300 py-0 px-0">
                    <input type="text" value={row.notes} onChange={(e) => handleCellChange(i, 'notes', e.target.value)}
                      className="w-full px-2 py-0 text-sm border-0 focus:ring-1 focus:ring-blue-500" style={{ height: '26px' }} />
                  </td>
                  <td className="border border-gray-300 py-0 px-1 text-center">
                    <button onClick={() => handleDeleteRow(i)} className="text-red-400 hover:text-red-600 p-0.5">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="border border-gray-300 py-8 text-center text-sm text-gray-400">No stock records for this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
