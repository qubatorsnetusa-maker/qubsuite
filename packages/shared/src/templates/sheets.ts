import { parseA1, parseCellKey, Workbook, type CellState } from '../formula';
import type { CellRange, CellStyle } from '../schemas/sheets';
import type { SheetTemplate, SheetTemplateSheet } from './types';

const HEADER: CellStyle = { bold: true, background: '#e8f0fe' };
const TITLE: CellStyle = { bold: true, fontSize: 18 };
const NOTE: CellStyle = { italic: true, color: '#5f6368' };
const TOTAL: CellStyle = { bold: true, background: '#f1f3f4' };
const CURRENCY: CellStyle = { numberFormat: 'currency' };
const PERCENT: CellStyle = { numberFormat: 'percent' };

export const SHEET_TEMPLATES: SheetTemplate[] = [
  {
    id: 'sheet-monthly-budget',
    app: 'SPREADSHEET',
    name: 'Monthly Budget',
    subtitle: 'Planned vs. actual',
    category: 'Personal',
    sheets: [
      {
        name: 'Budget',
        colWidths: { 0: 220, 1: 120, 2: 120, 3: 120 },
        rows: [
          ['Monthly budget'],
          ['Enter planned and actual amounts — totals and differences update automatically.'],
          [],
          ['Income', 'Planned', 'Actual', 'Difference'],
          ['Salary', 4200, 4200, '=C5-B5'],
          ['Side income', 600, 450, '=C6-B6'],
          ['Other', 0, 120, '=C7-B7'],
          ['Total income', '=SUM(B5:B7)', '=SUM(C5:C7)', '=C8-B8'],
          [],
          ['Expenses', 'Planned', 'Actual', 'Difference'],
          ['Housing', 1500, 1500, '=B11-C11'],
          ['Groceries', 450, 512, '=B12-C12'],
          ['Transport', 200, 176, '=B13-C13'],
          ['Utilities', 180, 192, '=B14-C14'],
          ['Insurance', 120, 120, '=B15-C15'],
          ['Savings', 800, 800, '=B16-C16'],
          ['Entertainment', 150, 210, '=B17-C17'],
          ['Other', 100, 64, '=B18-C18'],
          ['Total expenses', '=SUM(B11:B18)', '=SUM(C11:C18)', '=B19-C19'],
          [],
          ['Left over (income − expenses)', '=B8-B19', '=C8-C19', '=C21-B21'],
        ],
        styles: [
          { range: 'A1', style: TITLE },
          { range: 'A2', style: NOTE },
          { range: 'A4:D4', style: HEADER },
          { range: 'A10:D10', style: HEADER },
          { range: 'B5:D21', style: CURRENCY },
          { range: 'A8:D8', style: TOTAL },
          { range: 'A19:D19', style: TOTAL },
          { range: 'A21:D21', style: { bold: true, background: '#e6f4ea' } },
        ],
      },
    ],
  },
  {
    id: 'sheet-todo-list',
    app: 'SPREADSHEET',
    name: 'To-do List',
    subtitle: 'Track progress',
    category: 'Personal',
    sheets: [
      {
        name: 'Tasks',
        frozenRows: 5,
        colWidths: { 0: 120, 1: 280, 2: 110, 3: 90, 4: 240 },
        rows: [
          ['To-do list'],
          ['Completed', '=COUNTIF(A6:A200,"Done")', 'Remaining', '=COUNTA(B6:B200)-B2'],
          ['Progress', '=IF(COUNTA(B6:B200)=0,0,B2/COUNTA(B6:B200))'],
          ['Set Status to "Done" when you finish a task.'],
          ['Status', 'Task', 'Due date', 'Priority', 'Notes'],
          ['Done', 'Write down everything you need to do', '', 'High', ''],
          ['In progress', 'Add a due date and priority to each task', '', 'Medium', ''],
          ['Not started', 'Sort by due date to plan your week', '', 'Low', ''],
        ],
        styles: [
          { range: 'A1', style: TITLE },
          { range: 'A2:A3', style: { bold: true } },
          { range: 'C2', style: { bold: true } },
          { range: 'B3', style: PERCENT },
          { range: 'A4', style: NOTE },
          { range: 'A5:E5', style: HEADER },
        ],
      },
    ],
  },
  {
    id: 'sheet-invoice',
    app: 'SPREADSHEET',
    name: 'Invoice',
    subtitle: 'Line items and tax',
    category: 'Work',
    sheets: [
      {
        name: 'Invoice',
        colWidths: { 0: 280, 1: 90, 2: 120, 3: 130 },
        rows: [
          ['INVOICE'],
          ['Your Company Name'],
          ['Street Address, City, State ZIP'],
          [],
          ['Bill to', '', 'Invoice #', 'INV-0001'],
          ['Client Name', '', 'Date', ''],
          ['Client Address', '', 'Due', ''],
          [],
          ['Description', 'Qty', 'Unit price', 'Amount'],
          ['Service or product', 1, 500, '=B10*C10'],
          ['Service or product', 2, 125, '=B11*C11'],
          ['Service or product', 0, 0, '=B12*C12'],
          ['Service or product', 0, 0, '=B13*C13'],
          [],
          ['', '', 'Subtotal', '=SUM(D10:D13)'],
          ['', '', 'Tax rate', 0.08],
          ['', '', 'Tax', '=ROUND(D15*D16,2)'],
          ['', '', 'Total due', '=D15+D17'],
          [],
          ['Thank you for your business. Payment is due within 30 days.'],
        ],
        styles: [
          { range: 'A1', style: { bold: true, fontSize: 24, color: '#1a73e8' } },
          { range: 'A2', style: { bold: true } },
          { range: 'A5', style: { bold: true } },
          { range: 'C5:C7', style: { bold: true, align: 'right' } },
          { range: 'A9:D9', style: HEADER },
          { range: 'C10:D15', style: CURRENCY },
          { range: 'C15:C18', style: { bold: true, align: 'right' } },
          { range: 'D16', style: PERCENT },
          { range: 'D17', style: CURRENCY },
          { range: 'C18:D18', style: { ...TOTAL, numberFormat: 'currency' } },
          { range: 'A20', style: NOTE },
        ],
      },
    ],
  },
  {
    id: 'sheet-project-tracker',
    app: 'SPREADSHEET',
    name: 'Project Tracker',
    subtitle: 'Status overview',
    category: 'Work',
    sheets: [
      {
        name: 'Tracker',
        frozenRows: 7,
        colWidths: { 0: 260, 1: 140, 2: 120, 3: 110, 4: 110, 5: 100 },
        rows: [
          ['Project tracker'],
          ['Not started', '=COUNTIF(C8:C200,"Not started")'],
          ['In progress', '=COUNTIF(C8:C200,"In progress")'],
          ['Done', '=COUNTIF(C8:C200,"Done")'],
          ['Average progress', '=IFERROR(AVERAGE(F8:F200),0)'],
          [],
          ['Task', 'Owner', 'Status', 'Start', 'Due', 'Progress'],
          ['Kick-off and planning', 'Name', 'Done', '', '', 1],
          ['Research', 'Name', 'In progress', '', '', 0.6],
          ['Design', 'Name', 'In progress', '', '', 0.25],
          ['Build', 'Name', 'Not started', '', '', 0],
          ['Review and launch', 'Name', 'Not started', '', '', 0],
        ],
        styles: [
          { range: 'A1', style: TITLE },
          { range: 'A2:A5', style: { bold: true } },
          { range: 'B5', style: PERCENT },
          { range: 'A7:F7', style: HEADER },
          { range: 'F8:F12', style: PERCENT },
        ],
      },
    ],
  },
  {
    id: 'sheet-weekly-schedule',
    app: 'SPREADSHEET',
    name: 'Weekly Schedule',
    subtitle: 'Hour by hour',
    category: 'Personal',
    sheets: [
      {
        name: 'Schedule',
        frozenRows: 3,
        colWidths: { 0: 90, 1: 130, 2: 130, 3: 130, 4: 130, 5: 130, 6: 130, 7: 130 },
        rows: [
          ['Weekly schedule'],
          ['Week of:'],
          ['Time', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          ...['7:00', '8:00', '9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'].map((time) => [time]),
        ],
        styles: [
          { range: 'A1', style: TITLE },
          { range: 'A2', style: { bold: true } },
          { range: 'A3:H3', style: { ...HEADER, align: 'center' } },
          { range: 'A4:A17', style: { bold: true, color: '#5f6368' } },
        ],
      },
    ],
  },
  {
    id: 'sheet-gradebook',
    app: 'SPREADSHEET',
    name: 'Gradebook',
    subtitle: 'Averages and letter grades',
    category: 'Education',
    sheets: [
      {
        name: 'Grades',
        frozenRows: 3,
        colWidths: { 0: 200, 1: 110, 2: 110, 3: 110, 4: 110, 5: 100, 6: 80 },
        rows: [
          ['Gradebook'],
          ['Scores are out of 100. Averages and letter grades update automatically.'],
          ['Student', 'Assignment 1', 'Assignment 2', 'Assignment 3', 'Assignment 4', 'Average', 'Grade'],
          ...[
            [92, 88, 95, 90],
            [78, 85, 80, 74],
            [65, 72, 70, 81],
            [88, 91, 84, 93],
            [55, 62, 70, 58],
          ].map((scores, i) => {
            const r = i + 4;
            return [
              `Student ${i + 1}`,
              ...scores,
              `=ROUND(AVERAGE(B${r}:E${r}),1)`,
              `=IF(F${r}>=90,"A",IF(F${r}>=80,"B",IF(F${r}>=70,"C",IF(F${r}>=60,"D","F"))))`,
            ];
          }),
          [],
          ['Class average', '=ROUND(AVERAGE(B4:B8),1)', '=ROUND(AVERAGE(C4:C8),1)', '=ROUND(AVERAGE(D4:D8),1)', '=ROUND(AVERAGE(E4:E8),1)', '=ROUND(AVERAGE(F4:F8),1)'],
        ],
        styles: [
          { range: 'A1', style: TITLE },
          { range: 'A2', style: NOTE },
          { range: 'A3:G3', style: HEADER },
          { range: 'G4:G8', style: { bold: true, align: 'center' } },
          { range: 'A10:F10', style: TOTAL },
        ],
      },
    ],
  },
];

/** "A1" or "A1:D4" → an inclusive range. */
export function parseTemplateRange(ref: string): CellRange {
  const [a, b = a] = ref.split(':') as [string, string?];
  const start = parseA1(a);
  const end = parseA1(b!);
  if (!start || !end) throw new Error(`Invalid template range "${ref}"`);
  return {
    startRow: Math.min(start.row, end.row),
    endRow: Math.max(start.row, end.row),
    startCol: Math.min(start.col, end.col),
    endCol: Math.max(start.col, end.col),
  };
}

export interface BuiltTemplateCell {
  row: number;
  col: number;
  cell: CellState;
}

/**
 * Evaluates a spreadsheet template with the real formula engine. `sheetIds` are the ids to give each template sheet
 * (the server passes the rows it created; previews can pass any unique strings). Returns every non-empty cell.
 */
export function buildSheetTemplate(template: Pick<SheetTemplate, 'sheets'>, sheetIds: string[]): { sheet: SheetTemplateSheet; sheetId: string; cells: BuiltTemplateCell[] }[] {
  const wb = new Workbook();
  template.sheets.forEach((s, i) => wb.addSheet({ id: sheetIds[i]!, name: s.name }));
  // Inputs first (all sheets, so cross-sheet formulas resolve), then styles.
  template.sheets.forEach((s, i) => {
    const inputs = s.rows.flatMap((cols, row) =>
      cols.flatMap((v, col) => (v === null || v === '' ? [] : [{ row, col, input: typeof v === 'number' ? String(v) : v }])),
    );
    if (inputs.length) wb.setInputs(sheetIds[i]!, inputs);
  });
  template.sheets.forEach((s, i) => {
    for (const { range, style } of s.styles ?? []) wb.setStyle(sheetIds[i]!, parseTemplateRange(range), style, false);
  });
  return template.sheets.map((sheet, i) => ({
    sheet,
    sheetId: sheetIds[i]!,
    cells: [...wb.sheetCells(sheetIds[i]!)].map(([key, cell]) => ({ ...parseCellKey(key), cell })),
  }));
}
