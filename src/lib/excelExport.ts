import * as XLSX from 'xlsx';

interface ExportColumn {
  header: string;
  field: string;
}

export function exportToExcel(
  data: Record<string, any>[],
  columns: ExportColumn[],
  filename: string
) {
  const rows = data.map(row =>
    columns.reduce((acc, col) => {
      acc[col.header] = row[col.field] ?? '';
      return acc;
    }, {} as Record<string, any>)
  );

  const worksheet = XLSX.utils.json_to_sheet(rows);

  const colWidths = columns.map(col => {
    const maxLen = Math.max(
      col.header.length,
      ...data.map(r => String(r[col.field] ?? '').length)
    );
    return { wch: Math.min(Math.max(maxLen + 2, 12), 40) };
  });
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
