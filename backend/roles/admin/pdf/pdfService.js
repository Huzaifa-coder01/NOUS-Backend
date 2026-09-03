const PdfRepo = require("./pdfRepository");
const { CHAPTER_REQUIRED_TYPES } = require("./PdfModel");
const {
  resolvePdfChain,
  chainHasInactive,
} = require("../../../shared/courseContent/hierarchy");

/**
 * The ancestors are derived from the deepest node the caller names, so a stored
 * PDF can never point at a chain that does not line up.
 */
const createPdf = async ({
  type,
  name,
  file,
  fileUrl,
  subjectId,
  chapterId,
  uploadedBy,
  requireActiveChain = false,
}) => {
  if (CHAPTER_REQUIRED_TYPES.includes(type) && !chapterId) {
    return { error: "chapterId_required" };
  }

  const resolved = await resolvePdfChain({ subjectId, chapterId });
  if (resolved.error) {
    return { error: resolved.error };
  }
  const { chain } = resolved;

  const duplicate = await PdfRepo.findByName(name);
  if (duplicate) {
    return { error: "pdf_name_already_exists" };
  }

  // A new PDF under a node that is not active starts out inactive, same rule
  // the parent-child cascade applies.
  const inactiveChain = chainHasInactive(chain);

  // A student cannot hang a note off something they are not allowed to see
  if (inactiveChain && requireActiveChain) {
    return { error: chapterId ? "chapter_not_found" : "subject_not_found" };
  }

  const status = inactiveChain ? "inactive" : "active";

  const pdf = await PdfRepo.createPdf({
    type,
    name: String(name).trim(),
    file,
    fileUrl,
    course: chain.course._id,
    level: chain.level._id,
    subject: chain.subject._id,
    chapter: chain.chapter ? chain.chapter._id : null,
    uploadedBy,
    status,
  });

  return pdf;
};

const getPdfs = async ({
  type,
  page,
  limit,
  keyword,
  status,
  courseId,
  levelId,
  subjectId,
  chapterId,
  uploadedBy,
}) => {
  const skip = limit === 0 ? 0 : (page - 1) * limit;

  return PdfRepo.getPdfs({
    type,
    page,
    limit,
    skip,
    keyword,
    status,
    courseId,
    levelId,
    subjectId,
    chapterId,
    uploadedBy,
  });
};

const updatePdf = async (id, type, data) => {
  const pdf = await PdfRepo.findPdfById_(id, type);

  if (!pdf || pdf.status === "deleted") {
    return { error: "pdf_not_found" };
  }

  const allowedFields = ["name", "file", "fileUrl", "status"];
  const updateData = {};
  for (const key of allowedFields) {
    if (data[key] !== undefined) {
      updateData[key] = data[key];
    }
  }

  if (Object.keys(updateData).length === 0) {
    return pdf;
  }

  if (updateData.name) {
    const duplicate = await PdfRepo.findByName(updateData.name, id);
    if (duplicate) {
      return { error: "pdf_name_already_exists" };
    }
  }

  Object.assign(pdf, updateData);
  await pdf.save();

  return pdf;
};

const getPdfDetails = async (id, type, { onlyActive = false } = {}) => {
  const pdf = await PdfRepo.findPdfById(id, type);

  if (!pdf || pdf.status === "deleted") {
    return null;
  }

  // A student only ever sees an active PDF whose whole chain is active
  if (onlyActive) {
    const chain = [pdf.course, pdf.level, pdf.subject, pdf.chapter].filter(
      Boolean,
    );
    const chainActive = chain.every((node) => node.status === "active");
    if (pdf.status !== "active" || !chainActive) {
      return null;
    }
  }

  return pdf;
};

const deletePdf = async (id, type) => {
  if (!id) throw new Error("Pdf ID is required");
  const deleted = await PdfRepo.deletePdf(id, type);
  return !!deleted;
};

module.exports = {
  createPdf,
  getPdfs,
  updatePdf,
  deletePdf,
  getPdfDetails,
};
