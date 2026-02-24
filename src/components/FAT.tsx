import { useState, useCallback, useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import type { ColDef } from 'ag-grid-community';
import { CheckCircle2, Circle, CreditCard as Edit3, Pencil, X } from 'lucide-react';
import { FET } from './FET';
import type { FETRef, FETColumn, FETLabelColumn } from './FET';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

ModuleRegistry.registerModules([AllCommunityModule]);

export interface FATColumn {
  header: string;
  field: string;
  type: 'number' | 'integer' | 'string';
  minWidth?: number;
  width?: number;
  valueFormatter?: (params: any) => string;
  pinned?: 'left' | 'right';
}

export interface FATLabelColumn {
  header: string;
  field: string;
  minWidth?: number;
  width?: number;
  pinned?: 'left' | 'right';
}

export interface FATProps {
  data: Record<string, any>[];
  columns: FATColumn[];
  labelColumn: FATLabelColumn;
  onUpdate: (index: number, field: string, value: any) => void;
  rowKey: (row: Record<string, any>, index: number) => string;
  isDefaultRow: (row: Record<string, any>) => boolean;
  savedField?: string;
  errorsField?: string;
  touchedField?: string;
  modifiedField?: string;
  height?: string;
  pagination?: boolean;
  paginationPageSize?: number;
  editMode?: boolean;
  onEditModeChange?: (editMode: boolean) => void;
  editButtonLabel?: string;
  doneButtonLabel?: string;
  onBeforeEditToggle?: () => void;
}

export interface FATRef {
  flushPendingEdits: () => void;
  setEditMode: (mode: boolean) => void;
  isEditing: () => boolean;
}

type RowStatus = 'unedited' | 'edited' | 'saved';

function FATComponent(
  {
    data,
    columns,
    labelColumn,
    onUpdate,
    rowKey,
    isDefaultRow,
    savedField = 'existing_log_id',
    errorsField = 'errors',
    touchedField = 'isTouched',
    modifiedField = 'isModified',
    height = 'calc(100vh - 300px)',
    pagination = false,
    paginationPageSize = 20,
    editMode: controlledEditMode,
    onEditModeChange,
    editButtonLabel = 'Edit',
    doneButtonLabel = 'Done Editing',
    onBeforeEditToggle
  }: FATProps,
  ref: React.Ref<FATRef>
) {
  const [internalEditMode, setInternalEditMode] = useState(false);
  const fetRef = useRef<FETRef>(null);
  const gridRef = useRef<AgGridReact>(null);

  const isControlled = controlledEditMode !== undefined;
  const editing = isControlled ? controlledEditMode : internalEditMode;

  const setEditing = useCallback((mode: boolean) => {
    if (isControlled) {
      onEditModeChange?.(mode);
    } else {
      setInternalEditMode(mode);
    }
  }, [isControlled, onEditModeChange]);

  const handleToggleEdit = useCallback(() => {
    if (editing) {
      fetRef.current?.flushPendingEdits();
      onBeforeEditToggle?.();
    }
    setEditing(!editing);
  }, [editing, setEditing, onBeforeEditToggle]);

  const flushPendingEdits = useCallback(() => {
    fetRef.current?.flushPendingEdits();
  }, []);

  useImperativeHandle(ref, () => ({
    flushPendingEdits,
    setEditMode: setEditing,
    isEditing: () => editing,
  }), [flushPendingEdits, setEditing, editing]);

  const getRowStatus = useCallback((row: Record<string, any>): RowStatus => {
    if (row[savedField]) return 'saved';
    if (isDefaultRow(row)) return 'unedited';
    if (row[touchedField] || row[modifiedField]) return 'edited';
    return 'unedited';
  }, [savedField, touchedField, modifiedField, isDefaultRow]);

  const StatusRenderer = useCallback((params: any) => {
    const status = getRowStatus(params.data);
    if (status === 'saved') return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    if (status === 'edited') return <Edit3 className="w-4 h-4 text-amber-600" />;
    return <Circle className="w-4 h-4 text-red-600" />;
  }, [getRowStatus]);

  const agColumnDefs = useMemo<ColDef[]>(() => {
    const cols: ColDef[] = [
      {
        headerName: 'Status',
        field: '_status',
        width: 80,
        pinned: 'left',
        sortable: false,
        filter: false,
        resizable: false,
        suppressMovable: true,
        cellRenderer: StatusRenderer,
        cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      },
      {
        headerName: labelColumn.header,
        field: labelColumn.field,
        width: labelColumn.width,
        minWidth: labelColumn.minWidth || 150,
        pinned: labelColumn.pinned || 'left',
        sortable: true,
        filter: true,
        cellClass: 'font-medium',
      },
    ];

    for (const col of columns) {
      cols.push({
        headerName: col.header,
        field: col.field,
        width: col.width,
        minWidth: col.minWidth || 100,
        pinned: col.pinned,
        sortable: true,
        filter: true,
        type: col.type !== 'string' ? 'numericColumn' : undefined,
        valueFormatter: col.valueFormatter,
      });
    }

    return cols;
  }, [columns, labelColumn, StatusRenderer]);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    editable: false,
    suppressMovable: true,
  }), []);

  const getRowStyle = useCallback((params: any) => {
    if (!params.data) return {};
    const status = getRowStatus(params.data);
    if (status === 'unedited') return { backgroundColor: '#fef2f2' };
    if (status === 'edited') return { backgroundColor: '#fefce8' };
    return {};
  }, [getRowStatus]);

  const getRowId = useCallback((params: any) => {
    const idx = params.data?._fat_index;
    if (idx !== undefined) return String(idx);
    return String(params.rowIndex);
  }, []);

  const indexedData = useMemo(() => {
    return data.map((row, i) => ({ ...row, _fat_index: i }));
  }, [data]);

  const fetColumns: FETColumn[] = useMemo(() =>
    columns.map(c => ({ header: c.header, field: c.field, type: c.type, minWidth: c.minWidth })),
    [columns]
  );

  const fetLabelColumn: FETLabelColumn = useMemo(() =>
    ({ header: labelColumn.header, field: labelColumn.field, minWidth: labelColumn.minWidth }),
    [labelColumn]
  );

  return (
    <div>
      <div className="flex items-center justify-end mb-2">
        <button
          type="button"
          onClick={handleToggleEdit}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            editing
              ? 'bg-blue-200 text-blue-900 hover:bg-blue-300'
              : 'bg-blue-200 text-blue-900 hover:bg-blue-300'
          }`}
        >
          {editing ? (
            <>
              <X className="w-4 h-4" />
              {doneButtonLabel}
            </>
          ) : (
            <>
              <Pencil className="w-4 h-4" />
              {editButtonLabel}
            </>
          )}
        </button>
      </div>

      {editing ? (
        <FET
          ref={fetRef}
          data={data}
          columns={fetColumns}
          labelColumn={fetLabelColumn}
          onUpdate={onUpdate}
          rowKey={rowKey}
          isDefaultRow={isDefaultRow}
          savedField={savedField}
          errorsField={errorsField}
          touchedField={touchedField}
          modifiedField={modifiedField}
          height={height}
        />
      ) : (
        <div
          className="ag-theme-alpine"
          style={{ maxHeight: height, width: '100%', overflowY: 'auto' }}
        >
          <AgGridReact
            ref={gridRef}
            rowData={indexedData}
            columnDefs={agColumnDefs}
            defaultColDef={defaultColDef}
            getRowId={getRowId}
            getRowStyle={getRowStyle}
            domLayout="autoHeight"
            pagination={pagination}
            paginationPageSize={paginationPageSize}
            suppressMovableColumns={true}
            enableCellTextSelection={true}
            ensureDomOrder={true}
            animateRows={true}
          />
        </div>
      )}
    </div>
  );
}

export const FAT = forwardRef(FATComponent);
