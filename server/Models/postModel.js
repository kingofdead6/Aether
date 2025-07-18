import mongoose from "mongoose";

const CommentSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, maxLength: 280 },
    createdAt: { type: Date, default: Date.now },
  }
);

const PostSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, maxLength: 280 },
    image_urls: [{ type: String }], // Array for up to 5 images
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Users who liked the post
    comments: [CommentSchema], // Embedded comments
  },
  { timestamps: true }
);

export default mongoose.model("Post", PostSchema);