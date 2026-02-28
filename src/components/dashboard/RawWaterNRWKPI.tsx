import { Droplets } from 'lucide-react';

export default function RawWaterNRWKPI() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Droplets className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-bold text-gray-800">Raw Water NRW</h3>
      </div>

      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mb-4">
          <Droplets className="w-7 h-7 text-blue-300" />
        </div>
        <p className="text-sm font-medium text-gray-500">Coming Soon</p>
        <p className="text-xs text-gray-400 mt-1 max-w-xs text-center">
          Raw water non-revenue water metrics will be available here once configured.
        </p>
      </div>
    </div>
  );
}
