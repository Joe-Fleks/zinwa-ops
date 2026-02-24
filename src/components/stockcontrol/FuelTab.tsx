import { useState, useEffect, useCallback } from 'react';
import { Pencil, X, Plus, Save, Loader2, AlertTriangle, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { FuelType } from '../../pages/StockControl';
import FuelControlCard from './FuelControlCard';
import FuelControlCardFET from './FuelControlCardFET';
import type { FuelCardRow } from './FuelControlCard';

interface DateConfirmation {
  rowIndex: number;
  date: string;
  targetMonth: number;
  targetYear: number;
}

interface FuelTabProps {
  fuelType: FuelType;
}

const FUEL_LABELS: Record<FuelType, string> = {
  diesel: 'Diesel',
  petrol: 'Petrol',
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

export default function FuelTab({ fuelType }: FuelTabProps) {
  const { user, accessContext } = useAuth();
  const label = FUEL_LABELS[fuelType];

  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<FuelCardRow[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dateConfirmation, setDateConfirmation] = useState<DateConfirmation | null>(null);

  const serviceCentreId = accessContext?.scopeType === 'SC' ? accessContext.scopeId : null;

  useEffect(() => {
    setSelectedMonth(CURRENT_MONTH);
    setSelectedYear(CURRENT_YEAR);
    setEditing(false);
  }, [fuelType]);

  useEffect(() => {
    if (serviceCentreId) {
      loadData();
    }
  }, [serviceCentreId, fuelType, selectedMonth, selectedYear]);

  const sortRowsByDate = (rowsToSort: FuelCardRow[]): FuelCardRow[] => {
    return [...rowsToSort].sort((a, b) => {
      const dateA = new Date(a.entry_date).getTime();
      const dateB = new Date(b.entry_date).getTime();
      if (dateA !== dateB) return dateA - dateB;

      if (a.is_opening_balance !== b.is_opening_balance) {
        return a.is_opening_balance ? -1 : 1;
      }

      const aIsReceipt = (a.receipts || 0) > 0 ? 1 : 0;
      const bIsReceipt = (b.receipts || 0) > 0 ? 1 : 0;
      if (aIsReceipt !== bIsReceipt) return bIsReceipt - aIsReceipt;

      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
  };

  const recalcBalances = useCallback((currentRows: FuelCardRow[]): FuelCardRow[] => {
    if (currentRows.length === 0) return currentRows;
    const updated = [...currentRows];
    let running = updated[0].balance;
    for (let i = 1; i < updated.length; i++) {
      running = running - (updated[i].issues || 0) + (updated[i].receipts || 0);
      updated[i] = { ...updated[i], balance: running };
    }
    return updated;
  }, []);

  // Period A: Jul 2025 – Dec 2025 (anchor = Jul 2025, manual opening balance)
  // Period B: Jan 2026 onwards   (anchor = Jan 2026, manual opening balance)
  // Anchor months have a manually-set opening balance.
  // All subsequent months in each period inherit closing balance from previous month.
  const isAnchorMonth = (month: number, year: number): boolean => {
    return (month === 7 && year === 2025) || (month === 1 && year === 2026);
  };

  const isPeriodA = (month: number, year: number): boolean => {
    return year === 2025 && month >= 7 && month <= 12;
  };

  const isPeriodB = (month: number, year: number): boolean => {
    return year >= 2026;
  };

  const isInAnyLinkedPeriod = (month: number, year: number): boolean => {
    return isPeriodA(month, year) || isPeriodB(month, year);
  };

  // Fetches all rows for a given month and recalculates the true closing balance
  // by applying issues/receipts from the correct opening balance forward.
  // The opening balance for anchor months is taken from the stored DB opening row.
  // For all other months it is recursively derived from the previous month's closing balance.
  // Returns null if no data exists for the month or if the month is outside a linked period.
  const computeTrueClosingBalance = async (
    month: number,
    year: number,
    depth = 0
  ): Promise<number | null> => {
    if (!serviceCentreId) return null;
    if (depth > 12) return null; // guard against infinite recursion

    const { data, error } = await supabase
      .from('fuel_control_cards')
      .select('issues, receipts, balance, is_opening_balance, entry_date, sort_order')
      .eq('service_centre_id', serviceCentreId)
      .eq('fuel_type', fuelType)
      .eq('year', year)
      .eq('month', month)
      .order('entry_date', { ascending: true })
      .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) return null;

    // Sort identically to sortRowsByDate to get consistent ordering
    const sorted = [...data].sort((a, b) => {
      const da = new Date(a.entry_date).getTime();
      const db2 = new Date(b.entry_date).getTime();
      if (da !== db2) return da - db2;
      if (a.is_opening_balance !== b.is_opening_balance) return a.is_opening_balance ? -1 : 1;
      const aR = (a.receipts || 0) > 0 ? 1 : 0;
      const bR = (b.receipts || 0) > 0 ? 1 : 0;
      if (aR !== bR) return bR - aR;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });

    // Determine the correct opening balance for this month
    let openingBalance: number;

    if (isAnchorMonth(month, year)) {
      // Anchor month: use the stored opening balance row from DB
      const openingRow = sorted.find(r => r.is_opening_balance);
      openingBalance = openingRow ? Number(openingRow.balance) : 0;
    } else {
      // Non-anchor: derive from previous month's true closing balance
      let prevMonth = month - 1;
      let prevYear = year;
      if (prevMonth < 1) {
        prevMonth = 12;
        prevYear -= 1;
      }
      if (!isInAnyLinkedPeriod(prevMonth, prevYear)) return null;
      const prevClosing = await computeTrueClosingBalance(prevMonth, prevYear, depth + 1);
      if (prevClosing === null) return null;
      openingBalance = prevClosing;
    }

    // Walk all non-opening rows and apply issues/receipts to compute closing balance
    let running = openingBalance;
    for (const row of sorted) {
      if (row.is_opening_balance) continue;
      running = running - (Number(row.issues) || 0) + (Number(row.receipts) || 0);
    }
    return running;
  };

  // For non-anchor months within a linked period, returns the previous month's true closing balance.
  // Returns null for anchor months (they have manually-set opening balances).
  const fetchPreviousMonthClosingBalance = async (forMonth: number, forYear: number): Promise<number | null> => {
    if (!serviceCentreId) return null;

    // Anchor months — opening balance is entered manually, not auto-linked
    if (isAnchorMonth(forMonth, forYear)) return null;

    // Only auto-link within recognised periods
    if (!isInAnyLinkedPeriod(forMonth, forYear)) return null;

    let prevMonth = forMonth - 1;
    let prevYear = forYear;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear -= 1;
    }

    // Do not cross period boundaries: Period A ends Dec 2025, Period B starts Jan 2026
    if (!isInAnyLinkedPeriod(prevMonth, prevYear)) return null;

    return computeTrueClosingBalance(prevMonth, prevYear);
  };

  const loadData = useCallback(async () => {
    if (!serviceCentreId) return;
    setLoading(true);
    setMessage(null);

    try {
      const { data, error } = await supabase
        .from('fuel_control_cards')
        .select('*')
        .eq('service_centre_id', serviceCentreId)
        .eq('fuel_type', fuelType)
        .eq('year', selectedYear)
        .eq('month', selectedMonth)
        .order('entry_date', { ascending: true })
        .order('sort_order', { ascending: true });

      if (error) throw error;

      const firstDay = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;

      // Fetch the live previous month closing balance (null if anchor or out of period)
      const linkedOpeningBalance = await fetchPreviousMonthClosingBalance(selectedMonth, selectedYear);

      const makeOpeningRow = (balance: number, isNew: boolean, isLinked: boolean): FuelCardRow => ({
        entry_date: firstDay,
        voucher_no: '',
        no_plate: '',
        issues: 0,
        receipts: 0,
        balance,
        description: '',
        req_no: '',
        collected_by: '',
        is_opening_balance: true,
        sort_order: -1,
        isNew,
        isTouched: isLinked,
        isModified: isLinked,
        errors: [],
      });

      if (data && data.length > 0) {
        let mappedRows: FuelCardRow[] = data.map(r => ({
          id: r.id,
          entry_date: r.entry_date,
          voucher_no: r.voucher_no || '',
          no_plate: r.no_plate || '',
          issues: Number(r.issues) || 0,
          receipts: Number(r.receipts) || 0,
          balance: Number(r.balance) || 0,
          description: r.description || '',
          req_no: r.req_no || '',
          collected_by: r.collected_by || '',
          is_opening_balance: r.is_opening_balance || false,
          sort_order: r.sort_order,
          isNew: false,
          isTouched: false,
          isModified: false,
          errors: [],
        }));

        mappedRows = sortRowsByDate(mappedRows);

        const hasOpeningRow = mappedRows.some(r => r.is_opening_balance);

        if (linkedOpeningBalance !== null) {
          // Non-anchor month: inject the previous month's closing balance as the opening row
          if (hasOpeningRow) {
            const openingIdx = mappedRows.findIndex(r => r.is_opening_balance);
            mappedRows[openingIdx] = { ...mappedRows[openingIdx], balance: linkedOpeningBalance };
          } else {
            mappedRows = [makeOpeningRow(linkedOpeningBalance, true, true), ...mappedRows];
          }
          setRows(recalcBalances(mappedRows));
        } else {
          // Anchor month or out-of-period: ensure an opening balance row always exists
          if (!hasOpeningRow) {
            mappedRows = [makeOpeningRow(0, true, false), ...mappedRows];
          }
          setRows(recalcBalances(mappedRows));
        }
      } else {
        // No records exist yet for this month — create a blank opening balance row
        const openingBalance = linkedOpeningBalance ?? 0;
        const isLinked = linkedOpeningBalance !== null;
        setRows([makeOpeningRow(openingBalance, true, isLinked)]);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to load data' });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [serviceCentreId, fuelType, selectedMonth, selectedYear, recalcBalances]);

  const handleUpdate = useCallback((index: number, field: string, value: any) => {
    setRows(prev => {
      let updated = [...prev];
      updated[index] = { ...updated[index], [field]: value, isTouched: true, isModified: true };

      if (field === 'entry_date') {
        updated = sortRowsByDate(updated);
      }

      if ((index === 0 && field === 'balance') || field === 'issues' || field === 'receipts') {
        return recalcBalances(updated);
      }

      return updated;
    });
  }, [recalcBalances]);

  const handleAddRow = useCallback(() => {
    setRows(prev => {
      const lastBalance = prev.length > 0 ? prev[prev.length - 1].balance : 0;
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const maxSort = prev.reduce((max, r) => Math.max(max, r.sort_order), 0);

      return [...prev, {
        entry_date: dateStr,
        voucher_no: '',
        no_plate: '',
        issues: 0,
        receipts: 0,
        balance: lastBalance,
        description: '',
        req_no: '',
        collected_by: '',
        is_opening_balance: false,
        sort_order: maxSort + 1,
        isNew: true,
        isTouched: true,
        isModified: true,
        errors: [],
      }];
    });
  }, []);

  const handleDeleteRow = useCallback((index: number) => {
    setRows(prev => {
      if (prev[index]?.is_opening_balance) return prev;
      const updated = prev.filter((_, i) => i !== index);
      return recalcBalances(updated);
    });
  }, [recalcBalances]);

  const handleSave = async () => {
    if (!serviceCentreId || !user) return;

    const outOfMonthRows: DateConfirmation[] = [];
    rows.forEach((row, index) => {
      if (!row.entry_date) return;
      const entryDate = new Date(row.entry_date);
      const entryMonth = entryDate.getMonth() + 1;
      const entryYear = entryDate.getFullYear();

      if (entryMonth !== selectedMonth || entryYear !== selectedYear) {
        outOfMonthRows.push({
          rowIndex: index,
          date: row.entry_date,
          targetMonth: entryMonth,
          targetYear: entryYear,
        });
      }
    });

    if (outOfMonthRows.length > 0) {
      setDateConfirmation(outOfMonthRows[0]);
      return;
    }

    await performSave();
  };

  const performSave = async () => {
    if (!serviceCentreId || !user) return;
    setSaving(true);
    setMessage(null);

    try {
      const rowsByMonth = new Map<string, FuelCardRow[]>();

      rows.forEach((row) => {
        if (!row.entry_date) return;
        const entryDate = new Date(row.entry_date);
        const entryMonth = entryDate.getMonth() + 1;
        const entryYear = entryDate.getFullYear();
        const key = `${entryYear}-${entryMonth}`;

        if (!rowsByMonth.has(key)) {
          rowsByMonth.set(key, []);
        }
        rowsByMonth.get(key)!.push(row);
      });

      for (const [monthKey, monthRows] of rowsByMonth.entries()) {
        const [year, month] = monthKey.split('-').map(Number);
        const isCurrentMonth = (year === selectedYear && month === selectedMonth);

        let allRowsForMonth: FuelCardRow[];

        if (isCurrentMonth) {
          allRowsForMonth = [...monthRows];
        } else {
          const { data: existingRows } = await supabase
            .from('fuel_control_cards')
            .select('*')
            .eq('service_centre_id', serviceCentreId)
            .eq('fuel_type', fuelType)
            .eq('year', year)
            .eq('month', month)
            .order('entry_date', { ascending: true })
            .order('sort_order', { ascending: true });

          allRowsForMonth = [...(existingRows || []).map(r => ({
            id: r.id,
            entry_date: r.entry_date,
            voucher_no: r.voucher_no || '',
            no_plate: r.no_plate || '',
            issues: Number(r.issues) || 0,
            receipts: Number(r.receipts) || 0,
            balance: Number(r.balance) || 0,
            description: r.description || '',
            req_no: r.req_no || '',
            collected_by: r.collected_by || '',
            is_opening_balance: r.is_opening_balance || false,
            sort_order: r.sort_order,
          }))];

          monthRows.forEach((newRow) => {
            const existingIndex = allRowsForMonth.findIndex(r => r.id === newRow.id);
            if (existingIndex >= 0) {
              allRowsForMonth[existingIndex] = newRow;
            } else {
              allRowsForMonth.push(newRow);
            }
          });
        }

        const sortedMonthRows = sortRowsByDate(allRowsForMonth);
        const recalcedRows = recalcBalances(sortedMonthRows);

        const existingIds = recalcedRows.filter(r => r.id).map(r => r.id!);
        const { data: currentDbRows } = await supabase
          .from('fuel_control_cards')
          .select('id')
          .eq('service_centre_id', serviceCentreId)
          .eq('fuel_type', fuelType)
          .eq('year', year)
          .eq('month', month);

        const dbIds = (currentDbRows || []).map(r => r.id);
        const idsToDelete = dbIds.filter(id => !existingIds.includes(id));

        if (idsToDelete.length > 0) {
          const { error: delError } = await supabase
            .from('fuel_control_cards')
            .delete()
            .in('id', idsToDelete);
          if (delError) throw delError;
        }

        for (let i = 0; i < recalcedRows.length; i++) {
          const row = recalcedRows[i];
          const payload = {
            service_centre_id: serviceCentreId,
            fuel_type: fuelType,
            entry_date: row.entry_date,
            voucher_no: row.voucher_no,
            no_plate: row.no_plate,
            issues: row.issues,
            receipts: row.receipts,
            balance: row.balance,
            description: row.description,
            req_no: row.req_no,
            collected_by: row.collected_by,
            is_opening_balance: row.is_opening_balance,
            year: year,
            month: month,
            sort_order: i,
            updated_at: new Date().toISOString(),
          };

          if (row.id) {
            const { error } = await supabase
              .from('fuel_control_cards')
              .update(payload)
              .eq('id', row.id);
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from('fuel_control_cards')
              .insert({ ...payload, created_by: user.id });
            if (error) throw error;
          }
        }
      }

      setMessage({ type: 'success', text: 'Control card saved successfully' });
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
    }
    setEditing(!editing);
  };

  const handleExport = () => {
    const monthName = MONTHS[selectedMonth - 1];
    const filename = `${label}_Stock_${monthName}_${selectedYear}.xls`;

    const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      try {
        const d = new Date(dateStr + 'T00:00:00');
        const year = String(d.getFullYear()).slice(-2);
        return `${d.getDate()}/${d.getMonth() + 1}/${year}`;
      } catch {
        return dateStr;
      }
    };

    const escapeXml = (text: string | number) => {
      const s = String(text ?? '');
      return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const formatNumber = (value: number) => {
      return value === 0 ? '' : String(value);
    };

    const scDisplayName = accessContext?.serviceCentre?.name ?? '';

    const tableRows = rows
      .map(
        (r) => `
    <Row>
      <Cell ss:StyleID="s62"><Data ss:Type="String">${escapeXml(formatDate(r.entry_date))}</Data></Cell>
      <Cell ss:StyleID="s62"><Data ss:Type="String">${escapeXml(r.voucher_no)}</Data></Cell>
      <Cell ss:StyleID="s62"><Data ss:Type="String">${escapeXml(r.no_plate)}</Data></Cell>
      <Cell ss:StyleID="s63">${formatNumber(r.issues) ? `<Data ss:Type="Number">${formatNumber(r.issues)}</Data>` : ''}</Cell>
      <Cell ss:StyleID="s63">${formatNumber(r.receipts) ? `<Data ss:Type="Number">${formatNumber(r.receipts)}</Data>` : ''}</Cell>
      <Cell ss:StyleID="s64">${formatNumber(r.balance) ? `<Data ss:Type="Number">${formatNumber(r.balance)}</Data>` : ''}</Cell>
      <Cell ss:StyleID="s62"><Data ss:Type="String">${escapeXml(r.description)}</Data></Cell>
      <Cell ss:StyleID="s62"><Data ss:Type="String">${escapeXml(r.req_no)}</Data></Cell>
      <Cell ss:StyleID="s62"><Data ss:Type="String">${escapeXml(r.collected_by)}</Data></Cell>
    </Row>`
      )
      .join('');

    const excelXml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="s61">
   <Font ss:FontName="Arial" ss:Size="11" ss:Bold="1"/>
  </Style>
  <Style ss:ID="s62">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
   <Font ss:FontName="Arial" ss:Size="11"/>
  </Style>
  <Style ss:ID="s63">
   <Alignment ss:Horizontal="Right"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
   <Font ss:FontName="Arial" ss:Size="11"/>
  </Style>
  <Style ss:ID="s64">
   <Alignment ss:Horizontal="Right"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
   <Font ss:FontName="Arial" ss:Size="11" ss:Bold="1"/>
  </Style>
  <Style ss:ID="s65">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
   <Font ss:FontName="Arial" ss:Size="11" ss:Bold="1"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(label)} Stock">
  <Table>
   <Column ss:Width="80"/>
   <Column ss:Width="90"/>
   <Column ss:Width="90"/>
   <Column ss:Width="60"/>
   <Column ss:Width="70"/>
   <Column ss:Width="70"/>
   <Column ss:Width="200"/>
   <Column ss:Width="80"/>
   <Column ss:Width="120"/>
   <Row>
    <Cell ss:MergeAcross="8" ss:StyleID="s61"><Data ss:Type="String">${escapeXml(scDisplayName)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:MergeAcross="8" ss:StyleID="s61"><Data ss:Type="String">${label} Stock Control Card - ${monthName} ${selectedYear}</Data></Cell>
   </Row>
   <Row/>
   <Row>
    <Cell ss:StyleID="s65"><Data ss:Type="String">Date</Data></Cell>
    <Cell ss:StyleID="s65"><Data ss:Type="String">Voucher No.</Data></Cell>
    <Cell ss:StyleID="s65"><Data ss:Type="String">No. Plate</Data></Cell>
    <Cell ss:StyleID="s65"><Data ss:Type="String">Issues</Data></Cell>
    <Cell ss:StyleID="s65"><Data ss:Type="String">Receipts</Data></Cell>
    <Cell ss:StyleID="s65"><Data ss:Type="String">Bal</Data></Cell>
    <Cell ss:StyleID="s65"><Data ss:Type="String">Description</Data></Cell>
    <Cell ss:StyleID="s65"><Data ss:Type="String">Req. No.</Data></Cell>
    <Cell ss:StyleID="s65"><Data ss:Type="String">Collected By</Data></Cell>
   </Row>
   ${tableRows}
  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([excelXml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!serviceCentreId) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <p className="text-lg font-bold text-gray-900">{label} Stock</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-8 text-center border border-gray-200">
          <p className="text-sm text-gray-500">
            Fuel control cards are only available at the Service Centre level.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <p className="text-lg font-bold text-gray-900">{label} Stock</p>
          <select
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(Number(e.target.value));
              setEditing(false);
            }}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(Number(e.target.value));
              setEditing(false);
            }}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            {YEARS.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {editing && (
            <>
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium bg-blue-200 text-blue-900 hover:bg-blue-300 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Entry
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
            </>
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
              <>
                <X className="w-4 h-4" />
                Cancel
              </>
            ) : (
              <>
                <Pencil className="w-4 h-4" />
                Edit
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export
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
          <span className="ml-2 text-sm text-gray-500">Loading control card...</span>
        </div>
      ) : editing ? (
        <FuelControlCardFET
          data={rows}
          onUpdate={handleUpdate}
          onDeleteRow={handleDeleteRow}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
        />
      ) : (
        <FuelControlCard data={rows} />
      )}

      {dateConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Date Outside Filtered Month</h3>
                <p className="text-sm text-gray-600 mb-3">
                  The date <strong>{new Date(dateConfirmation.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong> falls
                  in <strong>{MONTHS[dateConfirmation.targetMonth - 1]} {dateConfirmation.targetYear}</strong>, but you are currently
                  viewing <strong>{MONTHS[selectedMonth - 1]} {selectedYear}</strong>.
                </p>
                <p className="text-sm text-gray-600">
                  Do you want to save this record? It will be moved to {MONTHS[dateConfirmation.targetMonth - 1]} {dateConfirmation.targetYear} and all balances will be recalculated.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDateConfirmation(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setDateConfirmation(null);
                  performSave();
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
              >
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
