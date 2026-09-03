
function getFullImageUrl(
  imagePath,
  baseUrl = process.env.MEDIA_BASE_URL || process.env.S3_BASE_URL || "",
) {
  if (imagePath && !imagePath.startsWith("http")) {
    return baseUrl + imagePath;
  }
  return imagePath || baseUrl + "noimage.png";
}

module.exports = { getFullImageUrl };
