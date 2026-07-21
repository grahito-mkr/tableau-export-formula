import ExcelJS from "exceljs";
import formulaConfig from "./formulaConfig.json";

export type Row = Record<string, unknown>;

export interface ExportPayload {
  sheetName?: string;
  columns: string[];
  rows: Row[];
}

// Map calculated-field column name -> Excel formula template.
// Reference other columns with {Column Name}; each is resolved to that
// column's letter + the current row (e.g. "{Quantity} / {Count of Orders}"
// on row 2 becomes "C2/B2"). Edit lib/formulaConfig.json to add mappings.
const FORMULA_MAP = formulaConfig as Record<string, string>;

const REF = /\{([^}]+)\}/g;

// 1 -> "A", 27 -> "AA", etc.
function columnLetter(index: number): string {
  let n = index;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function resolveFormula(
  template: string,
  excelRow: number,
  target: string,
  colLetter: Record<string, string>,
  columns: string[]
): string {
  return template.replace(REF, (_m, ref: string) => {
    const letter = colLetter[ref];
    if (!letter) {
      throw new Error(
        `Formula for "${target}" references unknown column "${ref}". ` +
          `Available columns: ${columns.join(", ")}`
      );
    }
    return `${letter}${excelRow}`;
  });
}

export async function buildWorkbook(payload: ExportPayload): Promise<ArrayBuffer> {
  const { columns, rows } = payload;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(payload.sheetName?.slice(0, 31) || "Export");

  const colLetter: Record<string, string> = {};
  columns.forEach((name, i) => {
    colLetter[name] = columnLetter(i + 1);
  });

  ws.addRow(columns);

  rows.forEach((row, r) => {
    const excelRow = r + 2;
    const values = columns.map((name) => {
      if (name in FORMULA_MAP) {
        return {
          formula: resolveFormula(FORMULA_MAP[name], excelRow, name, colLetter, columns)
        };
      }
      return row[name] ?? null;
    });
    ws.addRow(values);
  });

  const written = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  const src = new Uint8Array(written);
  const out = new ArrayBuffer(src.byteLength);
  new Uint8Array(out).set(src);
  return out;
}

export function getFormulaMap(): Record<string, string> {
  return FORMULA_MAP;
}
