const MAX_PASTE_ROWS = 10000;
const PASTE_CELL_TIMEOUT = 50;

export interface PasteConfig {
  isEditMode: boolean;
  onUpdate: (rowIndex: number, field: string, value: any) => void;
  getDirtyMap?: () => Set<string>;
  addDirtyCell?: (cellKey: string) => void;
  logger?: {
    info: (msg: string, data?: any) => void;
    warn: (msg: string, data?: any) => void;
    error: (msg: string, data?: any) => void;
  };
}

export interface FieldConfig {
  name: string;
  type: 'string' | 'number' | 'integer';
}

export interface RowValidator {
  (rowIndex: number): boolean;
}

export interface FieldValidator {
  (rowIndex: number, fieldName: string, value: any): boolean;
}

export interface FieldMapper {
  (fieldName: string, value: string): any;
}

const parseNumber = (value: string): number => {
  if (!value || value.trim() === '') return 0;
  const parsed = parseFloat(value.replace(/,/g, ''));
  return isNaN(parsed) ? 0 : parsed;
};

const parseInteger = (value: string): number => {
  if (!value || value.trim() === '') return 0;
  const parsed = parseInt(value.replace(/,/g, ''), 10);
  return isNaN(parsed) ? 0 : parsed;
};

const defaultFieldMapper: FieldMapper = (fieldName: string, value: string): any => {
  return value.trim();
};

export class PasteHandler {
  private config: PasteConfig;
  private fields: FieldConfig[];
  private rowValidator: RowValidator;
  private fieldValidator: FieldValidator;
  private fieldMapper: FieldMapper;
  private logger: NonNullable<PasteConfig['logger']>;

  constructor(
    config: PasteConfig,
    fields: FieldConfig[],
    rowValidator?: RowValidator,
    fieldValidator?: FieldValidator,
    fieldMapper?: FieldMapper
  ) {
    this.config = config;
    this.fields = fields;
    this.rowValidator = rowValidator || (() => true);
    this.fieldValidator = fieldValidator || (() => true);
    this.fieldMapper = fieldMapper || defaultFieldMapper;
    this.logger = config.logger || {
      info: () => {},
      warn: () => {},
      error: () => {}
    };
  }

  public async handlePaste(
    clipboardText: string,
    startRowIndex: number,
    startColIndex: number
  ): Promise<{ successCount: number; errorCount: number; message: string }> {
    const result = { successCount: 0, errorCount: 0, message: '' };

    try {
      if (!this.config.isEditMode) {
        this.logger.warn('Paste rejected: not in edit mode');
        result.message = 'Paste operation not allowed outside edit mode';
        return result;
      }

      if (!clipboardText || clipboardText.trim() === '') {
        this.logger.warn('Paste rejected: empty clipboard data');
        result.message = 'No data to paste';
        return result;
      }

      const rows = clipboardText
        .split(/\r?\n/)
        .map(row => row.trim())
        .filter(row => row !== '');

      if (rows.length === 0) {
        this.logger.warn('Paste rejected: no valid rows');
        result.message = 'No valid rows in clipboard data';
        return result;
      }

      if (rows.length > MAX_PASTE_ROWS) {
        this.logger.warn(`Paste size exceeded: ${rows.length} rows (max: ${MAX_PASTE_ROWS})`);
        result.message = `Paste size too large: ${rows.length} rows (max: ${MAX_PASTE_ROWS})`;
        result.errorCount = rows.length;
        return result;
      }

      this.logger.info(`Paste operation started: ${rows.length} rows, starting at [${startRowIndex}, ${startColIndex}]`);

      for (let rowOffset = 0; rowOffset < rows.length; rowOffset++) {
        const currentRowIndex = startRowIndex + rowOffset;

        if (!this.rowValidator(currentRowIndex)) {
          this.logger.warn(`Paste: row ${currentRowIndex} validation failed`);
          result.errorCount++;
          continue;
        }

        try {
          const rowCells = rows[rowOffset].split('\t');

          for (let colOffset = 0; colOffset < rowCells.length; colOffset++) {
            const currentColIndex = startColIndex + colOffset;

            if (currentColIndex >= this.fields.length) {
              this.logger.warn(
                `Paste: column ${currentColIndex} out of bounds (max: ${this.fields.length - 1})`
              );
              result.errorCount++;
              continue;
            }

            try {
              const field = this.fields[currentColIndex];
              if (!field) {
                result.errorCount++;
                continue;
              }

              if (!this.fieldValidator(currentRowIndex, field.name, rowCells[colOffset])) {
                this.logger.warn(
                  `Paste: field validation failed for [${currentRowIndex}, ${field.name}]`
                );
                result.errorCount++;
                continue;
              }

              const rawValue = rowCells[colOffset].trim();

              let processedValue: any = rawValue;
              if (field.type === 'number') {
                processedValue = parseNumber(rawValue);
              } else if (field.type === 'integer') {
                processedValue = parseInteger(rawValue);
              } else if (field.type === 'string') {
                processedValue = this.fieldMapper(field.name, rawValue);
              }

              if (processedValue === null || processedValue === undefined) {
                this.logger.warn(
                  `Paste: processing resulted in null/undefined for [${currentRowIndex}, ${field.name}]`
                );
                result.errorCount++;
                continue;
              }

              const cellKey = `${currentRowIndex}-${field.name}`;
              this.config.addDirtyCell?.(cellKey);
              this.config.onUpdate(currentRowIndex, field.name, processedValue);

              result.successCount++;
            } catch (cellError) {
              this.logger.error(
                `Paste: cell processing error at [${currentRowIndex}, ${currentColIndex}]`,
                cellError
              );
              result.errorCount++;
            }
          }
        } catch (rowError) {
          this.logger.error(`Paste: row processing error at index ${currentRowIndex}`, rowError);
          result.errorCount++;
        }
      }

      this.logger.info(`Paste completed: ${result.successCount} success, ${result.errorCount} errors`);
      result.message = `Pasted ${result.successCount} cells successfully${
        result.errorCount > 0 ? ` (${result.errorCount} errors)` : ''
      }`;
    } catch (error) {
      this.logger.error('Paste: critical error', error);
      result.message = 'Critical paste error occurred';
      result.errorCount++;
    }

    return result;
  }
}

export function createProductionDataPasteHandler(
  config: PasteConfig,
  isFullTreatment: boolean
): PasteHandler {
  const fields: FieldConfig[] = isFullTreatment
    ? [
        { name: 'rw_volume_m3', type: 'number' },
        { name: 'rw_hours_run', type: 'number' },
        { name: 'cw_volume_m3', type: 'number' },
        { name: 'cw_hours_run', type: 'number' },
        { name: 'load_shedding_hours', type: 'number' },
        { name: 'other_downtime_hours', type: 'number' },
        { name: 'reason_for_downtime', type: 'string' },
        { name: 'alum_kg', type: 'number' },
        { name: 'hth_kg', type: 'number' },
        { name: 'activated_carbon_kg', type: 'number' },
        { name: 'new_connections', type: 'integer' },
        { name: 'new_connection_category', type: 'string' },
        { name: 'meters_serviced', type: 'integer' },
      ]
    : [
        { name: 'cw_volume_m3', type: 'number' },
        { name: 'cw_hours_run', type: 'number' },
        { name: 'load_shedding_hours', type: 'number' },
        { name: 'other_downtime_hours', type: 'number' },
        { name: 'reason_for_downtime', type: 'string' },
        { name: 'new_connections', type: 'integer' },
        { name: 'new_connection_category', type: 'string' },
        { name: 'meters_serviced', type: 'integer' },
      ];

  return new PasteHandler(config, fields);
}
