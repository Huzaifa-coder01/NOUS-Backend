const {
  sendResponse,
  parsePaginationParams,
  validateParams,
  getReadableErrorMessage,
} = require("../../../helperUtils/responseUtil");
const ChapterService = require("./chapterService");
const {
  CHAPTER_STATUSES,
  CHAPTER_UPDATABLE_STATUSES,
} = require("./ChapterModel");

// A chapter number is a whole number starting at 1
const parseChapterNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
};

const createChapter = async (req, res) => {
  const { subjectId, chapterNumber, name } = req.body;

  if (
    !validateParams(req, res, {
      rawData: ["subjectId", "chapterNumber", "name"],
      objectIdFields: ["subjectId"],
    })
  )
    return;

  const parsedChapterNumber = parseChapterNumber(chapterNumber);
  if (parsedChapterNumber === null) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: "invalid_chapter_number",
    });
  }

  const data = {
    subject: subjectId,
    chapterNumber: parsedChapterNumber,
    name,
  };

  try {
    const chapter = await ChapterService.createChapter(data);
    if (!chapter) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "chapter_creation_failed",
      });
    }
    if (chapter && chapter.error) {
      return sendResponse({
        res,
        statusCode: chapter.error === "subject_not_found" ? 404 : 400,
        translationKey: chapter.error,
      });
    }
    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "chapter_created_successfully",
      data: chapter,
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

const getChapter = async (req, res) => {
  const { page, limit } = parsePaginationParams(req);
  let { keyword, status, subjectId } = req.query;
  const isAdmin = req.user.userType === "admin";

  if (
    !validateParams(req, res, {
      objectIdFields: ["subjectId"],
      enumFields: { status: CHAPTER_STATUSES },
    })
  )
    return;

  // A student only ever sees active chapters under an active chain
  if (!isAdmin) {
    status = "active";
  }

  try {
    const { chapter, meta } = await ChapterService.getChapter({
      page,
      limit,
      keyword,
      status,
      subjectId,
      onlyActiveParents: !isAdmin,
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "chapter_fetched_successfully",
      data: chapter,
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

const getChapterDetails = async (req, res) => {
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
    const chapter = await ChapterService.getChapterDetails(id, {
      onlyActive: !isAdmin,
    });
    if (!chapter) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "chapter_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "chapter_fetched_successfully",
      data: chapter,
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

const updateChapter = async (req, res) => {
  const { id } = req.params;
  const { chapterNumber, name, status } = req.body;

  if (
    !validateParams(req, res, {
      pathParams: ["id"],
      objectIdFields: ["id"],
      enumFields: { status: CHAPTER_UPDATABLE_STATUSES },
    })
  )
    return;

  let parsedChapterNumber;
  if (chapterNumber !== undefined) {
    parsedChapterNumber = parseChapterNumber(chapterNumber);
    if (parsedChapterNumber === null) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "invalid_chapter_number",
      });
    }
  }

  const data = {
    chapterNumber: parsedChapterNumber,
    name,
    status,
  };

  try {
    const updated = await ChapterService.updateChapter(id, data);
    if (updated && updated.error) {
      return sendResponse({
        res,
        statusCode: updated.error === "chapter_not_found" ? 404 : 400,
        translationKey: updated.error,
      });
    }

    if (!updated) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "chapter_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "chapter_updated_successfully",
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

const deleteChapter = async (req, res) => {
  const { id } = req.params;

  if (
    !validateParams(req, res, {
      pathParams: ["id"],
      objectIdFields: ["id"],
    })
  )
    return;

  try {
    const deleted = await ChapterService.deleteChapter(id);
    if (!deleted) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "chapter_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "chapter_deleted_successfully",
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
  createChapter,
  getChapter,
  updateChapter,
  deleteChapter,
  getChapterDetails,
};
