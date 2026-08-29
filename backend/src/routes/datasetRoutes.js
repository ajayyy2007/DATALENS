const express = require("express");
const multer = require("multer");

const protect = require("../middleware/authMiddleware");

const {
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
} = require("../controllers/datasetController");
const router = express.Router();

const upload = multer({
    dest: "uploads/"
});

router.post(
    "/upload",
    protect,
    upload.single("file"),
    uploadDataset
);

router.get(
    "/",
    protect,
    getDatasets
);
router.get(
    "/:id/investigate",
    protect,
    investigateDataset
);
router.get(
    "/:id",
    protect,
    getDatasetById
);

router.get(
    "/:id/profile",
    protect,
    getDatasetProfile
);
router.post("/:id/edit/preview", protect, previewDatasetEdit);
router.post("/:id/edit/apply", protect, applyDatasetEdit);
router.post("/:id/edit/undo", protect, undoDatasetEdit);

router.post("/join/suggest", protect, suggestJoinKey);
router.post("/join", protect, joinDatasets);

router.get(
    "/:id/anomalies",
    protect,
    getDatasetAnomalies
);

router.get(
    "/:id/cleaning-suggestions",
    protect,
    getCleaningSuggestions
);
router.get(
    "/:id/charts",
    protect,
    getDatasetCharts
);
router.post(
    "/compare",
    protect,
    compareTwoDatasets
);

router.get(
    "/:id/versions",
    protect,
    getDatasetVersions
);

router.get(
    "/:id/missing-value-preview",
    protect,
    previewMissingValueStrategy
);

router.post(
    "/:id/clean",
    protect,
    applyCleaningFixes
);

router.delete(
    "/:id",
    protect,
    deleteDataset
);

module.exports = router;