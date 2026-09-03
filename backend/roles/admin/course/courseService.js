const CourseRepo = require("./courseRepository");
const { cascadeFromCourse } = require("../../../shared/courseContent/cascadeStatus");

const createCourse = async (data) => {
  const course = await CourseRepo.createCourse(data);
  return course;
};

const getCourse = async ({ page, limit, keyword, status }) => {
  const skip = limit === 0 ? 0 : (page - 1) * limit;

  const { course, meta } = await CourseRepo.getCourse({
    page,
    limit,
    skip,
    keyword,
    status,
  });

  return { course, meta };
};

const updateCourse = async (id, data) => {
  const course = await CourseRepo.findCourseById_(id);

  if (!course || course.status === "deleted") {
    return { error: "course_not_found" };
  }

  const allowedFields = ["name", "description", "emoji", "status"];

  const updateData = {};

  for (const key of allowedFields) {
    if (data[key] !== undefined) {
      updateData[key] = data[key];
    }
  }

  if (Object.keys(updateData).length === 0) {
    return course;
  }

  if (updateData.name) {
    const duplicateCourse = await CourseRepo.findCourseByName(
      updateData.name,
      id,
    );
    if (duplicateCourse) {
      return { error: "course_already_exists_with_this_name" };
    }
  }

  Object.assign(course, updateData);
  await course.save();

  // Turning a node off turns everything under it off as well
  if (updateData.status === "inactive") {
    await cascadeFromCourse(course._id);
  }

  return course;
};

const getCourseDetails = async (id, { onlyActive = false } = {}) => {
  const course = await CourseRepo.findCourseById(id);

  if (!course || course.status === "deleted") {
    return null;
  }

  if (onlyActive && course.status !== "active") {
    return null;
  }

  return course;
};

const deleteCourse = async (id) => {
  if (!id) throw new Error("Course ID is required");
  const deleted = await CourseRepo.deleteCourse(id);

  // Children are kept, they just go inactive
  if (deleted) {
    await cascadeFromCourse(id);
  }

  return !!deleted;
};

module.exports = {
  createCourse,
  getCourse,
  updateCourse,
  deleteCourse,
  getCourseDetails,
};
