import { useMemo, useRef, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import type { ColDef } from 'ag-grid-community';
import { CheckCircle2, Circle, CreditCard as EditIcon } from 'lucide-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

ModuleRegistry.registerModules([AllCommunityModule]);

export interface FuelCardRow {
  id?: string;
  entry_date: string;
  voucher_no: string;
  no_plate: string;
  issues: number;
  receipts: number;
  balance: number;
  description: string;
  req_no: string;
  collected_by: string;
  is_opening_balance: boolean;
  sort_order: number;
  isNew?: boolean;
  isTouched?: boolean;
  isModified?: boolean;
  errors?: string[];
}

interface FuelControlCardProps {
  data: FuelCardRow[];
  height?: string;
}

type RowStatus = 'saved' | 'edited' | 'unedited';

function getRowStatus(row: FuelCardRow): RowStatus {
  if (row.id && !row.isModified) return 'saved';
  if (row.isTouched || row.isModified || row.isNew) return 'edited';
  return 'unedited';
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

export default function FuelControlCard({ data, height = 'calc(100vh - 320px)' }: FuelControlCardProps) {
  const gridRef = useRef<AgGridReact>(null);

  const StatusRenderer = useCallback((params: any) => {
    const row = params.data as FuelCardRow;
    const status = getRowStatus(row);
    if (status === 'saved') return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    if (status === 'edited') return <EditIcon className="w-4 h-4 text-amber-600" />;
    return <Circle className="w-4 h-4 text-red-600" />;
  }, []);

  const columnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: '',
      field: '_status',
      width: 50,
      maxWidth: 50,
      pinned: 'left',
      sortable: false,
      filter: false,
      resizable: false,
      suppressMovable: true,
      cellRenderer: StatusRenderer,
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
    },
    {
      headerName: 'Date',
      field: 'entry_date',
      width: 110,
      minWidth: 100,
      pinned: 'left',
      valueFormatter: (params: any) => formatDate(params.value),
      cellClass: 'font-medium',
    },
    { headerName: 'Voucher No.', field: 'voucher_no', width: 120, minWidth: 100 },
    { headerName: 'No. Plate', field: 'no_plate', width: 120, minWidth: 100 },
    {
      headerName: 'Issues',
      field: 'issues',
      width: 100,
      minWidth: 80,
      type: 'numericColumn',
      valueFormatter: (params: any) => {
        const v = Number(params.value);
        return v ? v.toLocaleString() : '';
      },
    },
    {
      headerName: 'Receipts',
      field: 'receipts',
      width: 100,
      minWidth: 80,
      type: 'numericColumn',
      valueFormatter: (params: any) => {
        const v = Number(params.value);
        return v ? v.toLocaleString() : '';
      },
    },
    {
      headerName: 'Balance',
      field: 'balance',
      width: 110,
      minWidth: 90,
      type: 'numericColumn',
      valueFormatter: (params: any) => Number(params.value).toLocaleString(),
      cellClass: 'font-semibold',
    },
    { headerName: 'Description', field: 'description', width: 200, minWidth: 150 },
    { headerName: 'Req. No.', field: 'req_no', width: 110, minWidth: 90 },
    { headerName: 'Collected By', field: 'collected_by', width: 140, minWidth: 110 },
  ], [StatusRenderer]);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    editable: false,
    suppressMovable: true,
  }), []);

  const getRowStyle = useCallback((params: any) => {
    if (!params.data) return {};
    const row = params.data as FuelCardRow;
    if (row.is_opening_balance) return { backgroundColor: '#eff6ff', fontWeight: '600' };
    const status = getRowStatus(row);
    if (status === 'unedited') return { backgroundColor: '#fef2f2' };
    if (status === 'edited') return { backgroundColor: '#fefce8' };
    return {};
  }, []);

  const getRowId = useCallback((params: any) => {
    return params.data?.id || `row-${params.data?.sort_order ?? params.rowIndex}`;
  }, []);

  return (
    <div className="ag-theme-alpine" style={{ height, width: '100%' }}>
      <AgGridReact
        ref={gridRef}
        rowData={data}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        getRowId={getRowId}
        getRowStyle={getRowStyle}
        suppressMovableColumns={true}
        enableCellTextSelection={true}
        ensureDomOrder={true}
        animateRows={true}
      />
    </div>
  );
}
