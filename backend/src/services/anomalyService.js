// backend/src/services/anomalyService.js

/**
 * Deterministic anomaly detection for numeric columns.
 * Uses IQR (Interquartile Range) as the primary method — robust to skew,
 * doesn't assume a normal distribution like z-score does.
 * No AI involved.
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

function percentile(sortedNumbers, p) {
    const n = sortedNumbers.length;
    if (n === 0) return null;
    if (n === 1) return sortedNumbers[0];

    const index = (p / 100) * (n - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) return sortedNumbers[lower];

    const weight = index - lower;
    return (
        sortedNumbers[lower] * (1 - weight) +
        sortedNumbers[upper] * weight
    );
}

function classifyDeviation(value, lowerBound, upperBound, q1, q3) {
    const iqr = q3 - q1;
    if (iqr === 0) return "moderate";

    // How many IQRs past the fence is this value?
    const distancePastFence =
        value > upperBound
            ? (value - upperBound) / iqr
            : (lowerBound - value) / iqr;

    if (distancePastFence > 1.5) return "very high";
    if (distancePastFence > 0.5) return "high";
    return "moderate";
}

/**
 * Detects anomalies in a single numeric column using the 1.5*IQR rule.
 * Returns an array of anomaly objects, each referencing the row index
 * so the frontend/other services can look up the full row if needed.
 */
function detectColumnAnomalies(columnName, rows) {
    const numericEntries = [];

    rows.forEach((row, index) => {
        const raw = row[columnName];
        if (!isEmptyValue(raw) && isNumericString(raw)) {
            numericEntries.push({ index, value: toNumber(raw) });
        }
    });

    // Need a reasonable sample size for IQR to be meaningful.
    if (numericEntries.length < 4) {
        return {
            method: "iqr",
            expectedRange: null,
            anomalies: [],
            skipped: true,
            reason: "Not enough numeric values to compute a reliable range.",
        };
    }

    const sortedValues = [...numericEntries]
        .map((e) => e.value)
        .sort((a, b) => a - b);

    const q1 = percentile(sortedValues, 25);
    const q3 = percentile(sortedValues, 75);
    const iqr = q3 - q1;

    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const anomalies = numericEntries
        .filter((e) => e.value < lowerBound || e.value > upperBound)
        .map((e) => ({
            rowIndex: e.index,
            value: e.value,
            expectedRange: {
                min: Number(lowerBound.toFixed(2)),
                max: Number(upperBound.toFixed(2)),
            },
            deviation: classifyDeviation(
                e.value,
                lowerBound,
                upperBound,
                q1,
                q3
            ),
            direction: e.value > upperBound ? "above" : "below",
        }));

    return {
        method: "iqr",
        expectedRange: {
            min: Number(lowerBound.toFixed(2)),
            max: Number(upperBound.toFixed(2)),
        },
        anomalies,
        skipped: false,
    };
}

/**
 * Detects anomalies across all numeric columns in a dataset.
 * dataset.columns entries are expected to have { name, type }.
 * Numeric-ness is re-checked from actual values (same approach as
 * profileService) rather than trusting the stored type blindly.
 */
function detectDatasetAnomalies(dataset) {
    const rows = Array.isArray(dataset.rows) ? dataset.rows : [];
    const columns = Array.isArray(dataset.columns) ? dataset.columns : [];

    const results = columns.map((col) => {
        const columnResult = detectColumnAnomalies(col.name, rows);
        return {
            column: col.name,
            ...columnResult,
        };
    });

    // Only surface columns that actually contain numeric data
    // (columns with 0 numeric values just get skipped: true, anomalies: []).
    const relevantResults = results.filter(
        (r) => !r.skipped || r.anomalies.length > 0
    );

    const totalAnomalyCount = relevantResults.reduce(
        (acc, r) => acc + r.anomalies.length,
        0
    );

    return {
        totalAnomalyCount,
        columns: relevantResults,
    };
}

module.exports = {
    detectDatasetAnomalies,
};