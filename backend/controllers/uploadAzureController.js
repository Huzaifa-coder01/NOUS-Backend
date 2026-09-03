const path = require("path");
const { sendResponse } = require("../helperUtils/responseUtil");
const { uploads3Mw } = require("../middlewares/uploadFilesAWSMw");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();
const multer = require("multer");
const sharp = require("sharp");
const {
  BlobServiceClient,
  StorageSharedKeyCredential,
} = require("@azure/storage-blob");

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

// Azure Blob Service is built on first use, reading the env at call time so a
// missing Azure config cannot crash the server at startup.
const isAzureConfigured = () =>
  Boolean(
    process.env.AZURE_STORAGE_ACCOUNT_NAME &&
      process.env.AZURE_STORAGE_ACCOUNT_KEY &&
      process.env.AZURE_STORAGE_CONTAINER_NAME
  );

let containerClient = null;

const getContainerClient = () => {
  if (!isAzureConfigured()) {
    throw new Error("azure_storage_not_configured");
  }

  if (!containerClient) {
    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    const sharedKeyCredential = new StorageSharedKeyCredential(
      accountName,
      process.env.AZURE_STORAGE_ACCOUNT_KEY
    );
    const blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      sharedKeyCredential
    );
    containerClient = blobServiceClient.getContainerClient(
      process.env.AZURE_STORAGE_CONTAINER_NAME
    );
  }

  return containerClient;
};

// Upload files to Azure
const uploadFiles = (req, res) => {
  if (!isAzureConfigured()) {
    return sendResponse({
      res,
      statusCode: 503,
      translationKey: "azure_storage_not_configured",
    });
  }

  uploads3Mw(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return sendResponse({ res, statusCode: 400, error: err.message });
    } else if (err) {
      return sendResponse({ res, statusCode: 400, error: err.message });
    } else if (!req.files || req.files.length === 0) {
      return sendResponse({ res, statusCode: 400, translationKey: "no_files" });
    }

    try {
      const uploadedFiles = await uploadFilesToAzure(req.files);
      const response = uploadedFiles.length === 1 ? uploadedFiles[0] : uploadedFiles;

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
        translationKey: "azure_upload",
        error: error,
      });
    }
  });
};

// Upload multiple files
const uploadFilesToAzure = async (files) => {
  const containerClient = getContainerClient();

  const uploadPromises = files.map(async (file) => {
    let fileBuffer = file.buffer;
    //enable to compress
    // if (fileBuffer.length > MAX_FILE_SIZE) {
    //   fileBuffer = await compressImage(file.buffer);
    // }

    const fileExtension = path.extname(file.originalname);
    const filename = `${uuidv4()}${fileExtension}`;

    const blockBlobClient = containerClient.getBlockBlobClient(filename);

    await blockBlobClient.uploadData(fileBuffer, {
      blobHTTPHeaders: { blobContentType: file.mimetype },
    });

    return {
      file: filename,
      fileUrl: `${process.env.AZURE_STORAGE_BASE_URL}${filename}`,
      fileExtension: fileExtension,
    };
  });

  return Promise.all(uploadPromises);
};

// Compress image
const compressImage = async (buffer) => {
  let quality = 80;
  let compressedBuffer = buffer;

  do {
    compressedBuffer = await sharp(buffer)
      .jpeg({ quality })
      .toBuffer();

    if (compressedBuffer.length <= MAX_FILE_SIZE) break;
    quality -= 10;

    if (quality < 10) throw new Error("Unable to compress below 3 MB");
  } while (compressedBuffer.length > MAX_FILE_SIZE);

  return compressedBuffer;
};

// Delete file from Azure
const deleteFiles = async (req, res) => {
  const { fileKey } = req.body;
  if (!fileKey) {
    return sendResponse({ res, statusCode: 400, error: "File key is missing" });
  }

  if (!isAzureConfigured()) {
    return sendResponse({
      res,
      statusCode: 503,
      translationKey: "azure_storage_not_configured",
    });
  }

  try {
    const containerClient = getContainerClient();

    if (Array.isArray(fileKey)) {
      await Promise.all(fileKey.map((key) => containerClient.deleteBlob(key)));
    } else {
      await containerClient.deleteBlob(fileKey);
    }

    return sendResponse({ res, statusCode: 200, translationKey: "file_deleted" });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "file_deletion",
      error,
    });
  }
};

module.exports = { uploadFiles, deleteFiles, uploadFilesToAzure };
