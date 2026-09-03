const express = require("express");
const { makePdfController } = require("./pdfControllerFactory");
const createRateLimiter = require("../../../helperUtils/rateLimiter");
const auth = require("../../../middlewares/authMiddleware");
const roleMiddleware = require("../../../middlewares/roleMiddleware");

const router = express.Router();
router.use(auth);

const rateLimiter = createRateLimiter("Syllabus");

// A syllabus PDF always belongs to a chapter
const syllabus = makePdfController({
  type: "syllabus",
  key: "syllabus",
  chapterRequired: true,
  studentCanCreate: false,
});

router.post("/", roleMiddleware(["admin"]), rateLimiter, syllabus.create);
router.get("/", roleMiddleware(["admin", "student"]), rateLimiter, syllabus.list);
router.get("/:id", roleMiddleware(["admin", "student"]), rateLimiter, syllabus.details);
router.put("/:id", roleMiddleware(["admin"]), syllabus.update);
router.delete("/:id", roleMiddleware(["admin"]), syllabus.remove);

module.exports = router;
