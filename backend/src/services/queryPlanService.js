// backend/src/services/queryPlanService.js
// Generic, dataset-agnostic query planning + execution.
// Works on any dataset's real columns instead of hardcoded names.
// Supports both single-operation and multi-operation (compound) questions.

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

/** Finds the best-matching real column name for a word/phrase mentioned in the question. */
function findColumnMention(question, columns) {
    const q = question.toLowerCase();
    const exact = columns.find((c) => q.includes(c.name.toLowerCase()));
    if (exact) return exact;

    const loose = columns.find((c) => {
        const name = c.name.toLowerCase();
        return q.includes(name.replace(/s$/, ""));
    });
    return loose || null;
}

function findNumericColumnMention(question, columns) {
    const numericCols = columns.filter((c) => c.type === "number");
    return findColumnMention(question, numericCols) || numericCols[0] || null;
}

function findCategoricalColumnMention(question, columns) {
    const catCols = columns.filter((c) => c.type !== "number");
    return findColumnMention(question, catCols) || catCols[0] || null;
}

/**
 * Builds a structured query plan from a natural-language question,
 * using the dataset's REAL columns (not assumptions).
 * Returns null if no operation could be confidently detected.
 * This is the deterministic fallback used when AI is unavailable.
 */
function buildQueryPlan(question, columns) {
    const q = question.toLowerCase().trim();

    // SHOW FULL DATA / ALL ROWS
    if (q.includes("full data") || q.includes("all rows") || q.includes("show data") || q.includes("raw data")) {
        return { operation: "all_rows" };
    }

    // TOP N BY <numeric column>
    if (q.includes("top") || (q.includes("highest") && /\d/.test(q))) {
        const numberMatch = q.match(/\d+/);
        const limit = numberMatch ? parseInt(numberMatch[0]) : 3;
        const column = findNumericColumnMention(q, columns);
        if (column) {
            return { operation: "top_n", column: column.name, order: "desc", limit };
        }
    }

    // BOTTOM N / LOWEST
    if (q.includes("bottom") || q.includes("lowest") || q.includes("least")) {
        const numberMatch = q.match(/\d+/);
        const limit = numberMatch ? parseInt(numberMatch[0]) : 3;
        const column = findNumericColumnMention(q, columns);
        if (column) {
            return { operation: "top_n", column: column.name, order: "asc", limit };
        }
    }

    // MAX / MOST EXPENSIVE / HIGHEST (single row)
    if (q.includes("most expensive") || q.includes("highest") || q.includes("maximum") || q.includes("max ")) {
        const column = findNumericColumnMention(q, columns);
        if (column) {
            return { operation: "max", column: column.name, limit: 1 };
        }
    }

    // MIN / CHEAPEST / LOWEST (single row)
    if (q.includes("cheapest") || q.includes("minimum") || q.includes("min ")) {
        const column = findNumericColumnMention(q, columns);
        if (column) {
            return { operation: "min", column: column.name, limit: 1 };
        }
    }

    // GROUP BY / BREAKDOWN (e.g. "sales by category", "average sales by product")
    // MUST run before the plain AVERAGE/SUM checks below, otherwise
    // "average sales by product" gets caught by the flat "average" branch
    // and never produces a per-group breakdown.
    if (q.includes(" by ")) {
        const numericColumn = findNumericColumnMention(q, columns);
        const catColumn = findCategoricalColumnMention(q, columns);
        if (numericColumn && catColumn) {
            const isAverage = q.includes("average") || q.includes("mean");
            return {
                operation: isAverage ? "group_average" : "group_sum",
                column: numericColumn.name,
                groupBy: catColumn.name,
            };
        }
    }

    // AVERAGE / MEAN
    if (q.includes("average") || q.includes("mean")) {
        const column = findNumericColumnMention(q, columns);
        if (column) {
            return { operation: "average", column: column.name };
        }
    }

    // SUM / TOTAL
    if (q.includes("sum") || q.includes("total")) {
        const column = findNumericColumnMention(q, columns);
        if (column) {
            return { operation: "sum", column: column.name };
        }
    }

    // COUNT / HOW MANY (optionally filtered by a category value)
    if (q.includes("how many") || q.includes("count")) {
        const catColumn = findCategoricalColumnMention(q, columns);
        return { operation: "count", filterColumn: catColumn ? catColumn.name : null, rawQuestion: q };
    }

    // NOTE: general "filter by value" detection (e.g. "show Electronics
    // products") isn't reliable from keywords alone since it needs to
    // match actual row values, not just column names. The AI path
    // (aiQueryService.js) handles filter_where properly; this keyword
    // fallback intentionally does not attempt it.

    return null;
}

/**
 * Validates a plan against the ACTUAL dataset schema before execution.
 * This is the security boundary: even if a plan came from AI, nothing
 * executes unless it references real columns and allowed operations.
 */
function validatePlan(plan, columns) {
    const ALLOWED_OPS = ["top_n", "max", "min", "average", "sum", "count", "group_sum", "all_rows", "filter_where", "group_average"];
    const columnNames = columns.map((c) => c.name);

    if (!plan || !ALLOWED_OPS.includes(plan.operation)) {
        return { valid: false, reason: "Unsupported operation" };
    }

    if (plan.operation === "filter_where" && !plan.filterColumn) {
        return { valid: false, reason: "filter_where requires filterColumn" };
    }

    if (plan.column && !columnNames.includes(plan.column)) {
        return { valid: false, reason: `Unknown column: ${plan.column}` };
    }

    if (plan.groupBy && !columnNames.includes(plan.groupBy)) {
        return { valid: false, reason: `Unknown column: ${plan.groupBy}` };
    }

    if (plan.filterColumn && !columnNames.includes(plan.filterColumn)) {
        return { valid: false, reason: `Unknown column: ${plan.filterColumn}` };
    }

    if (plan.filterValue !== undefined && typeof plan.filterValue !== "string" && typeof plan.filterValue !== "number") {
        return { valid: false, reason: "filterValue must be a string or number" };
    }

    if (plan.limit && (plan.limit < 1 || plan.limit > 500)) {
        return { valid: false, reason: "Limit out of allowed range" };
    }

    return { valid: true };
}

const MAX_RESULT_ROWS = 500;

/** Executes a validated plan against dataset rows. Pure, deterministic. */
function executePlan(plan, rows) {
    switch (plan.operation) {
        case "all_rows": {
            return rows.slice(0, MAX_RESULT_ROWS);
        }

        case "filter_where": {
            const filtered = rows.filter(
                (r) =>
                    String(r[plan.filterColumn]).trim().toLowerCase() ===
                    String(plan.filterValue).trim().toLowerCase()
            );
            return filtered.slice(0, MAX_RESULT_ROWS);
        }

        case "group_average": {
            const sums = new Map();
            const counts = new Map();
            rows.forEach((r) => {
                const key = r[plan.groupBy];
                const val = r[plan.column];
                if (key === undefined || !isNumericString(val)) return;
                sums.set(key, (sums.get(key) || 0) + toNumber(val));
                counts.set(key, (counts.get(key) || 0) + 1);
            });
            return Array.from(sums.entries())
                .map(([key, sum]) => ({
                    [plan.groupBy]: key,
                    [`Average ${plan.column}`]: Number((sum / counts.get(key)).toFixed(2)),
                }))
                .sort((a, b) => b[`Average ${plan.column}`] - a[`Average ${plan.column}`])
                .slice(0, MAX_RESULT_ROWS);
        }

        case "top_n": {
            const sorted = [...rows]
                .filter((r) => isNumericString(r[plan.column]))
                .sort((a, b) => {
                    const diff = toNumber(a[plan.column]) - toNumber(b[plan.column]);
                    return plan.order === "asc" ? diff : -diff;
                });
            return sorted.slice(0, Math.min(plan.limit, MAX_RESULT_ROWS));
        }

        case "max": {
            const sorted = [...rows]
                .filter((r) => isNumericString(r[plan.column]))
                .sort((a, b) => toNumber(b[plan.column]) - toNumber(a[plan.column]));
            return sorted.slice(0, 1);
        }

        case "min": {
            const sorted = [...rows]
                .filter((r) => isNumericString(r[plan.column]))
                .sort((a, b) => toNumber(a[plan.column]) - toNumber(b[plan.column]));
            return sorted.slice(0, 1);
        }

        case "average": {
            const values = rows.map((r) => r[plan.column]).filter(isNumericString).map(toNumber);
            if (values.length === 0) return [];
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            return [{ metric: `Average ${plan.column}`, value: Number(avg.toFixed(2)) }];
        }

        case "sum": {
            const values = rows.map((r) => r[plan.column]).filter(isNumericString).map(toNumber);
            const total = values.reduce((a, b) => a + b, 0);
            return [{ metric: `Total ${plan.column}`, value: Number(total.toFixed(2)) }];
        }

        case "count": {
            if (!plan.filterColumn) {
                return [{ metric: "Total Rows", value: rows.length }];
            }
            if (plan.filterValue) {
                const count = rows.filter(
                    (r) => String(r[plan.filterColumn]).trim().toLowerCase() === String(plan.filterValue).trim().toLowerCase()
                ).length;
                return [{ [plan.filterColumn]: plan.filterValue, count }];
            }
            const q = plan.rawQuestion || "";
            const distinctValues = [...new Set(rows.map((r) => String(r[plan.filterColumn]).trim()))];
            const matchedValue = distinctValues.find((v) => q.includes(v.toLowerCase()));
            if (!matchedValue) return [{ metric: "Total Rows", value: rows.length }];
            const count = rows.filter(
                (r) => String(r[plan.filterColumn]).trim().toLowerCase() === matchedValue.toLowerCase()
            ).length;
            return [{ [plan.filterColumn]: matchedValue, count }];
        }

        case "group_sum": {
            const totals = new Map();
            rows.forEach((r) => {
                const key = r[plan.groupBy];
                const val = r[plan.column];
                if (key === undefined || !isNumericString(val)) return;
                totals.set(key, (totals.get(key) || 0) + toNumber(val));
            });
            return Array.from(totals.entries())
                .map(([key, value]) => ({ [plan.groupBy]: key, [plan.column]: Number(value.toFixed(2)) }))
                .sort((a, b) => b[plan.column] - a[plan.column])
                .slice(0, MAX_RESULT_ROWS);
        }

        default:
            return [];
    }
}

/**
 * Validates and executes an ARRAY of plans (for compound/multi-part
 * questions). Each plan is independently validated — if one is
 * invalid, the others still run. Returns an array of { plan, results }
 * or { plan, error } for the ones that failed.
 */
function runMultiplePlans(plans, columns, rows) {
    return plans.map((plan) => {
        const validation = validatePlan(plan, columns);
        if (!validation.valid) {
            return { plan, error: validation.reason };
        }
        const results = executePlan(plan, rows);
        return { plan, results };
    });
}

module.exports = { buildQueryPlan, validatePlan, executePlan, runMultiplePlans };