import { AlertTriangle, X, FlaskConical, Package } from 'lucide-react';

interface ChemicalValidationModalProps {
  items: Array<{ name: string; cwVolume: number; rwVolume: number }>;
  onAddChemicals: () => void;
  onContinue: () => void;
}

export default function ChemicalValidationModal({
  items,
  onAddChemicals,
  onContinue
}: ChemicalValidationModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col border-2 border-amber-500">
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-amber-500 bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Missing Chemical Data</h2>
              <p className="text-sm text-gray-600">
                {items.length} {items.length === 1 ? 'record has' : 'records have'} production volumes but no chemicals recorded
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 bg-amber-50 border-b border-amber-100">
          <p className="text-sm text-amber-800">
            The following records have water production volumes greater than zero, but no chemicals (Alum, HTH, or Activated Carbon) have been recorded.
            Please confirm whether chemicals were actually used.
          </p>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <Package className="w-4 h-4 text-amber-600" />
                      {item.name}
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {item.cwVolume > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">CW Volume:</span>
                          <span className="font-medium text-gray-900">{item.cwVolume} m³</span>
                        </div>
                      )}
                      {item.rwVolume > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">RW Volume:</span>
                          <span className="font-medium text-gray-900">{item.rwVolume} m³</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 flex-shrink-0">
                    <FlaskConical className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-amber-200">
                  <p className="text-xs text-amber-700 font-medium">
                    All chemical fields (Alum, HTH, Activated Carbon) are zero
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t-2 border-amber-500 bg-gradient-to-r from-amber-50 to-orange-50">
          <button
            onClick={onContinue}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Continue to Save
          </button>
          <button
            onClick={onAddChemicals}
            className="px-5 py-2.5 text-sm font-medium text-blue-900 bg-blue-300 rounded-lg hover:bg-blue-400 transition-colors shadow-md hover:shadow-lg"
          >
            <span className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4" />
              Add Chemicals
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
