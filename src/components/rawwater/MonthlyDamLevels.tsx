import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Save, AlertCircle, CheckCircle2, X, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNetwork } from '../../contexts/NetworkContext';

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface DamWithCapacity {
  id: string;
  dam_code: string | null;
  name: string;
  full_supply_capacity_ml: number;
  service_centre_id: string | null;
}

interface LevelRow {
  dam_id: string;
  dam_code: string | null;
  dam_name: string;
  full_supply_capacity_ml: number;
  opening_level_ml: number | null;
  closing_level_ml: number | null;
  prev_closing_ml: number | null;
  existingId: string | null;
  modified: boolean;
}

interface Props {
  onClose: () => void;
}

export default function MonthlyDamLevels({ onClose }: Props) {
  const { user, accessContext, isViewer } = useAuth();
  const { isOnline, showOfflineWarning } = useNetwork();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState<LevelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isJanuary = selectedMonth === 1;

  useEffect(() => {
    loadData();
  }, [selectedYear, selectedMonth, accessContext?.scopeId]);

  const loadData = async () => {
    setLoading(true);
    setMessage(null);

    try {
      let damsQuery = supabase
        .from('dams')
        .select('id, dam_code, name, full_supply_capacity_ml, service_centre_id')
        .not('full_supply_capacity_ml', 'is', null)
        .gt('full_supply_capacity_ml', 0)
        .order('name');

      if (accessContext?.isSCScoped && accessContext?.scopeId) {
        damsQuery = damsQuery.eq('service_centre_id', accessContext.scopeId);
      }

      const { data: damsData, error: damsError } = await damsQuery;
      if (damsError) throw damsError;

      const dams: DamWithCapacity[] = (damsData || []).map(d => ({
        ...d,
        full_supply_capacity_ml: Number(d.full_supply_capacity_ml),
      }));

      if (dams.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const damIds = dams.map(d => d.id);

      const { data: currentData, error: currentError } = await supabase
        .from('dam_monthly_levels')
        .select('*')
        .in('dam_id', damIds)
        .eq('year', selectedYear)
        .eq('month', selectedMonth);
      if (currentError) throw currentError;

      const currentMap = new Map<string, any>();
      for (const row of (currentData || [])) {
        currentMap.set(row.dam_id, row);
      }

      let prevMap = new Map<string, number>();
      if (!isJanuary) {
        const { data: prevData, error: prevError } = await supabase
          .from('dam_monthly_levels')
          .select('dam_id, closing_level_ml')
          .in('dam_id', damIds)
          .eq('year', selectedYear)
          .eq('month', selectedMonth - 1);
        if (prevError) throw prevError;

        for (const row of (prevData || [])) {
          if (row.closing_level_ml !== null) {
            prevMap.set(row.dam_id, Number(row.closing_level_ml));
          }
        }
      } else {
        const { data: prevYearData, error: prevYearError } = await supabase
          .from('dam_monthly_levels')
          .select('dam_id, closing_level_ml')
          .in('dam_id', damIds)
          .eq('year', selectedYear - 1)
          .eq('month', 12);
        if (prevYearError) throw prevYearError;

        for (const row of (prevYearData || [])) {
          if (row.closing_level_ml !== null) {
            prevMap.set(row.dam_id, Number(row.closing_level_ml));
          }
        }
      }

      const levelRows: LevelRow[] = dams.map(dam => {
        const current = currentMap.get(dam.id);
        const prevClosing = prevMap.get(dam.id) ?? null;

        let openingLevel: number | null = null;
        if (current && current.opening_level_ml !== null) {
          openingLevel = Number(current.opening_level_ml);
        } else if (prevClosing !== null) {
          openingLevel = prevClosing;
        }

        return {
          dam_id: dam.id,
          dam_code: dam.dam_code,
          dam_name: dam.name,
          full_supply_capacity_ml: dam.full_supply_capacity_ml,
          opening_level_ml: openingLevel,
          closing_level_ml: current ? (current.closing_level_ml !== null ? Number(current.closing_level_ml) : null) : null,
          prev_closing_ml: prevClosing,
          existingId: current ? current.id : null,
          modified: false,
        };
      });

      setRows(levelRows);
    } catch (error: any) {
      console.error('Error loading dam levels:', error);
      setMessage({ type: 'error', text: 'Failed to load dam level data' });
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (damId: string, field: 'opening_level_ml' | 'closing_level_ml', value: string) => {
    const numVal = value === '' ? null : parseFloat(value);
    setRows(prev => prev.map(r => {
      if (r.dam_id === damId) {
        return { ...r, [field]: numVal, modified: true };
      }
      return r;
    }));
  };

  const isOpeningEditable = useMemo(() => {
    if (selectedMonth === 1) {
      return rows.some(r => r.prev_closing_ml === null);
    }
    return false;
  }, [selectedMonth, rows]);

  const handleSave = async () => {
    if (!isOnline) { showOfflineWarning(); return; }
    if (!user) { setMessage({ type: 'error', text: 'Not authenticated' }); return; }

    const modifiedRows = rows.filter(r => r.modified);
    if (modifiedRows.length === 0) {
      setMessage({ type: 'error', text: 'No changes to save' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      for (const row of modifiedRows) {
        const payload = {
          dam_id: row.dam_id,
          year: selectedYear,
          month: selectedMonth,
          opening_level_ml: row.opening_level_ml,
          closing_level_ml: row.closing_level_ml,
          service_centre_id: accessContext?.isSCScoped ? accessContext.scopeId : null,
          recorded_by: user.id,
        };

        if (row.existingId) {
          const { error } = await supabase
            .from('dam_monthly_levels')
            .update({
              opening_level_ml: payload.opening_level_ml,
              closing_level_ml: payload.closing_level_ml,
              recorded_by: user.id,
            })
            .eq('id', row.existingId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('dam_monthly_levels')
            .insert(payload);
          if (error) throw error;
        }
      }

      setMessage({ type: 'success', text: `Saved levels for ${modifiedRows.length} dam(s)` });
      await loadData();
    } catch (error: any) {
      console.error('Error saving dam levels:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to save dam levels' });
    } finally {
      setSaving(false);
    }
  };

  const handleExportExcel = () => {
    if (rows.length === 0) return;

    const monthLabel = `${MONTH_NAMES[selectedMonth]} ${selectedYear}`;
    const headers = ['Code', 'Dam Name', 'FSC (ML)', 'Opening (ML)', '% Full', 'Closing (ML)', '% Full', 'Change (ML)'];

    const dataRows = rows.map(row => {
      const openPct = computePctFull(row.opening_level_ml, row.full_supply_capacity_ml);
      const closePct = computePctFull(row.closing_level_ml, row.full_supply_capacity_ml);
      const change = computeChange(row.opening_level_ml, row.closing_level_ml);
      return [
        row.dam_code || '',
        row.dam_name,
        row.full_supply_capacity_ml,
        row.opening_level_ml ?? '',
        openPct !== null ? +(openPct.toFixed(1)) : '',
        row.closing_level_ml ?? '',
        closePct !== null ? +(closePct.toFixed(1)) : '',
        change ?? '',
      ];
    });

    const totalFSC = rows.reduce((s, r) => s + r.full_supply_capacity_ml, 0);
    const totalOpening = rows.reduce((s, r) => s + (r.opening_level_ml || 0), 0);
    const totalClosing = rows.reduce((s, r) => s + (r.closing_level_ml || 0), 0);
    const totalOpenPct = totalFSC > 0 && rows.some(r => r.opening_level_ml !== null) ? +((totalOpening / totalFSC * 100).toFixed(1)) : '';
    const totalClosePct = totalFSC > 0 && rows.some(r => r.closing_level_ml !== null) ? +((totalClosing / totalFSC * 100).toFixed(1)) : '';
    const damsWithBoth = rows.filter(r => r.opening_level_ml !== null && r.closing_level_ml !== null);
    const totalChange = damsWithBoth.length > 0 ? damsWithBoth.reduce((s, r) => s + (r.closing_level_ml! - r.opening_level_ml!), 0) : '';

    dataRows.push([
      '',
      `Totals (${rows.length} dams)`,
      totalFSC,
      rows.some(r => r.opening_level_ml !== null) ? totalOpening : '',
      totalOpenPct,
      rows.some(r => r.closing_level_ml !== null) ? totalClosing : '',
      totalClosePct,
      totalChange,
    ]);

    const xmlHeader = '<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n';
    const workbookOpen = '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
    const styles = `<Styles>
  <Style ss:ID="Default"><Font ss:FontName="Calibri" ss:Size="11"/></Style>
  <Style ss:ID="Title"><Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1"/></Style>
  <Style ss:ID="Header"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/><Interior ss:Color="#D9E2F3" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
  <Style ss:ID="NumberCell"><NumberFormat ss:Format="#,##0.00"/></Style>
  <Style ss:ID="PctCell"><NumberFormat ss:Format="0.0&quot;%&quot;"/></Style>
  <Style ss:ID="TotalRow"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/><Interior ss:Color="#E2EFDA" ss:Pattern="Solid"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
  <Style ss:ID="TotalNumber"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/><Interior ss:Color="#E2EFDA" ss:Pattern="Solid"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><NumberFormat ss:Format="#,##0.00"/></Style>
  <Style ss:ID="TotalPct"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/><Interior ss:Color="#E2EFDA" ss:Pattern="Solid"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><NumberFormat ss:Format="0.0&quot;%&quot;"/></Style>
</Styles>\n`;

    let worksheet = `<Worksheet ss:Name="Dam Levels">\n<Table>\n`;
    worksheet += '<Column ss:Width="60"/><Column ss:Width="180"/><Column ss:Width="100"/><Column ss:Width="100"/><Column ss:Width="70"/><Column ss:Width="100"/><Column ss:Width="70"/><Column ss:Width="100"/>\n';

    worksheet += `<Row><Cell ss:StyleID="Title"><Data ss:Type="String">Monthly Dam Levels - ${monthLabel}</Data></Cell></Row>\n<Row></Row>\n`;

    worksheet += '<Row>';
    headers.forEach(h => { worksheet += `<Cell ss:StyleID="Header"><Data ss:Type="String">${h}</Data></Cell>`; });
    worksheet += '</Row>\n';

    dataRows.forEach((row, rowIdx) => {
      const isTotal = rowIdx === dataRows.length - 1;
      worksheet += '<Row>';
      row.forEach((cell, colIdx) => {
        const isNumCol = colIdx >= 2;
        const isPctCol = colIdx === 4 || colIdx === 6;
        if (cell === '' || cell === null || cell === undefined) {
          worksheet += `<Cell${isTotal ? ' ss:StyleID="TotalRow"' : ''}><Data ss:Type="String"></Data></Cell>`;
        } else if (typeof cell === 'number') {
          let style = isTotal ? (isPctCol ? 'TotalPct' : 'TotalNumber') : (isPctCol ? 'PctCell' : 'NumberCell');
          worksheet += `<Cell ss:StyleID="${style}"><Data ss:Type="Number">${cell}</Data></Cell>`;
        } else {
          worksheet += `<Cell${isTotal ? ' ss:StyleID="TotalRow"' : ''}><Data ss:Type="String">${cell.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Data></Cell>`;
        }
      });
      worksheet += '</Row>\n';
    });

    worksheet += '</Table>\n</Worksheet>\n';
    const xml = xmlHeader + workbookOpen + styles + worksheet + '</Workbook>';

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Dam_Levels_${MONTH_NAMES[selectedMonth]}_${selectedYear}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const navigateMonth = (direction: -1 | 1) => {
    let newMonth = selectedMonth + direction;
    let newYear = selectedYear;
    if (newMonth < 1) { newMonth = 12; newYear--; }
    if (newMonth > 12) { newMonth = 1; newYear++; }
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  };

  const hasChanges = rows.some(r => r.modified);

  const computeChange = (opening: number | null, closing: number | null) => {
    if (opening === null || closing === null) return null;
    return closing - opening;
  };

  const computePctFull = (level: number | null, capacity: number) => {
    if (level === null || capacity <= 0) return null;
    return (level / capacity) * 100;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-gray-900">Monthly Dam Levels</h2>
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-1 py-1">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-1 hover:bg-white rounded transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-sm font-semibold text-gray-800 min-w-[140px] text-center">
              {MONTH_NAMES[selectedMonth]} {selectedYear}
            </span>
            <button
              onClick={() => navigateMonth(1)}
              className="p-1 hover:bg-white rounded transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportExcel}
            disabled={loading || rows.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
          {!isViewer && (
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            <X className="w-4 h-4" />
            Close
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-sm text-gray-500">Loading dam levels...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-sm font-medium">No dams with capacities found</p>
          <p className="text-xs mt-1">Only dams with Full Supply Capacity values appear here.</p>
        </div>
      ) : (
        <div className="overflow-auto border border-gray-200 rounded-lg" style={{ maxHeight: 'calc(100vh - 320px)' }}>
          <table className="w-full border-collapse bg-white text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="border-b border-r border-gray-200 px-3 py-2.5 text-left text-xs font-bold text-gray-700 w-20">Code</th>
                <th className="border-b border-r border-gray-200 px-3 py-2.5 text-left text-xs font-bold text-gray-700 min-w-[160px]">Dam Name</th>
                <th className="border-b border-r border-gray-200 px-3 py-2.5 text-right text-xs font-bold text-gray-700 w-32">FSC (ML)</th>
                <th className="border-b border-r border-gray-200 px-3 py-2.5 text-right text-xs font-bold text-blue-700 w-36">Opening (ML)</th>
                <th className="border-b border-r border-gray-200 px-3 py-2.5 text-right text-xs font-bold text-gray-500 w-24">% Full</th>
                <th className="border-b border-r border-gray-200 px-3 py-2.5 text-right text-xs font-bold text-blue-700 w-36">Closing (ML)</th>
                <th className="border-b border-r border-gray-200 px-3 py-2.5 text-right text-xs font-bold text-gray-500 w-24">% Full</th>
                <th className="border-b border-gray-200 px-3 py-2.5 text-right text-xs font-bold text-gray-700 w-32">Change (ML)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const openPct = computePctFull(row.opening_level_ml, row.full_supply_capacity_ml);
                const closePct = computePctFull(row.closing_level_ml, row.full_supply_capacity_ml);
                const change = computeChange(row.opening_level_ml, row.closing_level_ml);
                const openingIsAutoFilled = row.prev_closing_ml !== null && !isJanuary;
                const canEditOpening = isJanuary && row.prev_closing_ml === null;

                return (
                  <tr
                    key={row.dam_id}
                    className={`hover:bg-gray-50 ${row.modified ? 'bg-amber-50' : ''}`}
                  >
                    <td className="border-b border-r border-gray-200 px-3 py-1.5 text-xs text-gray-600 font-mono">
                      {row.dam_code || '-'}
                    </td>
                    <td className="border-b border-r border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-900">
                      {row.dam_name}
                    </td>
                    <td className="border-b border-r border-gray-200 px-3 py-1.5 text-xs text-right text-gray-700 tabular-nums">
                      {row.full_supply_capacity_ml.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="border-b border-r border-gray-200 p-0">
                      {canEditOpening ? (
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={row.opening_level_ml ?? ''}
                          onChange={(e) => handleFieldChange(row.dam_id, 'opening_level_ml', e.target.value)}
                          className="w-full h-full px-3 py-1.5 text-xs text-right border-0 focus:ring-1 focus:ring-blue-500 bg-blue-50"
                          placeholder="Enter..."
                        />
                      ) : (
                        <div className="px-3 py-1.5 text-xs text-right text-gray-700 tabular-nums bg-gray-50">
                          {row.opening_level_ml !== null
                            ? row.opening_level_ml.toLocaleString(undefined, { maximumFractionDigits: 2 })
                            : <span className="text-gray-400 italic">-</span>}
                        </div>
                      )}
                    </td>
                    <td className="border-b border-r border-gray-200 px-3 py-1.5 text-xs text-right text-gray-500 tabular-nums">
                      {openPct !== null ? `${openPct.toFixed(1)}%` : '-'}
                    </td>
                    <td className="border-b border-r border-gray-200 p-0">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={row.closing_level_ml ?? ''}
                        onChange={(e) => handleFieldChange(row.dam_id, 'closing_level_ml', e.target.value)}
                        className="w-full h-full px-3 py-1.5 text-xs text-right border-0 focus:ring-1 focus:ring-blue-500 bg-blue-50"
                        placeholder="Enter..."
                      />
                    </td>
                    <td className="border-b border-r border-gray-200 px-3 py-1.5 text-xs text-right text-gray-500 tabular-nums">
                      {closePct !== null ? `${closePct.toFixed(1)}%` : '-'}
                    </td>
                    <td className="border-b border-gray-200 px-3 py-1.5 text-xs text-right tabular-nums font-medium">
                      {change !== null ? (
                        <span className={change > 0 ? 'text-green-700' : change < 0 ? 'text-red-600' : 'text-gray-600'}>
                          {change > 0 ? '+' : ''}{change.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 font-bold">
              <tr>
                <td colSpan={2} className="border-t border-r border-gray-300 px-3 py-2 text-xs text-gray-800">
                  Totals ({rows.length} dams)
                </td>
                <td className="border-t border-r border-gray-300 px-3 py-2 text-xs text-right text-gray-800 tabular-nums">
                  {rows.reduce((s, r) => s + r.full_supply_capacity_ml, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </td>
                <td className="border-t border-r border-gray-300 px-3 py-2 text-xs text-right text-gray-800 tabular-nums">
                  {rows.filter(r => r.opening_level_ml !== null).length > 0
                    ? rows.reduce((s, r) => s + (r.opening_level_ml || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : '-'}
                </td>
                <td className="border-t border-r border-gray-300 px-3 py-2 text-xs text-right text-gray-500 tabular-nums">
                  {(() => {
                    const totalOpen = rows.reduce((s, r) => s + (r.opening_level_ml || 0), 0);
                    const totalCap = rows.reduce((s, r) => s + r.full_supply_capacity_ml, 0);
                    return totalCap > 0 && rows.some(r => r.opening_level_ml !== null)
                      ? `${((totalOpen / totalCap) * 100).toFixed(1)}%`
                      : '-';
                  })()}
                </td>
                <td className="border-t border-r border-gray-300 px-3 py-2 text-xs text-right text-gray-800 tabular-nums">
                  {rows.filter(r => r.closing_level_ml !== null).length > 0
                    ? rows.reduce((s, r) => s + (r.closing_level_ml || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : '-'}
                </td>
                <td className="border-t border-r border-gray-300 px-3 py-2 text-xs text-right text-gray-500 tabular-nums">
                  {(() => {
                    const totalClose = rows.reduce((s, r) => s + (r.closing_level_ml || 0), 0);
                    const totalCap = rows.reduce((s, r) => s + r.full_supply_capacity_ml, 0);
                    return totalCap > 0 && rows.some(r => r.closing_level_ml !== null)
                      ? `${((totalClose / totalCap) * 100).toFixed(1)}%`
                      : '-';
                  })()}
                </td>
                <td className="border-t border-gray-300 px-3 py-2 text-xs text-right tabular-nums">
                  {(() => {
                    const damsWithBoth = rows.filter(r => r.opening_level_ml !== null && r.closing_level_ml !== null);
                    if (damsWithBoth.length === 0) return '-';
                    const totalChange = damsWithBoth.reduce((s, r) => s + (r.closing_level_ml! - r.opening_level_ml!), 0);
                    return (
                      <span className={totalChange > 0 ? 'text-green-700' : totalChange < 0 ? 'text-red-600' : 'text-gray-600'}>
                        {totalChange > 0 ? '+' : ''}{totalChange.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    );
                  })()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-2">
        Opening levels for months after January are automatically set from the previous month's closing level.
        For January, enter the opening level manually if no December closing exists.
      </p>
    </div>
  );
}
