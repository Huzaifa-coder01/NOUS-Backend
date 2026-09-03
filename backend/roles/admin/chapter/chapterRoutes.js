const express = require("express");
const {
  createChapter,
  getChapter,
  updateChapter,
  deleteChapter,
  getChapterDetails,
} = require("./chapterController");
const createRateLimiter = require("../../../helperUtils/rateLimiter");
const auth = require("../../../middlewares/authMiddleware");
const roleMiddleware = require("../../../middlewares/roleMiddleware");

const router = express.Router();

router.use(auth);

// Create a rate limiter for Chapters
const ChapterRateLimiter = createRateLimiter("Chapter");

// Routes for Chapter Management
// Create a new Chapter
router.post("/", roleMiddleware(["admin"]), ChapterRateLimiter, createChapter);

// Get all Chapters with pagination
router.get(
  "/",
  roleMiddleware(["admin", "student"]),
  ChapterRateLimiter,
  getChapter,
);

// Get a specific Chapter by ID
router.get(
  "/:id",
  roleMiddleware(["admin", "student"]),
  ChapterRateLimiter,
  getChapterDetails,
);

// Update an existing Chapter
router.put("/:id", roleMiddleware(["admin"]), updateChapter);

// Delete a Chapter
router.delete("/:id", roleMiddleware(["admin"]), deleteChapter);

module.exports = router;
