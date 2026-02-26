import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, ListChecks, Clock, FlaskConical, PipetteIcon, Network } from 'lucide-react';
import TargetHoursForm from './TargetHoursForm';
import StationRegistryFAT from './StationRegistryFAT';
import TreatmentInfrastructure from './TreatmentInfrastructure';
import DistributionInfrastructure from './DistributionInfrastructure';
import DistributionNetwork from './DistributionNetwork';

type SubTab = 'registry' | 'treatment' | 'distribution' | 'network';

const SUB_TABS: { key: SubTab; label: string; shortLabel: string; icon: React.ReactNode }[] = [
  { key: 'registry', label: 'Station Registry', shortLabel: 'Registry', icon: <ListChecks className="w-4 h-4" /> },
  { key: 'treatment', label: 'Treatment Infrastructure', shortLabel: 'Treatment', icon: <FlaskConical className="w-4 h-4" /> },
  { key: 'distribution', label: 'Distribution Infrastructure', shortLabel: 'Distrib. Infra.', icon: <PipetteIcon className="w-4 h-4" /> },
  { key: 'network', label: 'Distribution Network', shortLabel: 'Network', icon: <Network className="w-4 h-4" /> },
];

export default function CWStationsTab() {
  const navigate = useNavigate();
  const [showTargetHoursForm, setShowTargetHoursForm] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('registry');

  if (showTargetHoursForm) {
    return <TargetHoursForm onClose={() => setShowTargetHoursForm(false)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex bg-gray-50 border border-gray-200 rounded-lg p-0.5 overflow-x-auto">
          {SUB_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveSubTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                activeSubTab === tab.key
                  ? 'bg-blue-100 text-blue-900 shadow-sm border border-blue-300'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              <span className="hidden min-[800px]:inline">{tab.label}</span>
              <span className="inline min-[800px]:hidden">{tab.shortLabel}</span>
            </button>
          ))}
        </div>

        {activeSubTab === 'registry' && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowTargetHoursForm(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-300 text-blue-900 rounded-lg hover:bg-blue-400 transition-colors text-sm"
            >
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">Target Daily Operating Hours</span>
              <span className="sm:hidden">Target Hrs</span>
            </button>
            <button
              onClick={() => navigate('/clearwater/stations')}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-300 text-blue-900 rounded-lg hover:bg-blue-400 transition-colors text-sm"
            >
              <ListChecks className="w-4 h-4" />
              <span className="hidden sm:inline">View Registry</span>
              <span className="sm:hidden">View</span>
            </button>
            <button
              onClick={() => navigate('/clearwater/stations/new')}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-300 text-blue-900 rounded-lg hover:bg-blue-400 transition-colors text-sm"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Register Station</span>
              <span className="sm:hidden">New</span>
            </button>
          </div>
        )}
      </div>

      {activeSubTab === 'registry' && <StationRegistryFAT />}
      {activeSubTab === 'treatment' && <TreatmentInfrastructure />}
      {activeSubTab === 'distribution' && <DistributionInfrastructure />}
      {activeSubTab === 'network' && <DistributionNetwork />}
    </div>
  );
}
