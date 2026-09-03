const express = require("express");
const {
  uploadFiles,
  deleteFiles,
} = require("../controllers/uploadCloudinaryController");

const router = express.Router();

// Route to upload one or more files (multipart field name: files)
router.post("/", uploadFiles);

// Route to delete one or more files
router.delete("/", deleteFiles);

module.exports = router;
