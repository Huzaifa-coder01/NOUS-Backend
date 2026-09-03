const express = require("express");
const { makePdfController } = require("./pdfControllerFactory");
const createRateLimiter = require("../../../helperUtils/rateLimiter");
const auth = require("../../../middlewares/authMiddleware");
const roleMiddleware = require("../../../middlewares/roleMiddleware");

const router = express.Router();
router.use(auth);

const rateLimiter = createRateLimiter("Note");

// Notes are the one thing a student uploads. Once uploaded they are active, so
// every student browsing that chapter sees them.
const notes = makePdfController({
  type: "note",
  key: "note",
  chapterRequired: true,
  studentCanCreate: true,
});

router.post("/", roleMiddleware(["admin", "student"]), rateLimiter, notes.create);
router.get("/", roleMiddleware(["admin", "student"]), rateLimiter, notes.list);
router.get("/:id", roleMiddleware(["admin", "student"]), rateLimiter, notes.details);

// Managing what students uploaded stays with the admin
router.put("/:id", roleMiddleware(["admin"]), notes.update);
router.delete("/:id", roleMiddleware(["admin"]), notes.remove);

module.exports = router;
