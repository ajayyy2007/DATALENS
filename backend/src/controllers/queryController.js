const Dataset = require("../models/Dataset");
const QueryHistory = require("../models/QueryHistory");
const { buildQueryPlan, validatePlan, executePlan } = require("../services/queryPlanService");
const { proposeAiQueryPlan } = require("../services/aiQueryService");
const { segmentQuestion } = require("../services/querySegmentationService");
const { synthesizeAnswer } = require("../services/answerSynthesisService");

const runQuery = async (req, res) => {
    try {
        const { datasetId, question } = req.body;

        if (!datasetId || !question) {
            return res.status(400).json({
                message: "Dataset and question are required"
            });
        }

        const dataset = await Dataset.findOne({
            _id: datasetId,
            owner: req.user.userId
        });

        if (!dataset) {
            return res.status(404).json({
                message: "Dataset not found"
            });
        }

        // Step 1: split the question deterministically into independent parts.
        const segments = segmentQuestion(question);

        // Step 2: for each segment, try AI first, then keyword fallback.
        // Each segment is handled independently — one bad segment never
        // blocks the others.
        const outcomes = [];
        let anyAiUsed = false;

        for (const segment of segments) {
            let plan = await proposeAiQueryPlan(segment, dataset.columns);
            let usedAi = Boolean(plan);

            if (!plan) {
                plan = buildQueryPlan(segment, dataset.columns);
            } else {
                anyAiUsed = true;
            }

            if (!plan) {
                outcomes.push({
                    plan: { operation: null, segment },
                    error: `Couldn't understand "${segment}"`,
                });
                continue;
            }

            const validation = validatePlan(plan, dataset.columns);
            if (!validation.valid) {
                outcomes.push({ plan, error: validation.reason });
                continue;
            }

            const results = executePlan(plan, dataset.rows);
            outcomes.push({ plan, results, source: usedAi ? "ai" : "keyword" });
        }

        const anySucceeded = outcomes.some((o) => o.results);
        const totalResultRows = outcomes.reduce(
            (acc, o) => acc + (o.results ? o.results.length : 0),
            0
        );

        // Step 3: build a plain-language answer from the real computed
        // results — deterministic, cannot hallucinate.
        const answer = anySucceeded ? synthesizeAnswer(outcomes) : null;

        await QueryHistory.create({
            owner: req.user.userId,
            datasetId: dataset._id,
            datasetName: dataset.name,
            question,
            resultRowCount: totalResultRows,
            status: anySucceeded ? "success" : "error",
            errorMessage: anySucceeded ? undefined : outcomes[0]?.error,
        });

        if (!anySucceeded) {
            return res.status(400).json({
                message: outcomes[0]?.error || "Couldn't answer that question.",
            });
        }

        return res.status(200).json({
            message: "Query executed successfully",
            answer,
            source: anyAiUsed ? "ai" : "keyword",
            outcomes,
        });

    } catch (error) {
        console.error("Query error:", error);

        return res.status(500).json({
            message: "Query failed",
            error: error.message
        });
    }
};

const getQueryHistory = async (req, res) => {
    try {
        const history = await QueryHistory.find({
            owner: req.user.userId
        })
            .sort({ createdAt: -1 })
            .limit(100);

        return res.status(200).json({ history });
    } catch (error) {
        console.error("Error fetching query history:", error);
        return res.status(500).json({ message: "Failed to fetch query history" });
    }
};

module.exports = {
    runQuery,
    getQueryHistory
};