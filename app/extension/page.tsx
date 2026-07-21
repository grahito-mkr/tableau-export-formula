"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

type Status = { kind: "ok" | "err" | "busy" | ""; msg: string };

export default function ExtensionPage() {
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [worksheets, setWorksheets] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [formulaCols, setFormulaCols] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "", msg: "" });
  const [busy, setBusy] = useState(false);
  const initStarted = useRef(false);

  function initTableau() {
    if (initStarted.current) return; // avoid double-initializing (onLoad + poll can both fire)
    if (!window.tableau) return;
    initStarted.current = true;

    window.tableau.extensions
      .initializeAsync()
      .then(() => {
        setReady(true);
        const names = window.tableau!.extensions.dashboardContent.dashboard.worksheets.map(
          (w) => w.name
        );
        setWorksheets(names);
        setSelected(names[0] || "");
      })
      .catch((err: any) => {
        initStarted.current = false;
        setInitError(err?.message || String(err));
      });
  }

  // Initialize the Tableau Extensions API. The <Script> onLoad handles the
  // normal case; this effect is a safety net for when the script was already
  // cached before mount (onLoad wouldn't fire again) - it polls briefly for
  // window.tableau instead of giving up after one check.
  useEffect(() => {
    if (window.tableau) {
      initTableau();
      return;
    }
    const interval = setInterval(() => {
      if (window.tableau) {
        initTableau();
        clearInterval(interval);
      }
    }, 200);
    const giveUp = setTimeout(() => {
      clearInterval(interval);
      if (!initStarted.current) {
        setInitError("window.tableau never became available (script may have failed to load or been blocked).");
      }
    }, 15000);
    return () => {
      clearInterval(interval);
      clearTimeout(giveUp);
    };
  }, []);

  // Load the formula mapping so we can show which columns become live formulas.
  useEffect(() => {
    fetch("/api/export")
      .then((r) => (r.ok ? r.json() : {}))
      .then((map) => setFormulaCols(Object.keys(map)))
      .catch(() => setFormulaCols([]));
  }, []);

  async function onExport() {
    if (!selected || busy || !window.tableau) return;
    const worksheet = window.tableau.extensions.dashboardContent.dashboard.worksheets.find(
      (w) => w.name === selected
    );
    if (!worksheet) return;

    setBusy(true);
    setStatus({ kind: "busy", msg: "Reading data from Tableau..." });

    try {
      const dataTable = await worksheet.getSummaryDataAsync({ maxRows: 0 });
      const columns = dataTable.columns.map((c) => c.fieldName);
      const rows = dataTable.data.map((row) => {
        const obj: Record<string, unknown> = {};
        dataTable.columns.forEach((c, i) => {
          obj[c.fieldName] = row[i].value;
        });
        return obj;
      });

      setStatus({ kind: "busy", msg: "Building Excel file..." });

      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetName: worksheet.name, columns, rows })
      });

      if (!res.ok) {
        throw new Error(`${res.status}: ${await res.text()}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${worksheet.name}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setStatus({ kind: "ok", msg: `Exported ${rows.length} rows.` });
    } catch (err: any) {
      setStatus({ kind: "err", msg: err?.message || String(err) });
    } finally {
      setBusy(false);
    }
  }

  const statusColor =
    status.kind === "ok" ? "#216e4e" : status.kind === "err" ? "crimson" : "#666";

  return (
    <>
      <Script
        src="/tableau-extensions.min.js"
        strategy="afterInteractive"
        onLoad={initTableau}
        onError={() => setInitError("Failed to load /tableau-extensions.min.js (check the file was uploaded to public/).")}
      />
      <div style={{ maxWidth: 440, padding: 20, fontSize: 13 }}>
        <h1 style={{ fontSize: 16, margin: "0 0 4px" }}>Formula Export</h1>
        <p style={{ color: "#5e6c84", margin: "0 0 16px", lineHeight: 1.4 }}>
          Exports the selected worksheet to Excel with live formulas for mapped calculated fields.
        </p>

        {!ready && !initError && <div style={{ color: "#999" }}>Connecting to Tableau...</div>}
        {initError && (
          <div style={{ color: "crimson", whiteSpace: "pre-wrap", marginBottom: 12 }}>
            Tableau init error: {initError}
          </div>
        )}

        {ready && (
          <>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Worksheet</label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              style={{ width: "100%", padding: "6px 8px", marginBottom: 12, fontSize: 13 }}
            >
              {worksheets.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            <div style={{ color: "#5e6c84", marginBottom: 16, lineHeight: 1.5 }}>
              {formulaCols.length > 0 ? (
                <>
                  Formula columns:{" "}
                  {formulaCols.map((c) => (
                    <code
                      key={c}
                      style={{
                        background: "#f4f5f7",
                        border: "1px solid #dfe1e6",
                        borderRadius: 3,
                        padding: "1px 6px",
                        marginRight: 4
                      }}
                    >
                      {c}
                    </code>
                  ))}
                </>
              ) : (
                "No calculated fields mapped in config."
              )}
            </div>

            <button
              onClick={onExport}
              disabled={busy || !selected}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "none",
                borderRadius: 4,
                background: "#1f6fd6",
                color: "#fff",
                fontWeight: 600,
                fontSize: 13,
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.5 : 1
              }}
            >
              Export to Excel
            </button>

            {status.msg && (
              <div style={{ marginTop: 12, color: statusColor, lineHeight: 1.4 }}>{status.msg}</div>
            )}
          </>
        )}
      </div>
    </>
  );
}
