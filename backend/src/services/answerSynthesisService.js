// backend/src/services/answerSynthesisService.js
// Turns computed outcomes into a plain-language answer summary.
// This is deterministic — built entirely from real computed numbers,
// never from AI text generation, so it can never hallucinate a fact.

function describeOutcome(outcome) {
    const { plan, results, error } = outcome;

    if (error) {
        return `Couldn't answer "${plan?.operation || "one part"}": ${error}.`;
    }

    if (!results || results.length === 0) {
        return `No matching data found for that part of the question.`;
    }

    switch (plan.operation) {
        case "average":
        case "sum": {
            const r = results[0];
            return `${r.metric}: ${r.value}.`;
        }
        case "count": {
            const r = results[0];
            if (r.count !== undefined) {
                const key = Object.keys(r).find((k) => k !== "count");
                return `${r[key]}: ${r.count} row(s).`;
            }
            return `Total rows: ${r.value}.`;
        }
        case "max":
            return `The highest ${plan.column} is ${results[0][plan.column]}.`;
        case "min":
            return `The lowest ${plan.column} is ${results[0][plan.column]}.`;
        case "top_n":
            return `Top ${results.length} row(s) by ${plan.column} shown below.`;
        case "group_sum":
            return `Total ${plan.column} broken down by ${plan.groupBy} — ${results.length} group(s) shown below.`;
        case "group_average":
            return `Average ${plan.column} broken down by ${plan.groupBy} — ${results.length} group(s) shown below.`;
        case "filter_where":
            return `Found ${results.length} row(s) matching ${plan.filterColumn} = "${plan.filterValue}".`;
        case "all_rows":
            return `Showing ${results.length} row(s) of raw data.`;
        default:
            return `${results.length} result(s) found.`;
    }
}

function synthesizeAnswer(outcomes) {
    return outcomes.map(describeOutcome).join(" ");
}

module.exports = { synthesizeAnswer };