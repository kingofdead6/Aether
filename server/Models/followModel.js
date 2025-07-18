import mongoose from "mongoose";

const FollowSchema = new mongoose.Schema(
  {
    followerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    followeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Ensure unique follow relationships
FollowSchema.index({ followerId: 1, followeeId: 1 }, { unique: true });

export default mongoose.model("Follow", FollowSchema);