import { useMemo, useCallback, useRef, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import type {
  ColDef,
  CellValueChangedEvent,
  PasteEndEvent,
  PasteStartEvent,
  GridReadyEvent,
  GetRowIdParams,
  NavigateToNextCellParams,
  TabToNextCellParams,
  CellPosition
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { CheckCircle2, Circle, CreditCard as Edit3, AlertCircle } from 'lucide-react';
import { ExcelStyleCellEditor } from './ExcelStyleCellEditor';
import { isDefaultValues, getRowStatus } from '../lib/productionUtils';
import type { RowData, RowStatus } from '../lib/productionUtils';

ModuleRegistry.registerModules([AllCommunityModule]);

interface MultiStationProductionGridProps {
  data: RowData[];
  onUpdate: (index: number, field: keyof RowData, value: any) => void;
  isFullTreatment: boolean;
  editMode?: boolean;
}

const StatusRenderer = (props: any) => {
  const status = getRowStatus(props.data);

  if (status === 'saved') {
    return (
      <div className="flex items-center justify-center h-full">
        <CheckCircle2 className="w-5 h-5 text-green-600" />
      </div>
    );
  } else if (status === 'edited') {
    return (
      <div className="flex items-center justify-center h-full">
        <Edit3 className="w-5 h-5 text-amber-600" />
      </div>
    );
  } else {
    return (
      <div className="flex items-center justify-center h-full">
        <Circle className="w-5 h-5 text-red-600" />
      </div>
    );
  }
};

const ErrorRenderer = (props: any) => {
  if (props.data.errors && props.data.errors.length > 0) {
    return (
      <div className="flex items-center gap-1">
        <AlertCircle className="w-4 h-4 text-red-600" />
        <span>{props.value}</span>
      </div>
    );
  }
  return <span>{props.value}</span>;
};

const numberParser = (params: any) => {
  const value = params.newValue;
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};

const integerParser = (params: any) => {
  const value = params.newValue;
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'string' ? parseInt(value.replace(/,/g, '')) : parseInt(value);
  return isNaN(parsed) ? 0 : parsed;
};

export function MultiStationProductionGrid({ data, onUpdate, isFullTreatment, editMode = true }: MultiStationProductionGridProps) {
  const gridRef = useRef<AgGridReact>(null);
  const dataRef = useRef(data);
  const onUpdateRef = useRef(onUpdate);
  const indexMapRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    dataRef.current = data;
    onUpdateRef.current = onUpdate;
    const map = new Map<string, number>();
    data.forEach((row, i) => map.set(row.station_id, i));
    indexMapRef.current = map;
  }, [data, onUpdate]);

  const safeData = data || [];

  const getRowId = useCallback((params: GetRowIdParams) => {
    return params.data.station_id;
  }, []);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    editable: false,
    suppressMovable: true,
    singleClickEdit: true,
    cellEditor: ExcelStyleCellEditor,
    cellEditorParams: {
      editMode: editMode
    }
  }), [editMode]);

  const columnDefs = useMemo<ColDef[]>(() => {
    const baseCols: ColDef[] = [
      {
        headerName: 'Status',
        field: 'status',
        width: 80,
        pinned: 'left',
        lockPosition: true,
        editable: false,
        cellRenderer: StatusRenderer,
        suppressPaste: true,
        suppressNavigable: true,
        cellClass: 'ag-cell-no-focus',
      },
      {
        headerName: 'Station',
        field: 'station_name',
        width: 200,
        pinned: 'left',
        lockPosition: true,
        editable: false,
        cellRenderer: ErrorRenderer,
        suppressPaste: true,
        cellClass: 'font-medium',
      },
    ];

    const productionCols: ColDef[] = isFullTreatment ? [
      {
        headerName: 'RW Vol (m\u00B3)',
        field: 'rw_volume_m3',
        width: 120,
        editable: editMode,
        type: 'numericColumn',
        valueParser: numberParser,
        cellClass: editMode ? 'editable-cell' : '',
      },
      {
        headerName: 'RW Hours',
        field: 'rw_hours_run',
        width: 110,
        editable: editMode,
        type: 'numericColumn',
        valueParser: numberParser,
        cellClass: editMode ? 'editable-cell' : '',
      },
      {
        headerName: 'CW Vol (m\u00B3)',
        field: 'cw_volume_m3',
        width: 120,
        editable: editMode,
        type: 'numericColumn',
        valueParser: numberParser,
        cellClass: editMode ? 'editable-cell' : '',
      },
      {
        headerName: 'CW Hours',
        field: 'cw_hours_run',
        width: 110,
        editable: editMode,
        type: 'numericColumn',
        valueParser: numberParser,
        cellClass: editMode ? 'editable-cell' : '',
      },
    ] : [
      {
        headerName: 'CW Vol (m\u00B3)',
        field: 'cw_volume_m3',
        width: 120,
        editable: editMode,
        type: 'numericColumn',
        valueParser: numberParser,
        cellClass: editMode ? 'editable-cell' : '',
      },
      {
        headerName: 'CW Hours',
        field: 'cw_hours_run',
        width: 110,
        editable: editMode,
        type: 'numericColumn',
        valueParser: numberParser,
        cellClass: editMode ? 'editable-cell' : '',
      },
    ];

    const downtimeCols: ColDef[] = [
      {
        headerName: 'Load Shedding Hours',
        field: 'load_shedding_hours',
        width: 170,
        editable: editMode,
        type: 'numericColumn',
        valueParser: numberParser,
        cellClass: editMode ? 'editable-cell' : '',
      },
      {
        headerName: 'Other Downtime',
        field: 'other_downtime_hours',
        width: 150,
        editable: editMode,
        type: 'numericColumn',
        valueParser: numberParser,
        cellClass: editMode ? 'editable-cell' : '',
      },
      {
        headerName: 'Downtime Reason',
        field: 'reason_for_downtime',
        width: 220,
        editable: editMode,
        cellClass: editMode ? 'editable-cell' : '',
      },
    ];

    const chemicalCols: ColDef[] = isFullTreatment ? [
      {
        headerName: 'Alum (kg)',
        field: 'alum_kg',
        width: 130,
        editable: editMode,
        type: 'numericColumn',
        valueParser: numberParser,
        cellClass: editMode ? 'editable-cell' : '',
      },
      {
        headerName: 'HTH (kg)',
        field: 'hth_kg',
        width: 130,
        editable: editMode,
        type: 'numericColumn',
        valueParser: numberParser,
        cellClass: editMode ? 'editable-cell' : '',
      },
      {
        headerName: 'Activated Carbon (kg)',
        field: 'activated_carbon_kg',
        width: 180,
        editable: editMode,
        type: 'numericColumn',
        valueParser: numberParser,
        cellClass: editMode ? 'editable-cell' : '',
      },
    ] : [];

    const customerCols: ColDef[] = [
      {
        headerName: 'New Connections',
        field: 'new_connections',
        width: 150,
        editable: editMode,
        type: 'numericColumn',
        valueParser: integerParser,
        cellClass: editMode ? 'editable-cell' : '',
      },
      {
        headerName: 'Connection Category',
        field: 'new_connection_category',
        width: 180,
        editable: editMode,
        cellClass: editMode ? 'editable-cell' : '',
      },
      {
        headerName: 'Meters Serviced',
        field: 'meters_serviced',
        width: 150,
        editable: editMode,
        type: 'numericColumn',
        valueParser: integerParser,
        cellClass: editMode ? 'editable-cell' : '',
      },
    ];

    return [
      ...baseCols,
      ...productionCols,
      ...downtimeCols,
      ...chemicalCols,
      ...customerCols,
    ];
  }, [isFullTreatment, editMode]);

  const onCellValueChanged = useCallback((event: CellValueChangedEvent) => {
    const currentOnUpdate = onUpdateRef.current;
    const rowIndex = indexMapRef.current.get(event.data.station_id);

    if (rowIndex !== undefined) {
      currentOnUpdate(rowIndex, event.colDef.field as keyof RowData, event.newValue);
    }
  }, []);

  const onPasteStart = useCallback((_event: PasteStartEvent) => {}, []);
  const onPasteEnd = useCallback((_event: PasteEndEvent) => {}, []);

  const getRowStyle = useCallback((params: any) => {
    const status = getRowStatus(params.data);
    if (status === 'unedited') {
      return { background: '#fef2f2', borderLeft: '4px solid #f87171' };
    } else if (status === 'edited') {
      return { background: '#fffbeb', borderLeft: '4px solid #fbbf24' };
    }
    return { background: '#ffffff' };
  }, []);

  const navigateToNextCell = useCallback((params: NavigateToNextCellParams): CellPosition | null => {
    const suggestedNextCell = params.nextCellPosition;

    if (!suggestedNextCell) {
      return null;
    }

    const column = suggestedNextCell.column;
    const colDef = column.getColDef();

    let finalCell = suggestedNextCell;

    if (colDef.suppressNavigable) {
      const allColumns = params.api.getColumns();
      if (!allColumns) return null;

      const currentIndex = allColumns.indexOf(column);
      const key = params.key;

      if (key === 'ArrowRight' || key === 'Tab') {
        for (let i = currentIndex + 1; i < allColumns.length; i++) {
          const nextCol = allColumns[i];
          if (!nextCol.getColDef().suppressNavigable) {
            finalCell = {
              rowIndex: suggestedNextCell.rowIndex,
              column: nextCol,
              rowPinned: suggestedNextCell.rowPinned
            };
            break;
          }
        }
      } else if (key === 'ArrowLeft') {
        for (let i = currentIndex - 1; i >= 0; i--) {
          const nextCol = allColumns[i];
          if (!nextCol.getColDef().suppressNavigable) {
            finalCell = {
              rowIndex: suggestedNextCell.rowIndex,
              column: nextCol,
              rowPinned: suggestedNextCell.rowPinned
            };
            break;
          }
        }
      }
    }

    return finalCell;
  }, []);

  const tabToNextCell = useCallback((params: TabToNextCellParams): CellPosition | null => {
    return navigateToNextCell({
      ...params,
      key: params.backwards ? 'ArrowLeft' : 'Tab'
    } as NavigateToNextCellParams);
  }, [navigateToNextCell]);

  const suppressKeyboardEvent = useCallback((_params: any) => {
    return false;
  }, []);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    const eGridDiv = gridRef.current?.eGridDiv;

    const handlePaste = async (e: ClipboardEvent) => {
      try {
        if (!editMode) return;

        const focusedCell = params.api.getFocusedCell();
        if (!focusedCell) return;

        e.preventDefault();
        e.stopPropagation();

        params.api.stopEditing();

        const clipboardData = e.clipboardData?.getData('text/plain');
        if (!clipboardData) return;

        const rows = clipboardData.split(/\r?\n/).filter(row => row.trim() !== '');
        if (rows.length === 0) return;

        const startRowIndex = focusedCell.rowIndex;
        const startColId = focusedCell.column.getColId();

        const allColumns = params.api.getColumns();
        if (!allColumns) return;

        const startColIndex = allColumns.findIndex(col => col.getColId() === startColId);
        if (startColIndex === -1) return;

        const currentOnUpdate = onUpdateRef.current;

        rows.forEach((rowData, rowOffset) => {
          try {
            const cells = rowData.split('\t');
            const rowNode = params.api.getDisplayedRowAtIndex(startRowIndex + rowOffset);

            if (!rowNode?.data) return;

            cells.forEach((cellValue, colOffset) => {
              try {
                const targetCol = allColumns[startColIndex + colOffset];
                if (!targetCol) return;

                const colDef = targetCol.getColDef();
                if (!colDef.editable) return;

                let parsedValue = cellValue;
                if (colDef.valueParser) {
                  try {
                    parsedValue = colDef.valueParser({ newValue: cellValue });
                  } catch {
                    return;
                  }
                }

                const fieldName = colDef.field as keyof RowData;
                rowNode.setDataValue(targetCol.getColId(), parsedValue);

                const rowIndex = indexMapRef.current.get(rowNode.data.station_id);
                if (rowIndex !== undefined && fieldName) {
                  currentOnUpdate(rowIndex, fieldName, parsedValue);
                }
              } catch {
                // skip cell
              }
            });
          } catch {
            // skip row
          }
        });
      } catch {
        // silent
      }
    };

    eGridDiv?.addEventListener('paste', handlePaste, { capture: true });

    return () => {
      if (eGridDiv) {
        eGridDiv.removeEventListener('paste', handlePaste, { capture: true });
      }
    };
  }, [editMode]);

  return (
    <div className="ag-theme-alpine" style={{ height: 'calc(100vh - 400px)', width: '100%' }}>
      <style>{`
        .editable-cell {
          background-color: #f9fafb !important;
          cursor: pointer !important;
        }
        .editable-cell:hover {
          background-color: #f3f4f6 !important;
          outline: 2px solid #3b82f6 !important;
          outline-offset: -2px !important;
        }
        .ag-cell-no-focus {
          pointer-events: none !important;
        }
      `}</style>
      <AgGridReact
        ref={gridRef}
        rowData={safeData}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        getRowId={getRowId}
        onCellValueChanged={onCellValueChanged}
        onPasteStart={onPasteStart}
        onPasteEnd={onPasteEnd}
        onGridReady={onGridReady}
        getRowStyle={getRowStyle}
        navigateToNextCell={navigateToNextCell}
        tabToNextCell={tabToNextCell}
        enableCellChangeFlash={true}
        suppressDragLeaveHidesColumns={true}
        suppressMovableColumns={true}
        enableRangeSelection={true}
        enableFillHandle={true}
        suppressClipboardPaste={false}
        enterNavigatesVertically={true}
        enterNavigatesVerticallyAfterEdit={true}
        stopEditingWhenCellsLoseFocus={true}
        suppressCellSelection={false}
        undoRedoCellEditing={true}
        undoRedoCellEditingLimit={20}
        singleClickEdit={true}
        suppressClickEdit={!editMode}
        suppressKeyboardEvent={suppressKeyboardEvent}
      />
    </div>
  );
}
