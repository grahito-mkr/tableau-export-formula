import ExcelJS from "exceljs";
import formulaConfig from "./formulaConfig.json";

export type Row = Record<string, unknown>;

export interface ExportPayload {
  sheetName?: string;
  columns: string[];
  rows: Row[];
}

// formulaConfig is structured as:
// {
//   "Worksheet Name": { "Column": "formula template" },
//   "__default": { "Column": "fallback formula" }
// }
// We look up by worksheet name first, then fall back to __default.
const CONFIG = formulaConfig as Record<string, Record<string, string>>;

function getFormulaMap(worksheetName: string): Record<string, string> {
  // First try exact worksheet name match
  if (worksheetName in CONFIG) {
    return CONFIG[worksheetName];
  }
  // Fall back to __default if worksheet not found
  return CONFIG["__default"] || {};
}

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
  const { columns, rows, sheetName } = payload;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName?.slice(0, 31) || "Export");

  const colLetter: Record<string, string> = {};
  columns.forEach((name, i) => {
    colLetter[name] = columnLetter(i + 1);
  });

  // Get formula map for this specific worksheet
  const FORMULA_MAP = getFormulaMap(sheetName || "");

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

export function getAllFormulaMappings(): Record<string, Record<string, string>> {
  return CONFIG;
}

export function getFormulaMapForWorksheet(worksheetName: string): Record<string, string> {
  return getFormulaMap(worksheetName);
}
