import { Clock } from 'lucide-react';

export default function MeanTimeBetweenFailuresKPI() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-orange-600" />
        <h3 className="text-sm font-bold text-gray-800">Mean Time Between Failures (MTBF)</h3>
      </div>

      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center mb-4">
          <Clock className="w-7 h-7 text-orange-300" />
        </div>
        <p className="text-sm font-medium text-gray-500">Coming Soon</p>
        <p className="text-xs text-gray-400 mt-1 max-w-xs text-center">
          MTBF metrics will be available here once configured.
        </p>
      </div>
    </div>
  );
}
