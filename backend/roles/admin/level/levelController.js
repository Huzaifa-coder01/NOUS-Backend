const {
  sendResponse,
  parsePaginationParams,
  validateParams,
  getReadableErrorMessage,
} = require("../../../helperUtils/responseUtil");
const LevelService = require("./levelService");
const { LEVEL_STATUSES, LEVEL_UPDATABLE_STATUSES } = require("./LevelModel");

const createLevel = async (req, res) => {
  const { courseId, name, emoji } = req.body;

  if (
    !validateParams(req, res, {
      rawData: ["courseId", "name"],
      objectIdFields: ["courseId"],
    })
  )
    return;

  const data = {
    course: courseId,
    name,
    emoji,
  };

  try {
    const level = await LevelService.createLevel(data);
    if (!level) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "level_creation_failed",
      });
    }
    if (level && level.error) {
      return sendResponse({
        res,
        statusCode: level.error === "course_not_found" ? 404 : 400,
        translationKey: level.error,
      });
    }
    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "level_created_successfully",
      data: level,
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

const getLevel = async (req, res) => {
  const { page, limit } = parsePaginationParams(req);
  let { keyword, status, courseId } = req.query;
  const isAdmin = req.user.userType === "admin";

  if (
    !validateParams(req, res, {
      objectIdFields: ["courseId"],
      enumFields: { status: LEVEL_STATUSES },
    })
  )
    return;

  // A student only ever sees the active levels of an active course
  if (!isAdmin) {
    status = "active";
  }

  try {
    const { level, meta } = await LevelService.getLevel({
      page,
      limit,
      keyword,
      status,
      courseId,
      onlyActiveCourse: !isAdmin,
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "level_fetched_successfully",
      data: level,
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

const getLevelDetails = async (req, res) => {
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
    const level = await LevelService.getLevelDetails(id, {
      onlyActive: !isAdmin,
    });
    if (!level) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "level_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "level_fetched_successfully",
      data: level,
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

const updateLevel = async (req, res) => {
  const { id } = req.params;
  const { name, emoji, status } = req.body;

  if (
    !validateParams(req, res, {
      pathParams: ["id"],
      objectIdFields: ["id"],
      enumFields: { status: LEVEL_UPDATABLE_STATUSES },
    })
  )
    return;

  const data = {
    name,
    emoji,
    status,
  };

  try {
    const updated = await LevelService.updateLevel(id, data);
    if (updated && updated.error) {
      return sendResponse({
        res,
        statusCode: updated.error === "level_not_found" ? 404 : 400,
        translationKey: updated.error,
      });
    }

    if (!updated) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "level_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "level_updated_successfully",
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

const deleteLevel = async (req, res) => {
  const { id } = req.params;

  if (
    !validateParams(req, res, {
      pathParams: ["id"],
      objectIdFields: ["id"],
    })
  )
    return;

  try {
    const deleted = await LevelService.deleteLevel(id);
    if (!deleted) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "level_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "level_deleted_successfully",
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
  createLevel,
  getLevel,
  updateLevel,
  deleteLevel,
  getLevelDetails,
};
