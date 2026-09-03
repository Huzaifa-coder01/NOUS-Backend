const LevelRepo = require("./levelRepository");
const { cascadeFromLevel } = require("../../../shared/courseContent/cascadeStatus");

const createLevel = async (data) => {
  const level = await LevelRepo.createLevel(data);
  return level;
};

const getLevel = async ({
  page,
  limit,
  keyword,
  status,
  courseId,
  onlyActiveCourse,
}) => {
  const skip = limit === 0 ? 0 : (page - 1) * limit;

  const { level, meta } = await LevelRepo.getLevel({
    page,
    limit,
    skip,
    keyword,
    status,
    courseId,
    onlyActiveCourse,
  });

  return { level, meta };
};

const updateLevel = async (id, data) => {
  const level = await LevelRepo.findLevelById_(id);

  if (!level || level.status === "deleted") {
    return { error: "level_not_found" };
  }

  const allowedFields = ["name", "emoji", "status"];

  const updateData = {};

  for (const key of allowedFields) {
    if (data[key] !== undefined) {
      updateData[key] = data[key];
    }
  }

  if (Object.keys(updateData).length === 0) {
    return level;
  }

  if (updateData.name) {
    const duplicateLevel = await LevelRepo.findLevelByName(
      level.course,
      updateData.name,
      id,
    );
    if (duplicateLevel) {
      return { error: "level_already_exists_in_this_course" };
    }
  }

  Object.assign(level, updateData);
  await level.save();

  // Turning a node off turns everything under it off as well
  if (updateData.status === "inactive") {
    await cascadeFromLevel(level._id);
  }

  return level;
};

const getLevelDetails = async (id, { onlyActive = false } = {}) => {
  const level = await LevelRepo.findLevelById(id);

  if (!level || level.status === "deleted") {
    return null;
  }

  // A student only sees an active level under an active course
  if (onlyActive) {
    if (level.status !== "active" || level.course?.status !== "active") {
      return null;
    }
  }

  return level;
};

const deleteLevel = async (id) => {
  if (!id) throw new Error("Level ID is required");
  const deleted = await LevelRepo.deleteLevel(id);

  // Children are kept, they just go inactive
  if (deleted) {
    await cascadeFromLevel(id);
  }

  return !!deleted;
};

module.exports = {
  createLevel,
  getLevel,
  updateLevel,
  deleteLevel,
  getLevelDetails,
};
