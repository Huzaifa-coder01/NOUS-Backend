const Subject = require("./SubjectModel");
const Level = require("../level/LevelModel");
const Chapter = require("../chapter/ChapterModel");
// Registers the Course model, the nested level.course populate needs it
require("../course/CourseModel");
const mongoose = require("mongoose");
const {
  buildKeywordQueryFromModels,
} = require("@helperUtils/dbUtils/queryUtil");
const { generateMeta } = require("@helperUtils/responseUtil");
const {
  activeChildCounts,
  attachContentCount,
} = require("../../../shared/courseContent/contentCounts");

// Active chapters of a subject
const withContentCount = async (subjects) => {
  const ids = subjects.map((subject) => subject._id);

  const activeChapters = await activeChildCounts(Chapter, "subject", ids);

  return attachContentCount(subjects, { activeChapters });
};

// A subject name has to stay unique inside its level among the subjects
// that are not deleted. The collation gives a case-insensitive exact match.
const findSubjectByName = async (level, name, excludeId) => {
  const filter = {
    level: new mongoose.Types.ObjectId(level),
    name: String(name).trim(),
    status: { $ne: "deleted" },
  };
  if (excludeId) {
    filter._id = { $ne: excludeId };
  }
  return Subject.findOne(filter).collation({ locale: "en", strength: 2 });
};

const findLevelById = async (levelId) => {
  return Level.findOne({ _id: levelId, status: { $ne: "deleted" } }).lean();
};

const createSubject = async (data) => {
  try {
    const level = await findLevelById(data.level);
    if (!level) {
      return { error: "level_not_found" };
    }

    const existingSubject = await findSubjectByName(data.level, data.name);
    if (existingSubject) {
      return { error: "subject_already_exists_in_this_level" };
    }

    const subject = new Subject(data);
    await subject.save();
    return subject;
  } catch (err) {
    throw err;
  }
};

// Pulls the parent level and, nested inside it, the level's course
const levelLookupStage = {
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
};

const getSubject = async ({
  page,
  limit,
  skip,
  keyword,
  status,
  levelId,
  onlyActiveParents,
}) => {
  const pipeline = [];

  if (levelId) {
    pipeline.push({
      $match: {
        level: new mongoose.Types.ObjectId(levelId),
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

  pipeline.push(levelLookupStage);

  pipeline.push({
    $unwind: {
      path: "$level",
      preserveNullAndEmptyArrays: true,
    },
  });

  // A student only sees subjects whose level and course are both active
  if (onlyActiveParents) {
    pipeline.push({
      $match: {
        "level.status": "active",
        "level.course.status": "active",
      },
    });
  }

  if (keyword) {
    const keywordMatch = buildKeywordQueryFromModels(
      [{ schema: Subject.schema }],
      keyword,
    );

    if (Object.keys(keywordMatch).length) {
      pipeline.push({
        $match: keywordMatch,
      });
    }
  }

  pipeline.push({
    $sort: {
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

  const result = await Subject.aggregate(pipeline);

  const subject = result[0]?.data || [];
  const totalFiltered = result[0]?.totalFiltered?.[0]?.count || 0;

  // Counts stay scoped to the level when the list is filtered by one
  const countFilter = {
    ...(levelId && { level: new mongoose.Types.ObjectId(levelId) }),
  };

  const [totalRecord, active, inactive, deleted] = await Promise.all([
    Subject.countDocuments({ ...countFilter }),
    Subject.countDocuments({ ...countFilter, status: "active" }),
    Subject.countDocuments({ ...countFilter, status: "inactive" }),
    Subject.countDocuments({ ...countFilter, status: "deleted" }),
  ]);

  const meta = generateMeta(page, limit, totalFiltered);

  meta.subjectCount = {
    totalRecord,
    active,
    inactive,
    deleted,
  };

  return {
    subject: await withContentCount(subject),
    meta,
  };
};

const findSubjectById = async (id) => {
  const subject = await Subject.findById(id).lean().populate({
    path: "level",
    select: "name emoji status course",
    populate: {
      path: "course",
      select: "name description emoji status",
    },
  });
  if (!subject) return subject;

  const [withCount] = await withContentCount([subject]);
  return withCount;
};

const findSubjectById_ = async (id) => {
  return Subject.findById(id);
};

const findByIdAndUpdate = async (id, data) => {
  return Subject.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  })
    .lean()
    .populate({
      path: "level",
      select: "name emoji status course",
      populate: {
        path: "course",
        select: "name description emoji status",
      },
    });
};

const deleteSubject = async (id) => {
  return Subject.findOneAndUpdate(
    { _id: id, status: { $ne: "deleted" } },
    { status: "deleted" },
    { new: true },
  );
};

module.exports = {
  createSubject,
  getSubject,
  findSubjectById,
  findSubjectById_,
  findSubjectByName,
  findLevelById,
  findByIdAndUpdate,
  deleteSubject,
};
