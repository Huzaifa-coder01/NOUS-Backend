const mongoose = require("mongoose");

// One collection for every PDF in the system. Keeping them together is what
// makes the "every PDF has a unique name" rule enforceable, and lets the
// status cascade touch all of them in one update per ancestor.
const PDF_TYPES = ["pastPaper", "syllabus", "note"];
const PDF_STATUSES = ["active", "inactive", "deleted"];
const PDF_UPDATABLE_STATUSES = ["active", "inactive"];

// Syllabus and notes always belong to a chapter, a past paper may sit
// straight on the subject.
const CHAPTER_REQUIRED_TYPES = ["syllabus", "note"];

const pdfSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: PDF_TYPES,
      required: [true, "type_required"],
      index: true,
    },
    name: {
      type: String,
      trim: true,
      required: [true, "name_required"],
    },
    // Stored file name from the upload API, e.g. "nous/dev/<id>.pdf".
    // The delivery URL is composed by the client from the media base url,
    // the same way profileIcon works, so no absolute url is persisted.
    fileName: {
      type: String,
      trim: true,
      required: [true, "fileName_required"],
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "courseId_required"],
      index: true,
    },
    level: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Level",
      required: [true, "levelId_required"],
      index: true,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: [true, "subjectId_required"],
      index: true,
    },
    chapter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chapter",
      default: null,
      index: true,
    },
    // Students upload notes, an admin uploads past papers and syllabus
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: PDF_STATUSES,
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

pdfSchema.pre("validate", function (next) {
  if (CHAPTER_REQUIRED_TYPES.includes(this.type) && !this.chapter) {
    this.invalidate("chapter", "chapterId_required");
  }
  next();
});

// Listing is always "this type, under this node, newest first"
pdfSchema.index({ type: 1, subject: 1, status: 1, createdAt: -1 });
pdfSchema.index({ type: 1, chapter: 1, status: 1, createdAt: -1 });

const Pdf = mongoose.model("Pdf", pdfSchema);

module.exports = Pdf;
module.exports.PDF_TYPES = PDF_TYPES;
module.exports.PDF_STATUSES = PDF_STATUSES;
module.exports.PDF_UPDATABLE_STATUSES = PDF_UPDATABLE_STATUSES;
module.exports.CHAPTER_REQUIRED_TYPES = CHAPTER_REQUIRED_TYPES;
