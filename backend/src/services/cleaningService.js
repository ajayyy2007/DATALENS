// backend/src/services/cleaningService.js

/**
 * Deterministic data cleaning suggestions.
 * Detects problems and proposes fixes — never applies anything silently.
 * No AI involved.
 */

function isEmptyValue(value) {
    return (
        value === null ||
        value === undefined ||
        (typeof value === "string" && value.trim() === "")
    );
}

function isWhitespaceOnly(value) {
    return typeof value === "string" && value !== "" && value.trim() === "";
}

function isNumericString(value) {
    if (typeof value === "number") return !Number.isNaN(value);
    if (typeof value !== "string") return false;
    const trimmed = value.trim();
    if (trimmed === "") return false;
    return !Number.isNaN(Number(trimmed));
}
function computeMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    if (n === 0) return null;
    const mid = Math.floor(n / 2);
    return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function computeMean(values) {
    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
}

function computeMode(values) {
    const counts = new Map();
    values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
    let best = null;
    let bestCount = 0;
    for (const [val, count] of counts.entries()) {
        if (count > bestCount) {
            best = val;
            bestCount = count;
        }
    }
    return best;
}

/**
 * Computes the fill value a given strategy would produce for a column,
 * without applying anything. Used to preview the fix before the user
 * commits to it.
 */
function computeSuggestedFillValue(columnName, columnType, rows, strategy) {
    if (strategy === "remove_rows") return null;

    if (columnType === "number") {
        const numericValues = rows
            .map((r) => r[columnName])
            .filter((v) => !isEmptyValue(v) && isNumericString(v))
            .map((v) => Number(String(v).trim()));

        if (strategy === "median") return computeMedian(numericValues);
        if (strategy === "mean") {
            const mean = computeMean(numericValues);
            return mean === null ? null : Number(mean.toFixed(2));
        }
    }

    if (strategy === "mode") {
        const values = rows
            .map((r) => r[columnName])
            .filter((v) => !isEmptyValue(v));
        return computeMode(values);
    }

    return null;
}

function stableRowKey(row) {
    return JSON.stringify(
        Object.keys(row)
            .sort()
            .reduce((acc, k) => {
                acc[k] = row[k];
                return acc;
            }, {})
    );
}

/** Detect exact duplicate rows, returning groups of row indices. */
function findDuplicateGroups(rows) {
    const map = new Map(); // key -> [indices]
    rows.forEach((row, index) => {
        const key = stableRowKey(row);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(index);
    });

    return Array.from(map.values()).filter((group) => group.length > 1);
}

/** Detect missing values, returning row indices per column. */
function findMissingValues(columnName, rows) {
    const affectedRows = [];
    rows.forEach((row, index) => {
        if (isEmptyValue(row[columnName])) affectedRows.push(index);
    });
    return affectedRows;
}

/** Detect whitespace-only string values (distinct from fully empty). */
function findWhitespaceIssues(columnName, rows) {
    const affectedRows = [];
    rows.forEach((row, index) => {
        if (isWhitespaceOnly(row[columnName])) affectedRows.push(index);
    });
    return affectedRows;
}

/** Detect invalid numeric values in a column expected to be numeric. */
function findInvalidNumericValues(columnName, rows) {
    const affectedRows = [];
    rows.forEach((row, index) => {
        const value = row[columnName];
        if (!isEmptyValue(value) && !isNumericString(value)) {
            affectedRows.push({ rowIndex: index, value });
        }
    });
    return affectedRows;
}

/**
 * Detect category inconsistencies: values that are identical after
 * trim + lowercase but differ in raw casing/whitespace.
 * Suggests the most frequent variant as the canonical correction.
 */
function findCategoryInconsistencies(columnName, rows) {
    const groups = new Map(); // normalized -> Map(variant -> count)

    rows.forEach((row) => {
        const raw = row[columnName];
        if (isEmptyValue(raw)) return;
        const normalized = String(raw).trim().toLowerCase();
        if (!groups.has(normalized)) groups.set(normalized, new Map());
        const variantMap = groups.get(normalized);
        variantMap.set(raw, (variantMap.get(raw) || 0) + 1);
    });

    const issues = [];
    for (const [normalized, variantMap] of groups.entries()) {
        if (variantMap.size <= 1) continue;

        const variants = Array.from(variantMap.entries())
            .map(([value, count]) => ({ value, count }))
            .sort((a, b) => b.count - a.count);

        const suggestedCorrection = variants[0].value; // most frequent wins

        const affectedRows = [];
        rows.forEach((row, index) => {
            const raw = row[columnName];
            if (
                !isEmptyValue(raw) &&
                String(raw).trim().toLowerCase() === normalized &&
                raw !== suggestedCorrection
            ) {
                affectedRows.push(index);
            }
        });

        issues.push({
            normalized,
            variants,
            suggestedCorrection,
            affectedRows,
        });
    }

    return issues;
}

/**
 * Builds a full cleaning report for a dataset: every detected problem,
 * affected rows, and a suggested (but not applied) correction.
 */
/**
 * Given a column and a chosen strategy, returns the computed fill
 * value plus how many rows would be affected — for frontend preview.
 */
function previewMissingValueFix(dataset, columnName, strategy) {
    const rows = Array.isArray(dataset.rows) ? dataset.rows : [];
    const column = dataset.columns.find((c) => c.name === columnName);
    if (!column) return null;

    const affectedRows = findMissingValues(columnName, rows);
    const fillValue =
        strategy === "remove_rows"
            ? null
            : computeSuggestedFillValue(columnName, column.type, rows, strategy);

    return {
        column: columnName,
        strategy,
        fillValue,
        affectedRowCount: affectedRows.length,
    };
}
function generateCleaningReport(dataset) {
    const rows = Array.isArray(dataset.rows) ? dataset.rows : [];
    const columns = Array.isArray(dataset.columns) ? dataset.columns : [];

    const issues = [];

    // 1. Duplicate rows (dataset-level, not per-column)
    const duplicateGroups = findDuplicateGroups(rows);
    if (duplicateGroups.length > 0) {
        issues.push({
            type: "duplicate_rows",
            column: null,
            description: `${duplicateGroups.length} duplicate row group(s) found.`,
            affectedRowGroups: duplicateGroups,
            suggestion: "Keep the first occurrence, remove the rest.",
        });
    }

    columns.forEach((col) => {
        // 2. Missing values
        const missingRows = findMissingValues(col.name, rows);
              if (missingRows.length > 0) {
            issues.push({
                type: "missing_values",
                column: col.name,
                declaredType: col.type,
                description: `${missingRows.length} missing value(s) in "${col.name}".`,
                affectedRows: missingRows,
                suggestion:
                    col.type === "number"
                        ? "Consider filling with median or removing affected rows."
                        : "Consider filling with a default value or removing affected rows.",
            });
        }

        // 3. Whitespace-only strings
        const whitespaceRows = findWhitespaceIssues(col.name, rows);
        if (whitespaceRows.length > 0) {
            issues.push({
                type: "whitespace_only",
                column: col.name,
                description: `${whitespaceRows.length} whitespace-only value(s) in "${col.name}".`,
                affectedRows: whitespaceRows,
                suggestion: "Treat as missing and trim/clear the value.",
            });
        }

        // 4. Invalid numeric values (only for columns declared numeric)
        if (col.type === "number") {
            const invalid = findInvalidNumericValues(col.name, rows);
            if (invalid.length > 0) {
                issues.push({
                    type: "invalid_numeric",
                    column: col.name,
                    description: `${invalid.length} non-numeric value(s) in numeric column "${col.name}".`,
                    affectedRows: invalid.map((i) => i.rowIndex),
                    invalidValues: invalid,
                    suggestion: "Review and correct or remove affected rows.",
                });
            }
        }

        // 5. Category inconsistencies (only meaningful for string columns)
        if (col.type !== "number") {
            const inconsistencies = findCategoryInconsistencies(
                col.name,
                rows
            );
            inconsistencies.forEach((issue) => {
                issues.push({
                    type: "category_inconsistency",
                    column: col.name,
                    description: `Inconsistent values detected for "${issue.normalized}" in "${col.name}".`,
                    variants: issue.variants,
                    suggestedCorrection: issue.suggestedCorrection,
                    affectedRows: issue.affectedRows,
                    suggestion: `Standardize to "${issue.suggestedCorrection}".`,
                });
            });
        }
    });

    return {
        issueCount: issues.length,
        issues,
    };
}

/**
 * Applies a set of user-approved fixes to produce cleaned rows.
 * `selectedFixes` is an array of issue objects (as returned by
 * generateCleaningReport) that the user chose to apply.
 * This is pure — it does not touch the database.
 */
function applyFixes(rows, selectedFixes) {
    let cleanedRows = rows.map((row) => ({ ...row }));
    const rowsToRemove = new Set();

    selectedFixes.forEach((fix) => {
        switch (fix.type) {
            case "duplicate_rows": {
                fix.affectedRowGroups.forEach((group) => {
                    // keep first, remove rest
                    group.slice(1).forEach((idx) => rowsToRemove.add(idx));
                });
                break;
            }

            case "category_inconsistency": {
                fix.affectedRows.forEach((idx) => {
                    if (cleanedRows[idx]) {
                        cleanedRows[idx][fix.column] =
                            fix.suggestedCorrection;
                    }
                });
                break;
            }

            case "whitespace_only": {
                fix.affectedRows.forEach((idx) => {
                    if (cleanedRows[idx]) {
                        cleanedRows[idx][fix.column] = "";
                    }
                });
                break;
            }

                     case "missing_values": {
                if (fix.strategy === "remove_rows") {
                    fix.affectedRows.forEach((idx) => rowsToRemove.add(idx));
                } else if (fix.fillValue !== null && fix.fillValue !== undefined) {
                    fix.affectedRows.forEach((idx) => {
                        if (cleanedRows[idx]) {
                            cleanedRows[idx][fix.column] = fix.fillValue;
                        }
                    });
                }
                break;
            }

            default:
                break;
        }
    });

    cleanedRows = cleanedRows.filter((_, idx) => !rowsToRemove.has(idx));

    return cleanedRows;
}

module.exports = {
    generateCleaningReport,
    applyFixes,
    previewMissingValueFix
};