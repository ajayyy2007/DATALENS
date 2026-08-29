const mongoose = require("mongoose");

const datasetGroupSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        columnSignature: {
            type: [String],
            required: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("DatasetGroup", datasetGroupSchema);