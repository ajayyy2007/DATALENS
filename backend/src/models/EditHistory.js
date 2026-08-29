const mongoose = require("mongoose");

const editHistorySchema = new mongoose.Schema(
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
        instruction: {
            type: String,
            required: true
        },
        previousRows: {
            type: Array,
            required: true
        },
        editSummary: {
            type: String,
            default: ""
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("EditHistory", editHistorySchema);