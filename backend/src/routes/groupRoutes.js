const express = require("express");
const protect = require("../middleware/authMiddleware");
const { getGroups, getGroupTrends } = require("../controllers/groupController");

const router = express.Router();

router.get("/", protect, getGroups);
router.get("/:groupId/trends", protect, getGroupTrends);

module.exports = router;