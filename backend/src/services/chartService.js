// Determines appropriate chart configs from column types + data.
// Pure, deterministic — no AI.

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

function suggestCharts(dataset) {
    const rows = Array.isArray(dataset.rows) ? dataset.rows : [];
    const columns = Array.isArray(dataset.columns) ? dataset.columns : [];

    const numericCols = columns.filter((c) => c.type === "number");
    const categoricalCols = columns.filter((c) => c.type !== "number");

    const charts = [];

    // Category + numeric -> bar chart (aggregate sum per category)
    if (categoricalCols.length > 0 && numericCols.length > 0) {
        const catCol = categoricalCols[0];
        const numCol = numericCols[0];

        const totals = new Map();
        rows.forEach((row) => {
            const cat = row[catCol.name];
            const val = row[numCol.name];
            if (cat === undefined || !isNumericString(val)) return;
            totals.set(cat, (totals.get(cat) || 0) + toNumber(val));
        });

        charts.push({
            type: "bar",
            title: `${numCol.name} by ${catCol.name}`,
            xKey: catCol.name,
            yKey: numCol.name,
            data: Array.from(totals.entries()).map(([name, value]) => ({
                [catCol.name]: name,
                [numCol.name]: Number(value.toFixed(2)),
            })),
        });

        // Category distribution -> pie chart (row counts per category)
        if (totals.size <= 8) {
            const counts = new Map();
            rows.forEach((row) => {
                const cat = row[catCol.name];
                if (cat === undefined) return;
                counts.set(cat, (counts.get(cat) || 0) + 1);
            });
            charts.push({
                type: "pie",
                title: `Distribution by ${catCol.name}`,
                nameKey: catCol.name,
                valueKey: "count",
                data: Array.from(counts.entries()).map(([name, value]) => ({
                    [catCol.name]: name,
                    count: value,
                })),
            });
        }
    }

    // Two numeric columns -> scatter plot
    if (numericCols.length >= 2) {
        const [xCol, yCol] = numericCols;
        const points = rows
            .filter(
                (row) =>
                    isNumericString(row[xCol.name]) &&
                    isNumericString(row[yCol.name])
            )
            .map((row) => ({
                [xCol.name]: toNumber(row[xCol.name]),
                [yCol.name]: toNumber(row[yCol.name]),
            }));

        charts.push({
            type: "scatter",
            title: `${xCol.name} vs ${yCol.name}`,
            xKey: xCol.name,
            yKey: yCol.name,
            data: points,
        });
    }

    // Single numeric -> histogram (bucketed)
    numericCols.forEach((col) => {
        const values = rows
            .map((row) => row[col.name])
            .filter(isNumericString)
            .map(toNumber);

        if (values.length < 5) return;

        const min = Math.min(...values);
        const max = Math.max(...values);
        const bucketCount = Math.min(8, Math.max(4, Math.ceil(Math.sqrt(values.length))));
        const bucketSize = (max - min) / bucketCount || 1;

        const buckets = Array.from({ length: bucketCount }, (_, i) => ({
            range: `${(min + i * bucketSize).toFixed(0)}-${(min + (i + 1) * bucketSize).toFixed(0)}`,
            count: 0,
        }));

        values.forEach((v) => {
            let idx = Math.floor((v - min) / bucketSize);
            if (idx >= bucketCount) idx = bucketCount - 1;
            if (idx < 0) idx = 0;
            buckets[idx].count += 1;
        });

        charts.push({
            type: "histogram",
            title: `Distribution of ${col.name}`,
            xKey: "range",
            yKey: "count",
            data: buckets,
        });
    });

    return charts;
}

module.exports = { suggestCharts };