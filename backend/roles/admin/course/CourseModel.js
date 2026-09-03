const mongoose = require("mongoose");

const COURSE_STATUSES = ["active", "inactive", "deleted"];
// Statuses an admin is allowed to set through the update API,
// "deleted" is only set by the delete API.
const COURSE_UPDATABLE_STATUSES = ["active", "inactive"];

const courseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: [true, "name_required"],
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    emoji: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: COURSE_STATUSES,
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

courseSchema.index({ createdAt: -1 });

const Course = mongoose.model("Course", courseSchema);

module.exports = Course;
module.exports.COURSE_STATUSES = COURSE_STATUSES;
module.exports.COURSE_UPDATABLE_STATUSES = COURSE_UPDATABLE_STATUSES;
