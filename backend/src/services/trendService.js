// backend/src/services/trendService.js
// Auto-detects revenue/cost columns by keyword and computes
// period-over-period business metrics. No AI — deterministic keyword rules.

const REVENUE_KEYWORDS = ["revenue", "sales", "income", "amount", "total", "turnover"];
const COST_KEYWORDS = ["cost", "expense", "expenditure", "cogs", "spend"];

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

function scoreColumnName(columnName, keywords) {
    const lower = columnName.toLowerCase();
    return keywords.some((kw) => lower.includes(kw)) ? 1 : 0;
}

/** Picks the best-matching numeric column for revenue and cost, if any. */
function detectMetricColumns(columns) {
    const numericCols = columns.filter((c) => c.type === "number");

    let revenueCol = null;
    let costCol = null;

    numericCols.forEach((col) => {
        if (!revenueCol && scoreColumnName(col.name, REVENUE_KEYWORDS)) {
            revenueCol = col.name;
        }
        if (!costCol && scoreColumnName(col.name, COST_KEYWORDS)) {
            costCol = col.name;
        }
    });

    return { revenueCol, costCol, numericCols: numericCols.map((c) => c.name) };
}

function sumColumn(rows, columnName) {
    if (!columnName) return 0;
    return rows.reduce((acc, row) => {
        const v = row[columnName];
        return isNumericString(v) ? acc + toNumber(v) : acc;
    }, 0);
}

function percentChange(oldVal, newVal) {
    if (oldVal === 0) return newVal === 0 ? 0 : null;
    return Number((((newVal - oldVal) / Math.abs(oldVal)) * 100).toFixed(1));
}

/**
 * Builds a period-by-period trend report for a group of datasets.
 * `datasets` must be pre-sorted chronologically (oldest first) and
 * each must have periodLabel + rows + columns populated.
 */
function computeGroupTrends(datasets) {
    if (datasets.length === 0) {
        return { periods: [], revenueColumn: null, costColumn: null };
    }

    const { revenueCol, costCol } = detectMetricColumns(datasets[0].columns);

    const periods = datasets.map((ds) => {
        const revenue = sumColumn(ds.rows, revenueCol);
        const cost = sumColumn(ds.rows, costCol);
        const profit = revenueCol && costCol ? Number((revenue - cost).toFixed(2)) : null;

        return {
            datasetId: ds._id,
            periodLabel: ds.periodLabel || ds.name,
            periodDate: ds.periodDate,
            rowCount: ds.rows.length,
            revenue: revenueCol ? Number(revenue.toFixed(2)) : null,
            cost: costCol ? Number(cost.toFixed(2)) : null,
            profit,
        };
    });

    // Add period-over-period % change
    for (let i = 0; i < periods.length; i++) {
        if (i === 0) {
            periods[i].revenueChange = null;
            periods[i].profitChange = null;
            continue;
        }
        const prev = periods[i - 1];
        const curr = periods[i];
        periods[i].revenueChange =
            prev.revenue !== null && curr.revenue !== null
                ? percentChange(prev.revenue, curr.revenue)
                : null;
        periods[i].profitChange =
            prev.profit !== null && curr.profit !== null
                ? percentChange(prev.profit, curr.profit)
                : null;
    }

    return {
        periods,
        revenueColumn: revenueCol,
        costColumn: costCol,
    };
}

/** Builds a stable column signature for group matching. */
function buildColumnSignature(columns) {
    return columns.map((c) => c.name).sort();
}

module.exports = { computeGroupTrends, detectMetricColumns, buildColumnSignature };