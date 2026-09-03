const Chapter = require("./ChapterModel");
const Subject = require("../subject/SubjectModel");
// Registers the parent models, the nested subject.level.course populate needs them
require("../level/LevelModel");
require("../course/CourseModel");
const mongoose = require("mongoose");
const Pdf = require("../pdf/PdfModel");
const {
  buildKeywordQueryFromModels,
} = require("@helperUtils/dbUtils/queryUtil");
const { generateMeta } = require("@helperUtils/responseUtil");
const {
  activeChildCounts,
  attachContentCount,
} = require("../../../shared/courseContent/contentCounts");

// The chapter screen shows three cards: syllabus, notes and past papers.
// These are exactly the counts behind them.
const withContentCount = async (chapters) => {
  const ids = chapters.map((chapter) => chapter._id);

  const [activeSyllabus, activeNotes, activePastPapers] = await Promise.all([
    activeChildCounts(Pdf, "chapter", ids, { type: "syllabus" }),
    activeChildCounts(Pdf, "chapter", ids, { type: "note" }),
    activeChildCounts(Pdf, "chapter", ids, { type: "pastPaper" }),
  ]);

  return attachContentCount(chapters, {
    activeSyllabus,
    activeNotes,
    activePastPapers,
  });
};

// A chapter name has to stay unique inside its subject among the chapters
// that are not deleted. The collation gives a case-insensitive exact match.
const findChapterByName = async (subject, name, excludeId) => {
  const filter = {
    subject: new mongoose.Types.ObjectId(subject),
    name: String(name).trim(),
    status: { $ne: "deleted" },
  };
  if (excludeId) {
    filter._id = { $ne: excludeId };
  }
  return Chapter.findOne(filter).collation({ locale: "en", strength: 2 });
};

// Two live chapters inside one subject cannot share a chapter number
const findChapterByNumber = async (subject, chapterNumber, excludeId) => {
  const filter = {
    subject: new mongoose.Types.ObjectId(subject),
    chapterNumber,
    status: { $ne: "deleted" },
  };
  if (excludeId) {
    filter._id = { $ne: excludeId };
  }
  return Chapter.findOne(filter);
};

const findSubjectById = async (subjectId) => {
  return Subject.findOne({ _id: subjectId, status: { $ne: "deleted" } }).lean();
};

const createChapter = async (data) => {
  try {
    const subject = await findSubjectById(data.subject);
    if (!subject) {
      return { error: "subject_not_found" };
    }

    // A child added under a node that is not active starts out inactive too
    if (subject.status !== "active") {
      data.status = "inactive";
    }

    const [existingName, existingNumber] = await Promise.all([
      findChapterByName(data.subject, data.name),
      findChapterByNumber(data.subject, data.chapterNumber),
    ]);

    if (existingName) {
      return { error: "chapter_already_exists_in_this_subject" };
    }
    if (existingNumber) {
      return { error: "chapter_number_already_exists_in_this_subject" };
    }

    const chapter = new Chapter(data);
    await chapter.save();
    return chapter;
  } catch (err) {
    throw err;
  }
};

// Pulls the parent subject with its level and, nested inside that, the course
const subjectLookupStage = {
  $lookup: {
    from: "subjects",
    let: { subjectId: "$subject" },
    pipeline: [
      {
        $match: {
          $expr: {
            $eq: ["$_id", "$$subjectId"],
          },
        },
      },
      {
        $lookup: {
          from: "levels",
          let: { levelId: "$level" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$levelId"],
                },
              },
            },
            {
              $lookup: {
                from: "courses",
                let: { courseId: "$course" },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $eq: ["$_id", "$$courseId"],
                      },
                    },
                  },
                  {
                    $project: {
                      name: 1,
                      description: 1,
                      emoji: 1,
                      status: 1,
                    },
                  },
                ],
                as: "course",
              },
            },
            {
              $unwind: {
                path: "$course",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                name: 1,
                emoji: 1,
                status: 1,
                course: 1,
              },
            },
          ],
          as: "level",
        },
      },
      {
        $unwind: {
          path: "$level",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          name: 1,
          emoji: 1,
          status: 1,
          level: 1,
        },
      },
    ],
    as: "subject",
  },
};

const populateParents = {
  path: "subject",
  select: "name emoji status level",
  populate: {
    path: "level",
    select: "name emoji status course",
    populate: {
      path: "course",
      select: "name description emoji status",
    },
  },
};

const getChapter = async ({
  page,
  limit,
  skip,
  keyword,
  status,
  subjectId,
  onlyActiveParents,
}) => {
  const pipeline = [];

  if (subjectId) {
    pipeline.push({
      $match: {
        subject: new mongoose.Types.ObjectId(subjectId),
      },
    });
  }

  if (status) {
    pipeline.push({
      $match: {
        status,
      },
    });
  } else {
    pipeline.push({
      $match: {
        status: { $ne: "deleted" },
      },
    });
  }

  pipeline.push(subjectLookupStage);

  pipeline.push({
    $unwind: {
      path: "$subject",
      preserveNullAndEmptyArrays: true,
    },
  });

  // A student only sees chapters whose whole chain is active
  if (onlyActiveParents) {
    pipeline.push({
      $match: {
        "subject.status": "active",
        "subject.level.status": "active",
        "subject.level.course.status": "active",
      },
    });
  }

  if (keyword) {
    const keywordMatch = buildKeywordQueryFromModels(
      [{ schema: Chapter.schema }],
      keyword,
    );

    if (Object.keys(keywordMatch).length) {
      pipeline.push({
        $match: keywordMatch,
      });
    }
  }

  // Chapters read in their own order, newest first only breaks ties
  pipeline.push({
    $sort: {
      chapterNumber: 1,
      createdAt: -1,
    },
  });

  pipeline.push({
    $facet: {
      data: [{ $skip: skip }, ...(limit === 0 ? [] : [{ $limit: limit }])],
      totalFiltered: [
        {
          $count: "count",
        },
      ],
    },
  });

  const result = await Chapter.aggregate(pipeline);

  const chapter = result[0]?.data || [];
  const totalFiltered = result[0]?.totalFiltered?.[0]?.count || 0;

  // Counts stay scoped to the subject when the list is filtered by one
  const countFilter = {
    ...(subjectId && { subject: new mongoose.Types.ObjectId(subjectId) }),
  };

  const [totalRecord, active, inactive, deleted] = await Promise.all([
    Chapter.countDocuments({ ...countFilter }),
    Chapter.countDocuments({ ...countFilter, status: "active" }),
    Chapter.countDocuments({ ...countFilter, status: "inactive" }),
    Chapter.countDocuments({ ...countFilter, status: "deleted" }),
  ]);

  const meta = generateMeta(page, limit, totalFiltered);

  meta.chapterCount = {
    totalRecord,
    active,
    inactive,
    deleted,
  };

  return {
    chapter: await withContentCount(chapter),
    meta,
  };
};

const findChapterById = async (id) => {
  const chapter = await Chapter.findById(id).lean().populate(populateParents);
  if (!chapter) return chapter;

  const [withCount] = await withContentCount([chapter]);
  return withCount;
};

const findChapterById_ = async (id) => {
  return Chapter.findById(id);
};

const findByIdAndUpdate = async (id, data) => {
  return Chapter.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  })
    .lean()
    .populate(populateParents);
};

const deleteChapter = async (id) => {
  return Chapter.findOneAndUpdate(
    { _id: id, status: { $ne: "deleted" } },
    { status: "deleted" },
    { new: true },
  );
};

module.exports = {
  createChapter,
  getChapter,
  findChapterById,
  findChapterById_,
  findChapterByName,
  findChapterByNumber,
  findSubjectById,
  findByIdAndUpdate,
  deleteChapter,
};
