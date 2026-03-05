import { useState, useCallback, RefObject } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { Search, X, ChevronDown } from 'lucide-react';

interface ColumnOption {
  label: string;
  field: string;
}

interface TableColumnSearchProps {
  columns: ColumnOption[];
  gridRef: RefObject<AgGridReact | null>;
}

export default function TableColumnSearch({ columns, gridRef }: TableColumnSearchProps) {
  const [selectedColumn, setSelectedColumn] = useState(columns[0]?.field || '');
  const [searchText, setSearchText] = useState('');

  const applyFilter = useCallback((field: string, value: string) => {
    const api = gridRef.current?.api;
    if (!api) return;

    api.setFilterModel(null);

    if (value) {
      const model: Record<string, unknown> = {};
      model[field] = { type: 'contains', filter: value, filterType: 'text' };
      api.setFilterModel(model);
    }

    api.onFilterChanged();
  }, [gridRef]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchText(value);
    applyFilter(selectedColumn, value);
  }, [selectedColumn, applyFilter]);

  const handleColumnChange = useCallback((field: string) => {
    setSelectedColumn(field);
    if (searchText) {
      applyFilter(field, searchText);
    }
  }, [searchText, applyFilter]);

  const handleClear = useCallback(() => {
    setSearchText('');
    const api = gridRef.current?.api;
    if (!api) return;
    api.setFilterModel(null);
    api.onFilterChanged();
  }, [gridRef]);

  const selectedLabel = columns.find(c => c.field === selectedColumn)?.label || '';

  return (
    <div className="relative flex items-center bg-white border border-gray-300 rounded-lg overflow-hidden shadow-sm hover:border-gray-400 transition-colors focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
      <div className="relative">
        <select
          value={selectedColumn}
          onChange={(e) => handleColumnChange(e.target.value)}
          className="appearance-none pl-3 pr-7 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 border-r border-gray-300 cursor-pointer hover:bg-gray-100 focus:outline-none"
          style={{ minWidth: '140px' }}
        >
          {columns.map(col => (
            <option key={col.field} value={col.field}>{col.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
      </div>

      <div className="flex items-center flex-1">
        <Search className="w-4 h-4 text-gray-400 ml-2.5 flex-shrink-0" />
        <input
          type="text"
          value={searchText}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={`Search by ${selectedLabel}...`}
          className="w-full px-2 py-1.5 text-sm border-0 focus:outline-none focus:ring-0"
          style={{ minWidth: '180px' }}
        />
        {searchText && (
          <button
            onClick={handleClear}
            className="p-1 mr-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
