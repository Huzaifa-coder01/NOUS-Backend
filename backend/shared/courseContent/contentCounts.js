const mongoose = require("mongoose");

/**
 * Counts of the active content sitting under a course / level / subject.
 * Every helper takes the ids of one page of parents and returns a plain
 * object keyed by parent id, so a list needs one extra query per depth.
 */

const toObjectIds = (ids) =>
  ids
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

const rowsToMap = (rows) =>
  rows.reduce((acc, row) => {
    acc[String(row._id)] = row.count;
    return acc;
  }, {});

/**
 * Active direct children per parent, e.g. active levels of a course.
 * extraMatch narrows the children further, e.g. { type: "syllabus" } for PDFs.
 */
const activeChildCounts = async (
  childModel,
  parentField,
  parentIds,
  extraMatch = {},
) => {
  const ids = toObjectIds(parentIds);
  if (!ids.length) return {};

  const rows = await childModel.aggregate([
    {
      $match: {
        ...extraMatch,
        [parentField]: { $in: ids },
        status: "active",
      },
    },
    {
      $group: {
        _id: "$" + parentField,
        count: { $sum: 1 },
      },
    },
  ]);

  return rowsToMap(rows);
};

/**
 * Active grandchildren per parent, e.g. active subjects of a course.
 * Walks down from the middle model so it can use its indexed parent field,
 * and skips anything hanging under a deleted middle record.
 */
const activeGrandchildCounts = async (
  middleModel,
  middleParentField,
  grandchildCollection,
  grandchildParentField,
  parentIds,
) => {
  const ids = toObjectIds(parentIds);
  if (!ids.length) return {};

  const rows = await middleModel.aggregate([
    {
      $match: {
        [middleParentField]: { $in: ids },
        status: { $ne: "deleted" },
      },
    },
    {
      $lookup: {
        from: grandchildCollection,
        let: { middleId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$" + grandchildParentField, "$$middleId"],
              },
              status: "active",
            },
          },
          {
            $count: "count",
          },
        ],
        as: "grandchildren",
      },
    },
    {
      $group: {
        _id: "$" + middleParentField,
        count: {
          $sum: {
            $ifNull: [{ $arrayElemAt: ["$grandchildren.count", 0] }, 0],
          },
        },
      },
    },
  ]);

  return rowsToMap(rows);
};

/**
 * Hangs a contentCount object on each record, defaulting every count to 0.
 */
const attachContentCount = (records, countMaps) => {
  return records.map((record) => {
    const contentCount = {};
    for (const [key, map] of Object.entries(countMaps)) {
      contentCount[key] = map[String(record._id)] || 0;
    }
    return { ...record, contentCount };
  });
};

module.exports = {
  activeChildCounts,
  activeGrandchildCounts,
  attachContentCount,
};
