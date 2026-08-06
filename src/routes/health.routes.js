import express from "express";
import mongoose from "mongoose";

const router = express.Router();

router.get("/", (req, res) => {
  const databaseStates = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  res.status(200).json({
    success: true,
    message: "Community Peer Support API is running",
    database: databaseStates[mongoose.connection.readyState] || "unknown",
    timestamp: new Date().toISOString(),
  });
});

export default router;