const Course = require("./CourseModel");
const Level = require("../level/LevelModel");
const {
  buildKeywordQueryFromModels,
} = require("@helperUtils/dbUtils/queryUtil");
const { generateMeta } = require("@helperUtils/responseUtil");
const {
  activeChildCounts,
  activeGrandchildCounts,
  attachContentCount,
} = require("../../../shared/courseContent/contentCounts");

// Active levels of a course, plus the active subjects under those levels
const withContentCount = async (courses) => {
  const ids = courses.map((course) => course._id);

  const [activeLevels, activeSubjects] = await Promise.all([
    activeChildCounts(Level, "course", ids),
    activeGrandchildCounts(Level, "course", "subjects", "level", ids),
  ]);

  return attachContentCount(courses, { activeLevels, activeSubjects });
};

// A course name has to stay unique among the courses that are not deleted.
// The collation gives a case-insensitive exact match without regex escaping.
const findCourseByName = async (name, excludeId) => {
  const filter = {
    name: String(name).trim(),
    status: { $ne: "deleted" },
  };
  if (excludeId) {
    filter._id = { $ne: excludeId };
  }
  return Course.findOne(filter).collation({ locale: "en", strength: 2 });
};

const createCourse = async (data) => {
  try {
    const existingCourse = await findCourseByName(data.name);
    if (existingCourse) {
      return { error: "course_already_exists_with_this_name" };
    }

    const course = new Course(data);
    await course.save();
    return course;
  } catch (err) {
    throw err;
  }
};

const getCourse = async ({ page, limit, skip, keyword, status }) => {
  const pipeline = [];

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

  if (keyword) {
    const keywordMatch = buildKeywordQueryFromModels(
      [{ schema: Course.schema }],
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

  const result = await Course.aggregate(pipeline);

  const course = result[0]?.data || [];
  const totalFiltered = result[0]?.totalFiltered?.[0]?.count || 0;

  const [totalRecord, active, inactive, deleted] = await Promise.all([
    Course.countDocuments({}),
    Course.countDocuments({ status: "active" }),
    Course.countDocuments({ status: "inactive" }),
    Course.countDocuments({ status: "deleted" }),
  ]);

  const meta = generateMeta(page, limit, totalFiltered);

  meta.courseCount = {
    totalRecord,
    active,
    inactive,
    deleted,
  };

  return {
    course: await withContentCount(course),
    meta,
  };
};

const findCourseById = async (id) => {
  const course = await Course.findById(id).lean();
  if (!course) return course;

  const [withCount] = await withContentCount([course]);
  return withCount;
};

const findCourseById_ = async (id) => {
  return Course.findById(id);
};

const findByIdAndUpdate = async (id, data) => {
  return Course.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  }).lean();
};

const deleteCourse = async (id) => {
  return Course.findOneAndUpdate(
    { _id: id, status: { $ne: "deleted" } },
    { status: "deleted" },
    { new: true },
  );
};

module.exports = {
  createCourse,
  getCourse,
  findCourseById,
  findCourseById_,
  findCourseByName,
  findByIdAndUpdate,
  deleteCourse,
};
