const SubjectRepo = require("./subjectRepository");

const createSubject = async (data) => {
  const subject = await SubjectRepo.createSubject(data);
  return subject;
};

const getSubject = async ({
  page,
  limit,
  keyword,
  status,
  levelId,
  onlyActiveParents,
}) => {
  const skip = limit === 0 ? 0 : (page - 1) * limit;

  const { subject, meta } = await SubjectRepo.getSubject({
    page,
    limit,
    skip,
    keyword,
    status,
    levelId,
    onlyActiveParents,
  });

  return { subject, meta };
};

const updateSubject = async (id, data) => {
  const subject = await SubjectRepo.findSubjectById_(id);

  if (!subject || subject.status === "deleted") {
    return { error: "subject_not_found" };
  }

  const allowedFields = ["name", "emoji", "status"];

  const updateData = {};

  for (const key of allowedFields) {
    if (data[key] !== undefined) {
      updateData[key] = data[key];
    }
  }

  if (Object.keys(updateData).length === 0) {
    return subject;
  }

  if (updateData.name) {
    const duplicateSubject = await SubjectRepo.findSubjectByName(
      subject.level,
      updateData.name,
      id,
    );
    if (duplicateSubject) {
      return { error: "subject_already_exists_in_this_level" };
    }
  }

  Object.assign(subject, updateData);
  await subject.save();

  return subject;
};

const getSubjectDetails = async (id, { onlyActive = false } = {}) => {
  const subject = await SubjectRepo.findSubjectById(id);

  if (!subject || subject.status === "deleted") {
    return null;
  }

  // A student only sees an active subject under an active level and course
  if (onlyActive) {
    if (
      subject.status !== "active" ||
      subject.level?.status !== "active" ||
      subject.level?.course?.status !== "active"
    ) {
      return null;
    }
  }

  return subject;
};

const deleteSubject = async (id) => {
  if (!id) throw new Error("Subject ID is required");
  const deleted = await SubjectRepo.deleteSubject(id);
  return !!deleted;
};

module.exports = {
  createSubject,
  getSubject,
  updateSubject,
  deleteSubject,
  getSubjectDetails,
};
