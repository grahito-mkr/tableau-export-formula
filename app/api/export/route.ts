import { buildWorkbook, getFormulaMap, type ExportPayload } from "@/lib/excelBuilder";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET /api/export -> the formula mapping, so the extension UI can show which
// columns will be turned into live formulas.
export async function GET() {
  return Response.json(getFormulaMap());
}

// POST /api/export -> an .xlsx built from the worksheet's summary data, with
// mapped calculated-field columns replaced by live Excel formulas.
export async function POST(req: Request) {
  let payload: ExportPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (!payload.columns?.length) {
    return new Response("Missing `columns`", { status: 400 });
  }

  try {
    const buffer = await buildWorkbook(payload);
    const safeName = (payload.sheetName || "export").replace(/[^A-Za-z0-9_.-]/g, "_") || "export";
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeName}.xlsx"`
      }
    });
  } catch (err: any) {
    return new Response(err?.message || "Export failed", { status: 400 });
  }
}
