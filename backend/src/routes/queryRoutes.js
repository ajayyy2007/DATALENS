const express = require("express");

const protect = require("../middleware/authMiddleware");

const {
    runQuery,
    getQueryHistory
} = require("../controllers/queryController");

const router = express.Router();

router.post("/", protect, runQuery);
router.get("/history", protect, getQueryHistory);

module.exports = router;