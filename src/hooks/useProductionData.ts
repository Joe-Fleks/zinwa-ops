import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNetwork } from '../contexts/NetworkContext';
import { getYesterdayString } from '../lib/dateUtils';
import {
  Station, RowData, DateRangeRowData, RowStatus, EntryMode,
  isDefaultValues, getRowStatus, getStatusCounts,
  generateDateRange, validateRow, checkMissingChemicals,
  buildLogData, createRowData, createDateRangeRowData
} from '../lib/productionUtils';

export interface SaveResults {
  success: number;
  failed: number;
  messages: string[];
}

export interface InvalidRow {
  name: string;
  errors: string[];
}

export interface MissingChemicalRow {
  name: string;
  cwVolume: number;
  rwVolume: number;
}

export function useProductionData() {
  const { user, accessContext } = useAuth();
  const { isOnline, showOfflineWarning } = useNetwork();

  const [entryMode, setEntryMode] = useState<EntryMode>('multi-station');
  const [selectedDate, setSelectedDate] = useState<string>(getYesterdayString());
  const [selectedStationId, setSelectedStationId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>(getYesterdayString());
  const [toDate, setToDate] = useState<string>(getYesterdayString());

  const [allStations, setAllStations] = useState<Station[]>([]);
  const [fullTreatmentStations, setFullTreatmentStations] = useState<Station[]>([]);
  const [boreholeStations, setBoreholeStations] = useState<Station[]>([]);
  const [fullTreatmentData, setFullTreatmentData] = useState<RowData[]>([]);
  const [boreholeData, setBoreholeData] = useState<RowData[]>([]);
  const [dateRangeData, setDateRangeData] = useState<DateRangeRowData[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveResults, setSaveResults] = useState<SaveResults | null>(null);
  const [statusFilter, setStatusFilter] = useState<RowStatus | 'all'>('all');
  const [editMode, setEditMode] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [invalidRows, setInvalidRows] = useState<InvalidRow[]>([]);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [showChemicalValidationModal, setShowChemicalValidationModal] = useState(false);
  const [missingChemicalRows, setMissingChemicalRows] = useState<MissingChemicalRow[]>([]);
  const [modifiedCount, setModifiedCount] = useState(0);

  const ftStationTypeMap = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    const map = new Map<string, boolean>();
    fullTreatmentStations.forEach(s => map.set(s.id, true));
    boreholeStations.forEach(s => map.set(s.id, false));
    ftStationTypeMap.current = map;
  }, [fullTreatmentStations, boreholeStations]);

  const ftIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    fullTreatmentData.forEach((row, i) => map.set(row.station_id, i));
    return map;
  }, [fullTreatmentData]);

  const bhIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    boreholeData.forEach((row, i) => map.set(row.station_id, i));
    return map;
  }, [boreholeData]);

  const drIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    dateRangeData.forEach((row, i) => map.set(row.date, i));
    return map;
  }, [dateRangeData]);

  useEffect(() => { loadStations(); }, []);

  useEffect(() => {
    if (entryMode === 'multi-station' && (fullTreatmentStations.length > 0 || boreholeStations.length > 0)) {
      loadMultiStationData();
    }
  }, [selectedDate, fullTreatmentStations, boreholeStations, entryMode]);

  useEffect(() => {
    if (entryMode === 'single-station' && selectedStationId && fromDate && toDate) {
      loadDateRangeData();
    }
  }, [selectedStationId, fromDate, toDate, entryMode]);

  const loadStations = async () => {
    try {
      let query = supabase
        .from('stations')
        .select('id, station_code, station_name, station_type')
        .order('station_name');

      if (accessContext?.isSCScoped && accessContext?.scopeId) {
        query = query.eq('service_centre_id', accessContext.scopeId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const stations = data || [];
      setAllStations(stations);
      setFullTreatmentStations(stations.filter(s => s.station_type === 'Full Treatment'));
      setBoreholeStations(stations.filter(s => s.station_type === 'Borehole'));
    } catch {
      alert('Failed to load stations');
    } finally {
      setLoading(false);
    }
  };

  const loadMultiStationData = async () => {
    try {
      const { data, error } = await supabase
        .from('production_logs')
        .select('*')
        .eq('date', selectedDate);

      if (error) throw error;

      const existingLogsMap = new Map((data || []).map(log => [log.station_id, log]));

      setFullTreatmentData(fullTreatmentStations.map(s => createRowData(s, selectedDate, existingLogsMap.get(s.id))));
      setBoreholeData(boreholeStations.map(s => createRowData(s, selectedDate, existingLogsMap.get(s.id))));
      setModifiedCount(0);
    } catch {
      // silent
    }
  };

  const loadDateRangeData = async () => {
    try {
      const dates = generateDateRange(fromDate, toDate);
      const { data, error } = await supabase
        .from('production_logs')
        .select('*')
        .eq('station_id', selectedStationId)
        .gte('date', fromDate)
        .lte('date', toDate);

      if (error) throw error;

      const existingLogsMap = new Map((data || []).map(log => [log.date, log]));
      setDateRangeData(dates.map(d => createDateRangeRowData(d, existingLogsMap.get(d))));
      setModifiedCount(0);
    } catch {
      // silent
    }
  };

  const updateRowData = useCallback((index: number, field: keyof RowData, value: any, isFullTreatment: boolean) => {
    if (index < 0) return;
    const setter = isFullTreatment ? setFullTreatmentData : setBoreholeData;
    setter(prev => {
      if (index >= prev.length) return prev;
      const row = { ...prev[index] };
      row[field] = value;
      if (!row.isModified) setModifiedCount(c => c + 1);
      row.isModified = true;
      row.isTouched = true;
      row.meta = { isEdited: true, isValid: true, hasSaveError: false };
      const updateData = [...prev];
      updateData[index] = row;
      return updateData;
    });
  }, []);

  const updateDateRangeRowData = useCallback((index: number, field: keyof DateRangeRowData, value: any) => {
    if (index < 0) return;
    setDateRangeData(prev => {
      if (index >= prev.length) return prev;
      const row = { ...prev[index] };
      row[field] = value;
      if (!row.isModified) setModifiedCount(c => c + 1);
      row.isModified = true;
      row.isTouched = true;
      row.meta = { isEdited: true, isValid: true, hasSaveError: false };
      const updateData = [...prev];
      updateData[index] = row;
      return updateData;
    });
  }, []);

  const updateRowsAfterSave = (rows: RowData[], insertedIds: Map<string, string> | null, isInsert: boolean) => {
    const stationIds = new Set(rows.map(r => r.station_id));
    const updateArray = (setter: React.Dispatch<React.SetStateAction<RowData[]>>) => {
      setter(prev => {
        let changed = false;
        const updated = prev.map(row => {
          if (!stationIds.has(row.station_id)) return row;
          changed = true;
          const newRow = { ...row, isModified: false, isTouched: false };
          if (isInsert && insertedIds) {
            const newId = insertedIds.get(row.station_id);
            if (newId) newRow.existing_log_id = newId;
          }
          newRow.meta = { isEdited: false, isValid: true, hasSaveError: false };
          return newRow;
        });
        return changed ? updated : prev;
      });
    };
    updateArray(setFullTreatmentData);
    updateArray(setBoreholeData);
  };

  const updateDateRowsAfterSave = (rows: DateRangeRowData[], insertedIds: Map<string, string> | null) => {
    const dates = new Set(rows.map(r => r.date));
    setDateRangeData(prev => {
      let changed = false;
      const updated = prev.map(row => {
        if (!dates.has(row.date)) return row;
        changed = true;
        const newRow = { ...row, isModified: false, isTouched: false };
        if (insertedIds) {
          const newId = insertedIds.get(row.date);
          if (newId) newRow.existing_log_id = newId;
        }
        newRow.meta = { isEdited: false, isValid: true, hasSaveError: false };
        return newRow;
      });
      return changed ? updated : prev;
    });
  };

  const saveMultiStationRows = async (
    modifiedRows: RowData[],
    saveMode: 'strict' | 'valid-only',
    invalidRowsList: InvalidRow[],
    messages: string[]
  ) => {
    let successCount = 0;
    let failedCount = 0;

    const invalidStationIds = new Set(invalidRowsList.map(r => {
      const found = modifiedRows.find(mr => mr.station_name === r.name);
      return found?.station_id;
    }).filter(Boolean));

    const rowsToSave = saveMode === 'valid-only'
      ? modifiedRows.filter(r => !invalidStationIds.has(r.station_id))
      : modifiedRows;

    if (saveMode === 'valid-only') failedCount = modifiedRows.length - rowsToSave.length;

    const toUpsert: Array<{ row: RowData; logData: any }> = [];
    const toInsert: Array<{ row: RowData; logData: any }> = [];

    for (const row of rowsToSave) {
      const logData = buildLogData(row, row.station_id, selectedDate, user?.id);
      if (row.existing_log_id) {
        toUpsert.push({ row, logData: { ...logData, id: row.existing_log_id } });
      } else {
        toInsert.push({ row, logData });
      }
    }

    if (toInsert.length > 0) {
      const BATCH_SIZE = 100;
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        const { data: insertedRows, error } = await supabase
          .from('production_logs')
          .insert(batch.map(b => b.logData))
          .select('id, station_id');

        if (error) {
          batch.forEach(item => messages.push(`${item.row.station_name}: ${error.message}`));
          failedCount += batch.length;
        } else {
          successCount += batch.length;
          if (insertedRows) {
            updateRowsAfterSave(batch.map(b => b.row), new Map(insertedRows.map(r => [r.station_id, r.id])), true);
          }
        }
      }
    }

    if (toUpsert.length > 0) {
      const BATCH_SIZE = 100;
      for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
        const batch = toUpsert.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('production_logs')
          .upsert(batch.map(b => b.logData), { onConflict: 'id' });

        if (error) {
          batch.forEach(item => messages.push(`${item.row.station_name}: ${error.message}`));
          failedCount += batch.length;
        } else {
          successCount += batch.length;
          updateRowsAfterSave(batch.map(b => b.row), null, false);
        }
      }
    }

    return { successCount, failedCount };
  };

  const saveDateRangeRows = async (
    modifiedRows: DateRangeRowData[],
    saveMode: 'strict' | 'valid-only',
    invalidRowsList: InvalidRow[],
    messages: string[]
  ) => {
    let successCount = 0;
    let failedCount = 0;

    const invalidDates = new Set(invalidRowsList.map(r => {
      const found = modifiedRows.find(mr => mr.dateDisplay === r.name);
      return found?.date;
    }).filter(Boolean));

    const rowsToSave = saveMode === 'valid-only'
      ? modifiedRows.filter(r => !invalidDates.has(r.date))
      : modifiedRows;

    if (saveMode === 'valid-only') failedCount = modifiedRows.length - rowsToSave.length;

    const toUpsert: Array<{ row: DateRangeRowData; logData: any }> = [];
    const toInsert: Array<{ row: DateRangeRowData; logData: any }> = [];

    for (const row of rowsToSave) {
      const logData = buildLogData(row, selectedStationId, row.date, user?.id);
      if (row.existing_log_id) {
        toUpsert.push({ row, logData: { ...logData, id: row.existing_log_id } });
      } else {
        toInsert.push({ row, logData });
      }
    }

    if (toInsert.length > 0) {
      const BATCH_SIZE = 100;
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        const { data: insertedRows, error } = await supabase
          .from('production_logs')
          .insert(batch.map(b => b.logData))
          .select('id, date');

        if (error) {
          batch.forEach(item => messages.push(`${item.row.dateDisplay}: ${error.message}`));
          failedCount += batch.length;
        } else {
          successCount += batch.length;
          if (insertedRows) {
            updateDateRowsAfterSave(batch.map(b => b.row), new Map(insertedRows.map(r => [r.date, r.id])));
          }
        }
      }
    }

    if (toUpsert.length > 0) {
      const BATCH_SIZE = 100;
      for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
        const batch = toUpsert.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('production_logs')
          .upsert(batch.map(b => b.logData), { onConflict: 'id' });

        if (error) {
          batch.forEach(item => messages.push(`${item.row.dateDisplay}: ${error.message}`));
          failedCount += batch.length;
        } else {
          successCount += batch.length;
          updateDateRowsAfterSave(batch.map(b => b.row), null);
        }
      }
    }

    return { successCount, failedCount };
  };

  const handleSave = async (saveMode: 'strict' | 'valid-only', skipChemicalValidation = false, flushFn?: () => void) => {
    if (!isOnline) { showOfflineWarning(); return; }

    flushFn?.();

    setSaving(true);
    setSaveResults(null);
    setSaveAttempted(true);

    try {
      const messages: string[] = [];
      const invalidRowsList: InvalidRow[] = [];
      const missingChemicalsList: MissingChemicalRow[] = [];

      if (entryMode === 'multi-station') {
        const allRows = [...fullTreatmentData, ...boreholeData];
        const modifiedRows = allRows.filter(row => row.isModified || row.existing_log_id);

        for (const row of modifiedRows) {
          const isFT = ftStationTypeMap.current.get(row.station_id) ?? false;
          const errors = validateRow(row, isFT);
          const criticalErrors = errors.filter(e => !e.startsWith('Warning:'));
          if (criticalErrors.length > 0) {
            invalidRowsList.push({ name: row.station_name, errors: criticalErrors });
          }
        }

        if (invalidRowsList.length > 0 && saveMode === 'strict') {
          setInvalidRows(invalidRowsList);
          setShowValidationModal(true);
          setSaving(false);
          return;
        }

        if (!skipChemicalValidation) {
          for (const row of modifiedRows) {
            const isFT = ftStationTypeMap.current.get(row.station_id) ?? false;
            if (isFT && checkMissingChemicals(row)) {
              missingChemicalsList.push({
                name: row.station_name,
                cwVolume: Number(row.cw_volume_m3 || 0),
                rwVolume: Number(row.rw_volume_m3 || 0)
              });
            }
          }
          if (missingChemicalsList.length > 0) {
            setMissingChemicalRows(missingChemicalsList);
            setShowChemicalValidationModal(true);
            setSaving(false);
            return;
          }
        }

        const { successCount, failedCount } = await saveMultiStationRows(modifiedRows, saveMode, invalidRowsList, messages);
        if (successCount > 0) setModifiedCount(prev => Math.max(0, prev - successCount));

        setSaveResults({ success: successCount, failed: failedCount, messages });
      } else {
        const modifiedRows = dateRangeData.filter(row => row.isModified || row.existing_log_id);
        const selectedStation = allStations.find(s => s.id === selectedStationId);
        const isFullTreatment = selectedStation?.station_type === 'Full Treatment';

        for (const row of modifiedRows) {
          const errors = validateRow(row, isFullTreatment ?? false);
          const criticalErrors = errors.filter(e => !e.startsWith('Warning:'));
          if (criticalErrors.length > 0) {
            invalidRowsList.push({ name: row.dateDisplay, errors: criticalErrors });
          }
        }

        if (invalidRowsList.length > 0 && saveMode === 'strict') {
          setInvalidRows(invalidRowsList);
          setShowValidationModal(true);
          setSaving(false);
          return;
        }

        if (!skipChemicalValidation && isFullTreatment) {
          for (const row of modifiedRows) {
            if (checkMissingChemicals(row)) {
              missingChemicalsList.push({
                name: row.dateDisplay,
                cwVolume: Number(row.cw_volume_m3 || 0),
                rwVolume: Number(row.rw_volume_m3 || 0)
              });
            }
          }
          if (missingChemicalsList.length > 0) {
            setMissingChemicalRows(missingChemicalsList);
            setShowChemicalValidationModal(true);
            setSaving(false);
            return;
          }
        }

        const { successCount, failedCount } = await saveDateRangeRows(modifiedRows, saveMode, invalidRowsList, messages);
        if (successCount > 0) setModifiedCount(prev => Math.max(0, prev - successCount));

        setSaveResults({ success: successCount, failed: failedCount, messages });
      }
    } catch {
      alert('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelChanges = useCallback(() => {
    setSaveResults(null);
    setSaveAttempted(false);
    setInvalidRows([]);
    setEditMode(false);
    setModifiedCount(0);
    if (entryMode === 'multi-station') {
      loadMultiStationData();
    } else if (entryMode === 'single-station') {
      loadDateRangeData();
    }
  }, [entryMode, selectedDate, fullTreatmentStations, boreholeStations, selectedStationId, fromDate, toDate]);

  const allData = useMemo(() =>
    entryMode === 'multi-station'
      ? [...fullTreatmentData, ...boreholeData]
      : dateRangeData,
    [entryMode, fullTreatmentData, boreholeData, dateRangeData]
  );

  const statusCounts = useMemo(() => getStatusCounts(allData), [allData]);
  const hasEditedRows = modifiedCount > 0;

  useEffect(() => {
    if (saveResults && saveResults.failed === 0 && !hasEditedRows) {
      setEditMode(false);
      const timer = setTimeout(() => setSaveResults(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [saveResults, hasEditedRows]);

  const filteredFullTreatmentData = useMemo(
    () => statusFilter === 'all' ? fullTreatmentData : fullTreatmentData.filter(row => getRowStatus(row) === statusFilter),
    [fullTreatmentData, statusFilter]
  );

  const filteredBoreholeData = useMemo(
    () => statusFilter === 'all' ? boreholeData : boreholeData.filter(row => getRowStatus(row) === statusFilter),
    [boreholeData, statusFilter]
  );

  const filteredDateRangeData = useMemo(
    () => statusFilter === 'all' ? dateRangeData : dateRangeData.filter(row => getRowStatus(row) === statusFilter),
    [dateRangeData, statusFilter]
  );

  const selectedStation = useMemo(
    () => allStations.find(s => s.id === selectedStationId),
    [allStations, selectedStationId]
  );

  const isSelectedStationFullTreatment = selectedStation?.station_type === 'Full Treatment';

  const filteredFtRef = useRef(filteredFullTreatmentData);
  filteredFtRef.current = filteredFullTreatmentData;
  const ftIndexMapRef = useRef(ftIndexMap);
  ftIndexMapRef.current = ftIndexMap;

  const filteredBhRef = useRef(filteredBoreholeData);
  filteredBhRef.current = filteredBoreholeData;
  const bhIndexMapRef = useRef(bhIndexMap);
  bhIndexMapRef.current = bhIndexMap;

  const filteredDrRef = useRef(filteredDateRangeData);
  filteredDrRef.current = filteredDateRangeData;
  const drIndexMapRef = useRef(drIndexMap);
  drIndexMapRef.current = drIndexMap;

  const handleFtUpdate = useCallback((index: number, field: keyof RowData, value: any) => {
    const filteredRow = filteredFtRef.current[index];
    if (!filteredRow) return;
    const actualIndex = ftIndexMapRef.current.get(filteredRow.station_id);
    if (actualIndex !== undefined) updateRowData(actualIndex, field, value, true);
  }, [updateRowData]);

  const handleBhUpdate = useCallback((index: number, field: keyof RowData, value: any) => {
    const filteredRow = filteredBhRef.current[index];
    if (!filteredRow) return;
    const actualIndex = bhIndexMapRef.current.get(filteredRow.station_id);
    if (actualIndex !== undefined) updateRowData(actualIndex, field, value, false);
  }, [updateRowData]);

  const handleDrUpdate = useCallback((index: number, field: keyof DateRangeRowData, value: any) => {
    const filteredRow = filteredDrRef.current[index];
    if (!filteredRow) return;
    const actualIndex = drIndexMapRef.current.get(filteredRow.date);
    if (actualIndex !== undefined) updateDateRangeRowData(actualIndex, field, value);
  }, [updateDateRangeRowData]);

  const changeEntryMode = useCallback((mode: EntryMode) => {
    setEntryMode(mode);
    setSaveResults(null);
    setStatusFilter('all');
  }, []);

  return {
    entryMode, changeEntryMode,
    selectedDate, setSelectedDate,
    selectedStationId, setSelectedStationId,
    fromDate, setFromDate,
    toDate, setToDate,
    allStations, fullTreatmentStations, boreholeStations,
    fullTreatmentData, boreholeData, dateRangeData,
    filteredFullTreatmentData, filteredBoreholeData, filteredDateRangeData,
    loading, saving, saveResults,
    statusFilter, setStatusFilter,
    editMode, setEditMode,
    showValidationModal, setShowValidationModal,
    invalidRows,
    saveAttempted,
    showChemicalValidationModal, setShowChemicalValidationModal,
    missingChemicalRows,
    modifiedCount,
    allData, statusCounts, hasEditedRows,
    selectedStation, isSelectedStationFullTreatment,
    handleFtUpdate, handleBhUpdate, handleDrUpdate,
    handleSave, handleCancelChanges,
  };
}
