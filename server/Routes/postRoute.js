import express from "express";
import {
  getFollowedPosts,
  createPost,
  likePost,
  addComment,
  deletePost,
  getLikedPosts,
  getCommentedPosts,
} from "../Controllers/postController.js";
import authMiddleware from "../Middleware/authMiddleware.js";
import multer from "multer";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

router.get("/followed", authMiddleware, getFollowedPosts);
router.post("/", authMiddleware, upload.array("images", 5), createPost);
router.post("/:postId/like", authMiddleware, likePost);
router.post("/:postId/comment", authMiddleware, addComment);
router.delete("/:postId", authMiddleware, deletePost);
router.get("/liked", authMiddleware, getLikedPosts);
router.get("/commented", authMiddleware, getCommentedPosts);

export default router;