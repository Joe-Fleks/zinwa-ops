import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, BarChart3, Droplets, Waves, Wrench, Cog } from 'lucide-react';
import DamMaintenance from '../components/maintenance/DamMaintenance';
import NonFunctionalStations from '../components/maintenance/NonFunctionalStations';
import BreakdownsTracker from '../components/maintenance/BreakdownsTracker';
import CapacityVariance from '../components/maintenance/CapacityVariance';
import WaterLossesNRW from '../components/maintenance/WaterLossesNRW';
import EquipmentRegistry from '../components/maintenance/EquipmentRegistry';

type TabKey = 'breakdowns' | 'non-functional' | 'capacity-variance' | 'nrw' | 'dams' | 'equipment';

const TABS: { key: TabKey; label: string; shortLabel: string; icon: React.ReactNode }[] = [
  { key: 'breakdowns', label: 'Breakdowns Tracker', shortLabel: 'Breakdowns', icon: <Wrench className="w-5 h-5" /> },
  { key: 'non-functional', label: 'Non-functional Stations', shortLabel: 'Non-func Stations', icon: <AlertTriangle className="w-5 h-5" /> },
  { key: 'capacity-variance', label: 'Capacity Variance', shortLabel: 'Cap. Var.', icon: <BarChart3 className="w-5 h-5" /> },
  { key: 'nrw', label: 'Non-revenue Water', shortLabel: 'NRW', icon: <Droplets className="w-5 h-5" /> },
  { key: 'dams', label: 'Dam Maintenance', shortLabel: 'Dam Maint.', icon: <Waves className="w-5 h-5" /> },
  { key: 'equipment', label: 'Equipment Registry', shortLabel: 'Equip. Reg.', icon: <Cog className="w-5 h-5" /> },
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
              <span className="hidden min-[951px]:inline">{tab.label}</span>
              <span className="inline min-[951px]:hidden">{tab.shortLabel}</span>
            </div>
          </button>
        ))}
      </div>

      {activeTab === 'breakdowns' && <BreakdownsTracker />}
      {activeTab === 'non-functional' && <NonFunctionalStations />}
      {activeTab === 'capacity-variance' && <CapacityVariance />}
      {activeTab === 'nrw' && <WaterLossesNRW />}
      {activeTab === 'dams' && <DamMaintenance />}
      {activeTab === 'equipment' && <EquipmentRegistry />}
    </div>
  );
}
