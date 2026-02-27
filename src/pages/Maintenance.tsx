import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, BarChart3, Droplets, Waves, Wrench, Cog, Zap } from 'lucide-react';
import DamMaintenance from '../components/maintenance/DamMaintenance';
import NonFunctionalStations from '../components/maintenance/NonFunctionalStations';
import BreakdownsTracker from '../components/maintenance/BreakdownsTracker';
import CapacityVariance from '../components/maintenance/CapacityVariance';
import WaterLossesNRW from '../components/maintenance/WaterLossesNRW';
import EquipmentRegistry from '../components/maintenance/EquipmentRegistry';
import EnergyManagement from '../components/maintenance/EnergyManagement';

type TabKey = 'breakdowns' | 'non-functional' | 'capacity-variance' | 'nrw' | 'dams' | 'equipment' | 'energy';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'breakdowns', label: 'Breakdowns', icon: <Wrench className="w-5 h-5" /> },
  { key: 'non-functional', label: 'Non-func Stations', icon: <AlertTriangle className="w-5 h-5" /> },
  { key: 'capacity-variance', label: 'Cap. Variance', icon: <BarChart3 className="w-5 h-5" /> },
  { key: 'nrw', label: 'NRW', icon: <Droplets className="w-5 h-5" /> },
  { key: 'energy', label: 'Energy', icon: <Zap className="w-5 h-5" /> },
  { key: 'dams', label: 'Dam Maint.', icon: <Waves className="w-5 h-5" /> },
  { key: 'equipment', label: 'Equip. Reg.', icon: <Cog className="w-5 h-5" /> },
];

export default function Maintenance() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabKey>('non-functional');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && TABS.some(t => t.key === tab)) {
      setActiveTab(tab as TabKey);
    }
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-6 py-3 font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {tab.icon}
              <span>{tab.label}</span>
            </div>
          </button>
        ))}
      </div>

      {activeTab === 'breakdowns' && <BreakdownsTracker />}
      {activeTab === 'non-functional' && <NonFunctionalStations />}
      {activeTab === 'capacity-variance' && <CapacityVariance />}
      {activeTab === 'nrw' && <WaterLossesNRW />}
      {activeTab === 'energy' && <EnergyManagement />}
      {activeTab === 'dams' && <DamMaintenance />}
      {activeTab === 'equipment' && <EquipmentRegistry />}
    </div>
  );
}
