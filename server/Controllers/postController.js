import mongoose from "mongoose";
import User from "../Models/userModel.js";
import Post from "../Models/postModel.js";
import cloudinary from "../utils/cloudinary.js";
import { PassThrough } from "stream";

export const getFollowedPosts = async (req, res) => {
  const userId = req.user._id;
  try {
    const user = await User.findById(userId).select("following");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const posts = await Post.find({ user_id: { $in: [...user.following, userId] } })
      .sort({ createdAt: -1 })
      .populate("user_id", "name profile_image")
      .populate("comments.user_id", "name profile_image")
      .limit(20);

    res.status(200).json({ posts });
  } catch (error) {
    console.error("Error fetching followed posts:", error);
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
};

export const createPost = async (req, res) => {
  const { content } = req.body;
  const images = req.files || [];
  const userId = req.user._id;

  try {
    console.log("Received create post request:", {
      content,
      imageCount: images.length,
    });

    if (!content || content.length > 280) {
      console.log("Invalid content:", content);
      return res.status(400).json({ message: "Content is required and must be 280 characters or less" });
    }

    if (images.length === 0) {
      console.log("No images provided");
      return res.status(400).json({ message: "At least one image is required" });
    }

    if (images.length > 5) {
      console.log("Too many images:", images.length);
      return res.status(400).json({ message: "Maximum 5 images allowed" });
    }

    const image_urls = [];
    for (const image of images) {
      if (!image.mimetype.startsWith("image/")) {
        console.log("Invalid file type:", image.mimetype);
        return res.status(400).json({ message: "All files must be images" });
      }
      if (image.size > 5 * 1024 * 1024) {
        console.log("File too large:", image.size);
        return res.status(400).json({ message: "Each image must be less than 5MB" });
      }

      const imageUrl = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "post_images",
            public_id: `${Date.now()}-${image.originalname}`,
            resource_type: "image",
          },
          (error, result) => {
            if (error) {
              console.error("Cloudinary upload error:", error.message);
              return reject(new Error(`Cloudinary upload failed: ${error.message}`));
            }
            console.log("Uploaded post image:", result.secure_url);
            resolve(result.secure_url);
          }
        );

        const bufferStream = new PassThrough();
        bufferStream.end(image.buffer);
        bufferStream.pipe(uploadStream);

        bufferStream.on("error", (error) => {
          console.error("Buffer stream error:", error.message);
          reject(error);
        });
      });
      image_urls.push(imageUrl);
    }

    const post = new Post({
      user_id: userId,
      content,
      image_urls,
      likes: [],
      comments: [],
    });
    await post.save();
    console.log("Post saved to MongoDB:", {
      _id: post._id,
      user_id: post.user_id,
      image_urls: post.image_urls,
    });

    const populatedPost = await Post.findById(post._id)
      .populate("user_id", "name profile_image")
      .populate("comments.user_id", "name profile_image");

    res.status(201).json({ post: populatedPost });
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
};

export const likePost = async (req, res) => {
  const { postId } = req.params;
  const userId = req.user._id;

  try {
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const isLiked = post.likes.includes(userId);
    if (isLiked) {
      post.likes = post.likes.filter((id) => id.toString() !== userId.toString());
      console.log("Unliked post:", postId);
    } else {
      post.likes.push(userId);
      console.log("Liked post:", postId);
    }
    await post.save();

    res.status(200).json({ message: isLiked ? "Unliked successfully" : "Liked successfully", likes: post.likes.length });
  } catch (error) {
    console.error("Error liking post:", error);
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
};

export const addComment = async (req, res) => {
  const { postId } = req.params;
  const { content } = req.body;
  const userId = req.user._id;

  try {
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }
    if (!content || content.length > 280) {
      return res.status(400).json({ message: "Comment is required and must be 280 characters or less" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    post.comments.push({ user_id: userId, content });
    await post.save();
    console.log("Comment added to post:", postId);

    const populatedPost = await Post.findById(postId)
      .populate("user_id", "name profile_image")
      .populate("comments.user_id", "name profile_image");

    res.status(201).json({ post: populatedPost });
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
};

export const deletePost = async (req, res) => {
  const { postId } = req.params;
  const userId = req.user._id;

  try {
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.user_id.toString() !== userId.toString()) {
      return res.status(403).json({ message: "You can only delete your own posts" });
    }

    for (const imageUrl of post.image_urls) {
      const publicId = imageUrl.split("/").pop()?.split(".")[0];
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(`post_images/${publicId}`);
          console.log("Deleted image from Cloudinary:", publicId);
        } catch (err) {
          console.warn("Cloudinary delete failed (continuing):", err.message);
        }
      }
    }

    await Post.deleteOne({ _id: postId });
    console.log("Deleted post from MongoDB:", postId);

    res.status(200).json({ message: "Post deleted successfully" });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
};

export const getLikedPosts = async (req, res) => {
  const userId = req.user._id;
  try {
    const posts = await Post.find({ likes: userId })
      .sort({ createdAt: -1 })
      .populate("user_id", "name profile_image")
      .populate("comments.user_id", "name profile_image")
      .limit(20);

    res.status(200).json({ posts });
  } catch (error) {
    console.error("Error fetching liked posts:", error);
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
};

export const getCommentedPosts = async (req, res) => {
  const userId = req.user._id;
  try {
    const posts = await Post.find({ "comments.user_id": userId })
      .sort({ createdAt: -1 })
      .populate("user_id", "name profile_image")
      .populate("comments.user_id", "name profile_image")
      .limit(20);

    res.status(200).json({ posts });
  } catch (error) {
    console.error("Error fetching commented posts:", error);
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
};