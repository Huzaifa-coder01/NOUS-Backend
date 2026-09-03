const { v2: cloudinary } = require("cloudinary");

/**
 * Cloudinary is configured on first use, reading the env at call time so a
 * missing config cannot crash the server at startup.
 * Either CLOUDINARY_URL, or the three CLOUDINARY_CLOUD_NAME / _API_KEY /
 * _API_SECRET values, is enough.
 */

const isCloudinaryConfigured = () =>
  Boolean(
    process.env.CLOUDINARY_URL ||
      (process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET)
  );

let configured = false;

const getCloudinary = () => {
  if (!isCloudinaryConfigured()) {
    throw new Error("cloudinary_not_configured");
  }

  if (!configured) {
    // CLOUDINARY_URL is picked up by the SDK on its own
    if (!process.env.CLOUDINARY_URL) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
    }
    cloudinary.config({ secure: true });
    configured = true;
  }

  return cloudinary;
};

// Optional folder every upload lands in, e.g. "nous/dev"
const getUploadFolder = () => process.env.CLOUDINARY_UPLOAD_FOLDER || "";

module.exports = {
  getCloudinary,
  isCloudinaryConfigured,
  getUploadFolder,
};
