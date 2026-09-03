const express = require("express");
const { makePdfController } = require("./pdfControllerFactory");
const createRateLimiter = require("../../../helperUtils/rateLimiter");
const auth = require("../../../middlewares/authMiddleware");
const roleMiddleware = require("../../../middlewares/roleMiddleware");

const router = express.Router();
router.use(auth);

const rateLimiter = createRateLimiter("PastPaper");

// A past paper hangs off a subject, optionally narrowed to one chapter
const pastPapers = makePdfController({
  type: "pastPaper",
  key: "past_paper",
  chapterRequired: false,
  studentCanCreate: false,
});

router.post("/", roleMiddleware(["admin"]), rateLimiter, pastPapers.create);
router.get("/", roleMiddleware(["admin", "student"]), rateLimiter, pastPapers.list);
router.get("/:id", roleMiddleware(["admin", "student"]), rateLimiter, pastPapers.details);
router.put("/:id", roleMiddleware(["admin"]), pastPapers.update);
router.delete("/:id", roleMiddleware(["admin"]), pastPapers.remove);

module.exports = router;
