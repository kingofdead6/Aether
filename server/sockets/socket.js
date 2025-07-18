import { Server } from "socket.io";
import Message from "../Models/messageModel.js";
import Notification from "../Models/notificationModel.js";
import Chat from "../Models/chatModel.js";
import jwt from "jsonwebtoken";

const setupSocket = (server, app) => {
  const io = new Server(server, {
    cors: {},
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    console.log("Socket.IO auth attempt, token:", token ? "Provided" : "Missing");
    if (!token) {
      console.error("Socket.IO auth error: No token provided");
      return next(new Error("Authentication error: No token provided"));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("Socket.IO auth success, userId:", decoded._id);
      socket.userId = decoded._id;
      next();
    } catch (error) {
      console.error("Socket.IO auth error:", error.message);
      next(new Error("Authentication error: Invalid token"));
    }
  });

  const users = new Map();
  app.set("users", users);

  io.on("connection", (socket) => {
    console.log("New Socket.IO connection:", socket.id, "User:", socket.userId);

    socket.on("register", (userId) => {
      console.log("Register event received, userId:", userId, "socket.userId:", socket.userId);
      if (userId && userId === socket.userId) {
        users.set(userId.toString(), socket.id);
        console.log(`User ${userId} registered with socket ${socket.id}`);
      } else {
        console.error("Invalid userId:", userId, "Expected:", socket.userId);
        socket.emit("error", { message: "Invalid userId" });
      }
    });

    socket.on("join_chat", (chatId) => {
      if (!chatId) {
        console.error("Invalid chatId:", chatId);
        socket.emit("error", { message: "Invalid chatId" });
        return;
      }
      socket.join(chatId);
      console.log(`User ${socket.userId} joined chat ${chatId}`);
      // Update seenBy for messages in this chat
      Message.updateMany(
        { chat_id: chatId, sender_id: { $ne: socket.userId }, seenBy: { $ne: socket.userId } },
        { $addToSet: { seenBy: socket.userId } }
      ).then(() => {
        io.to(chatId).emit("message_status_updated", { chatId });
      });
    });

    socket.on("typing", ({ chatId, userId }) => {
      if (chatId && userId) {
        io.to(chatId).emit("typing", { userId });
      }
    });

    // sockets/socket.js
socket.on("send_message", async ({ chatId, senderId, content, file_url, file_type, thumbnail_url, tempId }) => {
  console.log("Send message event:", { chatId, senderId, content, file_url, file_type, tempId });
  try {
    if (!chatId || !senderId || senderId !== socket.userId) {
      console.error("Invalid message data:", { chatId, senderId, socketUserId: socket.userId });
      socket.emit("message_error", { tempId, error: "Invalid message data" });
      return;
    }

    const chat = await Chat.findById(chatId)
      .populate("user1_id", "name profile_image")
      .populate("user2_id", "name profile_image");
    if (!chat) {
      console.error("Chat not found:", chatId);
      socket.emit("message_error", { tempId, error: "Chat not found" });
      return;
    }
    if (
      chat.user1_id._id.toString() !== senderId &&
      chat.user2_id._id.toString() !== senderId
    ) {
      console.error("Unauthorized sender:", senderId);
      socket.emit("message_error", { tempId, error: "Unauthorized" });
      return;
    }

    const message = new Message({
      chat_id: chatId,
      sender_id: senderId,
      content: content || "",
      file_url,
      file_type,
      thumbnail_url,
      seenBy: [senderId],
    });
    await message.save();
    console.log("Message saved:", message._id);

    const populatedMessage = await Message.findById(message._id)
      .populate("sender_id", "name profile_image")
      .lean();

    const messagePayload = {
      ...populatedMessage,
      chat_id: chatId,
      tempId,
      sender_id: {
        _id: populatedMessage.sender_id?._id.toString() || senderId,
        name: populatedMessage.sender_id?.name || "User deleted",
        profile_image: populatedMessage.sender_id?.profile_image || null,
        isDeleted: !populatedMessage.sender_id,
      },
      status: "sent",
    };
    io.to(chatId).emit("receive_message", messagePayload);
    console.log(`Message sent to chat ${chatId}:`, messagePayload);

    const recipientId =
      chat.user1_id._id.toString() === senderId
        ? chat.user2_id._id.toString()
        : chat.user1_id._id.toString();
    const senderName =
      chat.user1_id._id.toString() === senderId
        ? chat.user1_id.name || "User deleted"
        : chat.user2_id.name || "User deleted";

    const notification = new Notification({
      user_id: recipientId,
      type: "new_message",
      message: `New ${file_type || "message"} from ${senderName}`,
      related_id: chatId,
      read: false,
    });
    await notification.save();
    console.log("Notification saved for user:", recipientId);

    const recipientSocket = users.get(recipientId);
    if (recipientSocket) {
      io.to(recipientSocket).emit("receive_notification", notification);
      console.log(`Notification sent to user ${recipientId}`);
    }
  } catch (error) {
    console.error("Error in send_message:", error);
    socket.emit("message_error", {
      tempId,
      error: error.message || "Failed to send message",
    });
  }
});

    socket.on("disconnect", () => {
      for (let [userId, socketId] of users.entries()) {
        if (socketId === socket.id) {
          users.delete(userId);
          console.log(`User ${userId} disconnected`);
          break;
        }
      }
    });

    socket.on("error", (error) => {
      console.error("Socket.IO error:", error.message);
    });
  });

  return io;
};

export default setupSocket;