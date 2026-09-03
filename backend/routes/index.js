const express = require("express");
const router = express.Router();
router.use("/auth", require("./authRoutes"));
router.use("/upload", require("./uploadRoutes"));
// Cloudinary is the storage backend. /upload/aws keeps working for the
// clients already posting there, it just no longer talks to S3.
router.use("/upload/cloudinary", require("./uploadCloudinaryRoutes"));
router.use("/upload/aws", require("./uploadCloudinaryRoutes"));
router.use("/upload/azure", require("./uploadAzureBlobRoutes"));
router.use("/settings", require("../roles/admin/settings/adminSettingsRoutes"));
router.use("/communications", require("./communicationRoutes"));
router.use("/notifications", require("./notificationsRoutes"));
router.use("/support", require("./supportRoutes"));
router.use("/contact-us", require("./contactUsRoutes"));
router.use("/languages", require("./languageRoutes"));
router.use("/util", require("./dbRoutes"));
// router.use("/reviews", require("../commonModules/reviews/reviewRoutes"));
router.use("/engagement", require("../commonModules/appEngagement/engagementEventsRoutes"));

router.use("/dashboard", require("../roles/admin/dashboard/dashboardsRoutes"));

//locations
router.use("/locations", require("../shared/locations/routes"));
//help center
router.use("/help-center", require("../roles/admin/helpCenter/helpCenterRoutes"));        


//users
router.use("/users", require("../roles/admin/usersManagement/usersRoutes"));

//courses
router.use("/courses", require("../roles/admin/course/courseRoutes"));

//levels
router.use("/levels", require("../roles/admin/level/levelRoutes"));

//subjects
router.use("/subjects", require("../roles/admin/subject/subjectRoutes"));

//chapters
router.use("/chapters", require("../roles/admin/chapter/chapterRoutes"));

//pdfs: past papers and syllabus are admin uploaded, notes are student uploaded
router.use("/past-papers", require("../roles/admin/pdf/pastPaperRoutes"));
router.use("/syllabus", require("../roles/admin/pdf/syllabusRoutes"));
router.use("/notes", require("../roles/admin/pdf/noteRoutes"));

//leads
// router.use("/engagement", require("../commonModules/appEngagement/engagementEventsRoutes"));

//notification preferences
router.use("/notification-preferences", require("./notificationPreferencesRoutes"));
// router.use("/send-reminder", require("./sendRemindersRoutes"));
// router.use(
//   "/placeholder-profile",
//   require("../roles/admin/placeholder/placeholderProfileRoutes"),
// );
// router.use(
//   "/share",
//   require("../commonModules/share/shareRoutes"),
// );

// router.use("/stripe", require("../commonModules/stripeModule/routes/stripeAccountRoutes"));


module.exports = router;
