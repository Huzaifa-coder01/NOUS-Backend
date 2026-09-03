const {
  sendResponse,
  parsePaginationParams,
  validateParams,
  getReadableErrorMessage,
} = require("../../../helperUtils/responseUtil");
const CourseService = require("./courseService");
const {
  COURSE_STATUSES,
  COURSE_UPDATABLE_STATUSES,
} = require("./CourseModel");

const createCourse = async (req, res) => {
  const { name, description, emoji } = req.body;

  if (
    !validateParams(req, res, {
      rawData: ["name"],
    })
  )
    return;

  const data = {
    name,
    description,
    emoji,
  };

  try {
    const course = await CourseService.createCourse(data);
    if (!course) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "course_creation_failed",
      });
    }
    if (course && course.error) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: course.error,
      });
    }
    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "course_created_successfully",
      data: course,
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

const getCourse = async (req, res) => {
  const { page, limit } = parsePaginationParams(req);
  let { keyword, status } = req.query;
  const isAdmin = req.user.userType === "admin";

  if (
    !validateParams(req, res, {
      enumFields: { status: COURSE_STATUSES },
    })
  )
    return;

  // A student only ever sees the active courses
  if (!isAdmin) {
    status = "active";
  }

  try {
    const { course, meta } = await CourseService.getCourse({
      page,
      limit,
      keyword,
      status,
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "course_fetched_successfully",
      data: course,
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

const getCourseDetails = async (req, res) => {
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
    const course = await CourseService.getCourseDetails(id, {
      onlyActive: !isAdmin,
    });
    if (!course) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "course_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "course_fetched_successfully",
      data: course,
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

const updateCourse = async (req, res) => {
  const { id } = req.params;
  const { name, description, emoji, status } = req.body;

  if (
    !validateParams(req, res, {
      pathParams: ["id"],
      objectIdFields: ["id"],
      enumFields: { status: COURSE_UPDATABLE_STATUSES },
    })
  )
    return;

  const data = {
    name,
    description,
    emoji,
    status,
  };

  try {
    const updated = await CourseService.updateCourse(id, data);
    if (updated && updated.error) {
      return sendResponse({
        res,
        statusCode: updated.error === "course_not_found" ? 404 : 400,
        translationKey: updated.error,
      });
    }

    if (!updated) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "course_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "course_updated_successfully",
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

const deleteCourse = async (req, res) => {
  const { id } = req.params;

  if (
    !validateParams(req, res, {
      pathParams: ["id"],
      objectIdFields: ["id"],
    })
  )
    return;

  try {
    const deleted = await CourseService.deleteCourse(id);
    if (!deleted) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "course_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "course_deleted_successfully",
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
  createCourse,
  getCourse,
  updateCourse,
  deleteCourse,
  getCourseDetails,
};
