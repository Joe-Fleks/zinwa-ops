import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNetwork } from '../contexts/NetworkContext';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronUp, Plus, Trash2, Save, X, ArrowLeft } from 'lucide-react';
import { handleKeyNavigation } from '../lib/excelFormUtils';

interface PumpingStation {
  tempId: string;
  pumping_station_type: string;
  description: string;
  pumping_main_diameter: string;
  pumping_main_distance_m: string;
  pumping_main_material: string;
  pumps: Pump[];
}

interface Pump {
  tempId: string;
  pump_type: string;
  pump_head_m: string;
  motor_kw_rating: string;
  motor_hp_rating: string;
  pump_design_flow_m3_hr: string;
  manufacturer: string;
  installation_date: string;
  notes: string;
}

interface Operator {
  tempId: string;
  full_name: string;
  position: string;
  employment_status: string;
  transfer_target_station_id: string;
  notes: string;
  start_date: string;
}

interface ClientGroup {
  tempId: string;
  category: string;
  number_of_clients: string;
  notes: string;
}

interface StationAsset {
  tempId: string;
  asset_type: string;
  asset_name: string;
  registration_number: string;
  manufacturer: string;
  model: string;
  purchase_date: string;
  condition: string;
  notes: string;
}

interface LabEquipment {
  tempId: string;
  equipment_name: string;
  equipment_type: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  calibration_date: string;
  calibration_due_date: string;
  condition: string;
  notes: string;
}

interface SparePart {
  tempId: string;
  part_name: string;
  part_category: string;
  part_number: string;
  quantity_in_stock: string;
  minimum_stock_level: string;
  unit_of_measure: string;
  supplier: string;
  last_restock_date: string;
  notes: string;
}

export default function StationRegistration() {
  const { user, accessContext } = useAuth();
  const { isOnline, showOfflineWarning } = useNetwork();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEditMode);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    pumpingStations: true,
    operators: true,
    treatment: false,
    clients: false,
    assets: false,
    labEquipment: false,
    spareParts: false
  });

  const [formData, setFormData] = useState({
    station_code: '',
    station_name: '',
    station_type: '',
    operational_status: 'Active',
    design_capacity_m3_hr: '',
    location_coordinates: '',
    distance_from_sc_km: '',
    commissioning_date: '',
    notes: ''
  });

  const [pumpingStations, setPumpingStations] = useState<PumpingStation[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [treatmentUnit, setTreatmentUnit] = useState({
    rw_abstraction_type: '',
    sedimentation_tank_size_m3: '',
    filter_type: '',
    filter_size: '',
    backwash_tank_size_m3: '',
    backwash_system_type: '',
    notes: ''
  });
  const [clientGroups, setClientGroups] = useState<ClientGroup[]>([]);
  const [stationAssets, setStationAssets] = useState<StationAsset[]>([]);
  const [labEquipments, setLabEquipments] = useState<LabEquipment[]>([]);
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);

  useEffect(() => {
    if (isEditMode && id) {
      loadStationData();
    }
  }, [id, isEditMode]);

  const loadStationData = async () => {
    try {
      setLoadingData(true);
      setError('');

      const { data: stationData, error: stationError } = await supabase
        .from('stations')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (stationError) throw new Error('Failed to load station data. Please check your internet connection.');
      if (!stationData) throw new Error('Station not found');

      setFormData({
        station_code: stationData.station_code || '',
        station_name: stationData.station_name || '',
        station_type: stationData.station_type || '',
        operational_status: stationData.operational_status || 'Active',
        design_capacity_m3_hr: stationData.design_capacity_m3_hr?.toString() || '',
        location_coordinates: stationData.location_coordinates || '',
        distance_from_sc_km: stationData.distance_from_sc_km?.toString() || '',
        commissioning_date: stationData.commissioning_date || '',
        notes: stationData.notes || ''
      });

      const { data: pumpingStationsData } = await supabase
        .from('pumping_stations')
        .select('*')
        .eq('station_id', id);

      if (pumpingStationsData && pumpingStationsData.length > 0) {
        const psWithPumps = await Promise.all(
          pumpingStationsData.map(async (ps) => {
            const { data: pumpsData } = await supabase
              .from('pumps')
              .select('*')
              .eq('pumping_station_id', ps.id);

            return {
              tempId: ps.id,
              pumping_station_type: ps.pumping_station_type || '',
              description: ps.description || '',
              pumping_main_diameter: ps.pumping_main_diameter || '',
              pumping_main_distance_m: ps.pumping_main_distance_m?.toString() || '',
              pumping_main_material: ps.pumping_main_material || '',
              pumps: (pumpsData || []).map(pump => ({
                tempId: pump.id,
                pump_type: pump.pump_type || '',
                pump_head_m: pump.pump_head_m?.toString() || '',
                motor_kw_rating: pump.motor_kw_rating?.toString() || '',
                motor_hp_rating: pump.motor_hp_rating?.toString() || '',
                pump_design_flow_m3_hr: pump.pump_design_flow_m3_hr?.toString() || '',
                manufacturer: pump.manufacturer || '',
                installation_date: pump.installation_date || '',
                notes: pump.notes || ''
              }))
            };
          })
        );
        setPumpingStations(psWithPumps);
      }

      const { data: operatorsData } = await supabase
        .from('operators')
        .select('*')
        .eq('station_id', id);

      if (operatorsData) {
        setOperators(operatorsData.map(op => ({
          tempId: op.id,
          full_name: op.full_name || '',
          position: op.position || '',
          employment_status: op.employment_status || '',
          transfer_target_station_id: op.transfer_target_station_id || '',
          notes: op.notes || '',
          start_date: op.start_date || ''
        })));
      }

      const { data: treatmentData } = await supabase
        .from('treatment_units')
        .select('*')
        .eq('station_id', id)
        .maybeSingle();

      if (treatmentData) {
        setTreatmentUnit({
          rw_abstraction_type: treatmentData.rw_abstraction_type || '',
          sedimentation_tank_size_m3: treatmentData.sedimentation_tank_size_m3?.toString() || '',
          filter_type: treatmentData.filter_type || '',
          filter_size: treatmentData.filter_size || '',
          backwash_tank_size_m3: treatmentData.backwash_tank_size_m3?.toString() || '',
          backwash_system_type: treatmentData.backwash_system_type || '',
          notes: treatmentData.notes || ''
        });
      }

      const { data: clientGroupsData } = await supabase
        .from('station_client_groups')
        .select('*')
        .eq('station_id', id);

      if (clientGroupsData) {
        setClientGroups(clientGroupsData.map(cg => ({
          tempId: cg.id,
          category: cg.category || '',
          number_of_clients: cg.number_of_clients?.toString() || '',
          notes: cg.notes || ''
        })));
      }

      const { data: assetsData } = await supabase
        .from('station_assets')
        .select('*')
        .eq('station_id', id);

      if (assetsData) {
        setStationAssets(assetsData.map(asset => ({
          tempId: asset.id,
          asset_type: asset.asset_type || '',
          asset_name: asset.asset_name || '',
          registration_number: asset.registration_number || '',
          manufacturer: asset.manufacturer || '',
          model: asset.model || '',
          purchase_date: asset.purchase_date || '',
          condition: asset.condition || '',
          notes: asset.notes || ''
        })));
      }

      const { data: labEquipmentData } = await supabase
        .from('lab_equipment')
        .select('*')
        .eq('station_id', id);

      if (labEquipmentData) {
        setLabEquipments(labEquipmentData.map(eq => ({
          tempId: eq.id,
          equipment_name: eq.equipment_name || '',
          manufacturer: eq.manufacturer || '',
          model: eq.model || '',
          purchase_date: eq.purchase_date || '',
          calibration_due_date: eq.calibration_due_date || '',
          condition: eq.condition || '',
          notes: eq.notes || ''
        })));
      }

      const { data: sparePartsData } = await supabase
        .from('spare_parts')
        .select('*')
        .eq('station_id', id);

      if (sparePartsData) {
        setSpareParts(sparePartsData.map(part => ({
          tempId: part.id,
          part_name: part.part_name || '',
          part_number: part.part_number || '',
          quantity_in_stock: part.quantity_in_stock?.toString() || '',
          minimum_stock_level: part.minimum_stock_level?.toString() || '',
          unit_of_measure: part.unit_of_measure || '',
          supplier: part.supplier || '',
          last_restock_date: part.last_restock_date || '',
          notes: part.notes || ''
        })));
      }

    } catch (err: any) {
      setError(err.message || 'Failed to load station data');
    } finally {
      setLoadingData(false);
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const addPumpingStation = () => {
    setPumpingStations(prev => [...prev, {
      tempId: `ps_${Date.now()}`,
      pumping_station_type: '',
      description: '',
      pumping_main_diameter: '',
      pumping_main_distance_m: '',
      pumping_main_material: '',
      pumps: []
    }]);
  };

  const removePumpingStation = (tempId: string) => {
    setPumpingStations(prev => prev.filter(ps => ps.tempId !== tempId));
  };

  const updatePumpingStation = (tempId: string, field: string, value: string) => {
    setPumpingStations(prev => prev.map(ps =>
      ps.tempId === tempId ? { ...ps, [field]: value } : ps
    ));
  };

  const addPump = (psTempId: string) => {
    setPumpingStations(prev => prev.map(ps =>
      ps.tempId === psTempId
        ? {
          ...ps,
          pumps: [...ps.pumps, {
            tempId: `pump_${Date.now()}`,
            pump_type: '',
            pump_head_m: '',
            motor_kw_rating: '',
            motor_hp_rating: '',
            pump_design_flow_m3_hr: '',
            manufacturer: '',
            installation_date: '',
            notes: ''
          }]
        }
        : ps
    ));
  };

  const removePump = (psTempId: string, pumpTempId: string) => {
    setPumpingStations(prev => prev.map(ps =>
      ps.tempId === psTempId
        ? { ...ps, pumps: ps.pumps.filter(p => p.tempId !== pumpTempId) }
        : ps
    ));
  };

  const updatePump = (psTempId: string, pumpTempId: string, field: string, value: string) => {
    setPumpingStations(prev => prev.map(ps =>
      ps.tempId === psTempId
        ? {
          ...ps,
          pumps: ps.pumps.map(p =>
            p.tempId === pumpTempId ? { ...p, [field]: value } : p
          )
        }
        : ps
    ));
  };

  const addOperator = () => {
    setOperators(prev => [...prev, {
      tempId: `op_${Date.now()}`,
      full_name: '',
      position: '',
      employment_status: 'Active',
      transfer_target_station_id: '',
      notes: '',
      start_date: ''
    }]);
  };

  const removeOperator = (tempId: string) => {
    setOperators(prev => prev.filter(op => op.tempId !== tempId));
  };

  const updateOperator = (tempId: string, field: string, value: string) => {
    setOperators(prev => prev.map(op =>
      op.tempId === tempId ? { ...op, [field]: value } : op
    ));
  };

  const addClientGroup = () => {
    setClientGroups(prev => [...prev, {
      tempId: `cg_${Date.now()}`,
      category: '',
      number_of_clients: '',
      notes: ''
    }]);
  };

  const removeClientGroup = (tempId: string) => {
    setClientGroups(prev => prev.filter(cg => cg.tempId !== tempId));
  };

  const updateClientGroup = (tempId: string, field: string, value: string) => {
    setClientGroups(prev => prev.map(cg =>
      cg.tempId === tempId ? { ...cg, [field]: value } : cg
    ));
  };

  const addAsset = () => {
    setStationAssets(prev => [...prev, {
      tempId: `asset_${Date.now()}`,
      asset_type: '',
      asset_name: '',
      registration_number: '',
      manufacturer: '',
      model: '',
      purchase_date: '',
      condition: '',
      notes: ''
    }]);
  };

  const removeAsset = (tempId: string) => {
    setStationAssets(prev => prev.filter(a => a.tempId !== tempId));
  };

  const updateAsset = (tempId: string, field: string, value: string) => {
    setStationAssets(prev => prev.map(a =>
      a.tempId === tempId ? { ...a, [field]: value } : a
    ));
  };

  const addLabEquipment = () => {
    setLabEquipments(prev => [...prev, {
      tempId: `lab_${Date.now()}`,
      equipment_name: '',
      equipment_type: '',
      manufacturer: '',
      model: '',
      serial_number: '',
      calibration_date: '',
      calibration_due_date: '',
      condition: '',
      notes: ''
    }]);
  };

  const removeLabEquipment = (tempId: string) => {
    setLabEquipments(prev => prev.filter(e => e.tempId !== tempId));
  };

  const updateLabEquipment = (tempId: string, field: string, value: string) => {
    setLabEquipments(prev => prev.map(e =>
      e.tempId === tempId ? { ...e, [field]: value } : e
    ));
  };

  const addSparePart = () => {
    setSpareParts(prev => [...prev, {
      tempId: `spare_${Date.now()}`,
      part_name: '',
      part_category: '',
      part_number: '',
      quantity_in_stock: '',
      minimum_stock_level: '',
      unit_of_measure: '',
      supplier: '',
      last_restock_date: '',
      notes: ''
    }]);
  };

  const removeSparePart = (tempId: string) => {
    setSpareParts(prev => prev.filter(s => s.tempId !== tempId));
  };

  const updateSparePart = (tempId: string, field: string, value: string) => {
    setSpareParts(prev => prev.map(s =>
      s.tempId === tempId ? { ...s, [field]: value } : s
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isOnline) {
      showOfflineWarning();
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (!formData.station_name) {
        throw new Error('Station name is required');
      }

      let stationId: string;

      if (isEditMode && id) {
        const { error: stationError } = await supabase
          .from('stations')
          .update({
            station_code: formData.station_code || null,
            station_name: formData.station_name,
            station_type: formData.station_type || null,
            operational_status: formData.operational_status,
            design_capacity_m3_hr: formData.design_capacity_m3_hr ? parseFloat(formData.design_capacity_m3_hr) : null,
            location_coordinates: formData.location_coordinates || null,
            distance_from_sc_km: formData.distance_from_sc_km ? parseInt(formData.distance_from_sc_km) : null,
            commissioning_date: formData.commissioning_date || null,
            notes: formData.notes || null,
            service_centre_id: accessContext?.isSCScoped ? accessContext.scopeId : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);

        if (stationError) throw new Error('Failed to update station. Please check your internet connection.');

        stationId = id;

        const { data: existingPumpingStations } = await supabase
          .from('pumping_stations')
          .select('id')
          .eq('station_id', stationId);

        if (existingPumpingStations && existingPumpingStations.length > 0) {
          const psIds = existingPumpingStations.map(ps => ps.id);
          await supabase.from('pumps').delete().in('pumping_station_id', psIds);
          await supabase.from('pumping_stations').delete().eq('station_id', stationId);
        }

        await supabase.from('operators').delete().eq('station_id', stationId);
        await supabase.from('treatment_units').delete().eq('station_id', stationId);
        await supabase.from('station_client_groups').delete().eq('station_id', stationId);
        await supabase.from('station_assets').delete().eq('station_id', stationId);
        await supabase.from('lab_equipment').delete().eq('station_id', stationId);
        await supabase.from('spare_parts').delete().eq('station_id', stationId);

      } else {
        const { data: stationData, error: stationError } = await supabase
          .from('stations')
          .insert([{
            station_code: formData.station_code || null,
            station_name: formData.station_name,
            station_type: formData.station_type || null,
            operational_status: formData.operational_status,
            design_capacity_m3_hr: formData.design_capacity_m3_hr ? parseFloat(formData.design_capacity_m3_hr) : null,
            location_coordinates: formData.location_coordinates || null,
            distance_from_sc_km: formData.distance_from_sc_km ? parseInt(formData.distance_from_sc_km) : null,
            commissioning_date: formData.commissioning_date || null,
            notes: formData.notes || null,
            service_centre_id: accessContext?.isSCScoped ? accessContext.scopeId : null,
            created_by: user?.id
          }])
          .select()
          .single();

        if (stationError) throw new Error('Failed to create station. Please check your internet connection.');

        stationId = stationData.id;
      }

      for (const ps of pumpingStations) {
        const { data: psData, error: psError } = await supabase
          .from('pumping_stations')
          .insert([{
            station_id: stationId,
            pumping_station_type: ps.pumping_station_type || null,
            description: ps.description || null,
            pumping_main_diameter: ps.pumping_main_diameter || null,
            pumping_main_distance_m: ps.pumping_main_distance_m ? parseFloat(ps.pumping_main_distance_m) : null,
            pumping_main_material: ps.pumping_main_material || null
          }])
          .select()
          .single();

        if (psError) throw psError;

        if (ps.pumps.length > 0) {
          const pumpsToInsert = ps.pumps.map(pump => ({
            pumping_station_id: psData.id,
            pump_type: pump.pump_type || null,
            pump_head_m: pump.pump_head_m ? parseFloat(pump.pump_head_m) : null,
            motor_kw_rating: pump.motor_kw_rating ? parseFloat(pump.motor_kw_rating) : null,
            motor_hp_rating: pump.motor_hp_rating ? parseFloat(pump.motor_hp_rating) : null,
            pump_design_flow_m3_hr: pump.pump_design_flow_m3_hr ? parseFloat(pump.pump_design_flow_m3_hr) : null,
            manufacturer: pump.manufacturer || null,
            installation_date: pump.installation_date || null,
            notes: pump.notes || null
          }));

          const { error: pumpsError } = await supabase
            .from('pumps')
            .insert(pumpsToInsert);

          if (pumpsError) throw pumpsError;
        }
      }

      if (operators.length > 0) {
        const operatorsToInsert = operators.map(op => ({
          station_id: stationId,
          full_name: op.full_name || null,
          position: op.position || null,
          employment_status: op.employment_status,
          transfer_target_station_id: op.transfer_target_station_id || null,
          notes: op.notes || null,
          start_date: op.start_date || null
        }));

        const { error: operatorsError } = await supabase
          .from('operators')
          .insert(operatorsToInsert);

        if (operatorsError) throw operatorsError;
      }

      const hasTreatmentData = Object.values(treatmentUnit).some(val => val !== '');
      if (hasTreatmentData) {
        const { error: treatmentError } = await supabase
          .from('treatment_units')
          .insert([{
            station_id: stationId,
            rw_abstraction_type: treatmentUnit.rw_abstraction_type || null,
            sedimentation_tank_size_m3: treatmentUnit.sedimentation_tank_size_m3 ? parseFloat(treatmentUnit.sedimentation_tank_size_m3) : null,
            filter_type: treatmentUnit.filter_type || null,
            filter_size: treatmentUnit.filter_size || null,
            backwash_tank_size_m3: treatmentUnit.backwash_tank_size_m3 ? parseFloat(treatmentUnit.backwash_tank_size_m3) : null,
            backwash_system_type: treatmentUnit.backwash_system_type || null,
            notes: treatmentUnit.notes || null
          }]);

        if (treatmentError) throw treatmentError;
      }

      if (clientGroups.length > 0) {
        const clientGroupsToInsert = clientGroups.map(cg => ({
          station_id: stationId,
          category: cg.category || null,
          number_of_clients: cg.number_of_clients ? parseInt(cg.number_of_clients) : 0,
          notes: cg.notes || null
        }));

        const { error: clientGroupsError } = await supabase
          .from('station_client_groups')
          .insert(clientGroupsToInsert);

        if (clientGroupsError) throw clientGroupsError;
      }

      if (stationAssets.length > 0) {
        const assetsToInsert = stationAssets.map(asset => ({
          station_id: stationId,
          asset_type: asset.asset_type || null,
          asset_name: asset.asset_name || null,
          registration_number: asset.registration_number || null,
          manufacturer: asset.manufacturer || null,
          model: asset.model || null,
          purchase_date: asset.purchase_date || null,
          condition: asset.condition || null,
          notes: asset.notes || null
        }));

        const { error: assetsError } = await supabase
          .from('station_assets')
          .insert(assetsToInsert);

        if (assetsError) throw assetsError;
      }

      if (labEquipments.length > 0) {
        const labEquipmentsToInsert = labEquipments.map(equipment => ({
          station_id: stationId,
          equipment_name: equipment.equipment_name || null,
          equipment_type: equipment.equipment_type || null,
          manufacturer: equipment.manufacturer || null,
          model: equipment.model || null,
          serial_number: equipment.serial_number || null,
          calibration_date: equipment.calibration_date || null,
          calibration_due_date: equipment.calibration_due_date || null,
          condition: equipment.condition || null,
          notes: equipment.notes || null
        }));

        const { error: labEquipmentsError } = await supabase
          .from('lab_equipment')
          .insert(labEquipmentsToInsert);

        if (labEquipmentsError) throw labEquipmentsError;
      }

      if (spareParts.length > 0) {
        const sparePartsToInsert = spareParts.map(part => ({
          station_id: stationId,
          part_name: part.part_name || null,
          part_category: part.part_category || null,
          part_number: part.part_number || null,
          quantity_in_stock: part.quantity_in_stock ? parseInt(part.quantity_in_stock) : 0,
          minimum_stock_level: part.minimum_stock_level ? parseInt(part.minimum_stock_level) : 0,
          unit_of_measure: part.unit_of_measure || null,
          supplier: part.supplier || null,
          last_restock_date: part.last_restock_date || null,
          notes: part.notes || null
        }));

        const { error: sparePartsError } = await supabase
          .from('spare_parts')
          .insert(sparePartsToInsert);

        if (sparePartsError) throw sparePartsError;
      }

      setSuccess(true);
      setTimeout(() => {
        if (isEditMode) {
          navigate(`/clearwater/stations/${stationId}`);
        } else {
          navigate('/clearwater/stations');
        }
      }, 2000);
    } catch (err: any) {
      const errorMessage = err.message || (isEditMode
        ? 'Failed to update station. Please check your internet connection.'
        : 'Failed to register station. Please check your internet connection.');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate('/clearwater')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Clear Water
        </button>
      </div>

      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditMode ? 'Edit Station' : 'Register New Station'} <span className="text-base font-normal text-gray-600">
              ({isEditMode
                ? 'Update station information and details'
                : 'Enter station name to register, then add details later'})
            </span>
          </h1>
        </div>
        <button
          onClick={() => navigate(isEditMode ? `/clearwater/stations/${id}` : '/clearwater/stations')}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
      </div>

      {!isEditMode && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg">
          <p className="font-medium">Quick Registration Available</p>
          <p className="text-sm mt-1">Only the station name is required. You can add pumps, operators, equipment, and other details anytime by editing the station later.</p>
        </div>
      )}

      {loadingData && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading station data...</p>
        </div>
      )}

      {!loadingData && (
        <>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              <p className="font-medium">Success!</p>
              <p className="text-sm mt-1">
                {isEditMode
                  ? 'Station updated successfully! Redirecting...'
                  : 'Station registered successfully! Redirecting...'}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
        <SectionPanel
          title="A. Basic Station Information"
          isExpanded={expandedSections.basic}
          onToggle={() => toggleSection('basic')}
          required
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Station Code
              </label>
              <input
                type="text"
                name="station_code"
                value={formData.station_code}
                onChange={handleInputChange}
                onKeyDown={(e) => handleKeyNavigation(e, 0, 0, 5, 2)}
                onFocus={(e) => e.target.select()}
                data-row={0}
                data-col={0}
                placeholder="e.g., CW-001"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Station Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="station_name"
                value={formData.station_name}
                onChange={handleInputChange}
                onKeyDown={(e) => handleKeyNavigation(e, 0, 1, 5, 2)}
                onFocus={(e) => e.target.select()}
                data-row={0}
                data-col={1}
                required
                placeholder="e.g., Murombedzi Main Treatment Plant"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Station Type
              </label>
              <select
                name="station_type"
                value={formData.station_type}
                onChange={handleInputChange}
                onKeyDown={(e) => handleKeyNavigation(e, 1, 0, 5, 2)}
                data-row={1}
                data-col={0}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select type...</option>
                <option value="Full Treatment">Full Treatment</option>
                <option value="Borehole">Borehole</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Operational Status
              </label>
              <select
                name="operational_status"
                value={formData.operational_status}
                onChange={handleInputChange}
                onKeyDown={(e) => handleKeyNavigation(e, 1, 1, 5, 2)}
                data-row={1}
                data-col={1}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Active">Active</option>
                <option value="Decommissioned">Decommissioned</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Design Capacity (m³/hr)
              </label>
              <input
                type="number"
                name="design_capacity_m3_hr"
                value={formData.design_capacity_m3_hr}
                onChange={handleInputChange}
                onKeyDown={(e) => handleKeyNavigation(e, 2, 0, 5, 2)}
                onFocus={(e) => e.target.select()}
                data-row={2}
                data-col={0}
                step="0.01"
                placeholder="e.g., 150"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Commissioning Date
              </label>
              <input
                type="date"
                name="commissioning_date"
                value={formData.commissioning_date}
                onChange={handleInputChange}
                onKeyDown={(e) => handleKeyNavigation(e, 2, 1, 5, 2)}
                data-row={2}
                data-col={1}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location Coordinates
              </label>
              <input
                type="text"
                name="location_coordinates"
                value={formData.location_coordinates}
                onChange={handleInputChange}
                onKeyDown={(e) => handleKeyNavigation(e, 3, 0, 5, 2)}
                onFocus={(e) => e.target.select()}
                data-row={3}
                data-col={0}
                placeholder="e.g., -17.7289, 30.2567"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Distance from SC (km)
              </label>
              <input
                type="number"
                name="distance_from_sc_km"
                value={formData.distance_from_sc_km}
                onChange={handleInputChange}
                onKeyDown={(e) => handleKeyNavigation(e, 3, 1, 5, 2)}
                onFocus={(e) => e.target.select()}
                data-row={3}
                data-col={1}
                placeholder="e.g., 13"
                step="1"
                min="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                onKeyDown={(e) => handleKeyNavigation(e, 4, 0, 5, 2)}
                data-row={4}
                data-col={0}
                rows={3}
                placeholder="Any additional information about the station..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Tip:</strong> Use Arrow keys (↑↓←→) to navigate between fields, Tab to move forward, Shift+Tab to move backward
            </p>
          </div>
        </SectionPanel>

        <PumpingStationsSection
          pumpingStations={pumpingStations}
          isExpanded={expandedSections.pumpingStations}
          onToggle={() => toggleSection('pumpingStations')}
          onAdd={addPumpingStation}
          onRemove={removePumpingStation}
          onUpdate={updatePumpingStation}
          onAddPump={addPump}
          onRemovePump={removePump}
          onUpdatePump={updatePump}
        />

        <OperatorsSection
          operators={operators}
          isExpanded={expandedSections.operators}
          onToggle={() => toggleSection('operators')}
          onAdd={addOperator}
          onRemove={removeOperator}
          onUpdate={updateOperator}
        />

        <TreatmentUnitSection
          treatmentUnit={treatmentUnit}
          isExpanded={expandedSections.treatment}
          onToggle={() => toggleSection('treatment')}
          onUpdate={setTreatmentUnit}
        />

        <ClientGroupsSection
          clientGroups={clientGroups}
          isExpanded={expandedSections.clients}
          onToggle={() => toggleSection('clients')}
          onAdd={addClientGroup}
          onRemove={removeClientGroup}
          onUpdate={updateClientGroup}
        />

        <AssetsSection
          assets={stationAssets}
          isExpanded={expandedSections.assets}
          onToggle={() => toggleSection('assets')}
          onAdd={addAsset}
          onRemove={removeAsset}
          onUpdate={updateAsset}
        />

        <LabEquipmentSection
          equipment={labEquipments}
          isExpanded={expandedSections.labEquipment}
          onToggle={() => toggleSection('labEquipment')}
          onAdd={addLabEquipment}
          onRemove={removeLabEquipment}
          onUpdate={updateLabEquipment}
        />

        <SparePartsSection
          parts={spareParts}
          isExpanded={expandedSections.spareParts}
          onToggle={() => toggleSection('spareParts')}
          onAdd={addSparePart}
          onRemove={removeSparePart}
          onUpdate={updateSparePart}
        />

        <div className="flex justify-end gap-4 pt-6 border-t">
          <button
            type="button"
            onClick={() => navigate('/clearwater/stations')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {loading
              ? (isEditMode ? 'Saving Changes...' : 'Registering...')
              : (isEditMode ? 'Save Changes' : 'Register Station')}
          </button>
        </div>
      </form>
        </>
      )}
    </div>
  );
}

function SectionPanel({
  title,
  children,
  isExpanded,
  onToggle,
  required = false
}: {
  title: string;
  children: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  required?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
      >
        <h2 className="text-lg font-semibold text-gray-900">
          {title}
          {required && <span className="text-red-500 ml-2">*</span>}
        </h2>
        {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
      </button>
      {isExpanded && (
        <div className="p-6 border-t border-gray-200">
          {children}
        </div>
      )}
    </div>
  );
}

function PumpingStationsSection({ pumpingStations, isExpanded, onToggle, onAdd, onRemove, onUpdate, onAddPump, onRemovePump, onUpdatePump }: any) {
  return (
    <SectionPanel title="B. Pumping Stations & Pumps" isExpanded={isExpanded} onToggle={onToggle}>
      <div className="space-y-4">
        {pumpingStations.map((ps: PumpingStation, index: number) => (
          <div key={ps.tempId} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-medium text-gray-900">Pumping Station {index + 1}</h3>
              <button
                type="button"
                onClick={() => onRemove(ps.tempId)}
                className="text-red-600 hover:text-red-800"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select
                  value={ps.pumping_station_type}
                  onChange={(e) => onUpdate(ps.tempId, 'pumping_station_type', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select type...</option>
                  <option value="RW">RW (Raw Water)</option>
                  <option value="CW">CW (Clear Water)</option>
                  <option value="Mid-Booster">Mid-Booster</option>
                  <option value="Booster">Booster</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <input
                  type="text"
                  value={ps.description}
                  onChange={(e) => onUpdate(ps.tempId, 'description', e.target.value)}
                  placeholder="e.g., Main intake pumping station"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pumping Main Diameter</label>
                <input
                  type="text"
                  value={ps.pumping_main_diameter}
                  onChange={(e) => onUpdate(ps.tempId, 'pumping_main_diameter', e.target.value)}
                  placeholder="e.g., 150mm or 6 inch"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pumping Main Distance (m)</label>
                <input
                  type="number"
                  value={ps.pumping_main_distance_m}
                  onChange={(e) => onUpdate(ps.tempId, 'pumping_main_distance_m', e.target.value)}
                  step="0.01"
                  placeholder="e.g., 500"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pumping Main Material</label>
                <select
                  value={ps.pumping_main_material}
                  onChange={(e) => onUpdate(ps.tempId, 'pumping_main_material', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select material...</option>
                  <option value="PVC">PVC (Polyvinyl Chloride)</option>
                  <option value="AC">AC (Asbestos Cement)</option>
                  <option value="GI">GI (Galvanized Iron)</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-medium text-gray-700">Pumps</h4>
                <button
                  type="button"
                  onClick={() => onAddPump(ps.tempId)}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add Pump
                </button>
              </div>

              {ps.pumps.map((pump: Pump, pumpIndex: number) => (
                <div key={pump.tempId} className="border border-gray-300 rounded-lg p-3 bg-white">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-sm font-medium text-gray-700">Pump {pumpIndex + 1}</span>
                    <button
                      type="button"
                      onClick={() => onRemovePump(ps.tempId, pump.tempId)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Pump Type</label>
                      <input
                        type="text"
                        value={pump.pump_type}
                        onChange={(e) => onUpdatePump(ps.tempId, pump.tempId, 'pump_type', e.target.value)}
                        placeholder="e.g., Centrifugal"
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Pump Head (m)</label>
                      <input
                        type="number"
                        value={pump.pump_head_m}
                        onChange={(e) => onUpdatePump(ps.tempId, pump.tempId, 'pump_head_m', e.target.value)}
                        step="0.1"
                        placeholder="e.g., 45"
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Design Flow (m³/hr)</label>
                      <input
                        type="number"
                        value={pump.pump_design_flow_m3_hr}
                        onChange={(e) => onUpdatePump(ps.tempId, pump.tempId, 'pump_design_flow_m3_hr', e.target.value)}
                        step="0.01"
                        placeholder="e.g., 50"
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Motor kW</label>
                      <input
                        type="number"
                        value={pump.motor_kw_rating}
                        onChange={(e) => onUpdatePump(ps.tempId, pump.tempId, 'motor_kw_rating', e.target.value)}
                        step="0.1"
                        placeholder="e.g., 15"
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Motor HP</label>
                      <input
                        type="number"
                        value={pump.motor_hp_rating}
                        onChange={(e) => onUpdatePump(ps.tempId, pump.tempId, 'motor_hp_rating', e.target.value)}
                        step="0.1"
                        placeholder="e.g., 20"
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Manufacturer</label>
                      <input
                        type="text"
                        value={pump.manufacturer}
                        onChange={(e) => onUpdatePump(ps.tempId, pump.tempId, 'manufacturer', e.target.value)}
                        placeholder="e.g., Grundfos"
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Installation Date</label>
                      <input
                        type="date"
                        value={pump.installation_date}
                        onChange={(e) => onUpdatePump(ps.tempId, pump.tempId, 'installation_date', e.target.value)}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                      <input
                        type="text"
                        value={pump.notes}
                        onChange={(e) => onUpdatePump(ps.tempId, pump.tempId, 'notes', e.target.value)}
                        placeholder="Additional notes..."
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {ps.pumps.length === 0 && (
                <p className="text-sm text-gray-500 italic">No pumps added yet</p>
              )}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={onAdd}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Pumping Station
        </button>
      </div>
    </SectionPanel>
  );
}

function OperatorsSection({ operators, isExpanded, onToggle, onAdd, onRemove, onUpdate }: any) {
  return (
    <SectionPanel title="D. Station Operators" isExpanded={isExpanded} onToggle={onToggle}>
      <div className="space-y-4">
        {operators.map((op: Operator, index: number) => (
          <div key={op.tempId} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-medium text-gray-900">Operator {index + 1}</h3>
              <button
                type="button"
                onClick={() => onRemove(op.tempId)}
                className="text-red-600 hover:text-red-800"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  value={op.full_name}
                  onChange={(e) => onUpdate(op.tempId, 'full_name', e.target.value)}
                  placeholder="e.g., John Doe"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
                <input
                  type="text"
                  value={op.position}
                  onChange={(e) => onUpdate(op.tempId, 'position', e.target.value)}
                  placeholder="e.g., Station Operator"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Employment Status</label>
                <select
                  value={op.employment_status}
                  onChange={(e) => onUpdate(op.tempId, 'employment_status', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Active">Active</option>
                  <option value="Transferred">Transferred</option>
                  <option value="Retired">Retired</option>
                  <option value="Resigned">Resigned</option>
                  <option value="Fired">Fired</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={op.start_date}
                  onChange={(e) => onUpdate(op.tempId, 'start_date', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={op.notes}
                  onChange={(e) => onUpdate(op.tempId, 'notes', e.target.value)}
                  rows={2}
                  placeholder="Additional notes..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={onAdd}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Operator
        </button>
      </div>
    </SectionPanel>
  );
}

function TreatmentUnitSection({ treatmentUnit, isExpanded, onToggle, onUpdate }: any) {
  return (
    <SectionPanel title="E. Treatment Units (Optional)" isExpanded={isExpanded} onToggle={onToggle}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Raw Water Abstraction Type</label>
          <input
            type="text"
            value={treatmentUnit.rw_abstraction_type}
            onChange={(e) => onUpdate({ ...treatmentUnit, rw_abstraction_type: e.target.value })}
            placeholder="e.g., Surface water / Borehole"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Sedimentation Tank Size (m³)</label>
          <input
            type="number"
            value={treatmentUnit.sedimentation_tank_size_m3}
            onChange={(e) => onUpdate({ ...treatmentUnit, sedimentation_tank_size_m3: e.target.value })}
            step="0.01"
            placeholder="e.g., 500"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Filter Type</label>
          <input
            type="text"
            value={treatmentUnit.filter_type}
            onChange={(e) => onUpdate({ ...treatmentUnit, filter_type: e.target.value })}
            placeholder="e.g., Rapid sand filter"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Filter Size</label>
          <input
            type="text"
            value={treatmentUnit.filter_size}
            onChange={(e) => onUpdate({ ...treatmentUnit, filter_size: e.target.value })}
            placeholder="e.g., 10m x 5m"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Backwash Tank Size (m³)</label>
          <input
            type="number"
            value={treatmentUnit.backwash_tank_size_m3}
            onChange={(e) => onUpdate({ ...treatmentUnit, backwash_tank_size_m3: e.target.value })}
            step="0.01"
            placeholder="e.g., 100"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Backwash System Type</label>
          <input
            type="text"
            value={treatmentUnit.backwash_system_type}
            onChange={(e) => onUpdate({ ...treatmentUnit, backwash_system_type: e.target.value })}
            placeholder="e.g., Automated / Manual"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
          <textarea
            value={treatmentUnit.notes}
            onChange={(e) => onUpdate({ ...treatmentUnit, notes: e.target.value })}
            rows={3}
            placeholder="Additional notes..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
    </SectionPanel>
  );
}

function ClientGroupsSection({ clientGroups, isExpanded, onToggle, onAdd, onRemove, onUpdate }: any) {
  return (
    <SectionPanel title="F. Station Client Groups (Optional / Placeholder)" isExpanded={isExpanded} onToggle={onToggle}>
      <div className="space-y-4">
        {clientGroups.map((cg: ClientGroup, index: number) => (
          <div key={cg.tempId} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-medium text-gray-900">Client Group {index + 1}</h3>
              <button
                type="button"
                onClick={() => onRemove(cg.tempId)}
                className="text-red-600 hover:text-red-800"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Client Category</label>
                <select
                  value={cg.category}
                  onChange={(e) => onUpdate(cg.tempId, 'category', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select category...</option>
                  <option value="Domestic">Domestic</option>
                  <option value="School">School</option>
                  <option value="Business">Business</option>
                  <option value="Industry">Industry</option>
                  <option value="Church">Church</option>
                  <option value="Parastatal">Parastatal</option>
                  <option value="Government">Government</option>
                  <option value="Local Government">Local Government</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Number of Clients</label>
                <input
                  type="number"
                  value={cg.number_of_clients}
                  onChange={(e) => onUpdate(cg.tempId, 'number_of_clients', e.target.value)}
                  placeholder="e.g., 150"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={cg.notes}
                  onChange={(e) => onUpdate(cg.tempId, 'notes', e.target.value)}
                  rows={2}
                  placeholder="Additional notes..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={onAdd}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Client Group
        </button>
      </div>
    </SectionPanel>
  );
}

function AssetsSection({ assets, isExpanded, onToggle, onAdd, onRemove, onUpdate }: any) {
  return (
    <SectionPanel title="G. Station Assets / Resources" isExpanded={isExpanded} onToggle={onToggle}>
      <div className="space-y-4">
        {assets.map((asset: StationAsset, index: number) => (
          <div key={asset.tempId} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-medium text-gray-900">Asset {index + 1}</h3>
              <button
                type="button"
                onClick={() => onRemove(asset.tempId)}
                className="text-red-600 hover:text-red-800"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Asset Type</label>
                <select
                  value={asset.asset_type}
                  onChange={(e) => onUpdate(asset.tempId, 'asset_type', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select type...</option>
                  <option value="Motorbike">Motorbike</option>
                  <option value="Bicycle">Bicycle</option>
                  <option value="Grass Cutter">Grass Cutter</option>
                  <option value="Generator">Generator</option>
                  <option value="Tools">Tools</option>
                  <option value="Safety Equipment">Safety Equipment</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Asset Name/Description</label>
                <input
                  type="text"
                  value={asset.asset_name}
                  onChange={(e) => onUpdate(asset.tempId, 'asset_name', e.target.value)}
                  placeholder="e.g., Honda CG125"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Registration/Serial Number</label>
                <input
                  type="text"
                  value={asset.registration_number}
                  onChange={(e) => onUpdate(asset.tempId, 'registration_number', e.target.value)}
                  placeholder="e.g., ABC-123 or Serial #12345"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Manufacturer/Brand</label>
                <input
                  type="text"
                  value={asset.manufacturer}
                  onChange={(e) => onUpdate(asset.tempId, 'manufacturer', e.target.value)}
                  placeholder="e.g., Honda, Yamaha, etc."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                <input
                  type="text"
                  value={asset.model}
                  onChange={(e) => onUpdate(asset.tempId, 'model', e.target.value)}
                  placeholder="e.g., CG125"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Purchase Date</label>
                <input
                  type="date"
                  value={asset.purchase_date}
                  onChange={(e) => onUpdate(asset.tempId, 'purchase_date', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Condition</label>
                <select
                  value={asset.condition}
                  onChange={(e) => onUpdate(asset.tempId, 'condition', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select condition...</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Poor">Poor</option>
                  <option value="Under Repair">Under Repair</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={asset.notes}
                  onChange={(e) => onUpdate(asset.tempId, 'notes', e.target.value)}
                  rows={2}
                  placeholder="Additional notes..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={onAdd}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Asset
        </button>
      </div>
    </SectionPanel>
  );
}

function LabEquipmentSection({ equipment, isExpanded, onToggle, onAdd, onRemove, onUpdate }: any) {
  return (
    <SectionPanel title="H. Laboratory Equipment" isExpanded={isExpanded} onToggle={onToggle}>
      <div className="space-y-4">
        {equipment.map((eq: LabEquipment, index: number) => (
          <div key={eq.tempId} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-medium text-gray-900">Lab Equipment {index + 1}</h3>
              <button
                type="button"
                onClick={() => onRemove(eq.tempId)}
                className="text-red-600 hover:text-red-800"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Equipment Name</label>
                <input
                  type="text"
                  value={eq.equipment_name}
                  onChange={(e) => onUpdate(eq.tempId, 'equipment_name', e.target.value)}
                  placeholder="e.g., Digital pH Meter"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Equipment Type</label>
                <select
                  value={eq.equipment_type}
                  onChange={(e) => onUpdate(eq.tempId, 'equipment_type', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select type...</option>
                  <option value="pH Meter">pH Meter</option>
                  <option value="Turbidity Meter">Turbidity Meter</option>
                  <option value="Chlorine Test Kit">Chlorine Test Kit</option>
                  <option value="Conductivity Meter">Conductivity Meter</option>
                  <option value="Dissolved Oxygen Meter">Dissolved Oxygen Meter</option>
                  <option value="Spectrophotometer">Spectrophotometer</option>
                  <option value="Test Tubes & Beakers">Test Tubes & Beakers</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Manufacturer/Brand</label>
                <input
                  type="text"
                  value={eq.manufacturer}
                  onChange={(e) => onUpdate(eq.tempId, 'manufacturer', e.target.value)}
                  placeholder="e.g., Hach, Hanna Instruments"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                <input
                  type="text"
                  value={eq.model}
                  onChange={(e) => onUpdate(eq.tempId, 'model', e.target.value)}
                  placeholder="e.g., HI98128"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Serial Number</label>
                <input
                  type="text"
                  value={eq.serial_number}
                  onChange={(e) => onUpdate(eq.tempId, 'serial_number', e.target.value)}
                  placeholder="e.g., SN123456789"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Calibration Date</label>
                <input
                  type="date"
                  value={eq.calibration_date}
                  onChange={(e) => onUpdate(eq.tempId, 'calibration_date', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Next Calibration Due</label>
                <input
                  type="date"
                  value={eq.calibration_due_date}
                  onChange={(e) => onUpdate(eq.tempId, 'calibration_due_date', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Condition</label>
                <select
                  value={eq.condition}
                  onChange={(e) => onUpdate(eq.tempId, 'condition', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select condition...</option>
                  <option value="Working">Working</option>
                  <option value="Needs Calibration">Needs Calibration</option>
                  <option value="Under Repair">Under Repair</option>
                  <option value="Not Working">Not Working</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={eq.notes}
                  onChange={(e) => onUpdate(eq.tempId, 'notes', e.target.value)}
                  rows={2}
                  placeholder="Additional notes..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={onAdd}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Lab Equipment
        </button>
      </div>
    </SectionPanel>
  );
}

function SparePartsSection({ parts, isExpanded, onToggle, onAdd, onRemove, onUpdate }: any) {
  return (
    <SectionPanel title="I. Spare Parts Inventory" isExpanded={isExpanded} onToggle={onToggle}>
      <div className="space-y-4">
        {parts.map((part: SparePart, index: number) => (
          <div key={part.tempId} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-medium text-gray-900">Spare Part {index + 1}</h3>
              <button
                type="button"
                onClick={() => onRemove(part.tempId)}
                className="text-red-600 hover:text-red-800"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Part Name</label>
                <input
                  type="text"
                  value={part.part_name}
                  onChange={(e) => onUpdate(part.tempId, 'part_name', e.target.value)}
                  placeholder="e.g., Pump Impeller"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={part.part_category}
                  onChange={(e) => onUpdate(part.tempId, 'part_category', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select category...</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Mechanical">Mechanical</option>
                  <option value="Plumbing">Plumbing</option>
                  <option value="Pump Parts">Pump Parts</option>
                  <option value="Valves">Valves</option>
                  <option value="Fittings">Fittings</option>
                  <option value="Filters">Filters</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Part Number</label>
                <input
                  type="text"
                  value={part.part_number}
                  onChange={(e) => onUpdate(part.tempId, 'part_number', e.target.value)}
                  placeholder="e.g., IMP-250-A"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quantity in Stock</label>
                <input
                  type="number"
                  value={part.quantity_in_stock}
                  onChange={(e) => onUpdate(part.tempId, 'quantity_in_stock', e.target.value)}
                  placeholder="e.g., 5"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Stock Level</label>
                <input
                  type="number"
                  value={part.minimum_stock_level}
                  onChange={(e) => onUpdate(part.tempId, 'minimum_stock_level', e.target.value)}
                  placeholder="e.g., 2"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Unit of Measure</label>
                <select
                  value={part.unit_of_measure}
                  onChange={(e) => onUpdate(part.tempId, 'unit_of_measure', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select unit...</option>
                  <option value="Pieces">Pieces</option>
                  <option value="Meters">Meters</option>
                  <option value="Liters">Liters</option>
                  <option value="Kilograms">Kilograms</option>
                  <option value="Sets">Sets</option>
                  <option value="Boxes">Boxes</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Supplier</label>
                <input
                  type="text"
                  value={part.supplier}
                  onChange={(e) => onUpdate(part.tempId, 'supplier', e.target.value)}
                  placeholder="e.g., ABC Pumps Ltd."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Restock Date</label>
                <input
                  type="date"
                  value={part.last_restock_date}
                  onChange={(e) => onUpdate(part.tempId, 'last_restock_date', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={part.notes}
                  onChange={(e) => onUpdate(part.tempId, 'notes', e.target.value)}
                  rows={2}
                  placeholder="Additional notes..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={onAdd}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Spare Part
        </button>
      </div>
    </SectionPanel>
  );
}
