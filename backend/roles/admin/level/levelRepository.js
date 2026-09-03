const Level = require("./LevelModel");
const Course = require("../course/CourseModel");
const Subject = require("../subject/SubjectModel");
const mongoose = require("mongoose");
const {
  buildKeywordQueryFromModels,
} = require("@helperUtils/dbUtils/queryUtil");
const { generateMeta } = require("@helperUtils/responseUtil");
const {
  activeChildCounts,
  activeGrandchildCounts,
  attachContentCount,
} = require("../../../shared/courseContent/contentCounts");

// Active subjects of a level, plus the active chapters under those subjects
const withContentCount = async (levels) => {
  const ids = levels.map((level) => level._id);

  const [activeSubjects, activeChapters] = await Promise.all([
    activeChildCounts(Subject, "level", ids),
    activeGrandchildCounts(Subject, "level", "chapters", "subject", ids),
  ]);

  return attachContentCount(levels, { activeSubjects, activeChapters });
};

// A level name has to stay unique inside its course among the levels
// that are not deleted. The collation gives a case-insensitive exact match.
const findLevelByName = async (course, name, excludeId) => {
  const filter = {
    course: new mongoose.Types.ObjectId(course),
    name: String(name).trim(),
    status: { $ne: "deleted" },
  };
  if (excludeId) {
    filter._id = { $ne: excludeId };
  }
  return Level.findOne(filter).collation({ locale: "en", strength: 2 });
};

const findCourseById = async (courseId) => {
  return Course.findOne({ _id: courseId, status: { $ne: "deleted" } }).lean();
};

const createLevel = async (data) => {
  try {
    const course = await findCourseById(data.course);
    if (!course) {
      return { error: "course_not_found" };
    }

    const existingLevel = await findLevelByName(data.course, data.name);
    if (existingLevel) {
      return { error: "level_already_exists_in_this_course" };
    }

    const level = new Level(data);
    await level.save();
    return level;
  } catch (err) {
    throw err;
  }
};

const getLevel = async ({
  page,
  limit,
  skip,
  keyword,
  status,
  courseId,
  onlyActiveCourse,
}) => {
  const pipeline = [];

  if (courseId) {
    pipeline.push({
      $match: {
        course: new mongoose.Types.ObjectId(courseId),
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

  pipeline.push({
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
  });

  pipeline.push({
    $unwind: {
      path: "$course",
      preserveNullAndEmptyArrays: true,
    },
  });

  // A student only sees the levels that sit under an active course
  if (onlyActiveCourse) {
    pipeline.push({
      $match: {
        "course.status": "active",
      },
    });
  }

  if (keyword) {
    const keywordMatch = buildKeywordQueryFromModels(
      [{ schema: Level.schema }],
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

  const result = await Level.aggregate(pipeline);

  const level = result[0]?.data || [];
  const totalFiltered = result[0]?.totalFiltered?.[0]?.count || 0;

  // Counts stay scoped to the course when the list is filtered by one
  const countFilter = {
    ...(courseId && { course: new mongoose.Types.ObjectId(courseId) }),
  };

  const [totalRecord, active, inactive, deleted] = await Promise.all([
    Level.countDocuments({ ...countFilter }),
    Level.countDocuments({ ...countFilter, status: "active" }),
    Level.countDocuments({ ...countFilter, status: "inactive" }),
    Level.countDocuments({ ...countFilter, status: "deleted" }),
  ]);

  const meta = generateMeta(page, limit, totalFiltered);

  meta.levelCount = {
    totalRecord,
    active,
    inactive,
    deleted,
  };

  return {
    level: await withContentCount(level),
    meta,
  };
};

const findLevelById = async (id) => {
  const level = await Level.findById(id)
    .lean()
    .populate("course", "name description emoji status");
  if (!level) return level;

  const [withCount] = await withContentCount([level]);
  return withCount;
};

const findLevelById_ = async (id) => {
  return Level.findById(id);
};

const findByIdAndUpdate = async (id, data) => {
  return Level.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  })
    .lean()
    .populate("course", "name description emoji status");
};

const deleteLevel = async (id) => {
  return Level.findOneAndUpdate(
    { _id: id, status: { $ne: "deleted" } },
    { status: "deleted" },
    { new: true },
  );
};

module.exports = {
  createLevel,
  getLevel,
  findLevelById,
  findLevelById_,
  findLevelByName,
  findCourseById,
  findByIdAndUpdate,
  deleteLevel,
};
