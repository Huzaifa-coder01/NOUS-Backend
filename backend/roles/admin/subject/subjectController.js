const {
  sendResponse,
  parsePaginationParams,
  validateParams,
  getReadableErrorMessage,
} = require("../../../helperUtils/responseUtil");
const SubjectService = require("./subjectService");
const {
  SUBJECT_STATUSES,
  SUBJECT_UPDATABLE_STATUSES,
} = require("./SubjectModel");

const createSubject = async (req, res) => {
  const { levelId, name, emoji } = req.body;

  if (
    !validateParams(req, res, {
      rawData: ["levelId", "name"],
      objectIdFields: ["courseId", "levelId"],
    })
  )
    return;

  const data = {
    level: levelId,
    name,
    emoji,
  };

  try {
    const subject = await SubjectService.createSubject(data);
    if (!subject) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "subject_creation_failed",
      });
    }
    if (subject && subject.error) {
      return sendResponse({
        res,
        statusCode: subject.error === "level_not_found" ? 404 : 400,
        translationKey: subject.error,
      });
    }
    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "subject_created_successfully",
      data: subject,
    });
  } catch (error) {
    const readableError = getReadableErrorMessage(error);
    return sendResponse({
      res,
      statusCode: readableError.statusCode,
      translationKey: readableError.message,
      error,
    });
  }
};

const getSubject = async (req, res) => {
  const { page, limit } = parsePaginationParams(req);
  let { keyword, status, courseId, levelId } = req.query;
  const isAdmin = req.user.userType === "admin";

  if (
    !validateParams(req, res, {
      objectIdFields: ["courseId", "levelId"],
      enumFields: { status: SUBJECT_STATUSES },
    })
  )
    return;

  // A student only ever sees the active subjects of an active level and course
  if (!isAdmin) {
    status = "active";
  }

  try {
    const { subject, meta } = await SubjectService.getSubject({
      page,
      limit,
      keyword,
      status,
      courseId,
      levelId,
      onlyActiveParents: !isAdmin,
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "subject_fetched_successfully",
      data: subject,
      meta,
    });
  } catch (error) {
    const readableError = getReadableErrorMessage(error);
    return sendResponse({
      res,
      statusCode: readableError.statusCode,
      translationKey: readableError.message,
      error,
    });
  }
};

const getSubjectDetails = async (req, res) => {
  const { id } = req.params;
  const isAdmin = req.user.userType === "admin";

  if (
    !validateParams(req, res, {
      pathParams: ["id"],
      objectIdFields: ["id"],
    })
  )
    return;

  try {
    const subject = await SubjectService.getSubjectDetails(id, {
      onlyActive: !isAdmin,
    });
    if (!subject) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "subject_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "subject_fetched_successfully",
      data: subject,
    });
  } catch (error) {
    const readableError = getReadableErrorMessage(error);
    return sendResponse({
      res,
      statusCode: readableError.statusCode,
      translationKey: readableError.message,
      error,
    });
  }
};

const updateSubject = async (req, res) => {
  const { id } = req.params;
  const { name, emoji, status } = req.body;

  if (
    !validateParams(req, res, {
      pathParams: ["id"],
      objectIdFields: ["id"],
      enumFields: { status: SUBJECT_UPDATABLE_STATUSES },
    })
  )
    return;

  const data = {
    name,
    emoji,
    status,
  };

  try {
    const updated = await SubjectService.updateSubject(id, data);
    if (updated && updated.error) {
      return sendResponse({
        res,
        statusCode: updated.error === "subject_not_found" ? 404 : 400,
        translationKey: updated.error,
      });
    }

    if (!updated) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "subject_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "subject_updated_successfully",
      data: updated,
    });
  } catch (error) {
    const readableError = getReadableErrorMessage(error);
    return sendResponse({
      res,
      statusCode: readableError.statusCode,
      translationKey: readableError.message,
      error,
    });
  }
};

const deleteSubject = async (req, res) => {
  const { id } = req.params;

  if (
    !validateParams(req, res, {
      pathParams: ["id"],
      objectIdFields: ["id"],
    })
  )
    return;

  try {
    const deleted = await SubjectService.deleteSubject(id);
    if (!deleted) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "subject_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "subject_deleted_successfully",
    });
  } catch (error) {
    const readableError = getReadableErrorMessage(error);
    return sendResponse({
      res,
      statusCode: readableError.statusCode,
      translationKey: readableError.message,
      error,
    });
  }
};

module.exports = {
  createSubject,
  getSubject,
  updateSubject,
  deleteSubject,
  getSubjectDetails,
};
