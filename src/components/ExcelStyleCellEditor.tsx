import { forwardRef, useRef, useEffect, useImperativeHandle, useState } from 'react';
import type { ICellEditorParams, ICellEditor } from 'ag-grid-community';

export interface ExcelStyleCellEditorParams extends ICellEditorParams {
  editMode?: boolean;
}

export interface ExcelStyleCellEditorRef extends ICellEditor {
  getValue(): any;
}

export const ExcelStyleCellEditor = forwardRef<ExcelStyleCellEditorRef, ExcelStyleCellEditorParams>((props, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<string>(props.value != null ? String(props.value) : '');
  const [value, setValue] = useState<string>(props.value != null ? String(props.value) : '');

  useImperativeHandle(ref, () => ({
    getValue: () => {
      console.log('[ExcelStyleCellEditor] getValue called, returning:', valueRef.current);
      return valueRef.current;
    },

    getGui: () => {
      console.log('[ExcelStyleCellEditor] getGui called');
      return containerRef.current!;
    },

    isCancelBeforeStart: () => {
      console.log('[ExcelStyleCellEditor] isCancelBeforeStart called, returning: false');
      return false;
    },

    isCancelAfterEnd: () => {
      console.log('[ExcelStyleCellEditor] isCancelAfterEnd called, returning: false');
      return false;
    },

    afterGuiAttached: () => {
      console.log('[ExcelStyleCellEditor] afterGuiAttached called');
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }
  }));

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const { key, shiftKey } = e;
    const isArrowKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key);
    const isTabKey = key === 'Tab';
    const isEnterKey = key === 'Enter';

    if (isTabKey || isEnterKey) {
      console.log('[ExcelStyleCellEditor]', isTabKey ? 'Tab' : 'Enter', 'key detected, committing value:', valueRef.current);
      e.preventDefault();
      e.stopPropagation();

      const rowNode = props.node;
      const colKey = props.column.getColId();

      if (rowNode && colKey !== undefined) {
        rowNode.setDataValue(colKey, valueRef.current);
        console.log('[ExcelStyleCellEditor] Row data updated for Tab/Enter');
      }

      props.stopEditing(false);
      return;
    }

    if (isArrowKey && !shiftKey) {
      console.log('[ExcelStyleCellEditor] Arrow key detected:', key, 'Current value:', valueRef.current);
      e.preventDefault();
      e.stopPropagation();

      console.log('[ExcelStyleCellEditor] Stopping edit and updating row data with value:', valueRef.current);

      const rowNode = props.node;
      const colKey = props.column.getColId();

      if (rowNode && colKey !== undefined) {
        rowNode.setDataValue(colKey, valueRef.current);
        console.log('[ExcelStyleCellEditor] Row data updated via setDataValue');
      }

      props.stopEditing(false);

      const currentCell = props.api.getFocusedCell();
      if (!currentCell) {
        console.log('[ExcelStyleCellEditor] No focused cell found');
        return;
      }

      let nextRowIndex = currentCell.rowIndex;
      let nextColumn = currentCell.column;

      const allColumns = props.api.getColumns();
      if (!allColumns) return;

      if (key === 'ArrowUp') {
        nextRowIndex = Math.max(0, currentCell.rowIndex - 1);
      } else if (key === 'ArrowDown') {
        const rowCount = props.api.getDisplayedRowCount();
        nextRowIndex = Math.min(rowCount - 1, currentCell.rowIndex + 1);
      } else if (key === 'ArrowLeft') {
        const currentIndex = allColumns.indexOf(currentCell.column);
        for (let i = currentIndex - 1; i >= 0; i--) {
          const col = allColumns[i];
          const colDef = col.getColDef();
          if (!colDef.suppressNavigable && colDef.editable) {
            nextColumn = col;
            break;
          }
        }
      } else if (key === 'ArrowRight') {
        const currentIndex = allColumns.indexOf(currentCell.column);
        for (let i = currentIndex + 1; i < allColumns.length; i++) {
          const col = allColumns[i];
          const colDef = col.getColDef();
          if (!colDef.suppressNavigable && colDef.editable) {
            nextColumn = col;
            break;
          }
        }
      }

      console.log('[ExcelStyleCellEditor] Navigating to:', {
        fromRow: currentCell.rowIndex,
        toRow: nextRowIndex,
        fromCol: currentCell.column.getColId(),
        toCol: nextColumn.getColId()
      });

      setTimeout(() => {
        console.log('[ExcelStyleCellEditor] Setting focused cell after commit delay');
        props.api.setFocusedCell(nextRowIndex, nextColumn);

        const nextColDef = nextColumn.getColDef();
        if (nextColDef.editable) {
          console.log('[ExcelStyleCellEditor] Starting edit on next cell');
          props.api.startEditingCell({
            rowIndex: nextRowIndex,
            colKey: nextColumn.getColId()
          });
        } else {
          console.log('[ExcelStyleCellEditor] Next cell is not editable');
        }
      }, 0);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    console.log('[ExcelStyleCellEditor] Value changed from', valueRef.current, 'to', newValue);
    valueRef.current = newValue;
    setValue(newValue);
  };

  const handleBlur = () => {
    console.log('[ExcelStyleCellEditor] Input lost focus, committing value:', valueRef.current);
    const rowNode = props.node;
    const colKey = props.column.getColId();

    if (rowNode && colKey !== undefined) {
      rowNode.setDataValue(colKey, valueRef.current);
      console.log('[ExcelStyleCellEditor] Row data updated on blur');
    }
  };

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="ag-cell-edit-input"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          outline: 'none',
          padding: '0 6px',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          backgroundColor: 'white'
        }}
      />
    </div>
  );
});

ExcelStyleCellEditor.displayName = 'ExcelStyleCellEditor';
