const Pdf = require("./PdfModel");
const mongoose = require("mongoose");
// Registers the models the hierarchy populate needs
require("../course/CourseModel");
require("../level/LevelModel");
require("../subject/SubjectModel");
require("../chapter/ChapterModel");
const {
  buildKeywordQueryFromModels,
} = require("@helperUtils/dbUtils/queryUtil");
const { generateMeta } = require("@helperUtils/responseUtil");

// Every PDF name is unique across the whole system, whatever its type,
// among the ones that are not deleted. Collation gives a case-insensitive match.
const findByName = async (name, excludeId) => {
  const filter = {
    name: String(name).trim(),
    status: { $ne: "deleted" },
  };
  if (excludeId) {
    filter._id = { $ne: excludeId };
  }
  return Pdf.findOne(filter).collation({ locale: "en", strength: 2 });
};

const createPdf = async (data) => {
  const pdf = new Pdf(data);
  await pdf.save();
  return pdf;
};

const HIERARCHY_POPULATE = [
  { path: "course", select: "name description emoji status" },
  { path: "level", select: "name emoji status" },
  { path: "subject", select: "name emoji status" },
  { path: "chapter", select: "chapterNumber name status" },
  { path: "uploadedBy", select: "name email profileIcon" },
];

const lookupStage = (from, localField, projection) => [
  {
    $lookup: {
      from,
      let: { fk: "$" + localField },
      pipeline: [
        { $match: { $expr: { $eq: ["$_id", "$$fk"] } } },
        { $project: projection },
      ],
      as: localField,
    },
  },
  { $unwind: { path: "$" + localField, preserveNullAndEmptyArrays: true } },
];

const getPdfs = async ({
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
}) => {
  const match = { type };

  if (courseId) match.course = new mongoose.Types.ObjectId(courseId);
  if (levelId) match.level = new mongoose.Types.ObjectId(levelId);
  if (subjectId) match.subject = new mongoose.Types.ObjectId(subjectId);
  if (chapterId) match.chapter = new mongoose.Types.ObjectId(chapterId);
  if (uploadedBy) match.uploadedBy = new mongoose.Types.ObjectId(uploadedBy);

  match.status = status ? status : { $ne: "deleted" };

  const pipeline = [{ $match: match }];

  pipeline.push(
    ...lookupStage("courses", "course", { name: 1, emoji: 1, status: 1 }),
    ...lookupStage("levels", "level", { name: 1, emoji: 1, status: 1 }),
    ...lookupStage("subjects", "subject", { name: 1, emoji: 1, status: 1 }),
    ...lookupStage("chapters", "chapter", {
      chapterNumber: 1,
      name: 1,
      status: 1,
    }),
    ...lookupStage("users", "uploadedBy", {
      name: 1,
      email: 1,
      profileIcon: 1,
    }),
  );

  if (keyword) {
    const keywordMatch = buildKeywordQueryFromModels(
      [{ schema: Pdf.schema }],
      keyword,
    );
    if (Object.keys(keywordMatch).length) {
      pipeline.push({ $match: keywordMatch });
    }
  }

  pipeline.push({ $sort: { createdAt: -1 } });

  pipeline.push({
    $facet: {
      data: [{ $skip: skip }, ...(limit === 0 ? [] : [{ $limit: limit }])],
      totalFiltered: [{ $count: "count" }],
    },
  });

  const result = await Pdf.aggregate(pipeline);

  const pdfs = result[0]?.data || [];
  const totalFiltered = result[0]?.totalFiltered?.[0]?.count || 0;

  // Counts stay inside the same type and the same node the list is filtered by
  const countFilter = { type };
  if (courseId) countFilter.course = new mongoose.Types.ObjectId(courseId);
  if (levelId) countFilter.level = new mongoose.Types.ObjectId(levelId);
  if (subjectId) countFilter.subject = new mongoose.Types.ObjectId(subjectId);
  if (chapterId) countFilter.chapter = new mongoose.Types.ObjectId(chapterId);
  if (uploadedBy) {
    countFilter.uploadedBy = new mongoose.Types.ObjectId(uploadedBy);
  }

  const [totalRecord, active, inactive, deleted] = await Promise.all([
    Pdf.countDocuments({ ...countFilter }),
    Pdf.countDocuments({ ...countFilter, status: "active" }),
    Pdf.countDocuments({ ...countFilter, status: "inactive" }),
    Pdf.countDocuments({ ...countFilter, status: "deleted" }),
  ]);

  const meta = generateMeta(page, limit, totalFiltered);
  meta.pdfCount = { totalRecord, active, inactive, deleted };

  return { pdfs, meta };
};

const findPdfById = async (id, type) => {
  const filter = { _id: id };
  if (type) filter.type = type;
  return Pdf.findOne(filter).lean().populate(HIERARCHY_POPULATE);
};

const findPdfById_ = async (id, type) => {
  const filter = { _id: id };
  if (type) filter.type = type;
  return Pdf.findOne(filter);
};

const deletePdf = async (id, type) => {
  const filter = { _id: id, status: { $ne: "deleted" } };
  if (type) filter.type = type;
  return Pdf.findOneAndUpdate(filter, { status: "deleted" }, { new: true });
};

module.exports = {
  createPdf,
  getPdfs,
  findPdfById,
  findPdfById_,
  findByName,
  deletePdf,
};
