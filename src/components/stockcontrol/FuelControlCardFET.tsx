import { useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle2, Circle, CreditCard as EditIcon, Trash2 } from 'lucide-react';
import type { FuelCardRow } from './FuelControlCard';

interface FuelControlCardFETProps {
  data: FuelCardRow[];
  onUpdate: (index: number, field: string, value: any) => void;
  onDeleteRow: (index: number) => void;
  height?: string;
  selectedMonth?: number;
  selectedYear?: number;
}

type RowStatus = 'saved' | 'edited' | 'unedited';

const COLUMNS = [
  { field: 'entry_date', header: 'Date', type: 'date' as const, minWidth: 130 },
  { field: 'voucher_no', header: 'Voucher No.', type: 'text' as const, minWidth: 110 },
  { field: 'no_plate', header: 'No. Plate', type: 'text' as const, minWidth: 110 },
  { field: 'issues', header: 'Issues', type: 'number' as const, minWidth: 90 },
  { field: 'receipts', header: 'Receipts', type: 'number' as const, minWidth: 90 },
  { field: 'balance', header: 'Balance', type: 'number' as const, minWidth: 100 },
  { field: 'description', header: 'Description', type: 'text' as const, minWidth: 180 },
  { field: 'req_no', header: 'Req. No.', type: 'text' as const, minWidth: 100 },
  { field: 'collected_by', header: 'Collected By', type: 'text' as const, minWidth: 130 },
];

const READONLY_ON_NORMAL = new Set(['balance']);
const READONLY_ON_OPENING = new Set(['voucher_no', 'no_plate', 'issues', 'receipts', 'description', 'req_no', 'collected_by']);

function getRowStatus(row: FuelCardRow): RowStatus {
  if (row.id && !row.isModified) return 'saved';
  if (row.isTouched || row.isModified || row.isNew) return 'edited';
  return 'unedited';
}

function getRowBg(row: FuelCardRow): string {
  if (row.is_opening_balance) return 'bg-blue-50';
  const s = getRowStatus(row);
  if (s === 'unedited') return 'bg-red-50';
  if (s === 'edited') return 'bg-yellow-50';
  return 'bg-white';
}

function isFieldReadonly(row: FuelCardRow, field: string, month?: number, year?: number): boolean {
  if (row.is_opening_balance) {
    const canEditOpeningBalance =
      (year === 2025 && month === 7) ||
      (year === 2026 && month === 1);

    if (field === 'entry_date') return false;
    if (field === 'balance') return !canEditOpeningBalance;
    return READONLY_ON_OPENING.has(field);
  }
  return READONLY_ON_NORMAL.has(field);
}

function parseNum(v: string): number {
  const p = parseFloat(v.replace(/,/g, ''));
  return isNaN(p) ? 0 : p;
}

export default function FuelControlCardFET({
  data,
  onUpdate,
  onDeleteRow,
  height = 'calc(100vh - 320px)',
  selectedMonth,
  selectedYear,
}: FuelControlCardFETProps) {
  const [localData, setLocalData] = useState<FuelCardRow[]>([...data]);
  const dirtyRef = useRef(new Set<string>());
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    setLocalData([...data]);
    dirtyRef.current.clear();
  }, [data]);

  const getEditableCols = useCallback((row: FuelCardRow): number[] => {
    const indices: number[] = [];
    COLUMNS.forEach((col, ci) => {
      if (!isFieldReadonly(row, col.field, selectedMonth, selectedYear)) indices.push(ci);
    });
    return indices;
  }, [selectedMonth, selectedYear]);

  const focusCell = useCallback((rowIdx: number, colIdx: number) => {
    const table = tableRef.current;
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const row = rows[rowIdx];
    if (!row) return;
    const cells = Array.from(row.querySelectorAll('td'));
    const cell = cells[colIdx + 1];
    if (!cell) return;
    const input = cell.querySelector('input') as HTMLInputElement | null;
    if (input && !input.disabled && !input.readOnly) {
      input.focus();
      if (input.type === 'text' || input.type === 'number') input.select();
    }
  }, []);

  const navigateFrom = useCallback((rowIdx: number, colIdx: number, direction: 'up' | 'down' | 'left' | 'right') => {
    const rowCount = localData.length;
    if (rowCount === 0) return;

    let r = rowIdx;
    let c = colIdx;

    if (direction === 'up') {
      r = Math.max(0, r - 1);
    } else if (direction === 'down') {
      r = Math.min(rowCount - 1, r + 1);
    } else if (direction === 'left') {
      const editable = getEditableCols(localData[r]);
      const curPos = editable.indexOf(c);
      if (curPos > 0) {
        c = editable[curPos - 1];
      } else if (r > 0) {
        r -= 1;
        const prevEditable = getEditableCols(localData[r]);
        c = prevEditable[prevEditable.length - 1] ?? c;
      }
    } else if (direction === 'right') {
      const editable = getEditableCols(localData[r]);
      const curPos = editable.indexOf(c);
      if (curPos < editable.length - 1) {
        c = editable[curPos + 1];
      } else if (r < rowCount - 1) {
        r += 1;
        const nextEditable = getEditableCols(localData[r]);
        c = nextEditable[0] ?? c;
      }
    }

    focusCell(r, c);
  }, [localData, getEditableCols, focusCell]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) => {
    const dirMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };

    if (dirMap[e.key]) {
      e.preventDefault();
      const input = e.target as HTMLInputElement;
      input.blur();
      navigateFrom(rowIdx, colIdx, dirMap[e.key]);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const input = e.target as HTMLInputElement;
      input.blur();
      navigateFrom(rowIdx, colIdx, 'down');
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const input = e.target as HTMLInputElement;
      input.blur();
      navigateFrom(rowIdx, colIdx, e.shiftKey ? 'left' : 'right');
    }
  }, [navigateFrom]);

  const handleChange = useCallback((rowIdx: number, field: string, rawValue: string, colType: string) => {
    const value = colType === 'number' ? parseNum(rawValue) : rawValue;
    const key = `${rowIdx}-${field}`;
    dirtyRef.current.add(key);
    setLocalData(prev => {
      const updated = [...prev];
      updated[rowIdx] = { ...updated[rowIdx], [field]: value };
      return updated;
    });
  }, []);

  const commitCell = useCallback((rowIdx: number, field: string) => {
    const key = `${rowIdx}-${field}`;
    if (!dirtyRef.current.has(key)) return;
    const value = localData[rowIdx]?.[field as keyof FuelCardRow];
    onUpdate(rowIdx, field, value);
    dirtyRef.current.delete(key);
  }, [localData, onUpdate]);

  const getCellVal = (row: FuelCardRow, field: string, type: string): any => {
    const v = row[field as keyof FuelCardRow];
    if (type === 'number') return v ?? 0;
    return v || '';
  };

  return (
    <div className="overflow-auto" style={{ height }}>
      <table ref={tableRef} className="w-full border-collapse bg-white shadow-sm">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            <th className="border border-gray-300 px-1 py-1 text-xs font-bold text-gray-700 text-center w-10">
            </th>
            {COLUMNS.map(col => (
              <th
                key={col.field}
                className="border border-gray-300 px-2 py-1 text-xs font-bold text-gray-700 text-left"
                style={{ minWidth: `${col.minWidth}px` }}
              >
                {col.header}
              </th>
            ))}
            <th className="border border-gray-300 px-1 py-1 text-xs font-bold text-gray-700 text-center w-10">
            </th>
          </tr>
        </thead>
        <tbody>
          {localData.map((row, ri) => {
            const status = getRowStatus(row);
            return (
              <tr key={row.id || `new-${ri}`} className={getRowBg(row)}>
                <td className="border border-gray-300 py-0 px-1 text-center">
                  <div className="flex items-center justify-center" style={{ height: '26px' }}>
                    {status === 'saved' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                    {status === 'edited' && <EditIcon className="w-4 h-4 text-amber-600" />}
                    {status === 'unedited' && <Circle className="w-4 h-4 text-red-600" />}
                  </div>
                </td>
                {COLUMNS.map((col, ci) => {
                  const readonly = isFieldReadonly(row, col.field, selectedMonth, selectedYear);
                  return (
                    <td key={col.field} className="border border-gray-300 py-0 px-0">
                      {readonly ? (
                        <div
                          className={`px-2 py-0 text-sm flex items-center ${
                            col.type === 'number' ? 'justify-end font-mono' : ''
                          } ${col.field === 'balance' ? 'font-semibold bg-gray-100' : 'bg-gray-50'}`}
                          style={{ height: '26px' }}
                        >
                          {col.type === 'number'
                            ? Number(getCellVal(row, col.field, col.type)).toLocaleString()
                            : getCellVal(row, col.field, col.type)}
                        </div>
                      ) : (
                        <input
                          type={col.type === 'date' ? 'date' : col.type === 'number' ? 'number' : 'text'}
                          value={getCellVal(row, col.field, col.type === 'date' ? 'text' : col.type)}
                          onChange={(e) => handleChange(ri, col.field, e.target.value, col.type)}
                          onBlur={() => commitCell(ri, col.field)}
                          onKeyDown={(e) => handleKeyDown(e, ri, ci)}
                          onFocus={(e) => {
                            if (col.type === 'number' && e.target.value === '0') e.target.select();
                          }}
                          className={`w-full px-2 py-0 text-sm border-0 focus:ring-1 focus:ring-blue-500 outline-none ${
                            col.type === 'number' ? 'text-right font-mono' : ''
                          }`}
                          style={{ height: '26px' }}
                        />
                      )}
                    </td>
                  );
                })}
                <td className="border border-gray-300 py-0 px-1 text-center">
                  {!row.is_opening_balance && (
                    <button
                      type="button"
                      onClick={() => onDeleteRow(ri)}
                      className="text-red-400 hover:text-red-600 transition-colors p-0.5"
                      title="Delete row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {localData.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length + 2} className="border border-gray-300 py-8 text-center text-sm text-gray-400">
                No entries for this month
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
