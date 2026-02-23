import { Undo, Redo } from 'lucide-react';

interface FETUndoRedoButtonsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export default function FETUndoRedoButtons({ canUndo, canRedo, onUndo, onRedo }: FETUndoRedoButtonsProps) {
  return (
    <div className="flex items-center gap-1 border border-gray-300 rounded-md overflow-hidden">
      <button
        onClick={onUndo}
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
        onClick={onRedo}
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
