import { useRef, useState, useCallback, useMemo } from 'react';
import { Save, AlertCircle, CheckCircle2, X, Undo2, Redo2, Calendar } from 'lucide-react';
import { ProductionDataGrid } from '../ProductionDataGrid';
import { MultiStationProductionGrid } from '../MultiStationProductionGrid';
import { ProductionDataEditTable, ProductionDataEditTableRef } from '../ProductionDataEditTable';
import { MultiStationProductionEditTable, MultiStationProductionEditTableRef } from '../MultiStationProductionEditTable';
import ChemicalValidationModal from './ChemicalValidationModal';
import { useProductionData } from '../../hooks/useProductionData';
import type { EntryMode, RowStatus } from '../../lib/productionUtils';

export default function ProductionDataTab() {
  const prod = useProductionData();

  const fullTreatmentTableRef = useRef<MultiStationProductionEditTableRef>(null);
  const boreholeTableRef = useRef<MultiStationProductionEditTableRef>(null);
  const dateRangeTableRef = useRef<ProductionDataEditTableRef>(null);

  const [ftUndoState, setFtUndoState] = useState({ canUndo: false, canRedo: false });
  const [bhUndoState, setBhUndoState] = useState({ canUndo: false, canRedo: false });
  const [drUndoState, setDrUndoState] = useState({ canUndo: false, canRedo: false });

  const handleFtUndoRedoChange = useCallback((canUndo: boolean, canRedo: boolean) => {
    setFtUndoState(prev => (prev.canUndo === canUndo && prev.canRedo === canRedo) ? prev : { canUndo, canRedo });
  }, []);
  const handleBhUndoRedoChange = useCallback((canUndo: boolean, canRedo: boolean) => {
    setBhUndoState(prev => (prev.canUndo === canUndo && prev.canRedo === canRedo) ? prev : { canUndo, canRedo });
  }, []);
  const handleDrUndoRedoChange = useCallback((canUndo: boolean, canRedo: boolean) => {
    setDrUndoState(prev => (prev.canUndo === canUndo && prev.canRedo === canRedo) ? prev : { canUndo, canRedo });
  }, []);

  const flushAll = useCallback(() => {
    if (prod.entryMode === 'multi-station') {
      fullTreatmentTableRef.current?.flushPendingEdits();
      boreholeTableRef.current?.flushPendingEdits();
    } else {
      dateRangeTableRef.current?.flushPendingEdits();
    }
  }, [prod.entryMode]);

  const handleSaveAndContinue = (saveMode: 'strict' | 'valid-only' = 'strict') =>
    prod.handleSave(saveMode, false, flushAll);

  const handleChemicalValidationContinue = async () => {
    prod.setShowChemicalValidationModal(false);
    await prod.handleSave('strict', true, flushAll);
  };

  const handleChemicalValidationAddChemicals = () => {
    prod.setShowChemicalValidationModal(false);
  };

  if (prod.loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading stations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-32">
      <div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
            <select
              value={prod.entryMode}
              onChange={(e) => prod.changeEntryMode(e.target.value as EntryMode)}
              className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="multi-station">Multiple Stations</option>
              <option value="single-station">Single Station</option>
            </select>

            {prod.entryMode === 'multi-station' && (
              <>
                <input
                  type="date"
                  value={prod.selectedDate}
                  onChange={(e) => prod.setSelectedDate(e.target.value)}
                  className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-28 sm:w-40"
                />
                <select
                  value={prod.statusFilter}
                  onChange={(e) => prod.setStatusFilter(e.target.value as RowStatus | 'all')}
                  className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-32 sm:w-52"
                >
                  <option value="all">All Stations ({prod.allData.length})</option>
                  <option value="unedited">Unedited Default ({prod.statusCounts.unedited})</option>
                  <option value="edited">Edited Not Saved ({prod.statusCounts.edited})</option>
                  <option value="saved">Saved ({prod.statusCounts.saved})</option>
                </select>
              </>
            )}

            {prod.entryMode === 'single-station' && (
              <>
                <select
                  value={prod.selectedStationId}
                  onChange={(e) => prod.setSelectedStationId(e.target.value)}
                  className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-28 sm:w-36 lg:w-52"
                  title="Station"
                >
                  <option value="">Station</option>
                  <optgroup label="Full Treatment">
                    {prod.fullTreatmentStations.map(station => (
                      <option key={station.id} value={station.id}>
                        {station.station_name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Borehole">
                    {prod.boreholeStations.map(station => (
                      <option key={station.id} value={station.id}>
                        {station.station_name}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <input
                  type="date"
                  value={prod.fromDate}
                  onChange={(e) => prod.setFromDate(e.target.value)}
                  className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-28 sm:w-32 lg:w-48"
                  title="From Date"
                />
                <input
                  type="date"
                  value={prod.toDate}
                  onChange={(e) => prod.setToDate(e.target.value)}
                  className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-28 sm:w-32 lg:w-48"
                  title="To Date"
                />
                <select
                  value={prod.statusFilter}
                  onChange={(e) => prod.setStatusFilter(e.target.value as RowStatus | 'all')}
                  className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-28 sm:w-36 lg:w-64"
                >
                  <option value="all">All Days ({prod.allData.length})</option>
                  <option value="unedited">Unedited Default ({prod.statusCounts.unedited})</option>
                  <option value="edited">Edited Not Saved ({prod.statusCounts.edited})</option>
                  <option value="saved">Saved ({prod.statusCounts.saved})</option>
                </select>
              </>
            )}

            <div className="flex-1"></div>

            {!prod.editMode ? (
              <button
                onClick={() => prod.setEditMode(true)}
                className="px-3 py-1.5 text-xs sm:text-sm rounded-lg border-2 border-blue-400 bg-blue-300 text-blue-900 hover:bg-blue-400 transition-all font-medium whitespace-nowrap"
                title="Click to enable editing"
              >
                Edit
              </button>
            ) : (
              <button
                onClick={prod.handleCancelChanges}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg border-2 border-blue-400 bg-blue-300 text-blue-900 hover:bg-blue-400 transition-all font-medium whitespace-nowrap"
                title="Cancel changes and return to read-only mode"
              >
                <X className="w-3 sm:w-4 h-3 sm:h-4" />
                <span>Cancel</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">

        {prod.entryMode === 'multi-station' && (
          <>
            {prod.fullTreatmentStations.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-bold text-gray-900">
                    Full Treatment Stations ({prod.filteredFullTreatmentData.length}{prod.statusFilter !== 'all' ? ` of ${prod.fullTreatmentData.length}` : ''})
                  </h2>
                  {prod.editMode && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => fullTreatmentTableRef.current?.undo()}
                        disabled={!ftUndoState.canUndo}
                        className="p-1.5 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Undo"
                      >
                        <Undo2 className="w-4 h-4 text-gray-700" />
                      </button>
                      <button
                        onClick={() => fullTreatmentTableRef.current?.redo()}
                        disabled={!ftUndoState.canRedo}
                        className="p-1.5 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Redo"
                      >
                        <Redo2 className="w-4 h-4 text-gray-700" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="pb-2 border-b-2 border-blue-600 mb-4"></div>
                {prod.filteredFullTreatmentData.length > 0 ? (
                  prod.editMode ? (
                    <MultiStationProductionEditTable
                      ref={fullTreatmentTableRef}
                      data={prod.filteredFullTreatmentData}
                      onUpdate={prod.handleFtUpdate}
                      isFullTreatment={true}
                      onUndoRedoStateChange={handleFtUndoRedoChange}
                    />
                  ) : (
                    <MultiStationProductionGrid
                      data={prod.filteredFullTreatmentData}
                      onUpdate={prod.handleFtUpdate}
                      isFullTreatment={true}
                      editMode={prod.editMode}
                    />
                  )
                ) : prod.statusFilter !== 'all' ? (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm">No full treatment stations match the selected filter</p>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm">No data available for this date</p>
                  </div>
                )}
              </div>
            )}

            {prod.boreholeStations.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-bold text-gray-900">
                    Borehole Stations ({prod.filteredBoreholeData.length}{prod.statusFilter !== 'all' ? ` of ${prod.boreholeData.length}` : ''})
                  </h2>
                  {prod.editMode && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => boreholeTableRef.current?.undo()}
                        disabled={!bhUndoState.canUndo}
                        className="p-1.5 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Undo"
                      >
                        <Undo2 className="w-4 h-4 text-gray-700" />
                      </button>
                      <button
                        onClick={() => boreholeTableRef.current?.redo()}
                        disabled={!bhUndoState.canRedo}
                        className="p-1.5 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Redo"
                      >
                        <Redo2 className="w-4 h-4 text-gray-700" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="pb-2 border-b-2 border-green-600 mb-4"></div>
                {prod.filteredBoreholeData.length > 0 ? (
                  prod.editMode ? (
                    <MultiStationProductionEditTable
                      ref={boreholeTableRef}
                      data={prod.filteredBoreholeData}
                      onUpdate={prod.handleBhUpdate}
                      isFullTreatment={false}
                      onUndoRedoStateChange={handleBhUndoRedoChange}
                    />
                  ) : (
                    <MultiStationProductionGrid
                      data={prod.filteredBoreholeData}
                      onUpdate={prod.handleBhUpdate}
                      isFullTreatment={false}
                      editMode={prod.editMode}
                    />
                  )
                ) : prod.statusFilter !== 'all' ? (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm">No borehole stations match the selected filter</p>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm">No data available for this date</p>
                  </div>
                )}
              </div>
            )}

            {prod.fullTreatmentStations.length === 0 && prod.boreholeStations.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg font-medium mb-2">No stations registered</p>
                <p className="text-sm">Register stations before entering production data</p>
              </div>
            )}
          </>
        )}

        {prod.entryMode === 'single-station' && (
          <>
            {!prod.selectedStationId ? (
              <div className="text-center py-12 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium mb-2">Select a station to begin</p>
                <p className="text-sm">Choose a station and date range to start entering production data</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-bold text-gray-900">
                    {prod.selectedStation?.station_name} - Production Data ({prod.filteredDateRangeData.length}{prod.statusFilter !== 'all' ? ` of ${prod.dateRangeData.length}` : ''} days)
                  </h2>
                  {prod.editMode && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => dateRangeTableRef.current?.undo()}
                        disabled={!drUndoState.canUndo}
                        className="p-1.5 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Undo"
                      >
                        <Undo2 className="w-4 h-4 text-gray-700" />
                      </button>
                      <button
                        onClick={() => dateRangeTableRef.current?.redo()}
                        disabled={!drUndoState.canRedo}
                        className="p-1.5 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Redo"
                      >
                        <Redo2 className="w-4 h-4 text-gray-700" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="pb-2 border-b-2 border-blue-600 mb-4"></div>
                {prod.filteredDateRangeData.length > 0 ? (
                  prod.editMode ? (
                    <ProductionDataEditTable
                      ref={dateRangeTableRef}
                      data={prod.filteredDateRangeData}
                      onUpdate={prod.handleDrUpdate}
                      isFullTreatment={prod.isSelectedStationFullTreatment}
                      onUndoRedoStateChange={handleDrUndoRedoChange}
                    />
                  ) : (
                    <ProductionDataGrid
                      data={prod.filteredDateRangeData}
                      onUpdate={prod.handleDrUpdate}
                      isFullTreatment={prod.isSelectedStationFullTreatment}
                      editMode={prod.editMode}
                    />
                  )
                ) : prod.statusFilter !== 'all' ? (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm">No days match the selected filter</p>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm">No data available for the selected date range</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {prod.showChemicalValidationModal && (
        <ChemicalValidationModal
          items={prod.missingChemicalRows}
          onAddChemicals={handleChemicalValidationAddChemicals}
          onContinue={handleChemicalValidationContinue}
        />
      )}

      {prod.showValidationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-red-600" />
                <h2 className="text-xl font-bold text-gray-900">Validation Errors Found</h2>
              </div>
              <button
                onClick={() => prod.setShowValidationModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <p className="text-gray-700 mb-4">
                The following {prod.invalidRows.length} {prod.invalidRows.length === 1 ? 'row has' : 'rows have'} validation errors.
                Please correct them before saving.
              </p>
              <div className="space-y-4">
                {prod.invalidRows.map((row, idx) => (
                  <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h3 className="font-semibold text-red-900 mb-2">{row.name}</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {row.errors.map((error, errorIdx) => (
                        <li key={errorIdx} className="text-sm text-red-700">{error}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => prod.setShowValidationModal(false)}
                className="px-6 py-2 bg-blue-300 text-blue-900 rounded-lg hover:bg-blue-400 transition-colors font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {(prod.hasEditedRows || prod.saveResults) && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex-1">
                {prod.saveResults && (
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${prod.saveResults.failed === 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    {prod.saveResults.failed === 0 ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    )}
                    <span className={`text-sm font-medium ${prod.saveResults.failed === 0 ? 'text-green-700' : 'text-red-700'}`}>
                      Saved: {prod.saveResults.success}
                      {prod.saveResults.failed > 0 && <> | Failed: {prod.saveResults.failed}</>}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:ml-auto">
                <button
                  onClick={prod.handleCancelChanges}
                  disabled={prod.saving}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-300 text-blue-900 rounded-lg hover:bg-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  title="Discard all changes and reload data"
                >
                  <X className="w-5 h-5" />
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveAndContinue('strict')}
                  disabled={prod.saving || !prod.hasEditedRows}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-300 text-blue-900 rounded-lg hover:bg-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  title={!prod.hasEditedRows ? "Make changes to data first" : "Save all rows (aborts if any validation errors)"}
                >
                  {prod.saving ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Save
                    </>
                  )}
                </button>
                {prod.saveAttempted && prod.invalidRows.length > 0 && (
                  <button
                    onClick={() => handleSaveAndContinue('valid-only')}
                    disabled={prod.saving}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-300 text-blue-900 rounded-lg hover:bg-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                    title="Save only valid rows, preserve invalid rows for correction"
                  >
                    {prod.saving ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="hidden sm:inline">Save Valid Rows Only</span>
                        <span className="sm:hidden">Save Valid</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
