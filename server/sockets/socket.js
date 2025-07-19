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

    socket.on("register", async (userId) => {
      console.log("Register event received, userId:", userId, "socket.userId:", socket.userId);
      if (userId && userId === socket.userId) {
        users.set(userId.toString(), socket.id);
        console.log(`User ${userId} registered with socket ${socket.id}`);
        // Join all user chats
        try {
          const chats = await Chat.find({
            $or: [{ user1_id: userId }, { user2_id: userId }],
          });
          chats.forEach((chat) => socket.join(chat._id.toString()));
          console.log(`User ${userId} joined chats:`, chats.map((c) => c._id));
        } catch (error) {
          console.error("Error joining chats:", error);
          socket.emit("error", { message: "Error joining chats" });
        }
      } else {
        console.error("Invalid userId:", userId, "Expected:", socket.userId);
        socket.emit("error", { message: "Invalid userId" });
      }
    });

    socket.on("join_chat", async (chatId) => {
      if (!chatId) {
        console.error("Invalid chatId:", chatId);
        socket.emit("error", { message: "Invalid chatId" });
        return;
      }
      socket.join(chatId);
      console.log(`User ${socket.userId} joined chat ${chatId}`);

      try {
        const unreadMessages = await Message.find({
          chat_id: chatId,
          sender_id: { $ne: socket.userId },
          seenBy: { $ne: socket.userId },
        }).select("_id");

        const messageIds = unreadMessages.map((m) => m._id.toString());
        if (messageIds.length > 0) {
          socket.emit("unseen_messages", { chatId, messageIds });
        }
      } catch (error) {
        console.error("Error fetching unread messages:", error);
        socket.emit("error", { message: "Error fetching unread messages" });
      }
    });

    socket.on("send_message", async ({ chatId, senderId, content, file_url, file_type, thumbnail_url, tempId, replyTo }) => {
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
          replyTo,
        });
        await message.save();
        console.log("Message saved:", message._id);

        // Update chat's lastMessage and unreadCount
        const recipientId = chat.user1_id._id.toString() === senderId
          ? chat.user2_id._id.toString()
          : chat.user1_id._id.toString();
        await Chat.findByIdAndUpdate(chatId, {
          lastMessage: content || (file_type ? `[${file_type}]` : "Media"),
          $inc: { unreadCount: recipientId === socket.userId ? 0 : 1 },
        });

        const populatedMessage = await Message.findById(message._id)
          .populate("sender_id", "name profile_image")
          .populate("replyTo")
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
          replyTo: populatedMessage.replyTo
            ? {
                _id: populatedMessage.replyTo._id.toString(),
                content: populatedMessage.replyTo.content,
                sender_id: populatedMessage.replyTo.sender_id,
                file_url: populatedMessage.replyTo.file_url,
                file_type: populatedMessage.replyTo.file_type,
                isDeleted: populatedMessage.replyTo.isDeleted,
              }
            : null,
          status: "sent",
          seenBy: populatedMessage.seenBy.map((id) => id.toString()),
        };
        io.to(chatId).emit("receive_message", messagePayload);
        console.log(`Message sent to chat ${chatId}:`, messagePayload);

        // Update chat list for all participants
        const updatedChat = await Chat.findById(chatId).lean();
        io.to(chatId).emit("chat_updated", {
          chatId,
          lastMessage: updatedChat.lastMessage,
          unreadCount: updatedChat.unreadCount,
        });

        const senderName = chat.user1_id._id.toString() === senderId
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

    socket.on("mark_messages_seen", async ({ chatId, messageIds }) => {
      try {
        if (!chatId || !messageIds || !Array.isArray(messageIds)) {
          console.error("Invalid data for mark_messages_seen:", { chatId, messageIds });
          socket.emit("error", { message: "Invalid data" });
          return;
        }

        const userId = socket.userId;
        console.log(`User ${userId} marking messages as seen in chat ${chatId}`);

        const result = await Message.updateMany(
          {
            _id: { $in: messageIds },
            chat_id: chatId,
            sender_id: { $ne: userId },
            seenBy: { $ne: userId },
          },
          { $addToSet: { seenBy: userId } }
        );

        console.log(`Updated ${result.modifiedCount} messages as seen`);

        // Reset unreadCount for the chat
        await Chat.findByIdAndUpdate(chatId, { unreadCount: 0 });

        // Emit updates to all chat participants
        io.to(chatId).emit("messages_seen", {
          chatId,
          messageIds,
          userId,
        });

        // Update chat list
        const updatedChat = await Chat.findById(chatId).lean();
        io.to(chatId).emit("chat_updated", {
          chatId,
          lastMessage: updatedChat.lastMessage,
          unreadCount: updatedChat.unreadCount,
        });
      } catch (error) {
        console.error("Error in mark_messages_seen:", error);
        socket.emit("error", { message: "Error marking messages as seen" });
      }
    });

    socket.on("message_updated", async ({ messageId, content }) => {
      try {
        const message = await Message.findByIdAndUpdate(
          messageId,
          { content, updatedAt: new Date() },
          { new: true }
        );
        if (!message) {
          socket.emit("error", { message: "Message not found" });
          return;
        }
        io.to(message.chat_id).emit("message_updated", message);
        // Update chat's lastMessage if this is the latest message
        const latestMessage = await Message.findOne({ chat_id: message.chat_id })
          .sort({ createdAt: -1 })
          .lean();
        if (latestMessage._id.toString() === messageId) {
          await Chat.findByIdAndUpdate(message.chat_id, {
            lastMessage: content || (message.file_type ? `[${message.file_type}]` : "Media"),
          });
          const updatedChat = await Chat.findById(message.chat_id).lean();
          io.to(message.chat_id).emit("chat_updated", {
            chatId: message.chat_id,
            lastMessage: updatedChat.lastMessage,
            unreadCount: updatedChat.unreadCount,
          });
        }
      } catch (error) {
        console.error("Error in message_updated:", error);
        socket.emit("error", { message: "Error updating message" });
      }
    });

    socket.on("message_deleted", async ({ messageId }) => {
      try {
        const message = await Message.findByIdAndUpdate(
          messageId,
          { isDeleted: true, updatedAt: new Date() },
          { new: true }
        );
        if (!message) {
          socket.emit("error", { message: "Message not found" });
          return;
        }
        io.to(message.chat_id).emit("message_deleted", message);
        // Update chat's lastMessage if this was the latest message
        const latestMessage = await Message.findOne({ chat_id: message.chat_id, isDeleted: false })
          .sort({ createdAt: -1 })
          .lean();
        await Chat.findByIdAndUpdate(message.chat_id, {
          lastMessage: latestMessage
            ? latestMessage.content || (latestMessage.file_type ? `[${latestMessage.file_type}]` : "Media")
            : "No messages yet",
        });
        const updatedChat = await Chat.findById(message.chat_id).lean();
        io.to(message.chat_id).emit("chat_updated", {
          chatId: message.chat_id,
          lastMessage: updatedChat.lastMessage,
          unreadCount: updatedChat.unreadCount,
        });
      } catch (error) {
        console.error("Error in message_deleted:", error);
        socket.emit("error", { message: "Error deleting message" });
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