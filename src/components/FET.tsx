import {
  useState, useCallback, useEffect, useMemo, useRef,
  forwardRef, useImperativeHandle, memo
} from 'react';
import { CheckCircle2, Circle, CreditCard as Edit3, AlertCircle } from 'lucide-react';
import { PasteHandler } from '../lib/pasteHandlers';
import type { FieldConfig } from '../lib/pasteHandlers';
import { useUndoRedo } from '../hooks/useUndoRedo';

export interface FETColumn {
  header: string;
  field: string;
  type: 'number' | 'integer' | 'string' | 'select';
  minWidth?: number;
  options?: string[];
}

export interface FETLabelColumn {
  header: string;
  field: string;
  minWidth?: number;
}

export interface FETProps {
  data: Record<string, any>[];
  columns: FETColumn[];
  labelColumn: FETLabelColumn;
  onUpdate: (index: number, field: string, value: any) => void;
  rowKey: (row: Record<string, any>, index: number) => string;
  isDefaultRow: (row: Record<string, any>) => boolean;
  dataSourceId?: string;
  savedField?: string;
  errorsField?: string;
  touchedField?: string;
  modifiedField?: string;
  height?: string;
  onUndoRedoStateChange?: (canUndo: boolean, canRedo: boolean) => void;
}

export interface FETRef {
  flushPendingEdits: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

type RowStatus = 'unedited' | 'edited' | 'saved';

const ROW_HEIGHT = 25;
const OVERSCAN = 8;

const parseNumber = (value: any): number => {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : parseFloat(value);
  return isNaN(n) ? 0 : n;
};

const parseInteger = (value: any): number => {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'string' ? parseInt(value.replace(/,/g, '')) : parseInt(value);
  return isNaN(n) ? 0 : n;
};

const getCellValue = (row: Record<string, any>, field: string, type: string): any => {
  const v = row[field];
  return (type === 'string' || type === 'select') ? (v || '') : (v ?? 0);
};

const processInputValue = (value: string, type: string): any => {
  if (type === 'integer') return parseInteger(value);
  if (type === 'number') return parseNumber(value);
  return value;
};

interface CellHandlers {
  onChange: (field: string, colType: string, rawValue: string) => void;
  onBlur: (field: string) => void;
  onSelectChange: (field: string, value: string) => void;
}

interface RowProps {
  row: Record<string, any>;
  rowIndex: number;
  status: RowStatus;
  columns: FETColumn[];
  labelColumn: FETLabelColumn;
  errorsField: string;
  statusColWidth: number;
  labelColWidth: number;
  handlers: CellHandlers;
}

const FETRow = memo(function FETRow({
  row,
  rowIndex,
  status,
  columns,
  labelColumn,
  errorsField,
  statusColWidth,
  labelColWidth,
  handlers,
}: RowProps) {
  const bgColor =
    status === 'unedited' ? '#fef2f2' : status === 'edited' ? '#fefce8' : '#ffffff';
  const bgClass =
    status === 'unedited' ? 'bg-red-50' : status === 'edited' ? 'bg-yellow-50' : 'bg-white';
  const errors = Array.isArray(row[errorsField]) ? row[errorsField] : [];

  return (
    <tr className={bgClass} data-row-index={rowIndex}>
      <td
        className="border border-gray-300 py-0 px-1 sticky left-0 z-[1]"
        style={{ backgroundColor: bgColor }}
      >
        <div className="flex items-center justify-center" style={{ height: '24px' }}>
          {status === 'saved' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
          {status === 'edited' && <Edit3 className="w-5 h-5 text-amber-600" />}
          {status === 'unedited' && <Circle className="w-5 h-5 text-red-600" />}
        </div>
      </td>
      <td
        className="border border-gray-300 py-0 px-1 sticky z-[1]"
        style={{ left: `${statusColWidth}px`, backgroundColor: bgColor }}
      >
        <div className="flex items-center overflow-hidden" style={{ height: '24px', whiteSpace: 'nowrap' }}>
          <span className="text-sm font-medium">{row[labelColumn.field]}</span>
          {errors.length > 0 && (
            <AlertCircle className="w-4 h-4 text-red-600 ml-2 flex-shrink-0" />
          )}
        </div>
      </td>
      {columns.map(col => (
        <FETCell
          key={col.field}
          col={col}
          value={getCellValue(row, col.field, col.type)}
          handlers={handlers}
        />
      ))}
    </tr>
  );
});

interface CellProps {
  col: FETColumn;
  value: any;
  handlers: CellHandlers;
}

const FETCell = memo(function FETCell({ col, value, handlers }: CellProps) {
  if (col.type === 'select' && col.options) {
    return (
      <td className="border border-gray-300 py-0 px-1">
        <select
          value={value}
          onChange={(e) => handlers.onSelectChange(col.field, e.target.value)}
          className="w-full px-2 py-0.5 text-sm border-0 focus:ring-1 focus:ring-blue-500"
          style={{ height: '24px' }}
        >
          <option value=""></option>
          {col.options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </td>
    );
  }

  return (
    <td className="border border-gray-300 py-0 px-1">
      <input
        type={col.type === 'string' ? 'text' : 'number'}
        value={value}
        onChange={(e) => handlers.onChange(col.field, col.type, e.target.value)}
        onBlur={() => handlers.onBlur(col.field)}
        onFocus={(e) => {
          if (col.type !== 'string' && e.target.value === '0') e.target.select();
        }}
        className="w-full px-2 py-0.5 text-sm border-0 focus:ring-1 focus:ring-blue-500"
        style={{ height: '24px' }}
      />
    </td>
  );
});

function FETComponent(
  {
    data,
    columns,
    labelColumn,
    onUpdate,
    rowKey,
    isDefaultRow,
    dataSourceId,
    savedField = 'existing_log_id',
    errorsField = 'errors',
    touchedField = 'isTouched',
    modifiedField = 'isModified',
    height = 'calc(100vh - 300px)',
    onUndoRedoStateChange
  }: FETProps,
  ref: React.Ref<FETRef>
) {
  const [localData, setLocalData] = useState<Record<string, any>[]>(() => [...data]);
  const localDataRef = useRef(localData);
  const dirtyMap = useRef<Set<string>>(new Set());
  const { pushChange, undo, redo, canUndo, canRedo, clear } = useUndoRedo(100);
  const prevSourceIdRef = useRef(dataSourceId);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const selectedCellRef = useRef<{ rowIndex: number; colIndex: number } | null>(null);

  useEffect(() => {
    localDataRef.current = localData;
  });

  useEffect(() => {
    onUndoRedoStateChange?.(canUndo, canRedo);
  }, [canUndo, canRedo, onUndoRedoStateChange]);

  useEffect(() => {
    const sourceChanged = dataSourceId !== prevSourceIdRef.current;
    prevSourceIdRef.current = dataSourceId;

    if (sourceChanged) {
      const next = [...data];
      setLocalData(next);
      localDataRef.current = next;
      dirtyMap.current.clear();
      clear();
      setScrollTop(0);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }
  }, [dataSourceId, data, clear]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    ro.observe(container);
    setContainerHeight(container.clientHeight);
    return () => ro.disconnect();
  }, []);

  const totalColCount = columns.length + 2;

  const { startIndex, endIndex } = useMemo(() => {
    const bodyScrollTop = Math.max(0, scrollTop);
    const visibleRows = Math.ceil(containerHeight / ROW_HEIGHT);
    const start = Math.max(0, Math.floor(bodyScrollTop / ROW_HEIGHT) - OVERSCAN);
    const end = Math.min(localData.length - 1, Math.floor(bodyScrollTop / ROW_HEIGHT) + visibleRows + OVERSCAN);
    return { startIndex: start, endIndex: end };
  }, [scrollTop, containerHeight, localData.length]);

  const topSpacerHeight = startIndex * ROW_HEIGHT;
  const renderedCount = localData.length === 0 ? 0 : endIndex - startIndex + 1;
  const bottomSpacerHeight = Math.max(0, (localData.length - startIndex - renderedCount) * ROW_HEIGHT);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const getRowStatus = useCallback((row: Record<string, any>): RowStatus => {
    if (row[savedField]) return 'saved';
    if (isDefaultRow(row)) return 'unedited';
    if (row[touchedField] || row[modifiedField]) return 'edited';
    return 'unedited';
  }, [savedField, touchedField, modifiedField, isDefaultRow]);

  const rowStatuses = useMemo(
    () => localData.map(row => getRowStatus(row)),
    [localData, getRowStatus]
  );

  const onUpdateRef = useRef(onUpdate);
  useEffect(() => { onUpdateRef.current = onUpdate; });

  const applyChange = useCallback((index: number, field: string, value: any) => {
    dirtyMap.current.add(`${index}-${field}`);
    setLocalData(prev => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
    onUpdateRef.current(index, field, value);
  }, []);

  const handleUndo = useCallback(() => undo(applyChange), [undo, applyChange]);
  const handleRedo = useCallback(() => redo(applyChange), [redo, applyChange]);

  const flushPendingEdits = useCallback(() => {
    const keys = Array.from(dirtyMap.current);
    for (const cellKey of keys) {
      const dash = cellKey.indexOf('-');
      const index = parseInt(cellKey.substring(0, dash), 10);
      const field = cellKey.substring(dash + 1);
      if (!isNaN(index)) {
        const value = localDataRef.current[index]?.[field];
        onUpdateRef.current(index, field, value);
        dirtyMap.current.delete(cellKey);
      }
    }
  }, []);

  useImperativeHandle(ref, () => ({
    flushPendingEdits,
    undo: handleUndo,
    redo: handleRedo,
    canUndo,
    canRedo
  }), [flushPendingEdits, handleUndo, handleRedo, canUndo, canRedo]);

  const rowHandlers = useMemo<(index: number) => CellHandlers>(() => {
    const cache = new Map<number, CellHandlers>();
    return (index: number) => {
      if (!cache.has(index)) {
        cache.set(index, {
          onChange: (field: string, colType: string, rawValue: string) => {
            const value = processInputValue(rawValue, colType);
            const oldValue = localDataRef.current[index]?.[field];
            if (oldValue !== value) {
              pushChange(index, field, oldValue, value);
            }
            dirtyMap.current.add(`${index}-${field}`);
            setLocalData(prev => {
              const updated = [...prev];
              if (updated[index]) {
                updated[index] = { ...updated[index], [field]: value };
              }
              return updated;
            });
          },
          onBlur: (field: string) => {
            const cellKey = `${index}-${field}`;
            if (dirtyMap.current.has(cellKey)) {
              const value = localDataRef.current[index]?.[field];
              onUpdateRef.current(index, field, value);
              dirtyMap.current.delete(cellKey);
            }
          },
          onSelectChange: (field: string, value: string) => {
            dirtyMap.current.delete(`${index}-${field}`);
            setLocalData(prev => {
              const updated = [...prev];
              if (updated[index]) {
                updated[index] = { ...updated[index], [field]: value };
              }
              return updated;
            });
            onUpdateRef.current(index, field, value);
          },
        });
      }
      return cache.get(index)!;
    };
  }, [pushChange]);

  const scrollRowIntoView = useCallback((rowIndex: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const rowTop = rowIndex * ROW_HEIGHT;
    const rowBottom = rowTop + ROW_HEIGHT;
    const viewTop = container.scrollTop;
    const viewHeight = container.clientHeight;

    if (rowTop < viewTop) {
      container.scrollTop = rowTop;
    } else if (rowBottom > viewTop + viewHeight) {
      container.scrollTop = rowBottom - viewHeight;
    }
  }, []);

  const focusCell = useCallback((rowIndex: number, colIndex: number) => {
    scrollRowIntoView(rowIndex);
    selectedCellRef.current = { rowIndex, colIndex };

    requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const row = container.querySelector(`tr[data-row-index="${rowIndex}"]`);
      if (!row) {
        requestAnimationFrame(() => {
          const retryRow = container.querySelector(`tr[data-row-index="${rowIndex}"]`);
          if (!retryRow) return;
          const cells = Array.from(retryRow.querySelectorAll('td'));
          const cell = cells[colIndex];
          if (!cell) return;
          const input = cell.querySelector('input, select, textarea') as HTMLElement;
          if (input) input.focus();
        });
        return;
      }
      const cells = Array.from(row.querySelectorAll('td'));
      const cell = cells[colIndex];
      if (!cell) return;
      const input = cell.querySelector('input, select, textarea') as HTMLElement;
      if (input) input.focus();
    });
  }, [scrollRowIntoView]);

  const navigateCell = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    const current = selectedCellRef.current;
    if (!current) return;
    let newRow = current.rowIndex;
    let newCol = current.colIndex;

    switch (direction) {
      case 'up':
        newRow = Math.max(0, current.rowIndex - 1);
        break;
      case 'down':
        newRow = Math.min(localData.length - 1, current.rowIndex + 1);
        break;
      case 'left':
        if (newCol > 0) {
          newCol--;
        } else if (newRow > 0) {
          newRow--;
          newCol = totalColCount - 1;
        }
        break;
      case 'right':
        if (newCol < totalColCount - 1) {
          newCol++;
        } else if (newRow < localData.length - 1) {
          newRow++;
          newCol = 0;
        }
        break;
    }

    focusCell(newRow, newCol);
  }, [totalColCount, localData.length, focusCell]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA';
    if (!isInput) return;

    if (e.key === 'ArrowUp') { e.preventDefault(); navigateCell('up'); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); navigateCell('down'); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); navigateCell('left'); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); navigateCell('right'); }
    else if (e.key === 'Enter') { e.preventDefault(); navigateCell('down'); }
    else if (e.key === 'Tab') {
      e.preventDefault();
      navigateCell(e.shiftKey ? 'left' : 'right');
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      e.preventDefault();
      const input = target as HTMLInputElement;
      if (input.value !== undefined) {
        navigator.clipboard.writeText(input.value);
      }
    }
  }, [navigateCell]);

  const handleFocusIn = useCallback((e: React.FocusEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT' && target.tagName !== 'TEXTAREA') return;
    const cell = target.closest('td');
    const row = cell?.closest('tr');
    if (!cell || !row) return;
    const rowIndex = parseInt(row.getAttribute('data-row-index') || '-1', 10);
    if (rowIndex < 0) return;
    const cells = Array.from(row.querySelectorAll('td'));
    const colIndex = cells.indexOf(cell);
    if (colIndex >= 0) {
      selectedCellRef.current = { rowIndex, colIndex };
    }
  }, []);

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const current = selectedCellRef.current;
      if (!current) return;

      e.preventDefault();
      e.stopPropagation();

      const clipboardText = e.clipboardData?.getData('text/plain');
      if (!clipboardText) return;

      try {
        const currentData = localDataRef.current;
        if (current.rowIndex < 0 || current.rowIndex >= currentData.length) return;

        const fieldConfigs: FieldConfig[] = columns.map(col => ({
          name: col.field,
          type: col.type
        }));

        const batchUpdates: Array<{ idx: number; field: string; value: any }> = [];

        const pasteHandler = new PasteHandler(
          {
            isEditMode: true,
            onUpdate: (idx: number, field: string, value: any) => {
              if (idx >= 0 && idx < currentData.length) {
                batchUpdates.push({ idx, field, value });
                dirtyMap.current.add(`${idx}-${field}`);
              }
            },
            addDirtyCell: (cellKey: string) => {
              dirtyMap.current.add(cellKey);
            }
          },
          fieldConfigs,
          (idx: number) => idx >= 0 && idx < currentData.length
        );

        const adjustedColIndex = current.colIndex - 2;
        const result = await pasteHandler.handlePaste(clipboardText, current.rowIndex, adjustedColIndex);

        if (batchUpdates.length > 0) {
          const CHUNK_SIZE = 50;
          const applyChunk = (startIdx: number) => {
            const chunk = batchUpdates.slice(startIdx, startIdx + CHUNK_SIZE);
            setLocalData(prev => {
              const updated = [...prev];
              for (const { idx, field, value } of chunk) {
                if (updated[idx]) {
                  updated[idx] = { ...updated[idx], [field]: value };
                }
                pushChange(idx, field, prev[idx]?.[field], value);
              }
              return updated;
            });
            for (const { idx, field, value } of chunk) {
              onUpdateRef.current(idx, field, value);
            }
            if (startIdx + CHUNK_SIZE < batchUpdates.length) {
              requestAnimationFrame(() => applyChunk(startIdx + CHUNK_SIZE));
            }
          };
          requestAnimationFrame(() => applyChunk(0));
        }

        return result;
      } catch {
        return { successCount: 0, errorCount: 1, message: 'Paste error occurred' };
      }
    },
    [columns, pushChange]
  );

  const statusColWidth = 48;
  const labelColWidth = labelColumn.minWidth || 130;

  const visibleRows = useMemo(() => {
    const rows = [];
    for (let i = startIndex; i <= endIndex && i < localData.length; i++) {
      rows.push({
        index: i,
        row: localData[i],
        status: rowStatuses[i],
        key: rowKey(localData[i], i),
      });
    }
    return rows;
  }, [startIndex, endIndex, localData, rowStatuses, rowKey]);

  return (
    <div
      ref={scrollContainerRef}
      className="overflow-auto"
      style={{ maxHeight: height }}
      onScroll={handleScroll}
    >
      <table
        className="w-full border-collapse bg-white shadow-sm"
        onKeyDown={handleKeyDown}
        onFocusCapture={handleFocusIn}
        onPaste={handlePaste}
      >
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            <th
              className="border border-gray-300 px-2 py-1 text-xs font-black text-gray-700 text-left bg-gray-50 sticky left-0 z-20"
              style={{ width: `${statusColWidth}px`, minWidth: `${statusColWidth}px` }}
            >
              Status
            </th>
            <th
              className="border border-gray-300 px-2 py-1 text-xs font-black text-gray-700 text-left bg-gray-50 sticky z-20"
              style={{ left: `${statusColWidth}px`, minWidth: `${labelColWidth}px` }}
            >
              {labelColumn.header}
            </th>
            {columns.map(col => (
              <th
                key={col.field}
                className="border border-gray-300 px-2 py-1 text-xs font-black text-gray-700 text-left"
                style={{ minWidth: col.minWidth ? `${col.minWidth}px` : '100px' }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {topSpacerHeight > 0 && (
            <tr aria-hidden="true" style={{ height: `${topSpacerHeight}px` }}>
              <td colSpan={totalColCount} style={{ padding: 0, border: 'none' }} />
            </tr>
          )}
          {visibleRows.map(({ index, row, status, key }) => (
            <FETRow
              key={key}
              row={row}
              rowIndex={index}
              status={status}
              columns={columns}
              labelColumn={labelColumn}
              errorsField={errorsField}
              statusColWidth={statusColWidth}
              labelColWidth={labelColWidth}
              handlers={rowHandlers(index)}
            />
          ))}
          {bottomSpacerHeight > 0 && (
            <tr aria-hidden="true" style={{ height: `${bottomSpacerHeight}px` }}>
              <td colSpan={totalColCount} style={{ padding: 0, border: 'none' }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export const FET = memo(forwardRef(FETComponent));
