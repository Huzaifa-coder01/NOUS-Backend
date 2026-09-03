const mongoose = require("mongoose");

const SUBJECT_STATUSES = ["active", "inactive", "deleted"];
// Statuses an admin is allowed to set through the update API,
// "deleted" is only set by the delete API.
const SUBJECT_UPDATABLE_STATUSES = ["active", "inactive"];

const subjectSchema = new mongoose.Schema(
  {
    level: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Level",
      required: [true, "levelId_required"],
      index: true,
    },
    name: {
      type: String,
      trim: true,
      required: [true, "name_required"],
    },
    emoji: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: SUBJECT_STATUSES,
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

subjectSchema.index({ level: 1, createdAt: -1 });

const Subject = mongoose.model("Subject", subjectSchema);

module.exports = Subject;
module.exports.SUBJECT_STATUSES = SUBJECT_STATUSES;
module.exports.SUBJECT_UPDATABLE_STATUSES = SUBJECT_UPDATABLE_STATUSES;
