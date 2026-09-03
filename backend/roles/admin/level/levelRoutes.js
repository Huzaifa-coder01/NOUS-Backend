const express = require("express");
const {
  createLevel,
  getLevel,
  updateLevel,
  deleteLevel,
  getLevelDetails,
} = require("./levelController");
const createRateLimiter = require("../../../helperUtils/rateLimiter");
const auth = require("../../../middlewares/authMiddleware");
const roleMiddleware = require("../../../middlewares/roleMiddleware");

const router = express.Router();

router.use(auth);

// Create a rate limiter for Levels
const LevelRateLimiter = createRateLimiter("Level");

// Routes for Level Management
// Create a new Level
router.post("/", roleMiddleware(["admin"]), LevelRateLimiter, createLevel);

// Get all Levels with pagination
router.get(
  "/",
  roleMiddleware(["admin", "student"]),
  LevelRateLimiter,
  getLevel,
);

// Get a specific Level by ID
router.get(
  "/:id",
  roleMiddleware(["admin", "student"]),
  LevelRateLimiter,
  getLevelDetails,
);

// Update an existing Level
router.put("/:id", roleMiddleware(["admin"]), updateLevel);

// Delete a Level
router.delete("/:id", roleMiddleware(["admin"]), deleteLevel);

module.exports = router;
