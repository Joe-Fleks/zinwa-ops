import { useState, useRef, useEffect } from 'react';
import { Edit2, Save, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface TargetRow {
  id: string;
  name: string;
  jan: number;
  feb: number;
  mar: number;
  apr: number;
  may: number;
  jun: number;
  jul: number;
  aug: number;
  sep: number;
  oct: number;
  nov: number;
  dec: number;
}

interface TargetsTableProps {
  rows: TargetRow[];
  year: number;
  onYearChange: (year: number) => void;
  onSave: (rows: TargetRow[]) => Promise<void>;
  entityLabel: string;
  totalLabel: string;
  isLoading?: boolean;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function TargetsTable({
  rows,
  year,
  onYearChange,
  onSave,
  entityLabel,
  totalLabel,
  isLoading = false,
}: TargetsTableProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedRows, setEditedRows] = useState<TargetRow[]>([]);
  const [focusedCell, setFocusedCell] = useState<{ rowIndex: number; colIndex: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

  useEffect(() => {
    if (isEditMode) {
      setEditedRows(JSON.parse(JSON.stringify(rows)));
    }
  }, [isEditMode, rows]);

  useEffect(() => {
    if (focusedCell && isEditMode) {
      const key = `${focusedCell.rowIndex}-${focusedCell.colIndex}`;
      inputRefs.current[key]?.focus();
    }
  }, [focusedCell, isEditMode]);

  const calculateRowTotal = (row: TargetRow) => {
    return MONTHS.reduce((sum, month) => sum + (Number(row[month as keyof TargetRow]) || 0), 0);
  };

  const calculateColumnTotal = (month: string) => {
    return rows.reduce((sum, row) => sum + (Number(row[month as keyof TargetRow]) || 0), 0);
  };

  const calculateGrandTotal = () => {
    return rows.reduce((sum, row) => sum + calculateRowTotal(row), 0);
  };

  const handleEdit = () => {
    setIsEditMode(true);
    setFocusedCell({ rowIndex: 0, colIndex: 0 });
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setEditedRows([]);
    setFocusedCell(null);
  };

  const handleSaveAndExit = async () => {
    setIsSaving(true);
    try {
      await onSave(editedRows);
      setIsEditMode(false);
      setFocusedCell(null);
    } catch (error) {
      console.error('Error saving targets:', error);
      alert('Failed to save targets. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndContinue = async () => {
    setIsSaving(true);
    try {
      await onSave(editedRows);
    } catch (error) {
      console.error('Error saving targets:', error);
      alert('Failed to save targets. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCellChange = (rowIndex: number, month: string, value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    if (isNaN(numValue) || numValue < 0) return;

    const newRows = [...editedRows];
    newRows[rowIndex] = {
      ...newRows[rowIndex],
      [month]: numValue,
    };
    setEditedRows(newRows);
  };

  const handlePaste = async (e: React.ClipboardEvent, rowIndex: number, colIndex: number) => {
    e.preventDefault();

    const pastedText = e.clipboardData.getData('text');
    if (!pastedText) return;

    const lines = pastedText.split(/\r?\n/).filter(line => line.trim() !== '');

    if (lines.length === 0) return;

    const newRows = [...editedRows];

    lines.forEach((line, lineIndex) => {
      const targetRowIndex = rowIndex + lineIndex;

      if (targetRowIndex >= newRows.length) return;

      const values = line.split('\t');

      values.forEach((value, valueIndex) => {
        const targetColIndex = colIndex + valueIndex;

        if (targetColIndex >= MONTHS.length) return;

        const numValue = parseFloat(value.replace(/,/g, ''));
        if (!isNaN(numValue) && numValue >= 0) {
          const month = MONTHS[targetColIndex];
          newRows[targetRowIndex] = {
            ...newRows[targetRowIndex],
            [month]: numValue,
          };
        }
      });
    });

    setEditedRows(newRows);
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    if (!isEditMode) return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (rowIndex > 0) {
          setFocusedCell({ rowIndex: rowIndex - 1, colIndex });
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (rowIndex < editedRows.length - 1) {
          setFocusedCell({ rowIndex: rowIndex + 1, colIndex });
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (colIndex > 0) {
          setFocusedCell({ rowIndex, colIndex: colIndex - 1 });
        }
        break;
      case 'ArrowRight':
      case 'Tab':
        e.preventDefault();
        if (colIndex < MONTHS.length - 1) {
          setFocusedCell({ rowIndex, colIndex: colIndex + 1 });
        } else if (rowIndex < editedRows.length - 1) {
          setFocusedCell({ rowIndex: rowIndex + 1, colIndex: 0 });
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (rowIndex < editedRows.length - 1) {
          setFocusedCell({ rowIndex: rowIndex + 1, colIndex });
        }
        break;
    }
  };

  const displayRows = isEditMode ? editedRows : rows;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Year:</label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onYearChange(year - 1)}
              className="p-2 rounded-lg bg-blue-300 text-blue-900 hover:bg-blue-400 transition-colors"
              title="Previous year"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <select
              value={year}
              onChange={(e) => onYearChange(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button
              onClick={() => onYearChange(year + 1)}
              className="p-2 rounded-lg bg-blue-300 text-blue-900 hover:bg-blue-400 transition-colors"
              title="Next year"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!isEditMode ? (
          <button
            onClick={handleEdit}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-300 text-blue-900 rounded-lg hover:bg-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Edit2 className="w-4 h-4" />
            Edit Targets
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveAndContinue}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-300 text-blue-900 rounded-lg hover:bg-blue-400 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Save & Continue
            </button>
            <button
              onClick={handleSaveAndExit}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-300 text-blue-900 rounded-lg hover:bg-blue-400 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Save & Exit
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-300 text-blue-900 rounded-lg hover:bg-blue-400 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto overflow-y-auto border border-gray-300 rounded-lg max-h-[calc(100vh-300px)]">
        <table className="w-full border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="sticky left-0 top-0 z-20 bg-gray-100 border border-gray-300 px-4 py-2 text-left text-sm font-bold text-gray-700 min-w-[200px]">
                {entityLabel}
              </th>
              {MONTH_NAMES.map((month) => (
                <th key={month} className="sticky top-0 z-10 bg-gray-100 border border-gray-300 px-4 py-2 text-center text-sm font-bold text-gray-700 min-w-[100px]">
                  {month}
                </th>
              ))}
              <th className="sticky top-0 z-10 bg-gray-100 border border-gray-300 px-4 py-2 text-center text-sm font-bold text-gray-700 min-w-[120px]">
                {year} Target
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={14} className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : displayRows.length === 0 ? (
              <tr>
                <td colSpan={14} className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                  No data available
                </td>
              </tr>
            ) : (
              displayRows.map((row, rowIndex) => (
                <tr key={row.id} className="hover:bg-gray-50 group">
                  <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 border border-gray-300 px-4 py-2 text-sm text-gray-900 font-bold">
                    {row.name}
                  </td>
                  {MONTHS.map((month, colIndex) => (
                    <td key={month} className="border border-gray-300 px-2 py-1 text-center">
                      {isEditMode ? (
                        <input
                          ref={(el) => (inputRefs.current[`${rowIndex}-${colIndex}`] = el)}
                          type="number"
                          min="0"
                          step="0.01"
                          value={row[month as keyof TargetRow] || 0}
                          onChange={(e) => handleCellChange(rowIndex, month, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                          onPaste={(e) => handlePaste(e, rowIndex, colIndex)}
                          onFocus={(e) => {
                            setFocusedCell({ rowIndex, colIndex });
                            e.target.select();
                          }}
                          className="w-full px-2 py-1 text-sm text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <span className="text-sm text-gray-900">
                          {Number(row[month as keyof TargetRow] || 0).toLocaleString(undefined, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold text-gray-900 bg-gray-50">
                    {calculateRowTotal(row).toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </td>
                </tr>
              ))
            )}
            {displayRows.length > 0 && (
              <tr className="bg-blue-50 font-bold">
                <td className="sticky left-0 z-10 bg-blue-50 border border-gray-300 px-4 py-2 text-sm text-gray-900">
                  {totalLabel}
                </td>
                {MONTHS.map((month) => (
                  <td key={month} className="border border-gray-300 px-4 py-2 text-center text-sm text-gray-900">
                    {calculateColumnTotal(month).toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </td>
                ))}
                <td className="border border-gray-300 px-4 py-2 text-center text-sm text-gray-900">
                  {calculateGrandTotal().toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
