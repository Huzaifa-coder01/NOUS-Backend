const Level = require("../../roles/admin/level/LevelModel");
const Subject = require("../../roles/admin/subject/SubjectModel");
const Chapter = require("../../roles/admin/chapter/ChapterModel");
const Pdf = require("../../roles/admin/pdf/PdfModel");

/**
 * Making a node inactive, or deleting it, pushes every descendant to inactive.
 * Descendants are never deleted, and records already deleted are left alone so
 * a delete stays undoable at the row level.
 */

const INACTIVATE = { status: "inactive" };
const ONLY_ACTIVE = { status: "active" };

const idsOf = (docs) => docs.map((d) => d._id);

const inactivate = async (model, filter) => {
  const res = await model.updateMany({ ...filter, ...ONLY_ACTIVE }, INACTIVATE);
  return res.modifiedCount || 0;
};

/**
 * PDFs carry course/level/subject/chapter directly, so one update per ancestor
 * field is enough, no need to walk the tree for them.
 */
const cascadeFromCourse = async (courseId) => {
  const levels = await Level.find({ course: courseId }).select("_id").lean();
  const levelIds = idsOf(levels);
  const subjects = await Subject.find({ level: { $in: levelIds } })
    .select("_id")
    .lean();
  const subjectIds = idsOf(subjects);

  const [levelsOff, subjectsOff, chaptersOff, pdfsOff] = await Promise.all([
    inactivate(Level, { course: courseId }),
    inactivate(Subject, { level: { $in: levelIds } }),
    inactivate(Chapter, { subject: { $in: subjectIds } }),
    inactivate(Pdf, { course: courseId }),
  ]);

  return { levels: levelsOff, subjects: subjectsOff, chapters: chaptersOff, pdfs: pdfsOff };
};

const cascadeFromLevel = async (levelId) => {
  const subjects = await Subject.find({ level: levelId }).select("_id").lean();
  const subjectIds = idsOf(subjects);

  const [subjectsOff, chaptersOff, pdfsOff] = await Promise.all([
    inactivate(Subject, { level: levelId }),
    inactivate(Chapter, { subject: { $in: subjectIds } }),
    inactivate(Pdf, { level: levelId }),
  ]);

  return { subjects: subjectsOff, chapters: chaptersOff, pdfs: pdfsOff };
};

const cascadeFromSubject = async (subjectId) => {
  const [chaptersOff, pdfsOff] = await Promise.all([
    inactivate(Chapter, { subject: subjectId }),
    inactivate(Pdf, { subject: subjectId }),
  ]);

  return { chapters: chaptersOff, pdfs: pdfsOff };
};

const cascadeFromChapter = async (chapterId) => {
  const pdfsOff = await inactivate(Pdf, { chapter: chapterId });
  return { pdfs: pdfsOff };
};

module.exports = {
  cascadeFromCourse,
  cascadeFromLevel,
  cascadeFromSubject,
  cascadeFromChapter,
};
