// backend/src/services/profileService.js

/**
 * Deterministic dataset profiling.
 * No AI involved. Pure statistics based on dataset.columns and dataset.rows.
 */

function isEmptyValue(value) {
    return (
        value === null ||
        value === undefined ||
        (typeof value === "string" && value.trim() === "")
    );
}

function isNumericString(value) {
    if (typeof value === "number") return !Number.isNaN(value);
    if (typeof value !== "string") return false;
    const trimmed = value.trim();
    if (trimmed === "") return false;
    return !Number.isNaN(Number(trimmed));
}

function toNumber(value) {
    if (typeof value === "number") return value;
    return Number(String(value).trim());
}

function median(sortedNumbers) {
    const n = sortedNumbers.length;
    if (n === 0) return null;
    const mid = Math.floor(n / 2);
    if (n % 2 === 0) {
        return (sortedNumbers[mid - 1] + sortedNumbers[mid]) / 2;
    }
    return sortedNumbers[mid];
}

/**
 * Infer a practical "profile type" for a column, independent of the
 * type stored at upload time. This lets profiling stay accurate even
 * if the stored column.type is generic.
 */
function inferColumnProfileType(values) {
    const nonEmpty = values.filter((v) => !isEmptyValue(v));
    if (nonEmpty.length === 0) return "unknown";

    const numericCount = nonEmpty.filter(isNumericString).length;
    if (numericCount / nonEmpty.length >= 0.9) return "numeric";

    // crude date detection: parses cleanly AND contains a digit + separator
    const dateLikeCount = nonEmpty.filter((v) => {
        if (typeof v !== "string") return false;
        const looksDateShaped = /\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(v);
        if (!looksDateShaped) return false;
        const parsed = Date.parse(v);
        return !Number.isNaN(parsed);
    }).length;
    if (dateLikeCount / nonEmpty.length >= 0.9) return "date";

    // categorical vs free text: based on cardinality ratio
    const uniqueCount = new Set(
        nonEmpty.map((v) => String(v).trim().toLowerCase())
    ).size;
    const uniqueRatio = uniqueCount / nonEmpty.length;

    if (uniqueRatio <= 0.5 || uniqueCount <= 20) return "categorical";
    return "text";
}

function profileNumericColumn(values) {
    const numeric = values
        .filter((v) => !isEmptyValue(v) && isNumericString(v))
        .map(toNumber);

    const invalidCount = values.filter(
        (v) => !isEmptyValue(v) && !isNumericString(v)
    ).length;

    if (numeric.length === 0) {
        return {
            min: null,
            max: null,
            average: null,
            median: null,
            invalidCount,
        };
    }

    const sorted = [...numeric].sort((a, b) => a - b);
    const sum = numeric.reduce((acc, n) => acc + n, 0);

    return {
        min: sorted[0],
        max: sorted[sorted.length - 1],
        average: Number((sum / numeric.length).toFixed(2)),
        median: median(sorted),
        invalidCount,
    };
}

function detectCategoryInconsistencies(values) {
    // Groups values that are identical after trim+lowercase but differ
    // in raw form (casing/whitespace) — a lightweight, deterministic signal.
    const groups = new Map(); // normalized -> Set of raw variants

    values.forEach((v) => {
        if (isEmptyValue(v)) return;
        const raw = String(v);
        const normalized = raw.trim().toLowerCase();
        if (!groups.has(normalized)) groups.set(normalized, new Set());
        groups.get(normalized).add(raw);
    });

    const inconsistentGroups = [];
    for (const [normalized, variants] of groups.entries()) {
        if (variants.size > 1) {
            inconsistentGroups.push({
                normalized,
                variants: Array.from(variants),
            });
        }
    }
    return inconsistentGroups;
}

function profileColumn(columnName, declaredType, rows) {
    const values = rows.map((row) => row[columnName]);
    const totalCount = values.length;
    const missingCount = values.filter(isEmptyValue).length;
    const uniqueCount = new Set(
        values
            .filter((v) => !isEmptyValue(v))
            .map((v) => String(v).trim().toLowerCase())
    ).size;

    const profileType = inferColumnProfileType(values);

    const base = {
        name: columnName,
        declaredType: declaredType || "unknown",
        profileType,
        totalCount,
        missingCount,
        uniqueCount,
    };

    if (profileType === "numeric") {
        const stats = profileNumericColumn(values);
        return { ...base, stats };
    }

    if (profileType === "categorical") {
        const inconsistencies = detectCategoryInconsistencies(values);
        return {
            ...base,
            stats: {
                inconsistentGroups: inconsistencies,
            },
        };
    }

    // text / date / unknown — no numeric stats
    return { ...base, stats: null };
}

function countDuplicateRows(rows) {
    const seen = new Map();
    let duplicateCount = 0;

    rows.forEach((row) => {
        // Stable stringify: sort keys so key order doesn't affect comparison
        const key = JSON.stringify(
            Object.keys(row)
                .sort()
                .reduce((acc, k) => {
                    acc[k] = row[k];
                    return acc;
                }, {})
        );
        const count = seen.get(key) || 0;
        if (count >= 1) duplicateCount += 1;
        seen.set(key, count + 1);
    });

    return duplicateCount;
}

function computeQualityScore({ missingCells, totalCells, duplicateRows, totalRows, invalidNumericCells, numericCells }) {
    if (totalCells === 0) return 0;

    const missingPenalty = totalCells > 0 ? missingCells / totalCells : 0;
    const duplicatePenalty = totalRows > 0 ? duplicateRows / totalRows : 0;
    const invalidPenalty = numericCells > 0 ? invalidNumericCells / numericCells : 0;

    // Weighted deduction — deterministic, no AI.
    const rawScore =
        100 -
        missingPenalty * 40 -
        duplicatePenalty * 30 -
        invalidPenalty * 30;

    return Math.max(0, Math.round(rawScore));
}

function profileDataset(dataset) {
    const rows = Array.isArray(dataset.rows) ? dataset.rows : [];
    const columns = Array.isArray(dataset.columns) ? dataset.columns : [];

    const columnProfiles = columns.map((col) =>
        profileColumn(col.name, col.type, rows)
    );

    const totalCells = rows.length * columns.length;
    const missingCells = columnProfiles.reduce(
        (acc, c) => acc + c.missingCount,
        0
    );
    const numericColumns = columnProfiles.filter(
        (c) => c.profileType === "numeric"
    );
    const numericCells = numericColumns.length * rows.length;
    const invalidNumericCells = numericColumns.reduce(
        (acc, c) => acc + (c.stats?.invalidCount || 0),
        0
    );
    const duplicateRows = countDuplicateRows(rows);

    const categoricalInconsistencyCount = columnProfiles
        .filter((c) => c.profileType === "categorical")
        .reduce((acc, c) => acc + (c.stats?.inconsistentGroups?.length || 0), 0);

    const qualityScore = computeQualityScore({
        missingCells,
        totalCells,
        duplicateRows,
        totalRows: rows.length,
        invalidNumericCells,
        numericCells,
    });

    return {
        summary: {
            rowCount: rows.length,
            columnCount: columns.length,
            numericColumnCount: numericColumns.length,
            categoricalColumnCount: columnProfiles.filter(
                (c) => c.profileType === "categorical"
            ).length,
            textColumnCount: columnProfiles.filter(
                (c) => c.profileType === "text"
            ).length,
            dateColumnCount: columnProfiles.filter(
                (c) => c.profileType === "date"
            ).length,
            missingCells,
            duplicateRows,
            invalidNumericCells,
            categoricalInconsistencyCount,
            qualityScore,
        },
        columns: columnProfiles,
    };
}

module.exports = {
    profileDataset,
};