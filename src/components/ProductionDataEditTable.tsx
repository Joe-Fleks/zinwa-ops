import { forwardRef, useCallback, useMemo } from 'react';
import { FET, FETRef } from './FET';
import type { FETColumn } from './FET';
import { CLIENT_CATEGORIES } from '../lib/stationFATConfig';
import { isDefaultValues } from '../lib/productionUtils';
import type { DateRangeRowData } from '../lib/productionUtils';

export type ProductionDataEditTableRef = FETRef;

interface ProductionDataEditTableProps {
  data: DateRangeRowData[];
  onUpdate: (index: number, field: keyof DateRangeRowData, value: any) => void;
  isFullTreatment: boolean;
  onUndoRedoStateChange?: (canUndo: boolean, canRedo: boolean) => void;
}

const SHARED_COLUMNS: FETColumn[] = [
  { header: 'CW Vol (m\u00B3)', field: 'cw_volume_m3', type: 'number', minWidth: 110 },
  { header: 'CW Hours', field: 'cw_hours_run', type: 'number', minWidth: 100 },
  { header: 'Load Shed H.', field: 'load_shedding_hours', type: 'number', minWidth: 140 },
  { header: 'Other Down.', field: 'other_downtime_hours', type: 'number', minWidth: 120 },
  { header: 'Reason', field: 'reason_for_downtime', type: 'string', minWidth: 180 },
];

const RW_COLUMNS: FETColumn[] = [
  { header: 'RW Vol (m\u00B3)', field: 'rw_volume_m3', type: 'number', minWidth: 110 },
  { header: 'RW Hours', field: 'rw_hours_run', type: 'number', minWidth: 100 },
];

const CHEMICAL_COLUMNS: FETColumn[] = [
  { header: 'Alum (kg)', field: 'alum_kg', type: 'number', minWidth: 100 },
  { header: 'HTH (kg)', field: 'hth_kg', type: 'number', minWidth: 100 },
  { header: 'Act. Carbon (kg)', field: 'activated_carbon_kg', type: 'number', minWidth: 130 },
];

const TAIL_COLUMNS: FETColumn[] = [
  { header: 'New Conn.', field: 'new_connections', type: 'integer', minWidth: 120 },
  {
    header: 'Conn. Category',
    field: 'new_connection_category',
    type: 'select',
    minWidth: 150,
    options: CLIENT_CATEGORIES
  },
  { header: 'Meters Serv.', field: 'meters_serviced', type: 'integer', minWidth: 120 },
];

const FT_COLUMNS: FETColumn[] = [...RW_COLUMNS, ...SHARED_COLUMNS, ...CHEMICAL_COLUMNS, ...TAIL_COLUMNS];
const BH_COLUMNS: FETColumn[] = [...SHARED_COLUMNS, ...TAIL_COLUMNS];

const DATE_LABEL = { header: 'Date', field: 'dateDisplay', minWidth: 130 };

const rowKeyFn = (row: Record<string, any>) => row.date;

function ProductionDataEditTableComponent(
  { data, onUpdate, isFullTreatment, onUndoRedoStateChange }: ProductionDataEditTableProps,
  ref: React.Ref<ProductionDataEditTableRef>
) {
  const columns = isFullTreatment ? FT_COLUMNS : BH_COLUMNS;

  const handleUpdate = useCallback(
    (index: number, field: string, value: any) => onUpdate(index, field as keyof DateRangeRowData, value),
    [onUpdate]
  );

  const sourceId = useMemo(() => {
    if (data.length === 0) return '';
    return `dr-${data[0]?.date}-${data[data.length - 1]?.date}-${data.length}`;
  }, [data.length > 0 ? data[0]?.date : '', data.length > 0 ? data[data.length - 1]?.date : '', data.length]);

  return (
    <FET
      ref={ref}
      data={data}
      columns={columns}
      labelColumn={DATE_LABEL}
      onUpdate={handleUpdate}
      rowKey={rowKeyFn}
      isDefaultRow={isDefaultValues}
      dataSourceId={sourceId}
      onUndoRedoStateChange={onUndoRedoStateChange}
    />
  );
}

export const ProductionDataEditTable = forwardRef(ProductionDataEditTableComponent);
