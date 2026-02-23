import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2, Circle, CreditCard as EditIcon } from 'lucide-react';
import type { ChemicalStationRow } from '../../lib/chemicalStockService';
import { getBalanceColumnHeader, getAvgUsageColumnHeader, isPastMonth } from '../../lib/chemicalStockService';

interface ChemicalTrackerFETProps {
  data: ChemicalStationRow[];
  year: number;
  month: number;
  onUpdate: (index: number, field: string, value: any) => void;
  height?: string;
}

type RowStatus = 'saved' | 'edited' | 'unedited';

function getRowStatus(row: ChemicalStationRow): RowStatus {
  if (row.balance_id && !row.isModified) return 'saved';
  if (row.isTouched || row.isModified) return 'edited';
  return 'unedited';
}

function getRowBg(row: ChemicalStationRow): string {
  const s = getRowStatus(row);
  if (s === 'unedited') return 'bg-red-50';
  if (s === 'edited') return 'bg-yellow-50';
  return 'bg-white';
}

function parseNum(v: string): number {
  const p = parseFloat(v.replace(/,/g, ''));
  return isNaN(p) ? 0 : p;
}

function fmtNum(v: number): string {
  if (!v && v !== 0) return '';
  return v % 1 === 0 ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export default function ChemicalTrackerFET({
  data,
  year,
  month,
  onUpdate,
  height,
}: ChemicalTrackerFETProps) {
  const [localData, setLocalData] = useState<ChemicalStationRow[]>([...data]);
  const dirtyRef = useRef(new Set<string>());
  const tableRef = useRef<HTMLTableElement>(null);
  const showDaysRemaining = !isPastMonth(year, month);

  useEffect(() => {
    setLocalData([...data]);
    dirtyRef.current.clear();
  }, [data]);

  const focusCell = useCallback((rowIdx: number, colIdx: number) => {
    const table = tableRef.current;
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const row = rows[rowIdx];
    if (!row) return;
    const cells = Array.from(row.querySelectorAll('td'));
    const cell = cells[colIdx];
    if (!cell) return;
    const input = cell.querySelector('input') as HTMLInputElement | null;
    if (input && !input.disabled && !input.readOnly) {
      input.focus();
      input.select();
    }
  }, []);

  const navigateFrom = useCallback((rowIdx: number, colIdx: number, direction: 'up' | 'down' | 'left' | 'right') => {
    const rowCount = localData.length;
    if (rowCount === 0) return;

    let r = rowIdx;
    let c = colIdx;
    const editableCol = 2;

    if (direction === 'up') r = Math.max(0, r - 1);
    else if (direction === 'down') r = Math.min(rowCount - 1, r + 1);
    else if (direction === 'left') {
      if (r > 0) { r -= 1; c = editableCol; }
    }
    else if (direction === 'right') {
      if (r < rowCount - 1) { r += 1; c = editableCol; }
    }

    focusCell(r, c);
  }, [localData, focusCell]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) => {
    const dirMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    };
    if (dirMap[e.key]) {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
      navigateFrom(rowIdx, colIdx, dirMap[e.key]);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
      navigateFrom(rowIdx, colIdx, 'down');
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
      navigateFrom(rowIdx, colIdx, e.shiftKey ? 'up' : 'down');
    }
  }, [navigateFrom]);

  const handleChange = useCallback((rowIdx: number, rawValue: string) => {
    const value = parseNum(rawValue);
    const key = `${rowIdx}`;
    dirtyRef.current.add(key);
    setLocalData(prev => {
      const updated = [...prev];
      updated[rowIdx] = { ...updated[rowIdx], opening_balance: value };
      return updated;
    });
  }, []);

  const commitCell = useCallback((rowIdx: number) => {
    const key = `${rowIdx}`;
    if (!dirtyRef.current.has(key)) return;
    const value = localData[rowIdx]?.opening_balance ?? 0;
    onUpdate(rowIdx, 'opening_balance', value);
    dirtyRef.current.delete(key);
  }, [localData, onUpdate]);

  const totals = {
    opening_balance: localData.reduce((s, r) => s + r.opening_balance, 0),
    received: localData.reduce((s, r) => s + r.received, 0),
    used: localData.reduce((s, r) => s + r.used, 0),
    current_balance: localData.reduce((s, r) => s + r.current_balance, 0),
    avg_usage_per_day: localData.reduce((s, r) => s + r.avg_usage_per_day, 0),
    days_remaining: 0 as number | null,
  };
  if (totals.avg_usage_per_day > 0) {
    totals.days_remaining = Math.round(totals.current_balance / totals.avg_usage_per_day);
  } else {
    totals.days_remaining = null;
  }

  return (
    <div className="overflow-auto" style={{ maxHeight: height || 'calc(100vh - 340px)' }}>
      <table ref={tableRef} className="w-full border-collapse bg-white shadow-sm">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            <th className="border border-gray-300 px-1 py-1 text-xs font-bold text-gray-700 text-center w-10" />
            <th className="border border-gray-300 px-2 py-1 text-xs font-bold text-gray-700 text-left" style={{ minWidth: '160px' }}>
              Station
            </th>
            <th className="border border-gray-300 px-2 py-1 text-xs font-bold text-gray-700 text-left" style={{ minWidth: '120px' }}>
              {getBalanceColumnHeader(year, month)}
            </th>
            <th className="border border-gray-300 px-2 py-1 text-xs font-bold text-gray-700 text-right" style={{ minWidth: '100px' }}>
              Received
            </th>
            <th className="border border-gray-300 px-2 py-1 text-xs font-bold text-gray-700 text-right" style={{ minWidth: '100px' }}>
              Used (Kg)
            </th>
            <th className="border border-gray-300 px-2 py-1 text-xs font-bold text-gray-700 text-right" style={{ minWidth: '110px' }}>
              Current Bal.
            </th>
            <th className="border border-gray-300 px-2 py-1 text-xs font-bold text-gray-700 text-right" style={{ minWidth: '120px' }}>
              {getAvgUsageColumnHeader(year, month)}
            </th>
            {showDaysRemaining && (
              <th className="border border-gray-300 px-2 py-1 text-xs font-bold text-gray-700 text-right" style={{ minWidth: '120px' }}>
                Days remaining
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {localData.map((row, ri) => {
            const status = getRowStatus(row);
            return (
              <tr key={row.station_id} className={getRowBg(row)}>
                <td className="border border-gray-300 py-0 px-1 text-center">
                  <div className="flex items-center justify-center" style={{ height: '26px' }}>
                    {status === 'saved' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                    {status === 'edited' && <EditIcon className="w-4 h-4 text-amber-600" />}
                    {status === 'unedited' && <Circle className="w-4 h-4 text-red-600" />}
                  </div>
                </td>
                <td className="border border-gray-300 py-0 px-2">
                  <div className="flex items-center text-sm font-medium bg-gray-50" style={{ height: '26px' }}>
                    {row.station_name}
                  </div>
                </td>
                <td className="border border-gray-300 py-0 px-0">
                  <input
                    type="number"
                    value={row.opening_balance}
                    onChange={(e) => handleChange(ri, e.target.value)}
                    onBlur={() => commitCell(ri)}
                    onKeyDown={(e) => handleKeyDown(e, ri, 2)}
                    onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
                    className="w-full px-2 py-0 text-sm text-right font-mono border-0 focus:ring-1 focus:ring-blue-500 outline-none"
                    style={{ height: '26px' }}
                  />
                </td>
                <td className="border border-gray-300 py-0 px-2">
                  <div className="flex items-center justify-end text-sm font-mono bg-gray-50" style={{ height: '26px' }}>
                    {fmtNum(row.received)}
                  </div>
                </td>
                <td className="border border-gray-300 py-0 px-2">
                  <div className="flex items-center justify-end text-sm font-mono bg-gray-50" style={{ height: '26px' }}>
                    {fmtNum(row.used)}
                  </div>
                </td>
                <td className="border border-gray-300 py-0 px-2">
                  <div className="flex items-center justify-end text-sm font-mono font-semibold bg-gray-100" style={{ height: '26px' }}>
                    {fmtNum(row.current_balance)}
                  </div>
                </td>
                <td className="border border-gray-300 py-0 px-2">
                  <div className="flex items-center justify-end text-sm font-mono bg-gray-50" style={{ height: '26px' }}>
                    {fmtNum(row.avg_usage_per_day)}
                  </div>
                </td>
                {showDaysRemaining && (
                  <td className="border border-gray-300 py-0 px-2">
                    <div className="flex items-center justify-end text-sm font-mono bg-gray-50" style={{ height: '26px' }}>
                      {row.days_remaining !== null ? Math.round(row.days_remaining).toLocaleString() : ''}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
          <tr className="bg-gray-100 font-bold">
            <td className="border border-gray-300 py-0 px-1" />
            <td className="border border-gray-300 py-0 px-2">
              <div className="flex items-center text-sm font-bold" style={{ height: '26px' }}>Total</div>
            </td>
            <td className="border border-gray-300 py-0 px-2">
              <div className="flex items-center justify-end text-sm font-mono font-bold" style={{ height: '26px' }}>
                {fmtNum(totals.opening_balance)}
              </div>
            </td>
            <td className="border border-gray-300 py-0 px-2">
              <div className="flex items-center justify-end text-sm font-mono font-bold" style={{ height: '26px' }}>
                {fmtNum(totals.received)}
              </div>
            </td>
            <td className="border border-gray-300 py-0 px-2">
              <div className="flex items-center justify-end text-sm font-mono font-bold" style={{ height: '26px' }}>
                {fmtNum(totals.used)}
              </div>
            </td>
            <td className="border border-gray-300 py-0 px-2">
              <div className="flex items-center justify-end text-sm font-mono font-bold" style={{ height: '26px' }}>
                {fmtNum(totals.current_balance)}
              </div>
            </td>
            <td className="border border-gray-300 py-0 px-2">
              <div className="flex items-center justify-end text-sm font-mono font-bold" style={{ height: '26px' }}>
                {fmtNum(totals.avg_usage_per_day)}
              </div>
            </td>
            {showDaysRemaining && (
              <td className="border border-gray-300 py-0 px-2">
                <div className="flex items-center justify-end text-sm font-mono font-bold" style={{ height: '26px' }}>
                  {totals.days_remaining !== null ? Math.round(totals.days_remaining).toLocaleString() : ''}
                </div>
              </td>
            )}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
