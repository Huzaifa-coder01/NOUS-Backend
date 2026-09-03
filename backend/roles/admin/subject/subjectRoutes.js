const express = require("express");
const {
  createSubject,
  getSubject,
  updateSubject,
  deleteSubject,
  getSubjectDetails,
} = require("./subjectController");
const createRateLimiter = require("../../../helperUtils/rateLimiter");
const auth = require("../../../middlewares/authMiddleware");
const roleMiddleware = require("../../../middlewares/roleMiddleware");

const router = express.Router();

router.use(auth);

// Create a rate limiter for Subjects
const SubjectRateLimiter = createRateLimiter("Subject");

// Routes for Subject Management
// Create a new Subject
router.post("/", roleMiddleware(["admin"]), SubjectRateLimiter, createSubject);

// Get all Subjects with pagination
router.get(
  "/",
  roleMiddleware(["admin", "student"]),
  SubjectRateLimiter,
  getSubject,
);

// Get a specific Subject by ID
router.get(
  "/:id",
  roleMiddleware(["admin", "student"]),
  SubjectRateLimiter,
  getSubjectDetails,
);

// Update an existing Subject
router.put("/:id", roleMiddleware(["admin"]), updateSubject);

// Delete a Subject
router.delete("/:id", roleMiddleware(["admin"]), deleteSubject);

module.exports = router;
