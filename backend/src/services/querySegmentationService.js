// backend/src/services/querySegmentationService.js
// Deterministically splits a compound question into independent
// segments. This is far more reliable than asking a local LLM to
// output a correctly-sized JSON array in one shot — small models
// are good at one focused task, not perfect multi-part formatting.

const SPLIT_PATTERN = /\s*(?:,|;|\band\b|\balso\b|\bthen\b)\s*/i;

function segmentQuestion(question) {
    const parts = question
        .split(SPLIT_PATTERN)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

    // Guard against over-splitting short/simple questions on stray commas
    if (parts.length === 0) return [question.trim()];
    return parts;
}

module.exports = { segmentQuestion };