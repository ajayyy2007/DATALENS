// backend/src/services/aiEditService.js
// Asks Ollama to turn a natural-language edit instruction into a
// structured plan. Never mutates data itself.

const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL = "llama3.1";
const TIMEOUT_MS = 45000;

function buildSystemPrompt(columns) {
    const columnList = columns.map((c) => `- ${c.name} (${c.type})`).join("\n");

    return `You convert a user's instruction to edit a dataset into a single JSON edit plan. You do not perform the edit — you only describe it.

Dataset columns:
${columnList}

Allowed "operation" values:
- "set_cell_where": change a column's value for row(s) matching a condition. Needs "whereColumn", "whereValue", "targetColumn", "newValue".
- "delete_rows_where": delete row(s) matching a condition. Needs "whereColumn", "whereValue".
- "add_row": add a new row. Needs "newRow" as an object with column:value pairs using only real column names.

Rules:
- "whereColumn", "targetColumn", and keys in "newRow" MUST be exact column names from the list above.
- Respond with ONLY a single JSON object, no explanation, no markdown.
- If the instruction is unclear or not possible with these columns, respond with exactly: {"operation": null}

Example: {"operation": "set_cell_where", "whereColumn": "Product", "whereValue": "Laptop", "targetColumn": "Price", "newValue": 55000}`;
}

function extractJson(text) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
        return JSON.parse(match[0]);
    } catch {
        return null;
    }
}

async function proposeEditPlan(instruction, columns) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(OLLAMA_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: MODEL,
                system: buildSystemPrompt(columns),
                prompt: instruction,
                stream: false,
                format: "json",
            }),
            signal: controller.signal,
        });

        clearTimeout(timeout);
        if (!response.ok) return null;

        const data = await response.json();
        const parsed = extractJson(data.response || "");

        if (!parsed || !parsed.operation) return null;
        return parsed;
    } catch (error) {
        clearTimeout(timeout);
        console.error("AI edit planning failed:", error.message);
        return null;
    }
}

module.exports = { proposeEditPlan };