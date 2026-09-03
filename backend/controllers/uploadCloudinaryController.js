const path = require("path");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const { sendResponse } = require("../helperUtils/responseUtil");
const { uploads3Mw } = require("../middlewares/uploadFilesAWSMw");
const {
  getCloudinary,
  isCloudinaryConfigured,
  getUploadFolder,
} = require("../config/cloudinary");

// How many files go up at the same time
const MAX_CONCURRENT_UPLOADS = 5;

/**
 * Runs the tasks with a fixed number in flight, keeping the results in order.
 */
const runWithConcurrency = async (tasks, concurrency) => {
  const results = new Array(tasks.length);
  let next = 0;

  const worker = async () => {
    while (next < tasks.length) {
      const index = next++;
      results[index] = await tasks[index]();
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker(),
  );
  await Promise.all(workers);

  return results;
};

/**
 * Uploads one buffer through Cloudinary's upload stream.
 * resource_type "auto" lets images, videos and raw files share the endpoint.
 */
const uploadBuffer = (cloudinary, file, publicId, folder) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        folder: folder || undefined,
        resource_type: "auto",
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );

    stream.end(file.buffer);
  });

/**
 * Uploads the multer files to Cloudinary.
 * Keeps the response shape the S3 uploader used, so clients do not change:
 *   file           relative key, e.g. "nous/6f1e....png"
 *   fileUrl        absolute delivery URL
 *   fileExtension  ".png"
 */
const uploadFilesToCloudinary = async (files) => {
  const cloudinary = getCloudinary();
  const folder = getUploadFolder();

  const tasks = files.map((file) => async () => {
    if (!file.buffer) {
      throw new Error("file_buffer_is_missing");
    }

    const fileExtension = path.extname(file.originalname);
    const publicId = uuidv4();

    const result = await uploadBuffer(cloudinary, file, publicId, folder);

    const format = result.format ? `.${result.format}` : fileExtension;
    const key = `${result.public_id}${format}`;

    return {
      file: key,
      fileUrl: result.secure_url || result.url,
      fileExtension: format,
      publicId: result.public_id,
      resourceType: result.resource_type,
    };
  });

  return runWithConcurrency(tasks, MAX_CONCURRENT_UPLOADS);
};

// Function to handle file upload
const uploadFiles = (req, res) => {
  if (!isCloudinaryConfigured()) {
    return sendResponse({
      res,
      statusCode: 503,
      translationKey: "cloudinary_not_configured",
    });
  }

  uploads3Mw(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (
        err.code === "LIMIT_FILE_COUNT" ||
        err.code === "LIMIT_UNEXPECTED_FILE"
      ) {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey: "limit_exceeding_max_files",
          error: err.message,
        });
      }
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "file_upload",
        values: {
          errorMessage: err.message,
        },
        error: err,
      });
    } else if (err) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "file_upload",
        values: {
          errorMessage: err.message,
        },
        error: err,
      });
    } else if (!req.files || req.files.length === 0) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "no_files",
      });
    }

    try {
      const uploadedFiles = await uploadFilesToCloudinary(req.files);

      // A single file answers with an object, many with an array
      const response =
        uploadedFiles.length === 1 ? uploadedFiles[0] : uploadedFiles;

      return sendResponse({
        res,
        statusCode: 200,
        translationKey: "files_uploaded",
        data: response,
      });
    } catch (error) {
      return sendResponse({
        res,
        statusCode: 500,
        translationKey: "cloudinary_upload",
        values: {
          error: error.message,
        },
        error,
      });
    }
  });
};

/**
 * Accepts what the upload returned: the relative key ("folder/id.png"),
 * the bare public id, or the full delivery URL.
 */
const toPublicId = (fileKey) => {
  let key = String(fileKey).trim();

  if (key.startsWith("http")) {
    const withoutQuery = key.split("?")[0];
    // .../upload/v1712345678/folder/id.png -> folder/id.png
    const afterUpload = withoutQuery.split("/upload/")[1] || "";
    key = afterUpload.replace(/^v\d+\//, "");
  }

  const extension = path.extname(key);
  return extension ? key.slice(0, -extension.length) : key;
};

const deleteFileFromCloudinary = async (cloudinary, fileKey) => {
  const publicId = toPublicId(fileKey);

  // The resource type is not in the key, so try each one the uploader can write
  for (const resourceType of ["image", "video", "raw"]) {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });
    if (result?.result === "ok") {
      return result;
    }
  }

  throw new Error(`Failed to delete file: ${publicId}`);
};

/* Request body format:
For a single file: { "fileKey": "nous/6f1e....png" }
For multiple files: { "fileKey": ["nous/a.png", "nous/b.mp4"] } */
const deleteFiles = async (req, res) => {
  const { fileKey } = req.body;

  if (!fileKey) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: "file_key",
      error: "File key is missing.",
    });
  }

  if (!isCloudinaryConfigured()) {
    return sendResponse({
      res,
      statusCode: 503,
      translationKey: "cloudinary_not_configured",
    });
  }

  try {
    const cloudinary = getCloudinary();

    if (Array.isArray(fileKey)) {
      await Promise.all(
        fileKey.map((key) => deleteFileFromCloudinary(cloudinary, key)),
      );
      return sendResponse({
        res,
        statusCode: 200,
        translationKey: "files_deleted",
        data: { fileKeys: fileKey },
      });
    }

    await deleteFileFromCloudinary(cloudinary, fileKey);
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "file_deleted",
      data: { fileKey },
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "file_deletion",
      error,
    });
  }
};

module.exports = {
  uploadFiles,
  deleteFiles,
  uploadFilesToCloudinary,
};
