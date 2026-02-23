import { useState, useEffect, useRef, useMemo } from 'react';
import { Edit2, Save, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const MONTHS = [
  { key: 'jan', label: 'January', short: 'Jan' },
  { key: 'feb', label: 'February', short: 'Feb' },
  { key: 'mar', label: 'March', short: 'Mar' },
  { key: 'apr', label: 'April', short: 'Apr' },
  { key: 'may', label: 'May', short: 'May' },
  { key: 'jun', label: 'June', short: 'Jun' },
  { key: 'jul', label: 'July', short: 'Jul' },
  { key: 'aug', label: 'August', short: 'Aug' },
  { key: 'sep', label: 'September', short: 'Sep' },
  { key: 'oct', label: 'October', short: 'Oct' },
  { key: 'nov', label: 'November', short: 'Nov' },
  { key: 'dec', label: 'December', short: 'Dec' },
] as const;

type MonthKey = typeof MONTHS[number]['key'];

interface Dam {
  id: string;
  name: string;
  bailiff: string | null;
  service_centre_id: string | null;
}

interface GridRow {
  dam_id: string;
  dam_name: string;
  bailiff: string | null;
  dam_sc_id: string | null;
  jan: number; feb: number; mar: number; apr: number;
  may: number; jun: number; jul: number; aug: number;
  sep: number; oct: number; nov: number; dec: number;
}

interface Props {
  title: string;
  tableName: string;
}

export default function RWMonthlyGrid({ title, tableName }: Props) {
  const { accessContext } = useAuth();
  const gridRef = useRef<AgGridReact>(null);

  const [dams, setDams] = useState<Dam[]>([]);
  const [rows, setRows] = useState<GridRow[]>([]);
  const [editedRows, setEditedRows] = useState<GridRow[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedBailiff, setSelectedBailiff] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

  const bailiffOptions = useMemo(() => {
    const unique = new Set(dams.map(d => d.bailiff).filter(Boolean) as string[]);
    return Array.from(unique).sort();
  }, [dams]);

  const filteredRows = useMemo(() => {
    if (selectedBailiff === 'all') return rows;
    return rows.filter(r => r.bailiff === selectedBailiff);
  }, [rows, selectedBailiff]);

  const visibleMonths = useMemo(() => {
    if (selectedMonth === 'all') return [...MONTHS];
    return MONTHS.filter(m => m.key === selectedMonth);
  }, [selectedMonth]);

  const filteredEditedRows = useMemo(() => {
    if (selectedBailiff === 'all') return editedRows;
    return editedRows.filter(r => r.bailiff === selectedBailiff);
  }, [editedRows, selectedBailiff]);

  useEffect(() => {
    loadData();
  }, [selectedYear, accessContext]);

  useEffect(() => {
    if (focusedCell && isEditing) {
      const key = `${focusedCell.row}-${focusedCell.col}`;
      inputRefs.current[key]?.focus();
    }
  }, [focusedCell, isEditing]);

  const loadData = async () => {
    if (!accessContext) return;
    setLoading(true);
    try {
      let damsQuery = supabase
        .from('dams')
        .select('id, name, bailiff, service_centre_id')
        .order('name');

      if (accessContext.isSCScoped && accessContext.scopeId) {
        damsQuery = damsQuery.eq('service_centre_id', accessContext.scopeId);
      } else if (accessContext.isCatchmentScoped && accessContext.allowedServiceCentreIds.length > 0) {
        damsQuery = damsQuery.in('service_centre_id', accessContext.allowedServiceCentreIds);
      }

      const { data: damsData, error: damsErr } = await damsQuery;
      if (damsErr) throw damsErr;

      const loadedDams: Dam[] = (damsData || []).map(d => ({
        id: d.id,
        name: d.name,
        bailiff: d.bailiff,
        service_centre_id: d.service_centre_id,
      }));
      setDams(loadedDams);

      const { data: tableData, error: tableErr } = await supabase
        .from(tableName)
        .select('*')
        .eq('year', selectedYear);

      if (tableErr) throw tableErr;

      const dataMap = new Map<string, Record<string, unknown>>();
      (tableData || []).forEach((row: Record<string, unknown>) => {
        dataMap.set(row.dam_id as string, row);
      });

      const mergedRows: GridRow[] = loadedDams.map(dam => {
        const existing = dataMap.get(dam.id);
        return {
          dam_id: dam.id,
          dam_name: dam.name,
          bailiff: dam.bailiff,
          dam_sc_id: dam.service_centre_id,
          jan: Number(existing?.jan || 0),
          feb: Number(existing?.feb || 0),
          mar: Number(existing?.mar || 0),
          apr: Number(existing?.apr || 0),
          may: Number(existing?.may || 0),
          jun: Number(existing?.jun || 0),
          jul: Number(existing?.jul || 0),
          aug: Number(existing?.aug || 0),
          sep: Number(existing?.sep || 0),
          oct: Number(existing?.oct || 0),
          nov: Number(existing?.nov || 0),
          dec: Number(existing?.dec || 0),
        };
      });

      setRows(mergedRows);
    } catch (err) {
      console.error('Error loading RW data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRowTotal = (row: GridRow) =>
    MONTHS.reduce((sum, m) => sum + Number(row[m.key as MonthKey] || 0), 0);

  const getColumnTotal = (data: GridRow[], monthKey: string) =>
    data.reduce((sum, r) => sum + Number((r as Record<string, unknown>)[monthKey] || 0), 0);

  const getGrandTotal = (data: GridRow[]) =>
    data.reduce((sum, r) => sum + getRowTotal(r), 0);

  const columnDefs = useMemo(() => {
    const cols: Record<string, unknown>[] = [
      {
        headerName: 'Dam Name',
        field: 'dam_name',
        pinned: 'left',
        minWidth: 180,
        cellStyle: { fontWeight: '600' },
        sortable: true,
        filter: true,
      },
    ];

    visibleMonths.forEach(m => {
      cols.push({
        headerName: m.label,
        field: m.key,
        minWidth: 110,
        type: 'numericColumn',
        valueFormatter: (p: { value: number }) =>
          (p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
      });
    });

    cols.push({
      headerName: 'Yearly Total',
      field: '_yearly_total',
      pinned: 'right',
      minWidth: 130,
      valueGetter: (p: { data: GridRow }) => {
        if (!p.data) return 0;
        return MONTHS.reduce((sum, m) => sum + Number(p.data[m.key as MonthKey] || 0), 0);
      },
      valueFormatter: (p: { value: number }) =>
        (p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
      cellStyle: { fontWeight: 'bold' },
    });

    return cols;
  }, [visibleMonths]);

  const pinnedBottomRowData = useMemo(() => {
    const totalRow: Record<string, unknown> = { dam_name: 'TOTAL' };
    MONTHS.forEach(m => {
      totalRow[m.key] = getColumnTotal(filteredRows, m.key);
    });
    return [totalRow];
  }, [filteredRows]);

  const defaultColDef = useMemo(() => ({
    resizable: true,
    sortable: false,
  }), []);

  const getRowStyle = (params: { node: { rowPinned: string } }) => {
    if (params.node.rowPinned) {
      return { fontWeight: 'bold', backgroundColor: '#eff6ff' };
    }
    return undefined;
  };

  const handleEdit = () => {
    setEditedRows(JSON.parse(JSON.stringify(rows)));
    setIsEditing(true);
    setFocusedCell({ row: 0, col: 0 });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedRows([]);
    setFocusedCell(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const toSave = filteredEditedRows.map(row => ({
        dam_id: row.dam_id,
        year: selectedYear,
        jan: row.jan, feb: row.feb, mar: row.mar, apr: row.apr,
        may: row.may, jun: row.jun, jul: row.jul, aug: row.aug,
        sep: row.sep, oct: row.oct, nov: row.nov, dec: row.dec,
        service_centre_id: row.dam_sc_id,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from(tableName)
        .upsert(toSave, { onConflict: 'dam_id,year' });

      if (error) throw error;

      setIsEditing(false);
      setFocusedCell(null);
      await loadData();
    } catch (err) {
      console.error('Error saving:', err);
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCellChange = (rowIndex: number, monthKey: string, value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    if (isNaN(numValue) || numValue < 0) return;

    const targetRow = filteredEditedRows[rowIndex];
    if (!targetRow) return;

    const actualIndex = editedRows.findIndex(r => r.dam_id === targetRow.dam_id);
    if (actualIndex === -1) return;

    const newRows = [...editedRows];
    newRows[actualIndex] = { ...newRows[actualIndex], [monthKey]: numValue };
    setEditedRows(newRows);
  };

  const handlePaste = (e: React.ClipboardEvent, rowIndex: number, colIndex: number) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    if (!text) return;

    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const displayRows = filteredEditedRows;
    const newEditedRows = [...editedRows];

    lines.forEach((line, lineIdx) => {
      const targetRowIdx = rowIndex + lineIdx;
      if (targetRowIdx >= displayRows.length) return;

      const targetRow = displayRows[targetRowIdx];
      const actualIdx = editedRows.findIndex(r => r.dam_id === targetRow.dam_id);
      if (actualIdx === -1) return;

      const values = line.split('\t');
      values.forEach((val, valIdx) => {
        const targetColIdx = colIndex + valIdx;
        if (targetColIdx >= visibleMonths.length) return;

        const numVal = parseFloat(val.replace(/,/g, ''));
        if (!isNaN(numVal) && numVal >= 0) {
          const monthKey = visibleMonths[targetColIdx].key;
          newEditedRows[actualIdx] = { ...newEditedRows[actualIdx], [monthKey]: numVal };
        }
      });
    });

    setEditedRows(newEditedRows);
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    const maxRow = filteredEditedRows.length - 1;
    const maxCol = visibleMonths.length - 1;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (rowIndex > 0) setFocusedCell({ row: rowIndex - 1, col: colIndex });
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (rowIndex < maxRow) setFocusedCell({ row: rowIndex + 1, col: colIndex });
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (colIndex > 0) setFocusedCell({ row: rowIndex, col: colIndex - 1 });
        break;
      case 'ArrowRight':
      case 'Tab':
        e.preventDefault();
        if (colIndex < maxCol) {
          setFocusedCell({ row: rowIndex, col: colIndex + 1 });
        } else if (rowIndex < maxRow) {
          setFocusedCell({ row: rowIndex + 1, col: 0 });
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (rowIndex < maxRow) setFocusedCell({ row: rowIndex + 1, col: colIndex });
        break;
    }
  };

  const displayEditRows = filteredEditedRows;
  const editColumnTotal = (monthKey: string) =>
    displayEditRows.reduce((sum, r) => sum + Number((r as Record<string, unknown>)[monthKey] || 0), 0);
  const editGrandTotal = displayEditRows.reduce((sum, r) => sum + getRowTotal(r), 0);

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        {!isEditing ? (
          <button
            onClick={handleEdit}
            disabled={loading || filteredRows.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Year:</label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedYear(y => y - 1)}
              disabled={isEditing}
              className="p-1.5 rounded bg-gray-200 hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              disabled={isEditing}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button
              onClick={() => setSelectedYear(y => y + 1)}
              disabled={isEditing}
              className="p-1.5 rounded bg-gray-200 hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Bailiff:</label>
          <select
            value={selectedBailiff}
            onChange={e => setSelectedBailiff(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Bailiffs</option>
            {bailiffOptions.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Month:</label>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Months</option>
            {MONTHS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : filteredRows.length === 0 && !isEditing ? (
        <div className="text-center py-12 text-gray-500">No dam data available</div>
      ) : !isEditing ? (
        <div
          className="ag-theme-alpine"
          style={{ height: Math.min(600, filteredRows.length * 42 + 90), width: '100%' }}
        >
          <AgGridReact
            ref={gridRef}
            rowData={filteredRows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            pinnedBottomRowData={pinnedBottomRowData}
            getRowStyle={getRowStyle}
            domLayout={filteredRows.length <= 12 ? 'autoHeight' : undefined}
            suppressMovableColumns
          />
        </div>
      ) : (
        <div className="overflow-x-auto overflow-y-auto border border-gray-300 rounded-lg max-h-[calc(100vh-350px)]">
          <table className="w-full border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="sticky left-0 top-0 z-20 bg-gray-100 border border-gray-300 px-4 py-2 text-left text-sm font-bold text-gray-700 min-w-[180px]">
                  Dam Name
                </th>
                {visibleMonths.map(m => (
                  <th
                    key={m.key}
                    className="sticky top-0 z-10 bg-gray-100 border border-gray-300 px-4 py-2 text-center text-sm font-bold text-gray-700 min-w-[100px]"
                  >
                    {m.label}
                  </th>
                ))}
                <th className="sticky top-0 z-10 bg-gray-100 border border-gray-300 px-4 py-2 text-center text-sm font-bold text-gray-700 min-w-[120px]">
                  Yearly Total
                </th>
              </tr>
            </thead>
            <tbody>
              {displayEditRows.map((row, rowIdx) => (
                <tr key={row.dam_id} className="hover:bg-gray-50 group">
                  <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 border border-gray-300 px-4 py-2 text-sm text-gray-900 font-bold">
                    {row.dam_name}
                  </td>
                  {visibleMonths.map((m, colIdx) => (
                    <td key={m.key} className="border border-gray-300 px-1 py-1 text-center">
                      <input
                        ref={el => { inputRefs.current[`${rowIdx}-${colIdx}`] = el; }}
                        type="number"
                        min="0"
                        step="0.01"
                        value={row[m.key as MonthKey] || 0}
                        onChange={e => handleCellChange(rowIdx, m.key, e.target.value)}
                        onKeyDown={e => handleKeyDown(e, rowIdx, colIdx)}
                        onPaste={e => handlePaste(e, rowIdx, colIdx)}
                        onFocus={e => {
                          setFocusedCell({ row: rowIdx, col: colIdx });
                          e.target.select();
                        }}
                        className="w-full px-2 py-1 text-sm text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                  ))}
                  <td className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold text-gray-900 bg-gray-50">
                    {getRowTotal(row).toLocaleString()}
                  </td>
                </tr>
              ))}
              {displayEditRows.length > 0 && (
                <tr className="bg-blue-50 font-bold sticky bottom-0 z-10">
                  <td className="sticky left-0 z-20 bg-blue-50 border border-gray-300 px-4 py-2 text-sm text-gray-900">
                    TOTAL
                  </td>
                  {visibleMonths.map(m => (
                    <td key={m.key} className="border border-gray-300 px-4 py-2 text-center text-sm text-gray-900">
                      {editColumnTotal(m.key).toLocaleString()}
                    </td>
                  ))}
                  <td className="border border-gray-300 px-4 py-2 text-center text-sm text-gray-900">
                    {editGrandTotal.toLocaleString()}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
