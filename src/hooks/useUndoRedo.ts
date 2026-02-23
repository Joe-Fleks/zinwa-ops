import { useRef, useCallback, useState } from 'react';

interface HistoryEntry {
  index: number;
  field: string;
  oldValue: any;
  newValue: any;
}

export function useUndoRedo(maxSize: number = 100) {
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncFlags = useCallback(() => {
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  const pushChange = useCallback((index: number, field: string, oldValue: any, newValue: any) => {
    undoStack.current.push({ index, field, oldValue, newValue });
    if (undoStack.current.length > maxSize) {
      undoStack.current.shift();
    }
    redoStack.current = [];
    syncFlags();
  }, [maxSize, syncFlags]);

  const undo = useCallback((applyFn: (index: number, field: string, value: any) => void) => {
    if (undoStack.current.length === 0) return;
    const entry = undoStack.current.pop();
    if (entry) {
      redoStack.current.push(entry);
      applyFn(entry.index, entry.field, entry.oldValue);
      syncFlags();
    }
  }, [syncFlags]);

  const redo = useCallback((applyFn: (index: number, field: string, value: any) => void) => {
    if (redoStack.current.length === 0) return;
    const entry = redoStack.current.pop();
    if (entry) {
      undoStack.current.push(entry);
      applyFn(entry.index, entry.field, entry.newValue);
      syncFlags();
    }
  }, [syncFlags]);

  const clear = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
    syncFlags();
  }, [syncFlags]);

  return {
    pushChange,
    undo,
    redo,
    canUndo,
    canRedo,
    clear
  };
}
