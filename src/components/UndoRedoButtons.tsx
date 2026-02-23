import { Undo, Redo } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { GridApi } from 'ag-grid-community';

interface UndoRedoButtonsProps {
  gridApi: GridApi | null;
}

export default function UndoRedoButtons({ gridApi }: UndoRedoButtonsProps) {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    if (!gridApi) return;

    const updateState = () => {
      setCanUndo(gridApi.getCurrentUndoSize() > 0);
      setCanRedo(gridApi.getCurrentRedoSize() > 0);
    };

    updateState();

    const intervalId = setInterval(updateState, 100);

    return () => clearInterval(intervalId);
  }, [gridApi]);

  const handleUndo = () => {
    if (gridApi) {
      gridApi.undoCellEditing();
    }
  };

  const handleRedo = () => {
    if (gridApi) {
      gridApi.redoCellEditing();
    }
  };

  return (
    <div className="flex items-center gap-1 border border-gray-300 rounded-md overflow-hidden">
      <button
        onClick={handleUndo}
        disabled={!canUndo}
        className={`p-2 transition-colors ${
          canUndo
            ? 'bg-white hover:bg-gray-100 text-gray-700'
            : 'bg-gray-50 text-gray-300 cursor-not-allowed'
        }`}
        title="Undo (Ctrl+Z)"
      >
        <Undo className="w-4 h-4" />
      </button>
      <div className="w-px h-6 bg-gray-300" />
      <button
        onClick={handleRedo}
        disabled={!canRedo}
        className={`p-2 transition-colors ${
          canRedo
            ? 'bg-white hover:bg-gray-100 text-gray-700'
            : 'bg-gray-50 text-gray-300 cursor-not-allowed'
        }`}
        title="Redo (Ctrl+Y)"
      >
        <Redo className="w-4 h-4" />
      </button>
    </div>
  );
}
