import mongoose from "mongoose";

const chatSchema = new mongoose.Schema({
  user1_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  user2_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  lastMessage: { type: String, default: "No messages yet" },
  unreadCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Chat", chatSchema);