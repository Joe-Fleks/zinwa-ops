export type EquipmentCategory = 'pumps' | 'motors' | 'bearings' | 'vehicles';

export const EQUIPMENT_CATEGORIES: { key: EquipmentCategory; label: string }[] = [
  { key: 'pumps', label: 'Pumps' },
  { key: 'motors', label: 'Electric Motors' },
  { key: 'bearings', label: 'Bearings' },
  { key: 'vehicles', label: 'Vehicles' },
];

export const TABLE_NAMES: Record<EquipmentCategory, string> = {
  pumps: 'equipment_pumps',
  motors: 'equipment_motors',
  bearings: 'equipment_bearings',
  vehicles: 'equipment_vehicles',
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

export const VEHICLE_TYPES = ['Truck', 'Bakkie', 'Sedan', 'SUV', 'Motorcycle', 'Van', 'Bus', 'Trailer', 'Plant/Machinery'];
export const FUEL_TYPES = ['Diesel', 'Petrol'];
export const TRANSMISSIONS = ['Manual', 'Automatic'];
export const VEHICLE_STATUSES = ['Runner', 'Non-Runner'];

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
  insurance_expiry: string;
  fitness_expiry: string;
  condition: string;
  condition_comment: string;
  assigned_to: string;
  notes: string;
  _isNew: boolean;
  _isDirty: boolean;
}

export type EquipmentRow = PumpRow | MotorRow | BearingRow | VehicleRow;

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
    head_m: 0, flow_rate_m3_hr: 0, speed_rpm: 0, stages: 1,
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
    phase: 'Three Phase', enclosure_type: '',
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
    zinara_expiry: '', insurance_expiry: '', fitness_expiry: '',
    condition: 'Good', condition_comment: '', assigned_to: '', notes: '',
    _isNew: true, _isDirty: true,
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
