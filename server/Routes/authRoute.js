import express from "express";
import {
  registerUser,
  loginUser,
  getCurrentUser,
  requestPasswordReset,
  changePassword,
  searchUsers,
  getUserProfile,
  followUser,
  updateUserProfile,
  isFollowing,
} from "../Controllers/userController.js";
import authMiddleware from "../Middleware/authMiddleware.js";
import multer from "multer";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

router.post("/register", upload.fields([{ name: "profile_image", maxCount: 1 }]), registerUser);
router.post("/login", loginUser);
router.get("/me", authMiddleware, getCurrentUser);
router.post("/reset-password", requestPasswordReset);
router.post("/change-password", changePassword);
router.get("/search", authMiddleware, searchUsers);
router.get("/:userId", authMiddleware, getUserProfile);
router.post("/:userId/follow", authMiddleware, followUser);
router.get("/isFollowing/:userId", authMiddleware, isFollowing);
router.put("/profile", authMiddleware, upload.single("profile_image"), (req, res, next) => {
  console.log("Multer received files:", req.files, req.file);
  next();
}, updateUserProfile);

export default router;