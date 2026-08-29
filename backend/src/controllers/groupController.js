const Dataset = require("../models/Dataset");
const DatasetGroup = require("../models/DatasetGroup");
const { computeGroupTrends } = require("../services/trendService");

const getGroups = async (req, res) => {
    try {
        const groups = await DatasetGroup.find({ owner: req.user.userId }).sort({ createdAt: -1 });
        return res.status(200).json({ groups });
    } catch (error) {
        console.error("Error fetching groups:", error);
        return res.status(500).json({ message: "Failed to fetch groups" });
    }
};
const deleteGroup = async (req, res) => {
    try {
        const group = await DatasetGroup.findOne({
            _id: req.params.groupId,
            owner: req.user.userId,
        });

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        // Cascade delete every dataset that belongs to this group
        await Dataset.deleteMany({
            groupId: group._id,
            owner: req.user.userId,
        });

        await DatasetGroup.deleteOne({ _id: group._id });

        return res.status(200).json({ message: "Group and its datasets deleted successfully" });
    } catch (error) {
        console.error("Error deleting group:", error);
        return res.status(500).json({ message: "Failed to delete group" });
    }
};

// Add deleteGroup to module.exports

const getGroupTrends = async (req, res) => {
    try {
        const group = await DatasetGroup.findOne({
            _id: req.params.groupId,
            owner: req.user.userId,
        });

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        const datasets = await Dataset.find({
            groupId: group._id,
            owner: req.user.userId,
        }).sort({ periodDate: 1, createdAt: 1 });

        const trends = computeGroupTrends(datasets);

        return res.status(200).json({
            group: { id: group._id, name: group.name },
            trends,
        });
    } catch (error) {
        console.error("Error computing trends:", error);
        return res.status(500).json({ message: "Failed to compute trends" });
    }
};

module.exports = { getGroups, getGroupTrends, deleteGroup };