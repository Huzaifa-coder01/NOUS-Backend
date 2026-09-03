const mongoose = require("mongoose");

const LEVEL_STATUSES = ["active", "inactive", "deleted"];
// Statuses an admin is allowed to set through the update API,
// "deleted" is only set by the delete API.
const LEVEL_UPDATABLE_STATUSES = ["active", "inactive"];

const levelSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "courseId_required"],
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
      enum: LEVEL_STATUSES,
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

levelSchema.index({ course: 1, createdAt: -1 });

const Level = mongoose.model("Level", levelSchema);

module.exports = Level;
module.exports.LEVEL_STATUSES = LEVEL_STATUSES;
module.exports.LEVEL_UPDATABLE_STATUSES = LEVEL_UPDATABLE_STATUSES;
