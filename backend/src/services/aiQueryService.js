// backend/src/services/aiQueryService.js
// Sends ONE question segment + the real dataset schema to a local
// Ollama model and asks for a SINGLE structured query plan. Asking
// for one focused thing at a time is far more reliable with small
// local models than asking for a full multi-item JSON array.
// This NEVER executes anything — it only proposes a plan.
// queryController.js validates + executes it before anything runs
// against real data. AI proposes, backend decides.

const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL = "llama3.1";
const TIMEOUT_MS = 30000;

const ALLOWED_OPERATIONS = [
    "top_n", "max", "min", "average", "sum", "count",
    "group_sum", "group_average", "all_rows", "filter_where",
];

function buildSystemPrompt(columns) {
    const columnList = columns
        .map((c) => `- ${c.name} (${c.type === "number" ? "numeric" : "text/category"})`)
        .join("\n");

    return `You are a query planner. Convert ONE user request about a dataset into ONE JSON object. Output ONLY that JSON object — no explanation, no markdown, no code fences.

Dataset columns:
${columnList}

Pick exactly one "operation":
- {"operation":"top_n","column":"<numeric col>","order":"desc","limit":3}
- {"operation":"max","column":"<numeric col>"}
- {"operation":"min","column":"<numeric col>"}
- {"operation":"average","column":"<numeric col>"}
- {"operation":"sum","column":"<numeric col>"}
- {"operation":"count","filterColumn":"<col or omit>","filterValue":"<value or omit>"}
- {"operation":"group_sum","column":"<numeric col>","groupBy":"<category col>"}
- {"operation":"group_average","column":"<numeric col>","groupBy":"<category col>"}
- {"operation":"all_rows"}
- {"operation":"filter_where","filterColumn":"<category col>","filterValue":"<exact value>"}

RULES:
- "column", "groupBy", "filterColumn" must be EXACT column names from the list above.
- Use "group_sum"/"group_average" for "X by Y" phrasing (per-group breakdown), not the plain average/sum.
- If a specific category value is mentioned (a product name, status, etc), use filter_where or count with filterValue.
- If nothing matches, output: {"operation": null}

EXAMPLES:
"average price" -> {"operation":"average","column":"Price"}
"top 5 by sales" -> {"operation":"top_n","column":"Sales","order":"desc","limit":5}
"show Electronics products" -> {"operation":"filter_where","filterColumn":"Category","filterValue":"Electronics"}
"show full data" -> {"operation":"all_rows"}
"sales by category" -> {"operation":"group_sum","column":"Sales","groupBy":"Category"}
"average sales by product" -> {"operation":"group_average","column":"Sales","groupBy":"Product"}
"how many rows are Furniture" -> {"operation":"count","filterColumn":"Category","filterValue":"Furniture"}

Now answer this ONE request with ONE JSON object only.`;
}

function extractJsonObject(text) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
        return JSON.parse(match[0]);
    } catch {
        return null;
    }
}

/**
 * Proposes a single query plan for a single question segment.
 * Returns null on any failure (unreachable, timeout, invalid JSON,
 * disallowed operation, unknown column) — caller falls back to the
 * deterministic keyword planner for this segment.
 */
async function proposeAiQueryPlan(questionSegment, columns) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const startTime = Date.now();

    try {
        const response = await fetch(OLLAMA_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: MODEL,
                system: buildSystemPrompt(columns),
                prompt: questionSegment,
                stream: false,
                format: "json",
                options: { temperature: 0.1 },
            }),
            signal: controller.signal,
        });

        clearTimeout(timeout);
        console.log(`Ollama answered "${questionSegment}" in ${Date.now() - startTime}ms`);

        if (!response.ok) return null;

        const data = await response.json();
        const parsed = extractJsonObject(data.response || "");

        if (!parsed || !parsed.operation) return null;
        if (!ALLOWED_OPERATIONS.includes(parsed.operation)) return null;

        const columnNames = columns.map((c) => c.name);
        if (parsed.column && !columnNames.includes(parsed.column)) return null;
        if (parsed.groupBy && !columnNames.includes(parsed.groupBy)) return null;
        if (parsed.filterColumn && !columnNames.includes(parsed.filterColumn)) return null;

        return parsed;
    } catch (error) {
        clearTimeout(timeout);
        console.error(`Ollama failed on "${questionSegment}" after ${Date.now() - startTime}ms:`, error.message);
        return null;
    }
}

module.exports = { proposeAiQueryPlan };