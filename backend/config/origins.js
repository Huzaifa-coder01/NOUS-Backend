const isDev =
  process.env.NODE_ENV === "dev" ||
  process.env.NODE_ENV === "mobileapps";

const PROD_ORIGINS = [
  "https://nous.com",
  "https://www.nous.com",
  "https://dev.nous.com",
  "https://www.dev.nous.com",
  "http://localhost:4003",
  "http://localhost:3030",
  "https://coachcritnousic.vercel.app",
  "http://192.168.13.67:4003"
];

module.exports = {
  isDev,
  allowedOrigins: isDev ? [] : PROD_ORIGINS,
  connectSrc: isDev ? ["*"] : ["'self'", ...PROD_ORIGINS],
};