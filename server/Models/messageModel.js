import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  chat_id: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true },
  sender_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, default: "" },
  file_url: { type: String, default: null },
  file_type: { type: String, enum: ["image", "pdf", "video", "audio"], default: null },
  public_id: { type: String, default: null },
  thumbnail_url: { type: String, default: null },
  seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  isEdited: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model("Message", messageSchema);