const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const express = require("express");
const datasetRoutes = require("./routes/datasetRoutes");
const cors = require("cors");
const queryRoutes = require("./routes/queryRoutes");
const groupRoutes = require("./routes/groupRoutes");
require("dotenv").config();

const connectDB = require("./config/database");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/datasets", datasetRoutes);
app.use("/api/queries", queryRoutes);
app.use("/api/groups", groupRoutes);

connectDB();

app.get("/", (req, res) => {
    res.json({
        message: "DataLens API is running"
    });
});

app.get("/api/health", (req, res) => {
    res.json({
        status: "OK",
        message: "Backend is healthy"
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`DataLens backend running on port ${PORT}`);
});