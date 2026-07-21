// Minimal typing for the Tableau Extensions API, loaded at runtime via
// /tableau-extensions.min.js (proxied Tableau library).
// This only covers what this app calls.
export {};

interface TableauDataValue {
  value: unknown;
  formattedValue: string;
}

interface TableauDataColumn {
  fieldName: string;
  index: number;
}

interface TableauDataTable {
  columns: TableauDataColumn[];
  data: TableauDataValue[][];
  totalRowCount: number;
}

interface TableauWorksheet {
  name: string;
  getSummaryDataAsync: (options?: { maxRows?: number; ignoreSelection?: boolean }) => Promise<TableauDataTable>;
}

declare global {
  interface Window {
    tableau?: {
      extensions: {
        initializeAsync: () => Promise<void>;
        dashboardContent: {
          dashboard: {
            name: string;
            worksheets: TableauWorksheet[];
          };
        };
      };
    };
  }
}
