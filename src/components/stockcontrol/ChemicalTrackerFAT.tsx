import { useMemo, useRef, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import type { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import type { ChemicalStationRow } from '../../lib/chemicalStockService';
import { getBalanceColumnHeader, getAvgUsageColumnHeader, isPastMonth } from '../../lib/chemicalStockService';

ModuleRegistry.registerModules([AllCommunityModule]);

interface ChemicalTrackerFATProps {
  data: ChemicalStationRow[];
  year: number;
  month: number;
  height?: string;
}

function numFmt(params: any): string {
  const v = Number(params.value);
  if (!v && v !== 0) return '';
  return v % 1 === 0 ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export default function ChemicalTrackerFAT({ data, year, month, height }: ChemicalTrackerFATProps) {
  const gridRef = useRef<AgGridReact>(null);
  const showDaysRemaining = !isPastMonth(year, month);

  const totalsRow = useMemo(() => {
    const t: any = {
      station_name: 'Total',
      station_id: '__total__',
      opening_balance: data.reduce((s, r) => s + r.opening_balance, 0),
      received: data.reduce((s, r) => s + r.received, 0),
      used: data.reduce((s, r) => s + r.used, 0),
      current_balance: data.reduce((s, r) => s + r.current_balance, 0),
      avg_usage_per_day: data.reduce((s, r) => s + r.avg_usage_per_day, 0),
      days_remaining: null,
      _isTotal: true,
    };
    if (t.avg_usage_per_day > 0) {
      t.days_remaining = Math.round(t.current_balance / t.avg_usage_per_day);
    }
    return t;
  }, [data]);

  const rowData = useMemo(() => [...data, totalsRow], [data, totalsRow]);

  const columnDefs = useMemo<ColDef[]>(() => {
    const cols: ColDef[] = [
      {
        headerName: 'Station',
        field: 'station_name',
        pinned: 'left',
        width: 180,
        minWidth: 140,
        cellClass: (params: any) => params.data?._isTotal ? 'font-bold' : '',
      },
      {
        headerName: getBalanceColumnHeader(year, month),
        field: 'opening_balance',
        width: 130,
        minWidth: 100,
        type: 'numericColumn',
        valueFormatter: numFmt,
      },
      {
        headerName: 'Received',
        field: 'received',
        width: 110,
        minWidth: 90,
        type: 'numericColumn',
        valueFormatter: numFmt,
      },
      {
        headerName: 'Used (Kg)',
        field: 'used',
        width: 110,
        minWidth: 90,
        type: 'numericColumn',
        valueFormatter: numFmt,
      },
      {
        headerName: 'Current Bal.',
        field: 'current_balance',
        width: 120,
        minWidth: 100,
        type: 'numericColumn',
        valueFormatter: numFmt,
        cellClass: 'font-semibold',
      },
      {
        headerName: getAvgUsageColumnHeader(year, month),
        field: 'avg_usage_per_day',
        width: 130,
        minWidth: 100,
        type: 'numericColumn',
        valueFormatter: numFmt,
      },
    ];

    if (showDaysRemaining) {
      cols.push({
        headerName: 'Days remaining',
        field: 'days_remaining',
        width: 130,
        minWidth: 100,
        type: 'numericColumn',
        valueFormatter: (params: any) => {
          const v = params.value;
          if (v === null || v === undefined) return '';
          return Math.round(v).toLocaleString();
        },
      });
    }

    return cols;
  }, [year, month, showDaysRemaining]);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    editable: false,
    suppressMovable: true,
  }), []);

  const getRowStyle = useCallback((params: any) => {
    if (params.data?._isTotal) {
      return { backgroundColor: '#f3f4f6', fontWeight: '700', borderTop: '2px solid #9ca3af' };
    }
    return {};
  }, []);

  const getRowId = useCallback((params: any) => {
    return params.data?.station_id || `row-${params.rowIndex}`;
  }, []);

  return (
    <div
      className="ag-theme-alpine"
      style={{
        maxHeight: height || 'calc(100vh - 340px)',
        width: '100%',
        overflowY: 'auto',
      }}
    >
      <AgGridReact
        ref={gridRef}
        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        getRowId={getRowId}
        getRowStyle={getRowStyle}
        domLayout="autoHeight"
        suppressMovableColumns={true}
        enableCellTextSelection={true}
        ensureDomOrder={true}
        animateRows={true}
      />
    </div>
  );
}
