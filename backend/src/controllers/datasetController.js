const fs = require("fs");
const csv = require("csv-parser");

const Dataset = require("../models/Dataset");
const DatasetGroup = require("../models/DatasetGroup");
const { profileDataset } = require("../services/profileService");
const { detectDatasetAnomalies } = require("../services/anomalyService");
const { generateCleaningReport, applyFixes, previewMissingValueFix } = require("../services/cleaningService");
const { suggestCharts } = require("../services/chartService");
const { compareDatasets } = require("../services/comparisonService");
const { buildColumnSignature } = require("../services/trendService");
const { runInvestigation } = require("../services/investigationService");
const EditHistory = require("../models/EditHistory");
const { validateEditPlan, previewEditPlan, applyEditPlan } = require("../services/editPlanService");
const { proposeEditPlan } = require("../services/aiEditService");
const { detectBestJoinKey, performJoin } = require("../services/joinService");

const previewMissingValueStrategy = async (req, res) => {
    try {
        const dataset = await Dataset.findOne({
            _id: req.params.id,
            owner: req.user.userId,
        });

        if (!dataset) {
            return res.status(404).json({ message: "Dataset not found" });
        }

        const { column, strategy } = req.query;

        if (!column || !strategy) {
            return res.status(400).json({ message: "column and strategy are required" });
        }

        const validStrategies = ["median", "mean", "mode", "remove_rows"];
        if (!validStrategies.includes(strategy)) {
            return res.status(400).json({ message: "Invalid strategy" });
        }

        const preview = previewMissingValueFix(dataset, column, strategy);

        if (!preview) {
            return res.status(400).json({ message: "Invalid column" });
        }

        return res.status(200).json({ preview });
    } catch (error) {
        console.error("Error previewing missing value fix:", error);
        return res.status(500).json({ message: "Failed to preview fix" });
    }
};

const investigateDataset = async (req, res) => {
    try {
        const dataset = await Dataset.findOne({
            _id: req.params.id,
            owner: req.user.userId,
        });

        if (!dataset) {
            return res.status(404).json({ message: "Dataset not found" });
        }

        const report = runInvestigation(dataset);

        return res.status(200).json({
            datasetId: dataset._id,
            name: dataset.name,
            report,
        });
    } catch (error) {
        console.error("Error running investigation:", error);
        return res.status(500).json({ message: "Failed to run investigation" });
    }
};

const compareTwoDatasets = async (req, res) => {
    try {
        const { datasetAId, datasetBId } = req.body;

        const [datasetA, datasetB] = await Promise.all([
            Dataset.findOne({ _id: datasetAId, owner: req.user.userId }),
            Dataset.findOne({ _id: datasetBId, owner: req.user.userId }),
        ]);

        if (!datasetA || !datasetB) {
            return res.status(404).json({ message: "One or both datasets not found" });
        }

        const comparison = compareDatasets(datasetA, datasetB);

        return res.status(200).json({
            datasetA: { id: datasetA._id, name: datasetA.name },
            datasetB: { id: datasetB._id, name: datasetB.name },
            comparison,
        });
    } catch (error) {
        console.error("Error comparing datasets:", error);
        return res.status(500).json({ message: "Failed to compare datasets" });
    }
};

const getDatasetVersions = async (req, res) => {
    try {
        const dataset = await Dataset.findOne({
            _id: req.params.id,
            owner: req.user.userId,
        });

        if (!dataset) {
            return res.status(404).json({ message: "Dataset not found" });
        }

        const rootId = dataset.sourceDatasetId || dataset._id;

        const versions = await Dataset.find({
            owner: req.user.userId,
            $or: [{ _id: rootId }, { sourceDatasetId: rootId }],
        })
            .select("-rows")
            .sort({ createdAt: 1 });

        return res.status(200).json({ versions });
    } catch (error) {
        console.error("Error fetching versions:", error);
        return res.status(500).json({ message: "Failed to fetch versions" });
    }
};

const getDatasetProfile = async (req, res) => {
    try {
        const dataset = await Dataset.findOne({
            _id: req.params.id,
            owner: req.user.userId,
        });

        if (!dataset) {
            return res.status(404).json({ message: "Dataset not found" });
        }

        const profile = profileDataset(dataset);

        return res.status(200).json({
            datasetId: dataset._id,
            name: dataset.name,
            profile,
        });
    } catch (error) {
        console.error("Error generating dataset profile:", error);
        return res.status(500).json({
            message: "Failed to generate dataset profile",
        });
    }
};

const getDatasetCharts = async (req, res) => {
    try {
        const dataset = await Dataset.findOne({
            _id: req.params.id,
            owner: req.user.userId,
        });

        if (!dataset) {
            return res.status(404).json({ message: "Dataset not found" });
        }

        const charts = suggestCharts(dataset);

        return res.status(200).json({
            datasetId: dataset._id,
            name: dataset.name,
            charts,
        });
    } catch (error) {
        console.error("Error generating charts:", error);
        return res.status(500).json({ message: "Failed to generate charts" });
    }
};

const getCleaningSuggestions = async (req, res) => {
    try {
        const dataset = await Dataset.findOne({
            _id: req.params.id,
            owner: req.user.userId,
        });

        if (!dataset) {
            return res.status(404).json({ message: "Dataset not found" });
        }

        const report = generateCleaningReport(dataset);

        return res.status(200).json({
            datasetId: dataset._id,
            name: dataset.name,
            report,
        });
    } catch (error) {
        console.error("Error generating cleaning report:", error);
        return res.status(500).json({
            message: "Failed to generate cleaning suggestions",
        });
    }
};

const applyCleaningFixes = async (req, res) => {
    try {
        const dataset = await Dataset.findOne({
            _id: req.params.id,
            owner: req.user.userId,
        });

        if (!dataset) {
            return res.status(404).json({ message: "Dataset not found" });
        }

        const { selectedFixes } = req.body;

        if (!Array.isArray(selectedFixes) || selectedFixes.length === 0) {
            return res.status(400).json({
                message: "No fixes were selected to apply",
            });
        }

        const cleanedRows = applyFixes(dataset.rows, selectedFixes);

        const cleanedDataset = await Dataset.create({
            name: `${dataset.name} (cleaned)`,
            originalFileName: dataset.originalFileName,
            owner: req.user.userId,
            columns: dataset.columns,
            rows: cleanedRows,
            rowCount: cleanedRows.length,
            sourceDatasetId: dataset._id,
            versionLabel: "cleaned",
        });

        return res.status(201).json({
            message: "Cleaned dataset created successfully",
            dataset: {
                id: cleanedDataset._id,
                name: cleanedDataset.name,
                rowCount: cleanedDataset.rowCount,
                sourceDatasetId: cleanedDataset.sourceDatasetId,
            },
        });
    } catch (error) {
        console.error("Error applying cleaning fixes:", error);
        return res.status(500).json({
            message: "Failed to apply cleaning fixes",
        });
    }
};

const getDatasetAnomalies = async (req, res) => {
    try {
        const dataset = await Dataset.findOne({
            _id: req.params.id,
            owner: req.user.userId,
        });

        if (!dataset) {
            return res.status(404).json({ message: "Dataset not found" });
        }

        const anomalies = detectDatasetAnomalies(dataset);

        return res.status(200).json({
            datasetId: dataset._id,
            name: dataset.name,
            anomalies,
        });
    } catch (error) {
        console.error("Error detecting anomalies:", error);
        return res.status(500).json({
            message: "Failed to detect anomalies",
        });
    }
};

const deleteDataset = async (req, res) => {
    try {
        const dataset = await Dataset.findOneAndDelete({
            _id: req.params.id,
            owner: req.user.userId,
        });

        if (!dataset) {
            return res.status(404).json({ message: "Dataset not found" });
        }

        return res.status(200).json({ message: "Dataset deleted successfully" });
    } catch (error) {
        console.error("Error deleting dataset:", error);
        return res.status(500).json({ message: "Failed to delete dataset" });
    }
};

const previewDatasetEdit = async (req, res) => {
    try {
        const dataset = await Dataset.findOne({
            _id: req.params.id,
            owner: req.user.userId,
        });

        if (!dataset) {
            return res.status(404).json({ message: "Dataset not found" });
        }

        const { instruction } = req.body;
        if (!instruction) {
            return res.status(400).json({ message: "Instruction is required" });
        }

        const plan = await proposeEditPlan(instruction, dataset.columns);

        if (!plan) {
            return res.status(400).json({
                message: "Couldn't understand that edit instruction. Try: 'change Price to 500 where Product is Laptop' or 'delete rows where Category is Furniture'.",
            });
        }

        const validation = validateEditPlan(plan, dataset.columns, dataset.rows.length);
        if (!validation.valid) {
            return res.status(400).json({ message: validation.reason });
        }

        const affectedRowIndices = previewEditPlan(plan, dataset.rows);

        return res.status(200).json({
            plan,
            affectedRowCount: plan.operation === "add_row" ? 1 : affectedRowIndices.length,
            preview: plan.operation === "add_row"
                ? [plan.newRow]
                : affectedRowIndices.slice(0, 10).map((idx) => dataset.rows[idx]),
        });
    } catch (error) {
        console.error("Error previewing edit:", error);
        return res.status(500).json({ message: "Failed to preview edit" });
    }
};

const applyDatasetEdit = async (req, res) => {
    try {
        const dataset = await Dataset.findOne({
            _id: req.params.id,
            owner: req.user.userId,
        });

        if (!dataset) {
            return res.status(404).json({ message: "Dataset not found" });
        }

        const { plan, instruction } = req.body;
        if (!plan) {
            return res.status(400).json({ message: "Plan is required" });
        }

        const validation = validateEditPlan(plan, dataset.columns, dataset.rows.length);
        if (!validation.valid) {
            return res.status(400).json({ message: validation.reason });
        }

        await EditHistory.create({
            owner: req.user.userId,
            datasetId: dataset._id,
            instruction: instruction || "",
            previousRows: dataset.rows,
            editSummary: `${plan.operation} on ${plan.targetColumn || plan.whereColumn || "dataset"}`,
        });

        const newRows = applyEditPlan(plan, dataset.rows);

        dataset.rows = newRows;
        dataset.rowCount = newRows.length;
        await dataset.save();

        return res.status(200).json({
            message: "Edit applied successfully",
            rowCount: dataset.rowCount,
        });
    } catch (error) {
        console.error("Error applying edit:", error);
        return res.status(500).json({ message: "Failed to apply edit" });
    }
};

const undoDatasetEdit = async (req, res) => {
    try {
        const dataset = await Dataset.findOne({
            _id: req.params.id,
            owner: req.user.userId,
        });

        if (!dataset) {
            return res.status(404).json({ message: "Dataset not found" });
        }

        const lastEdit = await EditHistory.findOne({
            datasetId: dataset._id,
            owner: req.user.userId,
        }).sort({ createdAt: -1 });

        if (!lastEdit) {
            return res.status(400).json({ message: "No edits to undo" });
        }

        dataset.rows = lastEdit.previousRows;
        dataset.rowCount = lastEdit.previousRows.length;
        await dataset.save();

        await EditHistory.deleteOne({ _id: lastEdit._id });

        return res.status(200).json({
            message: "Last edit undone",
            rowCount: dataset.rowCount,
        });
    } catch (error) {
        console.error("Error undoing edit:", error);
        return res.status(500).json({ message: "Failed to undo edit" });
    }
};

const suggestJoinKey = async (req, res) => {
    try {
        const { datasetAId, datasetBId } = req.body;

        const [datasetA, datasetB] = await Promise.all([
            Dataset.findOne({ _id: datasetAId, owner: req.user.userId }),
            Dataset.findOne({ _id: datasetBId, owner: req.user.userId }),
        ]);

        if (!datasetA || !datasetB) {
            return res.status(404).json({ message: "One or both datasets not found" });
        }

        const suggestion = detectBestJoinKey(datasetA, datasetB);

        if (!suggestion) {
            return res.status(400).json({
                message: "No matching column found between these datasets to join on.",
            });
        }

        return res.status(200).json({ suggestion });
    } catch (error) {
        console.error("Error suggesting join key:", error);
        return res.status(500).json({ message: "Failed to suggest join key" });
    }
};

const joinDatasets = async (req, res) => {
    try {
        const { datasetAId, datasetBId, columnA, columnB } = req.body;

        const [datasetA, datasetB] = await Promise.all([
            Dataset.findOne({ _id: datasetAId, owner: req.user.userId }),
            Dataset.findOne({ _id: datasetBId, owner: req.user.userId }),
        ]);

        if (!datasetA || !datasetB) {
            return res.status(404).json({ message: "One or both datasets not found" });
        }

        const columnNamesA = datasetA.columns.map((c) => c.name);
        const columnNamesB = datasetB.columns.map((c) => c.name);

        if (!columnNamesA.includes(columnA) || !columnNamesB.includes(columnB)) {
            return res.status(400).json({ message: "Invalid join columns" });
        }

        const { rows, columns } = performJoin(datasetA, datasetB, columnA, columnB);

        if (rows.length === 0) {
            return res.status(400).json({ message: "Join produced no matching rows" });
        }

        const joinedDataset = await Dataset.create({
            name: `${datasetA.name} + ${datasetB.name} (joined)`,
            originalFileName: `${datasetA.originalFileName} + ${datasetB.originalFileName}`,
            owner: req.user.userId,
            columns,
            rows,
            rowCount: rows.length,
            versionLabel: "joined",
        });

        return res.status(201).json({
            message: "Datasets joined successfully",
            dataset: {
                id: joinedDataset._id,
                name: joinedDataset.name,
                rowCount: joinedDataset.rowCount,
            },
        });
    } catch (error) {
        console.error("Error joining datasets:", error);
        return res.status(500).json({ message: "Failed to join datasets" });
    }
};

const uploadDataset = (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            message: "Please upload a CSV file"
        });
    }

    const rows = [];
    const periodLabel = req.body.periodLabel || null;
    const requestedGroupId = req.body.groupId || null;

    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on("data", (row) => {
            rows.push(row);
        })
        .on("end", async () => {
            try {
                if (rows.length === 0) {
                    return res.status(400).json({
                        message: "CSV file is empty"
                    });
                }

                const columnNames = Object.keys(rows[0]);

                const columns = columnNames.map((column) => {
                    const value = rows[0][column];

                    let type = "string";

                    if (value !== "" && !isNaN(value)) {
                        type = "number";
                    }

                    return {
                        name: column,
                        type
                    };
                });

                const signature = buildColumnSignature(columns);

                let group = null;

                if (requestedGroupId) {
                    group = await DatasetGroup.findOne({
                        _id: requestedGroupId,
                        owner: req.user.userId,
                    });

                    if (!group) {
                        return res.status(400).json({
                            message: "Selected group not found",
                        });
                    }

                    const signatureMatches =
                        JSON.stringify(group.columnSignature) === JSON.stringify(signature);

                    if (!signatureMatches) {
                        return res.status(400).json({
                            message:
                                "This file's columns don't match the selected group's structure. Choose 'Create new group' instead.",
                        });
                    }
                } else {
                    group = await DatasetGroup.create({
                        name: req.file.originalname.replace(".csv", ""),
                        owner: req.user.userId,
                        columnSignature: signature,
                    });
                }

                const dataset = await Dataset.create({
                    name: req.file.originalname.replace(".csv", ""),
                    originalFileName: req.file.originalname,
                    owner: req.user.userId,
                    columns,
                    rows,
                    rowCount: rows.length,
                    groupId: group._id,
                    periodLabel,
                    periodDate: (() => {
                        if (!periodLabel) return null;
                        const parsed = new Date(periodLabel);
                        return isNaN(parsed.valueOf()) ? null : parsed;
                    })(),
                });

                fs.unlinkSync(req.file.path);

                res.status(201).json({
                    message: "CSV uploaded successfully",
                    dataset: {
                        id: dataset._id,
                        name: dataset.name,
                        columns: dataset.columns,
                        rowCount: dataset.rowCount,
                        groupId: dataset.groupId,
                        periodLabel: dataset.periodLabel
                    }
                });

            } catch (error) {
                console.error(error);

                res.status(500).json({
                    message: "Failed to process CSV"
                });
            }
        })
        .on("error", (error) => {
            console.error(error);

            res.status(500).json({
                message: "Failed to read CSV file"
            });
        });
};

const getDatasets = async (req, res) => {
    try {
        const datasets = await Dataset.find({
            owner: req.user.userId
        }).select("-rows");

        res.json({
            datasets
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to fetch datasets"
        });
    }
};

const getDatasetById = async (req, res) => {
    try {
        const dataset = await Dataset.findOne({
            _id: req.params.id,
            owner: req.user.userId
        });

        if (!dataset) {
            return res.status(404).json({
                message: "Dataset not found"
            });
        }

        res.json({
            dataset
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to fetch dataset"
        });
    }
};


module.exports = {
    uploadDataset,
    getDatasets,
    getDatasetById,
    getDatasetProfile,
    getDatasetAnomalies,
    getCleaningSuggestions,
    applyCleaningFixes,
    getDatasetCharts,
    compareTwoDatasets,
    getDatasetVersions,
    previewMissingValueStrategy,
    deleteDataset,
    investigateDataset,
    previewDatasetEdit,
    applyDatasetEdit,
    undoDatasetEdit,
    suggestJoinKey,
    joinDatasets
};