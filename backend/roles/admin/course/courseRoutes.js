const express = require("express");
const {
  createCourse,
  getCourse,
  updateCourse,
  deleteCourse,
  getCourseDetails,
} = require("./courseController");
const createRateLimiter = require("../../../helperUtils/rateLimiter");
const auth = require("../../../middlewares/authMiddleware");
const roleMiddleware = require("../../../middlewares/roleMiddleware");

const router = express.Router();

router.use(auth);

// Create a rate limiter for Courses
const CourseRateLimiter = createRateLimiter("Course");

// Routes for Course Management
// Create a new Course
router.post("/", roleMiddleware(["admin"]), CourseRateLimiter, createCourse);

// Get all Courses with pagination
router.get(
  "/",
  roleMiddleware(["admin", "student"]),
  CourseRateLimiter,
  getCourse,
);

// Get a specific Course by ID
router.get(
  "/:id",
  roleMiddleware(["admin", "student"]),
  CourseRateLimiter,
  getCourseDetails,
);

// Update an existing Course
router.put("/:id", roleMiddleware(["admin"]), updateCourse);

// Delete a Course
router.delete("/:id", roleMiddleware(["admin"]), deleteCourse);

module.exports = router;
