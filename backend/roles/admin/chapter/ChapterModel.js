const mongoose = require("mongoose");

const CHAPTER_STATUSES = ["active", "inactive", "deleted"];
// Statuses an admin is allowed to set through the update API,
// "deleted" is only set by the delete API.
const CHAPTER_UPDATABLE_STATUSES = ["active", "inactive"];

const chapterSchema = new mongoose.Schema(
  {
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: [true, "subjectId_required"],
      index: true,
    },
    chapterNumber: {
      type: Number,
      required: [true, "chapterNumber_required"],
      min: 1,
    },
    name: {
      type: String,
      trim: true,
      required: [true, "name_required"],
    },
    status: {
      type: String,
      enum: CHAPTER_STATUSES,
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

chapterSchema.index({ subject: 1, chapterNumber: 1 });

const Chapter = mongoose.model("Chapter", chapterSchema);

module.exports = Chapter;
module.exports.CHAPTER_STATUSES = CHAPTER_STATUSES;
module.exports.CHAPTER_UPDATABLE_STATUSES = CHAPTER_UPDATABLE_STATUSES;
