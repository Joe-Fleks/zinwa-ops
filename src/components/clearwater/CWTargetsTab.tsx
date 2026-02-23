import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import TargetsTable from '../targets/TargetsTable';

type SubTab = 'production' | 'sales' | 'outputs' | 'demand';

interface CWTargetsTabProps {
  activeSubTab: SubTab;
}

interface Station {
  id: string;
  station_name: string;
}

interface Target {
  id: string;
  station_id: string;
  year: number;
  jan: number;
  feb: number;
  mar: number;
  apr: number;
  may: number;
  jun: number;
  jul: number;
  aug: number;
  sep: number;
  oct: number;
  nov: number;
  dec: number;
}

interface TargetRow {
  id: string;
  name: string;
  jan: number;
  feb: number;
  mar: number;
  apr: number;
  may: number;
  jun: number;
  jul: number;
  aug: number;
  sep: number;
  oct: number;
  nov: number;
  dec: number;
}

export default function CWTargetsTab({ activeSubTab }: CWTargetsTabProps) {
  const { accessContext } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [stations, setStations] = useState<Station[]>([]);
  const [productionTargets, setProductionTargets] = useState<TargetRow[]>([]);
  const [salesTargets, setSalesTargets] = useState<TargetRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadStations();
  }, [accessContext?.scopeId]);

  useEffect(() => {
    if (stations.length > 0) {
      loadTargets();
    }
  }, [year, stations, activeSubTab]);

  const loadStations = async () => {
    try {
      let query = supabase
        .from('stations')
        .select('id, station_name, service_centre_id')
        .order('station_name');

      if (accessContext?.isSCScoped && accessContext?.scopeId) {
        query = query.eq('service_centre_id', accessContext.scopeId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setStations(data || []);
    } catch (error) {
      console.error('Error loading stations:', error);
    }
  };

  const loadTargets = async () => {
    setIsLoading(true);
    try {
      const tableName = activeSubTab === 'production' ? 'cw_production_targets' : 'cw_sales_targets';

      let query = supabase
        .from(tableName)
        .select('*')
        .eq('year', year);

      const stationIds = stations.map(s => s.id);
      if (stationIds.length > 0) {
        query = query.in('station_id', stationIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      const targetsMap = new Map(
        (data || []).map((target: Target) => [target.station_id, target])
      );

      const rows: TargetRow[] = stations.map((station) => {
        const target = targetsMap.get(station.id);
        return {
          id: target?.id || `new-${station.id}`,
          name: station.station_name,
          jan: target?.jan || 0,
          feb: target?.feb || 0,
          mar: target?.mar || 0,
          apr: target?.apr || 0,
          may: target?.may || 0,
          jun: target?.jun || 0,
          jul: target?.jul || 0,
          aug: target?.aug || 0,
          sep: target?.sep || 0,
          oct: target?.oct || 0,
          nov: target?.nov || 0,
          dec: target?.dec || 0,
        };
      });

      if (activeSubTab === 'production') {
        setProductionTargets(rows);
      } else {
        setSalesTargets(rows);
      }
    } catch (error) {
      console.error('Error loading targets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveTargets = async (rows: TargetRow[]) => {
    try {
      const tableName = activeSubTab === 'production' ? 'cw_production_targets' : 'cw_sales_targets';

      const updates = rows.map((row, index) => {
        const station = stations[index];
        return {
          station_id: station.id,
          year,
          jan: row.jan,
          feb: row.feb,
          mar: row.mar,
          apr: row.apr,
          may: row.may,
          jun: row.jun,
          jul: row.jul,
          aug: row.aug,
          sep: row.sep,
          oct: row.oct,
          nov: row.nov,
          dec: row.dec,
        };
      });

      const { error } = await supabase
        .from(tableName)
        .upsert(updates, {
          onConflict: 'station_id,year',
        });

      if (error) throw error;

      await loadTargets();
    } catch (error) {
      console.error('Error saving targets:', error);
      throw error;
    }
  };

  const currentRows = activeSubTab === 'production' ? productionTargets : salesTargets;

  return (
    <div className="space-y-6">
      {activeSubTab === 'outputs' ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">Outputs section coming soon</p>
          <p className="text-sm mt-2">This section will display performance analytics and outputs</p>
        </div>
      ) : (
        <TargetsTable
          rows={currentRows}
          year={year}
          onYearChange={setYear}
          onSave={saveTargets}
          entityLabel="Station Name"
          totalLabel="SC Target"
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
