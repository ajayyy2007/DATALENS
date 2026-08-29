function isNumericString(value) {
    if (typeof value === "number") return !Number.isNaN(value);
    if (typeof value !== "string") return false;
    const trimmed = value.trim();
    if (trimmed === "") return false;
    return !Number.isNaN(Number(trimmed));
}
function toNumber(value) {
    return typeof value === "number" ? value : Number(String(value).trim());
}

function percentChange(oldVal, newVal) {
    if (oldVal === 0) return newVal === 0 ? 0 : null; // undefined % change from zero
    return Number((((newVal - oldVal) / Math.abs(oldVal)) * 100).toFixed(1));
}

function compareDatasets(datasetA, datasetB) {
    const rowsA = Array.isArray(datasetA.rows) ? datasetA.rows : [];
    const rowsB = Array.isArray(datasetB.rows) ? datasetB.rows : [];

    const columnsA = datasetA.columns.map((c) => c.name);
    const numericColsA = datasetA.columns.filter((c) => c.type === "number");

    // Metric-level comparison: sum of each numeric column
    const metrics = numericColsA
        .filter((col) => datasetB.columns.some((c) => c.name === col.name))
        .map((col) => {
            const sumA = rowsA.reduce((acc, r) => {
                return isNumericString(r[col.name]) ? acc + toNumber(r[col.name]) : acc;
            }, 0);
            const sumB = rowsB.reduce((acc, r) => {
                return isNumericString(r[col.name]) ? acc + toNumber(r[col.name]) : acc;
            }, 0);

            return {
                column: col.name,
                totalA: Number(sumA.toFixed(2)),
                totalB: Number(sumB.toFixed(2)),
                percentChange: percentChange(sumA, sumB),
            };
        });

    // Row-level diffing using a natural key: first categorical/text column
    // as an identifier (best-effort, since there's no declared primary key)
    const catCol = datasetA.columns.find((c) => c.type !== "number");
    let newRows = [];
    let removedRows = [];
    let changedRows = [];

    if (catCol) {
        const keyName = catCol.name;
        const mapA = new Map(rowsA.map((r) => [r[keyName], r]));
        const mapB = new Map(rowsB.map((r) => [r[keyName], r]));

        for (const [key, rowB] of mapB.entries()) {
            if (!mapA.has(key)) {
                newRows.push(rowB);
            }
        }
        for (const [key, rowA] of mapA.entries()) {
            if (!mapB.has(key)) {
                removedRows.push(rowA);
            }
        }
        for (const [key, rowA] of mapA.entries()) {
            if (mapB.has(key)) {
                const rowB = mapB.get(key);
                const diffs = {};
                columnsA.forEach((colName) => {
                    if (rowA[colName] !== rowB[colName]) {
                        diffs[colName] = { before: rowA[colName], after: rowB[colName] };
                    }
                });
                if (Object.keys(diffs).length > 0) {
                    changedRows.push({ key, diffs });
                }
            }
        }
    }

    // Category-level breakdown for the top metric (if a categorical + numeric column exist)
    let categoryBreakdown = null;
    if (catCol && numericColsA.length > 0) {
        const metricCol = numericColsA[0].name;
        const catKey = catCol.name;

        const sumsA = new Map();
        rowsA.forEach((r) => {
            if (!isNumericString(r[metricCol])) return;
            sumsA.set(r[catKey], (sumsA.get(r[catKey]) || 0) + toNumber(r[metricCol]));
        });
        const sumsB = new Map();
        rowsB.forEach((r) => {
            if (!isNumericString(r[metricCol])) return;
            sumsB.set(r[catKey], (sumsB.get(r[catKey]) || 0) + toNumber(r[metricCol]));
        });

        const allCats = new Set([...sumsA.keys(), ...sumsB.keys()]);
        const breakdown = Array.from(allCats).map((cat) => {
            const a = sumsA.get(cat) || 0;
            const b = sumsB.get(cat) || 0;
            return {
                category: cat,
                before: Number(a.toFixed(2)),
                after: Number(b.toFixed(2)),
                percentChange: percentChange(a, b),
            };
        });

        breakdown.sort((x, y) => (y.percentChange ?? 0) - (x.percentChange ?? 0));

        categoryBreakdown = {
            metric: metricCol,
            category: catKey,
            topIncrease: breakdown[0] || null,
            topDecrease: breakdown[breakdown.length - 1] || null,
            all: breakdown,
        };
    }

    return {
        metrics,
        rowChanges: {
            newRowCount: newRows.length,
            removedRowCount: removedRows.length,
            changedRowCount: changedRows.length,
            newRows,
            removedRows,
            changedRows,
        },
        categoryBreakdown,
    };
}

module.exports = { compareDatasets };