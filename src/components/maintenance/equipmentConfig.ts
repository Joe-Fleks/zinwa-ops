export type EquipmentCategory = 'pumps' | 'motors' | 'bearings' | 'vehicles' | 'bikes';

export const EQUIPMENT_CATEGORIES: { key: EquipmentCategory; label: string }[] = [
  { key: 'pumps', label: 'Pumps' },
  { key: 'motors', label: 'Electric Motors' },
  { key: 'bearings', label: 'Bearings' },
  { key: 'vehicles', label: 'Vehicles' },
  { key: 'bikes', label: 'Bikes' },
];

export const TABLE_NAMES: Record<EquipmentCategory, string> = {
  pumps: 'equipment_pumps',
  motors: 'equipment_motors',
  bearings: 'equipment_bearings',
  vehicles: 'equipment_vehicles',
  bikes: 'equipment_bikes',
};

export const PUMP_TYPES = ['Centrifugal', 'Submersible', 'Borehole', 'Positive Displacement', 'Multistage'];
export const PUMP_USES = ['RW Pump', 'CW Pump', 'Booster Pump', 'Dosing Pump', 'Backwash Pump'];
export const DUTY_STATUSES = ['Duty', 'Standby'];
export const CONDITIONS = ['Good', 'Fair', 'Poor', 'Decommissioned'];

export const MOTOR_TYPES = ['Induction', 'Synchronous', 'Submersible', 'DC'];
export const MOTOR_USES = ['RW Pump', 'CW Pump', 'Booster Pump', 'Dosing Pump', 'Backwash Pump'];
export const PHASES = ['Single Phase', 'Three Phase'];
export const ENCLOSURE_TYPES = ['TEFC', 'ODP', 'IP55', 'IP68'];

export const BEARING_TYPES = ['Ball Bearing', 'Roller Bearing', 'Thrust Bearing', 'Sleeve Bearing'];
export const BEARING_POSITIONS = ['Drive End', 'Non-Drive End', 'Pump Side', 'Motor Side'];

export const VEHICLE_TYPES = ['Truck', 'Bakkie', 'Pick-up', 'Double Cab', 'Sedan', 'SUV', 'Van', 'Bus', 'Trailer', 'Plant/Machinery'];
export const FUEL_TYPES = ['Diesel', 'Petrol'];
export const TRANSMISSIONS = ['Manual', 'Automatic'];
export const VEHICLE_STATUSES = ['Runner', 'Non-Runner'];

export const BIKE_TYPES = ['Motorbike', 'Bicycle'];
export const BIKE_FUEL_TYPES = ['Petrol', 'N/A'];
export const IMPELLER_TYPES = ['Closed', 'Semi-Open', 'Open', 'Vortex'];

export interface StationOption {
  id: string;
  station_name: string;
}

export interface ServiceCentreOption {
  id: string;
  name: string;
  short_name: string;
}

export interface PumpRow {
  id: string | null;
  station_id: string;
  station_name: string;
  service_centre_id: string | null;
  tag_number: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  pump_type: string;
  pump_use: string;
  duty_status: string;
  head_m: number;
  flow_rate_m3_hr: number;
  speed_rpm: number;
  stages: number;
  impeller_size_mm: number;
  impeller_type: string;
  installation_date: string;
  design_life_years: number;
  design_life_expiry: string;
  condition: string;
  notes: string;
  _isNew: boolean;
  _isDirty: boolean;
}

export interface MotorRow {
  id: string | null;
  station_id: string;
  station_name: string;
  service_centre_id: string | null;
  tag_number: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  motor_type: string;
  motor_use: string;
  duty_status: string;
  kw_rating: number;
  hp_rating: number;
  voltage: number;
  current_amps: number;
  speed_rpm: number;
  shaft_diameter_mm: number;
  phase: string;
  enclosure_type: string;
  installation_date: string;
  design_life_years: number;
  design_life_expiry: string;
  condition: string;
  notes: string;
  _isNew: boolean;
  _isDirty: boolean;
}

export interface BearingRow {
  id: string | null;
  station_id: string;
  station_name: string;
  service_centre_id: string | null;
  tag_number: string;
  manufacturer: string;
  model: string;
  bearing_type: string;
  bearing_position: string;
  parent_equipment: string;
  parent_equipment_id: string | null;
  parent_equipment_type: string;
  size_designation: string;
  installation_date: string;
  design_life_years: number;
  design_life_expiry: string;
  condition: string;
  notes: string;
  _isNew: boolean;
  _isDirty: boolean;
}

export interface VehicleRow {
  id: string | null;
  service_centre_id: string;
  sc_name: string;
  number_plate: string;
  vehicle_type: string;
  make: string;
  model: string;
  year_of_manufacture: number;
  engine_number: string;
  chassis_number: string;
  fuel_type: string;
  transmission: string;
  odometer_km: number;
  status: string;
  zinara_expiry: string;
  condition: string;
  condition_comment: string;
  assigned_to: string;
  notes: string;
  _isNew: boolean;
  _isDirty: boolean;
}

export interface BikeRow {
  id: string | null;
  station_id: string;
  station_name: string;
  service_centre_id: string | null;
  bike_type: string;
  make: string;
  model: string;
  number_plate: string;
  engine_number: string;
  chassis_number: string;
  year_of_manufacture: number;
  fuel_type: string;
  odometer_km: number;
  status: string;
  zinara_expiry: string;
  condition: string;
  condition_comment: string;
  assigned_to: string;
  notes: string;
  _isNew: boolean;
  _isDirty: boolean;
}

export type EquipmentRow = PumpRow | MotorRow | BearingRow | VehicleRow | BikeRow;

export function computeDesignLifeExpiry(installDate: string, lifeYears: number): string {
  if (!installDate || !lifeYears) return '';
  const d = new Date(installDate + 'T12:00:00');
  d.setFullYear(d.getFullYear() + lifeYears);
  return d.toISOString().split('T')[0];
}

export function createEmptyPump(serviceCentreId: string | null): PumpRow {
  return {
    id: null, station_id: '', station_name: '', service_centre_id: serviceCentreId,
    tag_number: '', manufacturer: '', model: '', serial_number: '',
    pump_type: '', pump_use: '', duty_status: '',
    head_m: 0, flow_rate_m3_hr: 0, speed_rpm: 0, stages: 1, impeller_size_mm: 0, impeller_type: '',
    installation_date: '', design_life_years: 0, design_life_expiry: '',
    condition: 'Good', notes: '', _isNew: true, _isDirty: true,
  };
}

export function createEmptyMotor(serviceCentreId: string | null): MotorRow {
  return {
    id: null, station_id: '', station_name: '', service_centre_id: serviceCentreId,
    tag_number: '', manufacturer: '', model: '', serial_number: '',
    motor_type: '', motor_use: '', duty_status: '',
    kw_rating: 0, hp_rating: 0, voltage: 0, current_amps: 0, speed_rpm: 0,
    shaft_diameter_mm: 0, phase: 'Three Phase', enclosure_type: '',
    installation_date: '', design_life_years: 0, design_life_expiry: '',
    condition: 'Good', notes: '', _isNew: true, _isDirty: true,
  };
}

export function createEmptyBearing(serviceCentreId: string | null): BearingRow {
  return {
    id: null, station_id: '', station_name: '', service_centre_id: serviceCentreId,
    tag_number: '', manufacturer: '', model: '',
    bearing_type: '', bearing_position: '',
    parent_equipment: '', parent_equipment_id: null, parent_equipment_type: '',
    size_designation: '',
    installation_date: '', design_life_years: 0, design_life_expiry: '',
    condition: 'Good', notes: '', _isNew: true, _isDirty: true,
  };
}

export function createEmptyVehicle(serviceCentreId: string | null): VehicleRow {
  return {
    id: null, service_centre_id: serviceCentreId || '', sc_name: '',
    number_plate: '', vehicle_type: '', make: '', model: '',
    year_of_manufacture: 0, engine_number: '', chassis_number: '',
    fuel_type: 'Diesel', transmission: 'Manual', odometer_km: 0,
    status: 'Runner',
    zinara_expiry: '',
    condition: 'Good', condition_comment: '', assigned_to: '', notes: '',
    _isNew: true, _isDirty: true,
  };
}

export function createEmptyBike(serviceCentreId: string | null): BikeRow {
  return {
    id: null, station_id: '', station_name: '', service_centre_id: serviceCentreId,
    bike_type: 'Motorbike', make: '', model: '', number_plate: '',
    engine_number: '', chassis_number: '', year_of_manufacture: 0,
    fuel_type: 'Petrol', odometer_km: 0, status: 'Runner',
    zinara_expiry: '', condition: 'Good', condition_comment: '',
    assigned_to: '', notes: '', _isNew: true, _isDirty: true,
  };
}

export function shortenSCName(name: string): string {
  return name
    .replace(/\bService\s+Cent(re|er)\b/i, 'SC')
    .replace(/\bservice\s+cent(re|er)\b/i, 'SC');
}

export interface DesignLifeAlert {
  equipmentType: EquipmentCategory;
  equipmentLabel: string;
  stationName: string;
  tagNumber: string;
  expiryDate: string;
  daysRemaining: number;
}

const EXPORT_COLUMNS: Record<EquipmentCategory, { key: string; label: string }[]> = {
  pumps: [
    { key: 'station_name', label: 'Station' }, { key: 'tag_number', label: 'Tag No.' },
    { key: 'manufacturer', label: 'Manufacturer' }, { key: 'model', label: 'Model' },
    { key: 'serial_number', label: 'Serial No.' }, { key: 'pump_type', label: 'Type' },
    { key: 'pump_use', label: 'Use' }, { key: 'duty_status', label: 'Duty' },
    { key: 'head_m', label: 'Head (m)' }, { key: 'flow_rate_m3_hr', label: 'Flow (m3/hr)' },
    { key: 'speed_rpm', label: 'Speed (RPM)' }, { key: 'stages', label: 'Stages' },
    { key: 'impeller_size_mm', label: 'Impeller (mm)' }, { key: 'impeller_type', label: 'Impeller Type' },
    { key: 'installation_date', label: 'Installed' }, { key: 'design_life_years', label: 'Life (yrs)' },
    { key: 'design_life_expiry', label: 'Expiry' }, { key: 'condition', label: 'Condition' },
    { key: 'notes', label: 'Notes' },
  ],
  motors: [
    { key: 'station_name', label: 'Station' }, { key: 'tag_number', label: 'Tag No.' },
    { key: 'manufacturer', label: 'Manufacturer' }, { key: 'model', label: 'Model' },
    { key: 'serial_number', label: 'Serial No.' }, { key: 'motor_type', label: 'Type' },
    { key: 'motor_use', label: 'Use' }, { key: 'duty_status', label: 'Duty' },
    { key: 'kw_rating', label: 'kW' }, { key: 'hp_rating', label: 'HP' },
    { key: 'voltage', label: 'Voltage (V)' }, { key: 'current_amps', label: 'Current (A)' },
    { key: 'speed_rpm', label: 'Speed (RPM)' }, { key: 'shaft_diameter_mm', label: 'Shaft (mm)' },
    { key: 'phase', label: 'Phase' }, { key: 'enclosure_type', label: 'Enclosure' },
    { key: 'installation_date', label: 'Installed' }, { key: 'design_life_years', label: 'Life (yrs)' },
    { key: 'design_life_expiry', label: 'Expiry' }, { key: 'condition', label: 'Condition' },
    { key: 'notes', label: 'Notes' },
  ],
  bearings: [
    { key: 'station_name', label: 'Station' }, { key: 'tag_number', label: 'Tag No.' },
    { key: 'manufacturer', label: 'Manufacturer' }, { key: 'model', label: 'Model' },
    { key: 'bearing_type', label: 'Type' }, { key: 'bearing_position', label: 'Position' },
    { key: 'parent_equipment', label: 'Parent Equipment' }, { key: 'size_designation', label: 'Size' },
    { key: 'installation_date', label: 'Installed' }, { key: 'design_life_years', label: 'Life (yrs)' },
    { key: 'design_life_expiry', label: 'Expiry' }, { key: 'condition', label: 'Condition' },
    { key: 'notes', label: 'Notes' },
  ],
  vehicles: [
    { key: 'sc_name', label: 'Service Centre' }, { key: 'number_plate', label: 'Plate' },
    { key: 'vehicle_type', label: 'Type' }, { key: 'make', label: 'Make' },
    { key: 'model', label: 'Model' }, { key: 'year_of_manufacture', label: 'Year' },
    { key: 'engine_number', label: 'Engine No.' }, { key: 'chassis_number', label: 'Chassis No.' },
    { key: 'fuel_type', label: 'Fuel' }, { key: 'transmission', label: 'Transmission' },
    { key: 'odometer_km', label: 'Odometer (km)' }, { key: 'status', label: 'Status' },
    { key: 'zinara_expiry', label: 'ZINARA Expiry' }, { key: 'condition', label: 'Condition' },
    { key: 'condition_comment', label: 'Condition Notes' }, { key: 'assigned_to', label: 'Assigned To' },
    { key: 'notes', label: 'Notes' },
  ],
  bikes: [
    { key: 'station_name', label: 'Station' }, { key: 'number_plate', label: 'Plate' },
    { key: 'bike_type', label: 'Type' }, { key: 'make', label: 'Make' },
    { key: 'model', label: 'Model' }, { key: 'year_of_manufacture', label: 'Year' },
    { key: 'engine_number', label: 'Engine No.' }, { key: 'chassis_number', label: 'Chassis No.' },
    { key: 'fuel_type', label: 'Fuel' }, { key: 'odometer_km', label: 'Odometer (km)' },
    { key: 'status', label: 'Status' }, { key: 'zinara_expiry', label: 'ZINARA Expiry' },
    { key: 'condition', label: 'Condition' }, { key: 'condition_comment', label: 'Condition Notes' },
    { key: 'assigned_to', label: 'Assigned To' }, { key: 'notes', label: 'Notes' },
  ],
};

function escapeCsvField(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export function exportEquipmentCSV(category: EquipmentCategory, rows: any[]) {
  const cols = EXPORT_COLUMNS[category];
  const header = cols.map(c => escapeCsvField(c.label)).join(',');
  const dataRows = rows.map(row =>
    cols.map(c => escapeCsvField((row as any)[c.key])).join(',')
  );
  const csv = [header, ...dataRows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const catLabel = EQUIPMENT_CATEGORIES.find(c => c.key === category)?.label || category;
  link.download = `Equipment_${catLabel}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
