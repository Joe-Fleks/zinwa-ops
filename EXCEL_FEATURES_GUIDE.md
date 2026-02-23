# Excel-Like Editing Features Guide

All legacy editing interfaces (Dams, Water Users, RW Database) now support Excel-like functionality for efficient data entry.

## Keyboard Navigation

### Arrow Keys
- **↑ Up Arrow**: Move to the cell above
- **↓ Down Arrow**: Move to the cell below
- **← Left Arrow**: Move to the previous cell (when cursor is at start of input)
- **→ Right Arrow**: Move to the next cell (when cursor is at end of input)

### Tab Navigation
- **Tab**: Move to the next cell (right, wraps to next row)
- **Shift + Tab**: Move to the previous cell (left, wraps to previous row)

### Enter Key
- **Enter**: Move to the cell below (same column)

## Copy & Paste

### Single Cell
- **Ctrl+C / Cmd+C**: Copy the current cell value
- **Ctrl+V / Cmd+V**: Paste into the current cell

### Multi-Cell Paste (Excel Grid Format)
1. Copy cells from Excel or spreadsheet (preserves tab-delimited format)
2. Click on target cell in the table
3. **Ctrl+V / Cmd+V**: Paste data
   - Automatically fills multiple cells
   - Respects row/column boundaries
   - Triggers change events for data validation

## Selection Behavior

- Click or Tab into any cell to select it
- Selected cell receives focus and input is highlighted
- Visual feedback shows which cell is active
- All keyboard shortcuts work relative to the selected cell

## Data Entry Tips

1. **Rapid Entry**: Use Tab to move quickly across columns
2. **Column Entry**: Use Enter to move down within a column
3. **Bulk Import**: Copy from Excel and paste to quickly populate multiple cells
4. **Navigation**: Use arrows for precise cell-by-cell movement

## Technical Notes

- All input types are supported (text, number, date, select)
- Changes trigger immediate validation
- Modified cells are tracked (yellow highlight for modified, blue for new)
- Read-only cells (like calculated fields) are automatically skipped
