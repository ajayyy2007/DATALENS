const mongoose = require("mongoose");

const queryHistorySchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        datasetId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Dataset",
            required: true
        },
        datasetName: {
            type: String,
            required: true
        },
        question: {
            type: String,
            required: true
        },
        resultRowCount: {
            type: Number,
            default: 0
        },
        status: {
            type: String,
            enum: ["success", "error"],
            default: "success"
        },
        errorMessage: {
            type: String,
            default: null
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("QueryHistory", queryHistorySchema);