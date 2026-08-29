// backend/src/services/investigationService.js
// Orchestrates existing deterministic services into one report.
// No new detection logic here — pure composition + narrative summary.

const { profileDataset } = require("./profileService");
const { detectDatasetAnomalies } = require("./anomalyService");
const { generateCleaningReport } = require("./cleaningService");
const { suggestCharts } = require("./chartService");

function buildSummarySentences(profile, anomalies, cleaning) {
    const sentences = [];
    const s = profile.summary;

    sentences.push(
        `This dataset has ${s.rowCount} rows and ${s.columnCount} columns ` +
        `(${s.numericColumnCount} numeric, ${s.categoricalColumnCount} categorical` +
        `${s.textColumnCount ? `, ${s.textColumnCount} text` : ""}` +
        `${s.dateColumnCount ? `, ${s.dateColumnCount} date` : ""}).`
    );

    if (s.missingCells === 0 && s.duplicateRows === 0 && s.invalidNumericCells === 0) {
        sentences.push("No missing values, duplicates, or invalid numeric entries were found.");
    } else {
        const issues = [];
        if (s.missingCells > 0) issues.push(`${s.missingCells} missing value(s)`);
        if (s.duplicateRows > 0) issues.push(`${s.duplicateRows} duplicate row(s)`);
        if (s.invalidNumericCells > 0) issues.push(`${s.invalidNumericCells} invalid numeric value(s)`);
        sentences.push(`Found ${issues.join(", ")}.`);
    }

    if (anomalies.totalAnomalyCount > 0) {
        sentences.push(
            `${anomalies.totalAnomalyCount} statistical anomal${anomalies.totalAnomalyCount === 1 ? "y was" : "ies were"} detected across numeric columns.`
        );
    } else {
        sentences.push("No statistical anomalies were detected.");
    }

    if (cleaning.issueCount > 0) {
        sentences.push(
            `The cleaning assistant found ${cleaning.issueCount} data quality issue(s) that could be reviewed and fixed.`
        );
    }

    return sentences;
}

/** Finds the single best-performing row for the first numeric column, if any. */
function findTopPerformer(dataset) {
    const numericCol = dataset.columns.find((c) => c.type === "number");
    const catCol = dataset.columns.find((c) => c.type !== "number");
    if (!numericCol) return null;

    const sorted = [...dataset.rows]
        .filter((r) => r[numericCol.name] !== undefined && !isNaN(Number(r[numericCol.name])))
        .sort((a, b) => Number(b[numericCol.name]) - Number(a[numericCol.name]));

    if (sorted.length === 0) return null;

    const topRow = sorted[0];
    return {
        column: numericCol.name,
        value: Number(topRow[numericCol.name]),
        label: catCol ? topRow[catCol.name] : null,
    };
}

/** Generates suggested natural-language questions based on actual schema. */
function generateSuggestedQuestions(dataset) {
    const numericCols = dataset.columns.filter((c) => c.type === "number");
    const catCols = dataset.columns.filter((c) => c.type !== "number");

    const questions = [];

    if (numericCols[0]) {
        questions.push(`What is the average ${numericCols[0].name}?`);
        questions.push(`Show the top 5 rows by ${numericCols[0].name}`);
    }
    if (numericCols[1]) {
        questions.push(`What is the total ${numericCols[1].name}?`);
    }
    if (numericCols[0] && catCols[0]) {
        questions.push(`Show ${numericCols[0].name} by ${catCols[0].name}`);
    }
    if (catCols[0]) {
        questions.push(`How many rows are in each ${catCols[0].name}?`);
    }

    return questions.slice(0, 6);
}

function computeOverallStatus(profile, anomalies, cleaning) {
    const score = profile.summary.qualityScore;
    if (score >= 90 && anomalies.totalAnomalyCount === 0) return "clean";
    if (score >= 70) return "minor_issues";
    return "needs_attention";
}

function runInvestigation(dataset) {
    const profile = profileDataset(dataset);
    const anomalies = detectDatasetAnomalies(dataset);
    const cleaning = generateCleaningReport(dataset);
    const charts = suggestCharts(dataset);

    return {
        status: computeOverallStatus(profile, anomalies, cleaning),
        summarySentences: buildSummarySentences(profile, anomalies, cleaning),
        topPerformer: findTopPerformer(dataset),
        profile,
        anomalies,
        cleaning,
        charts,
        suggestedQuestions: generateSuggestedQuestions(dataset),
    };
}

module.exports = { runInvestigation };