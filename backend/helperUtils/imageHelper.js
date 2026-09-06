/**
 * Media is stored and returned as a file name, never as an absolute url.
 * The client composes the url from the media base url, so moving storage
 * (S3 to Cloudinary and so on) never strands rows holding a dead link.
 */
function getFileName(value) {
  if (!value || typeof value !== "string") return "";

  if (!value.startsWith("http")) return value;

  // A row written before this rule may hold a full url. Peel off the origin and
  // any delivery prefix, keeping the folder structure of the stored name.
  let path = value.split("?")[0].replace(/^https?:\/\/[^/]+\//, "");

  // Cloudinary style: <resource_type>/upload/v1234/<name>
  const afterUpload = path.split("/upload/")[1];
  if (afterUpload !== undefined) path = afterUpload;

  return path.replace(/^v\d+\//, "");
}

// Kept so the older call sites keep working, they now return the file name
const getFullImageUrl = getFileName;

module.exports = { getFileName, getFullImageUrl };
