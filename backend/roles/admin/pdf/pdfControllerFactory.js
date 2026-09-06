const {
  sendResponse,
  parsePaginationParams,
  validateParams,
  getReadableErrorMessage,
} = require("../../../helperUtils/responseUtil");
const PdfService = require("./pdfService");
const { PDF_STATUSES, PDF_UPDATABLE_STATUSES } = require("./PdfModel");

const NOT_FOUND_ERRORS = [
  "course_not_found",
  "level_not_found",
  "subject_not_found",
  "chapter_not_found",
  "pdf_not_found",
];

/**
 * Past papers, syllabus and notes are the same record with a different type,
 * so they share one controller set. config carries what actually differs.
 *
 * @param {object} config
 * @param {string} config.type            pastPaper | syllabus | note
 * @param {string} config.key             translation key prefix, e.g. past_paper
 * @param {boolean} config.chapterRequired syllabus and notes need a chapter
 * @param {boolean} config.studentCanCreate only notes are student uploadable
 * @param {string[]} [config.readTypes]     what the listing shows, defaults to
 *   just `type`. The syllabus screen also shows the notes students uploaded.
 */
const makePdfController = ({
  type,
  key,
  chapterRequired,
  studentCanCreate,
  readTypes,
}) => {
  const notFoundKey = `${key}_not_found`;
  // Writes always stay on the owning type, only reads may span types
  const listTypes = readTypes || type;

  const create = async (req, res) => {
    const { name, fileName, subjectId, chapterId } = req.body;
    const isAdmin = req.user.userType === "admin";

    if (!isAdmin && !studentCanCreate) {
      return sendResponse({
        res,
        statusCode: 403,
        translationKey: "only_admin_can_perform_this_action",
      });
    }

    const rawData = ["name", "fileName"];
    rawData.push(chapterRequired ? "chapterId" : "subjectId");

    if (
      !validateParams(req, res, {
        rawData,
        objectIdFields: ["subjectId", "chapterId"],
      })
    )
      return;

    try {
      const pdf = await PdfService.createPdf({
        type,
        name,
        fileName,
        subjectId,
        chapterId,
        uploadedBy: req.user._id,
        // A student may only upload under a fully active chain
        requireActiveChain: !isAdmin,
      });

      if (!pdf) {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey: `${key}_creation_failed`,
        });
      }

      if (pdf.error) {
        return sendResponse({
          res,
          statusCode: NOT_FOUND_ERRORS.includes(pdf.error) ? 404 : 400,
          translationKey: pdf.error,
        });
      }

      return sendResponse({
        res,
        statusCode: 201,
        translationKey: `${key}_created_successfully`,
        data: pdf,
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

  const list = async (req, res) => {
    const { page, limit } = parsePaginationParams(req);
    let { keyword, status, courseId, levelId, subjectId, chapterId, uploadedBy } =
      req.query;
    const { mine } = req.query;
    const isAdmin = req.user.userType === "admin";

    if (
      !validateParams(req, res, {
        objectIdFields: ["courseId", "levelId", "subjectId", "chapterId", "uploadedBy"],
        enumFields: { status: PDF_STATUSES },
      })
    )
      return;

    // A student only ever sees active PDFs, and the cascade keeps anything
    // under an inactive node inactive too. mine=true narrows the list to the
    // student's own uploads, which is how a "my notes" screen is built.
    if (!isAdmin) {
      status = "active";
      uploadedBy = mine === "true" ? req.user._id : undefined;
    }

    try {
      const { pdfs, meta } = await PdfService.getPdfs({
        type: listTypes,
        page,
        limit,
        keyword,
        status,
        courseId,
        levelId,
        subjectId,
        chapterId,
        uploadedBy,
      });

      return sendResponse({
        res,
        statusCode: 200,
        translationKey: `${key}_fetched_successfully`,
        data: pdfs,
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

  const details = async (req, res) => {
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
      const pdf = await PdfService.getPdfDetails(id, listTypes, {
        onlyActive: !isAdmin,
      });

      if (!pdf) {
        return sendResponse({
          res,
          statusCode: 404,
          translationKey: notFoundKey,
        });
      }

      return sendResponse({
        res,
        statusCode: 200,
        translationKey: `${key}_fetched_successfully`,
        data: pdf,
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

  const update = async (req, res) => {
    const { id } = req.params;
    const { name, fileName, status } = req.body;

    if (
      !validateParams(req, res, {
        pathParams: ["id"],
        objectIdFields: ["id"],
        enumFields: { status: PDF_UPDATABLE_STATUSES },
      })
    )
      return;

    try {
      const updated = await PdfService.updatePdf(id, type, {
        name,
        fileName,
        status,
      });

      if (updated && updated.error) {
        return sendResponse({
          res,
          statusCode: updated.error === "pdf_not_found" ? 404 : 400,
          translationKey:
            updated.error === "pdf_not_found" ? notFoundKey : updated.error,
        });
      }

      if (!updated) {
        return sendResponse({
          res,
          statusCode: 404,
          translationKey: notFoundKey,
        });
      }

      return sendResponse({
        res,
        statusCode: 200,
        translationKey: `${key}_updated_successfully`,
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

  const remove = async (req, res) => {
    const { id } = req.params;

    if (
      !validateParams(req, res, {
        pathParams: ["id"],
        objectIdFields: ["id"],
      })
    )
      return;

    try {
      const deleted = await PdfService.deletePdf(id, type);

      if (!deleted) {
        return sendResponse({
          res,
          statusCode: 404,
          translationKey: notFoundKey,
        });
      }

      return sendResponse({
        res,
        statusCode: 200,
        translationKey: `${key}_deleted_successfully`,
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

  return { create, list, details, update, remove };
};

module.exports = { makePdfController };
