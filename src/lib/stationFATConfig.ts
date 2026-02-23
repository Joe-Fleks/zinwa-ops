export const CLIENT_CATEGORIES = ['Domestic', 'School', 'Business', 'Industry', 'Church', 'Parastatal', 'Government', 'Local Government'] as const;
export const STATION_TYPES = ['Full Treatment', 'Borehole'] as const;
export const STATUSES = ['Active', 'Decommissioned'] as const;
export const MATERIALS = ['PVC', 'AC', 'GI'] as const;

export interface ColDef {
  field: string;
  header: string;
  type: 'text' | 'number' | 'integer' | 'select' | 'date' | 'readonly';
  options?: readonly string[];
  width?: number;
  calculate?: (row: any) => number;
}

export interface ColGroup {
  label: string;
  key: string;
  bgClass: string;
  headerTextClass: string;
  columns: ColDef[];
}

export interface StationRow {
  id: string | null;
  station_code: string;
  station_name: string;
  station_type: string;
  operational_status: string;
  design_capacity_m3_hr: number;
  location_coordinates: string;
  distance_from_sc_km: number;
  commissioning_date: string;
  notes: string;
  ps_rw_description: string;
  ps_rw_main_diameter: string;
  ps_rw_main_distance_m: number;
  ps_rw_main_material: string;
  ps_cw_description: string;
  ps_cw_main_diameter: string;
  ps_cw_main_distance_m: number;
  ps_cw_main_material: string;
  ps_booster_description: string;
  ps_booster_main_diameter: string;
  ps_booster_main_distance_m: number;
  ps_booster_main_material: string;
  operator_count: number;
  rw_abstraction_type: string;
  sedimentation_tank_size_m3: number;
  filter_type: string;
  filter_size: string;
  backwash_tank_size_m3: number;
  backwash_system_type: string;
  clients_domestic: number;
  clients_school: number;
  clients_business: number;
  clients_industry: number;
  clients_church: number;
  clients_parastatal: number;
  clients_government: number;
  clients_other: number;
  assets_count: number;
  lab_equipment_count: number;
  spare_parts_count: number;
  _isNew: boolean;
  _isDirty: boolean;
  _ps_rw_id: string | null;
  _ps_cw_id: string | null;
  _ps_booster_id: string | null;
  _treatment_id: string | null;
}

export const COLUMN_GROUPS: ColGroup[] = [
  {
    label: 'A. Basic Info',
    key: 'basic',
    bgClass: 'bg-blue-50',
    headerTextClass: 'text-blue-800',
    columns: [
      { field: 'station_code', header: 'Code', type: 'text', width: 80 },
      { field: 'station_type', header: 'Type', type: 'select', options: STATION_TYPES, width: 120 },
      { field: 'operational_status', header: 'Status', type: 'select', options: STATUSES, width: 120 },
      { field: 'design_capacity_m3_hr', header: 'Cap. m\u00B3/hr', type: 'number', width: 90 },
      { field: 'location_coordinates', header: 'Coordinates', type: 'text', width: 130 },
      { field: 'distance_from_sc_km', header: 'Distance from SC (km)', type: 'integer', width: 150 },
      { field: 'commissioning_date', header: 'Commissioned', type: 'date', width: 115 },
      { field: 'notes', header: 'Notes', type: 'text', width: 140 },
    ],
  },
  {
    label: 'B. RW Pumping',
    key: 'ps_rw',
    bgClass: 'bg-cyan-50',
    headerTextClass: 'text-cyan-800',
    columns: [
      { field: 'ps_rw_description', header: 'Description', type: 'text', width: 110 },
      { field: 'ps_rw_main_diameter', header: 'Diameter', type: 'text', width: 80 },
      { field: 'ps_rw_main_distance_m', header: 'Dist. m', type: 'number', width: 75 },
      { field: 'ps_rw_main_material', header: 'Material', type: 'select', options: MATERIALS, width: 75 },
    ],
  },
  {
    label: 'B. CW Pumping',
    key: 'ps_cw',
    bgClass: 'bg-sky-50',
    headerTextClass: 'text-sky-800',
    columns: [
      { field: 'ps_cw_description', header: 'Description', type: 'text', width: 110 },
      { field: 'ps_cw_main_diameter', header: 'Diameter', type: 'text', width: 80 },
      { field: 'ps_cw_main_distance_m', header: 'Dist. m', type: 'number', width: 75 },
      { field: 'ps_cw_main_material', header: 'Material', type: 'select', options: MATERIALS, width: 75 },
    ],
  },
  {
    label: 'B. Booster',
    key: 'ps_booster',
    bgClass: 'bg-slate-100',
    headerTextClass: 'text-slate-700',
    columns: [
      { field: 'ps_booster_description', header: 'Description', type: 'text', width: 110 },
      { field: 'ps_booster_main_diameter', header: 'Diameter', type: 'text', width: 80 },
      { field: 'ps_booster_main_distance_m', header: 'Dist. m', type: 'number', width: 75 },
      { field: 'ps_booster_main_material', header: 'Material', type: 'select', options: MATERIALS, width: 75 },
    ],
  },
  {
    label: 'D. Operators',
    key: 'operators',
    bgClass: 'bg-amber-50',
    headerTextClass: 'text-amber-800',
    columns: [
      { field: 'operator_count', header: 'Total', type: 'integer', width: 65 },
    ],
  },
  {
    label: 'E. Treatment',
    key: 'treatment',
    bgClass: 'bg-green-50',
    headerTextClass: 'text-green-800',
    columns: [
      { field: 'rw_abstraction_type', header: 'Abstraction', type: 'text', width: 100 },
      { field: 'sedimentation_tank_size_m3', header: 'Sed m\u00B3', type: 'number', width: 75 },
      { field: 'filter_type', header: 'Filter', type: 'text', width: 90 },
      { field: 'filter_size', header: 'Size', type: 'text', width: 80 },
      { field: 'backwash_tank_size_m3', header: 'BW m\u00B3', type: 'number', width: 70 },
      { field: 'backwash_system_type', header: 'BW System', type: 'text', width: 90 },
    ],
  },
  {
    label: 'F. Clients',
    key: 'clients',
    bgClass: 'bg-teal-50',
    headerTextClass: 'text-teal-800',
    columns: [
      ...CLIENT_CATEGORIES.map(cat => ({
        field: cat === 'Local Government' ? 'clients_other' : `clients_${cat.toLowerCase()}`,
        header: cat,
        type: 'integer' as const,
        width: 75,
      })),
      {
        field: 'clients_total',
        header: 'Total',
        type: 'readonly' as const,
        width: 65,
        calculate: (row: any) =>
          CLIENT_CATEGORIES.reduce((sum, cat) => {
            const field = cat === 'Local Government' ? 'clients_other' : `clients_${cat.toLowerCase()}`;
            return sum + ((row[field] as number) || 0);
          }, 0),
      },
    ],
  },
  {
    label: 'G-I. Inventory',
    key: 'equipment',
    bgClass: 'bg-stone-50',
    headerTextClass: 'text-stone-700',
    columns: [
      { field: 'assets_count', header: 'Assets', type: 'readonly', width: 65 },
      { field: 'lab_equipment_count', header: 'Lab', type: 'readonly', width: 55 },
      { field: 'spare_parts_count', header: 'Spares', type: 'readonly', width: 65 },
    ],
  },
];

export function createEmptyRow(): StationRow {
  return {
    id: null,
    station_code: '', station_name: '', station_type: '', operational_status: 'Active',
    design_capacity_m3_hr: 0, location_coordinates: '', distance_from_sc_km: 0,
    commissioning_date: '', notes: '',
    ps_rw_description: '', ps_rw_main_diameter: '', ps_rw_main_distance_m: 0, ps_rw_main_material: '',
    ps_cw_description: '', ps_cw_main_diameter: '', ps_cw_main_distance_m: 0, ps_cw_main_material: '',
    ps_booster_description: '', ps_booster_main_diameter: '', ps_booster_main_distance_m: 0, ps_booster_main_material: '',
    operator_count: 0,
    rw_abstraction_type: '', sedimentation_tank_size_m3: 0, filter_type: '', filter_size: '',
    backwash_tank_size_m3: 0, backwash_system_type: '',
    clients_domestic: 0, clients_school: 0, clients_business: 0, clients_industry: 0,
    clients_church: 0, clients_parastatal: 0, clients_government: 0, clients_other: 0,
    assets_count: 0, lab_equipment_count: 0, spare_parts_count: 0,
    _isNew: true, _isDirty: true, _ps_rw_id: null, _ps_cw_id: null, _ps_booster_id: null, _treatment_id: null,
  };
}
