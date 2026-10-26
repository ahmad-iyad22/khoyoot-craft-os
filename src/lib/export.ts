/** Client-side exports: CSV (opens in Excel) and print-to-PDF reports. */

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function csvCell(v: unknown) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Download rows as a CSV file Excel opens correctly (UTF-8 BOM). */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const lines = [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))];
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, filename);
}

const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Print a simple report table through a hidden iframe; the browser dialog
 * offers "Save as PDF". `sections` render as titled tables in order.
 */
export function printReport(
  title: string,
  sections: { heading: string; headers: string[]; rows: (string | number)[][] }[],
  lang: string,
) {
  const rtl = lang === "ar";
  const body = sections
    .map(
      (s) => `
      <h2>${esc(s.heading)}</h2>
      <table>
        <thead><tr>${s.headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
        <tbody>${s.rows
          .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody>
      </table>`,
    )
    .join("");
  const html = `<!doctype html><html dir="${rtl ? "rtl" : "ltr"}" lang="${lang}"><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>
      body { font-family: ${rtl ? "'Noto Kufi Arabic', " : ""}Arial, sans-serif; margin: 24px; color: #1c1917; }
      h1 { font-size: 20px; margin: 0 0 4px; }
      h2 { font-size: 14px; margin: 20px 0 6px; color: #9a3412; }
      .meta { font-size: 11px; color: #78716c; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #d6d3d1; padding: 5px 8px; text-align: ${rtl ? "right" : "left"}; }
      th { background: #faf6ef; }
      tr { break-inside: avoid; }
      @page { size: A4; margin: 12mm; }
    </style></head><body>
    <h1>${esc(title)}</h1>
    <p class="meta">Khoyoot · ${esc(new Date().toLocaleDateString(rtl ? "ar" : "en-GB", { day: "2-digit", month: "short", year: "numeric" }))}</p>
    ${body}</body></html>`;

  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60_000);
  };
}
