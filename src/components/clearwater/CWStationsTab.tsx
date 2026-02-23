import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, ListChecks, Clock } from 'lucide-react';
import TargetHoursForm from './TargetHoursForm';
import StationRegistryFAT from './StationRegistryFAT';

export default function CWStationsTab() {
  const navigate = useNavigate();
  const [showTargetHoursForm, setShowTargetHoursForm] = useState(false);

  if (showTargetHoursForm) {
    return <TargetHoursForm onClose={() => setShowTargetHoursForm(false)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-lg font-bold text-gray-900">Manage station registry</p>
        <div className="flex gap-3">
          <button
            onClick={() => setShowTargetHoursForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
          >
            <Clock className="w-4 h-4" />
            Target Daily Operating Hours
          </button>
          <button
            onClick={() => navigate('/clearwater/stations')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ListChecks className="w-4 h-4" />
            View Registry
          </button>
          <button
            onClick={() => navigate('/clearwater/stations/new')}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Register Station
          </button>
        </div>
      </div>

      <StationRegistryFAT />
    </div>
  );
}
