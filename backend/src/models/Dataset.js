const mongoose = require("mongoose");

const datasetSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true
        },

        originalFileName: {
            type: String,
            required: true
        },

        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        columns: [
            {
                name: {
                    type: String,
                    required: true
                },

                type: {
                    type: String,
                    required: true
                }
            }
        ],

        rows: {
            type: Array,
            default: []
        },

        rowCount: {
            type: Number,
            default: 0
        },

        sourceDatasetId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Dataset",
            default: null
        },

        versionLabel: {
            type: String,
            default: "original"
        },

        groupId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "DatasetGroup",
            default: null
        },

        periodLabel: {
            type: String,
            default: null
        },

        periodDate: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }

);

module.exports = mongoose.model("Dataset", datasetSchema);