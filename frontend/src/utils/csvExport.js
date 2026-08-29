// frontend/src/utils/csvExport.js
// Pure client-side CSV generation — no backend round-trip needed
// since the data is already loaded in the page.

function escapeCsvValue(value) {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

export function rowsToCsv(rows) {
    if (!rows || rows.length === 0) return "";

    const headers = Object.keys(rows[0]);
    const headerLine = headers.map(escapeCsvValue).join(",");
    const dataLines = rows.map((row) =>
        headers.map((h) => escapeCsvValue(row[h])).join(",")
    );

    return [headerLine, ...dataLines].join("\n");
}

export function downloadCsv(filename, rows) {
    const csv = rowsToCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export function downloadTextFile(filename, content) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename.endsWith(".txt") ? filename : `${filename}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}