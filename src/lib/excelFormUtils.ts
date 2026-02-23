export const handleKeyNavigation = (
  e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  currentRow: number,
  currentCol: number,
  totalRows: number,
  totalCols: number
) => {
  const target = e.target as HTMLInputElement;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const nextInput = document.querySelector(
      `[data-row="${currentRow + 1}"][data-col="${currentCol}"]`
    ) as HTMLInputElement;
    if (nextInput) nextInput.focus();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const prevInput = document.querySelector(
      `[data-row="${currentRow - 1}"][data-col="${currentCol}"]`
    ) as HTMLInputElement;
    if (prevInput) prevInput.focus();
  } else if (e.key === 'ArrowRight') {
    if (target.selectionStart === target.value.length) {
      e.preventDefault();
      const nextInput = document.querySelector(
        `[data-row="${currentRow}"][data-col="${currentCol + 1}"]`
      ) as HTMLInputElement;
      if (nextInput) nextInput.focus();
    }
  } else if (e.key === 'ArrowLeft') {
    if (target.selectionStart === 0) {
      e.preventDefault();
      const prevInput = document.querySelector(
        `[data-row="${currentRow}"][data-col="${currentCol - 1}"]`
      ) as HTMLInputElement;
      if (prevInput) prevInput.focus();
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const nextInput = document.querySelector(
      `[data-row="${currentRow + 1}"][data-col="${currentCol}"]`
    ) as HTMLInputElement;
    if (nextInput) {
      nextInput.focus();
    }
  } else if (e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault();
    let nextCol = currentCol + 1;
    let nextRow = currentRow;

    if (nextCol >= totalCols) {
      nextCol = 0;
      nextRow = currentRow + 1;
    }

    const nextInput = document.querySelector(
      `[data-row="${nextRow}"][data-col="${nextCol}"]`
    ) as HTMLInputElement;
    if (nextInput) nextInput.focus();
  } else if (e.key === 'Tab' && e.shiftKey) {
    e.preventDefault();
    let prevCol = currentCol - 1;
    let prevRow = currentRow;

    if (prevCol < 0) {
      prevCol = totalCols - 1;
      prevRow = currentRow - 1;
    }

    const prevInput = document.querySelector(
      `[data-row="${prevRow}"][data-col="${prevCol}"]`
    ) as HTMLInputElement;
    if (prevInput) prevInput.focus();
  }
};

export const excelCellClassName = "px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm w-full";

export const excelTableClassName = "w-full border-collapse";

export const excelHeaderClassName = "px-3 py-2 text-left text-xs font-semibold text-gray-700 bg-blue-50 border border-gray-300";

export const excelRowClassName = "hover:bg-gray-50 transition-colors";
