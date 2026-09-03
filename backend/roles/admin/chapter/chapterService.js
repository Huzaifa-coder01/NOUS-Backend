const ChapterRepo = require("./chapterRepository");
const { cascadeFromChapter } = require("../../../shared/courseContent/cascadeStatus");

const createChapter = async (data) => {
  const chapter = await ChapterRepo.createChapter(data);
  return chapter;
};

const getChapter = async ({
  page,
  limit,
  keyword,
  status,
  subjectId,
  onlyActiveParents,
}) => {
  const skip = limit === 0 ? 0 : (page - 1) * limit;

  const { chapter, meta } = await ChapterRepo.getChapter({
    page,
    limit,
    skip,
    keyword,
    status,
    subjectId,
    onlyActiveParents,
  });

  return { chapter, meta };
};

const updateChapter = async (id, data) => {
  const chapter = await ChapterRepo.findChapterById_(id);

  if (!chapter || chapter.status === "deleted") {
    return { error: "chapter_not_found" };
  }

  const allowedFields = ["chapterNumber", "name", "status"];

  const updateData = {};

  for (const key of allowedFields) {
    if (data[key] !== undefined) {
      updateData[key] = data[key];
    }
  }

  if (Object.keys(updateData).length === 0) {
    return chapter;
  }

  if (updateData.name) {
    const duplicateName = await ChapterRepo.findChapterByName(
      chapter.subject,
      updateData.name,
      id,
    );
    if (duplicateName) {
      return { error: "chapter_already_exists_in_this_subject" };
    }
  }

  if (updateData.chapterNumber !== undefined) {
    const duplicateNumber = await ChapterRepo.findChapterByNumber(
      chapter.subject,
      updateData.chapterNumber,
      id,
    );
    if (duplicateNumber) {
      return { error: "chapter_number_already_exists_in_this_subject" };
    }
  }

  Object.assign(chapter, updateData);
  await chapter.save();

  // Turning a node off turns everything under it off as well
  if (updateData.status === "inactive") {
    await cascadeFromChapter(chapter._id);
  }

  return chapter;
};

const getChapterDetails = async (id, { onlyActive = false } = {}) => {
  const chapter = await ChapterRepo.findChapterById(id);

  if (!chapter || chapter.status === "deleted") {
    return null;
  }

  // A student only sees an active chapter whose whole chain is active
  if (onlyActive) {
    if (
      chapter.status !== "active" ||
      chapter.subject?.status !== "active" ||
      chapter.subject?.level?.status !== "active" ||
      chapter.subject?.level?.course?.status !== "active"
    ) {
      return null;
    }
  }

  return chapter;
};

const deleteChapter = async (id) => {
  if (!id) throw new Error("Chapter ID is required");
  const deleted = await ChapterRepo.deleteChapter(id);

  // Children are kept, they just go inactive
  if (deleted) {
    await cascadeFromChapter(id);
  }

  return !!deleted;
};

module.exports = {
  createChapter,
  getChapter,
  updateChapter,
  deleteChapter,
  getChapterDetails,
};
