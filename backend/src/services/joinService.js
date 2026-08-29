// backend/src/services/joinService.js
// Deterministic join key detection + execution. AI can suggest a key,
// but this module validates the suggestion by checking actual value
// overlap before trusting it — never joins on a hallucinated match.

function normalize(value) {
    return String(value).trim().toLowerCase();
}

/** Computes what fraction of column A's values also appear in column B. */
function computeOverlapRatio(rowsA, colA, rowsB, colB) {
    const valuesA = new Set(rowsA.map((r) => normalize(r[colA])).filter((v) => v !== ""));
    const valuesB = new Set(rowsB.map((r) => normalize(r[colB])).filter((v) => v !== ""));

    if (valuesA.size === 0) return 0;

    let matchCount = 0;
    for (const v of valuesA) {
        if (valuesB.has(v)) matchCount++;
    }
    return matchCount / valuesA.size;
}

/**
 * Deterministically finds the best join key pair between two datasets
 * by testing every column combination and picking the highest value
 * overlap. This is the source of truth — AI suggestions get checked
 * against this before being trusted.
 */
function detectBestJoinKey(datasetA, datasetB) {
    let best = null;

    datasetA.columns.forEach((colA) => {
        datasetB.columns.forEach((colB) => {
            const overlap = computeOverlapRatio(datasetA.rows, colA.name, datasetB.rows, colB.name);
            if (overlap > 0.3 && (!best || overlap > best.overlap)) {
                best = { columnA: colA.name, columnB: colB.name, overlap: Number(overlap.toFixed(2)) };
            }
        });
    });

    return best;
}

/**
 * Performs an inner join: rows from A and B where the key values match.
 * Column name collisions (other than the join key) get suffixed.
 */
function performJoin(datasetA, datasetB, columnA, columnB) {
    const indexB = new Map();
    datasetB.rows.forEach((row) => {
        const key = normalize(row[columnB]);
        if (!indexB.has(key)) indexB.set(key, []);
        indexB.get(key).push(row);
    });

    const columnNamesA = new Set(datasetA.columns.map((c) => c.name));
    const columnNamesB = new Set(datasetB.columns.map((c) => c.name));
    const collisions = [...columnNamesB].filter((n) => columnNamesA.has(n) && n !== columnB);

    const joinedRows = [];
    datasetA.rows.forEach((rowA) => {
        const key = normalize(rowA[columnA]);
        const matches = indexB.get(key) || [];
        matches.forEach((rowB) => {
            const merged = { ...rowA };
            Object.keys(rowB).forEach((k) => {
                if (k === columnB) return; // skip duplicate join key
                const outputKey = collisions.includes(k) ? `${k}_2` : k;
                merged[outputKey] = rowB[k];
            });
            joinedRows.push(merged);
        });
    });

    // Build resulting column list
    const resultColumns = [...datasetA.columns];
    datasetB.columns.forEach((col) => {
        if (col.name === columnB) return;
        const outputName = collisions.includes(col.name) ? `${col.name}_2` : col.name;
        resultColumns.push({ name: outputName, type: col.type });
    });

    return { rows: joinedRows, columns: resultColumns };
}

module.exports = { detectBestJoinKey, performJoin };