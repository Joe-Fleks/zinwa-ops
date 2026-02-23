import { useRef, useEffect, useState, KeyboardEvent, ClipboardEvent } from 'react';

interface CellPosition {
  rowIndex: number;
  colIndex: number;
}

interface ExcelLikeTableProps {
  children: React.ReactNode;
  onCellChange?: (rowIndex: number, colIndex: number, value: string) => void;
  onPaste?: (rowIndex: number, colIndex: number, clipboardText: string) => Promise<{ successCount: number; errorCount: number; message: string }>;
  className?: string;
}

export function ExcelLikeTable({ children, onCellChange, onPaste, className = '' }: ExcelLikeTableProps) {
  const tableRef = useRef<HTMLTableElement>(null);
  const selectedCellRef = useRef<CellPosition | null>(null);
  const [selectedCell, setSelectedCell] = useState<CellPosition | null>(null);
  const [copiedData, setCopiedData] = useState<string[][] | null>(null);

  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      const currentSelectedCell = selectedCellRef.current;
      if (!currentSelectedCell) return;

      const tbody = table.querySelector('tbody');
      if (!tbody) return;

      const rows = Array.from(tbody.querySelectorAll('tr'));
      const currentRow = rows[currentSelectedCell.rowIndex];
      if (!currentRow) return;

      const cells = Array.from(currentRow.querySelectorAll('td'));
      const currentCell = cells[currentSelectedCell.colIndex];
      if (!currentCell) return;

      const input = currentCell.querySelector('input, select, textarea') as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

      if (e.key === 'ArrowUp' && e.target === input) {
        e.preventDefault();
        navigateCell('up');
      } else if (e.key === 'ArrowDown' && e.target === input) {
        e.preventDefault();
        navigateCell('down');
      } else if (e.key === 'ArrowLeft' && e.target === input) {
        e.preventDefault();
        navigateCell('left');
      } else if (e.key === 'ArrowRight' && e.target === input) {
        e.preventDefault();
        navigateCell('right');
      } else if (e.key === 'Enter' && e.target === input) {
        e.preventDefault();
        navigateCell('down');
      } else if (e.key === 'Tab' && e.target === input) {
        e.preventDefault();
        if (e.shiftKey) {
          navigateCell('left');
        } else {
          navigateCell('right');
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'c' && e.target === input) {
        handleCopy(e);
      }
    };

    const navigateCell = (direction: 'up' | 'down' | 'left' | 'right') => {
      const currentSelectedCell = selectedCellRef.current;
      if (!currentSelectedCell) return;

      const tbody = table.querySelector('tbody');
      if (!tbody) return;

      const rows = Array.from(tbody.querySelectorAll('tr'));
      let newRowIndex = currentSelectedCell.rowIndex;
      let newColIndex = currentSelectedCell.colIndex;

      switch (direction) {
        case 'up':
          newRowIndex = Math.max(0, currentSelectedCell.rowIndex - 1);
          break;
        case 'down':
          newRowIndex = Math.min(rows.length - 1, currentSelectedCell.rowIndex + 1);
          break;
        case 'left':
          if (newColIndex > 0) {
            newColIndex--;
          } else if (newRowIndex > 0) {
            newRowIndex--;
            const prevRow = rows[newRowIndex];
            const prevCells = Array.from(prevRow.querySelectorAll('td'));
            newColIndex = prevCells.length - 1;
          }
          break;
        case 'right':
          const currentRow = rows[newRowIndex];
          const currentCells = Array.from(currentRow.querySelectorAll('td'));
          if (newColIndex < currentCells.length - 1) {
            newColIndex++;
          } else if (newRowIndex < rows.length - 1) {
            newRowIndex++;
            newColIndex = 0;
          }
          break;
      }

      focusCell(newRowIndex, newColIndex);
    };

    const focusCell = (rowIndex: number, colIndex: number) => {
      const tbody = table.querySelector('tbody');
      if (!tbody) return;

      const rows = Array.from(tbody.querySelectorAll('tr'));
      const targetRow = rows[rowIndex];
      if (!targetRow) return;

      const cells = Array.from(targetRow.querySelectorAll('td'));
      const targetCell = cells[colIndex];
      if (!targetCell) return;

      const input = targetCell.querySelector('input, select, textarea') as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (input) {
        input.focus();
        if (input instanceof HTMLInputElement && input.type === 'text') {
          input.select();
        }
        selectedCellRef.current = { rowIndex, colIndex };
        setSelectedCell({ rowIndex, colIndex });
      }
    };

    const handleCopy = (e: globalThis.KeyboardEvent) => {
      e.preventDefault();
      const currentSelectedCell = selectedCellRef.current;
      if (!currentSelectedCell) return;

      const tbody = table.querySelector('tbody');
      if (!tbody) return;

      const rows = Array.from(tbody.querySelectorAll('tr'));
      const currentRow = rows[currentSelectedCell.rowIndex];
      if (!currentRow) return;

      const cells = Array.from(currentRow.querySelectorAll('td'));
      const currentCell = cells[currentSelectedCell.colIndex];
      if (!currentCell) return;

      const input = currentCell.querySelector('input, select, textarea') as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (input) {
        const value = input.value;
        navigator.clipboard.writeText(value);
        setCopiedData([[value]]);
      }
    };

    const handlePaste = async (e: ClipboardEvent) => {
      try {
        const currentSelectedCell = selectedCellRef.current;
        if (!currentSelectedCell || !onPaste) return;

        e.preventDefault();
        e.stopPropagation();

        const clipboardData = e.clipboardData?.getData('text/plain');
        if (!clipboardData) return;

        await onPaste(
          currentSelectedCell.rowIndex,
          currentSelectedCell.colIndex,
          clipboardData
        );
      } catch {
        // silent
      }
    };

    table.addEventListener('keydown', handleKeyDown);
    table.addEventListener('paste', handlePaste as any);

    return () => {
      table.removeEventListener('keydown', handleKeyDown);
      table.removeEventListener('paste', handlePaste as any);
    };
  }, [onCellChange, onPaste]);

  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
        const cell = target.closest('td');
        const row = cell?.closest('tr');
        const tbody = table.querySelector('tbody');

        if (cell && row && tbody) {
          const rows = Array.from(tbody.querySelectorAll('tr'));
          const cells = Array.from(row.querySelectorAll('td'));

          const rowIndex = rows.indexOf(row);
          const colIndex = cells.indexOf(cell);

          if (rowIndex !== -1 && colIndex !== -1) {
            selectedCellRef.current = { rowIndex, colIndex };
            setSelectedCell({ rowIndex, colIndex });
          }
        }
      }
    };

    table.addEventListener('focusin', handleFocus);

    return () => {
      table.removeEventListener('focusin', handleFocus);
    };
  }, []);

  return (
    <table ref={tableRef} className={className}>
      {children}
    </table>
  );
}
