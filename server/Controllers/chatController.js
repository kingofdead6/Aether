import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { PassThrough } from "stream";
import Chat from "../Models/chatModel.js";
import Message from "../Models/messageModel.js";
import Notification from "../Models/notificationModel.js";

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "application/pdf",
      "video/mp4",
      "video/webm",
      "audio/mp3",
      "audio/wav",
      "audio/ogg",
      "audio/webm",
    ];
    if (allowedTypes.includes(file.mimetype) || file.mimetype.startsWith("audio/webm")) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, PDF, MP4, WebM, MP3, WAV, OGG, and WebM audio files are allowed"), false);
    }
  },
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

export const sendMessage = [
  upload.single("file"),
  async (req, res) => {
    const { chatId } = req.params;
    const { content, tempId } = req.body;
    let replyTo = null;

    // 1. Parse replyTo data
    try {
      if (req.body.replyTo) {
        replyTo = typeof req.body.replyTo === 'string' ? 
          JSON.parse(req.body.replyTo) : 
          req.body.replyTo;
        
        // Validate replyTo object
        if (!replyTo._id) {
          return res.status(400).json({ message: "Invalid reply format" });
        }

        // Verify replied message exists
        const repliedMessage = await Message.findById(replyTo._id);
        if (!repliedMessage) {
          return res.status(400).json({ message: "Replied message not found" });
        }
      }
    } catch (e) {
      console.error("Error parsing replyTo:", e);
      return res.status(400).json({ message: "Invalid reply data" });
    }

    try {
      // 2. Validate chat and permissions
      const chat = await Chat.findById(chatId)
        .populate("user1_id", "name profile_image")
        .populate("user2_id", "name profile_image");

      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }

      const senderId = req.user._id.toString();
      if (
        chat.user1_id?._id.toString() !== senderId &&
        chat.user2_id?._id.toString() !== senderId
      ) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // 3. Handle file upload if exists
      let file_url = null;
      let file_type = null;
      let public_id = null;
      let thumbnail_url = null;

      if (req.file) {
        const isWebmAudio = req.file.mimetype === "audio/webm";
        const isVideo = req.file.mimetype.startsWith("video");
        const isAudio = req.file.mimetype.startsWith("audio");

        const resource_type = isVideo || isWebmAudio
          ? "video"
          : isAudio
          ? "raw"
          : "image";

        const result = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              resource_type,
              folder: "chat_files",
              format: isWebmAudio ? "webm" : undefined,
            },
            (error, result) => error ? reject(error) : resolve(result)
          );

          const bufferStream = new PassThrough();
          bufferStream.end(req.file.buffer);
          bufferStream.pipe(uploadStream);
        });

        file_url = result.secure_url;
        public_id = result.public_id;
        file_type = req.file.mimetype.startsWith("image")
          ? "image"
          : isVideo || isWebmAudio
          ? "video"
          : isAudio
          ? "audio"
          : "pdf";

        if (isVideo) {
          thumbnail_url = cloudinary.url(result.public_id, {
            resource_type: "video",
            transformation: [
              { width: 200, height: 200, crop: "fill" },
              { format: "jpg" },
            ],
          });
        }
      }

      // 4. Create and save message
      const message = new Message({
        chat_id: chatId,
        sender_id: senderId,
        content: content ? content.trim() : "",
        file_url,
        file_type,
        public_id,
        thumbnail_url,
        seenBy: [senderId],
        replyTo: replyTo?._id || null,
      });

      await message.save();

      // 5. Populate all necessary fields for response
      const populatedMessage = await Message.findById(message._id)
        .populate("sender_id", "name profile_image")
        .populate({
          path: "replyTo",
          select: "content sender_id file_url file_type isDeleted",
          populate: {
            path: "sender_id",
            select: "name profile_image"
          }
        });

      // 6. Prepare complete response
      const messagePayload = {
        ...populatedMessage.toObject(),
        chat_id: chatId,
        tempId,
        sender_id: {
          _id: populatedMessage.sender_id?._id.toString() || senderId,
          name: populatedMessage.sender_id?.name || "User deleted",
          profile_image: populatedMessage.sender_id?.profile_image || null,
        },
        replyTo: populatedMessage.replyTo
          ? {
              _id: populatedMessage.replyTo._id,
              content: populatedMessage.replyTo.content,
              sender_id: {
                _id: populatedMessage.replyTo.sender_id?._id.toString(),
                name: populatedMessage.replyTo.sender_id?.name || "User deleted",
                profile_image: populatedMessage.replyTo.sender_id?.profile_image || null,
              },
              file_url: populatedMessage.replyTo.file_url,
              file_type: populatedMessage.replyTo.file_type,
              isDeleted: populatedMessage.replyTo.isDeleted || false,
            }
          : null,
      };

      // 7. Emit to socket
      const io = req.app.get("io");
      io.to(chatId).emit("receive_message", messagePayload);

      // 8. Create notification
      const recipientId = chat.user1_id._id.toString() === senderId
        ? chat.user2_id._id.toString()
        : chat.user1_id._id.toString();

      const notification = new Notification({
        user_id: recipientId,
        type: "new_message",
        message: `New ${file_type || "message"} from ${req.user.name}`,
        related_id: chatId,
        read: false,
      });

      await notification.save();

      // 9. Send response
      res.status(200).json({
        status: "success",
        data: messagePayload,
      });

    } catch (error) {
      console.error("Error in sendMessage:", error);
      res.status(500).json({ 
        message: "Server error", 
        error: error.message 
      });
    }
  }
];










































































export const createChat = async (req, res) => {
  const { user1_id, user2_id } = req.body;
  try {
    if (!user1_id || !user2_id) {
      return res.status(400).json({ message: "Both user IDs are required" });
    }

    const existingChat = await Chat.findOne({
      $or: [
        { user1_id, user2_id },
        { user1_id: user2_id, user2_id: user1_id },
      ],
    });
    if (existingChat) {
      return res.status(200).json({ message: "Chat already exists", chat: existingChat });
    }

    const chat = new Chat({
      user1_id,
      user2_id,
      deletedBy: [],
    });
    await chat.save();

    res.status(201).json({ message: "Chat created successfully", chat });
  } catch (error) {
    console.error("Error in createChat:", error);
    res.status(500).json({ message: "Server error" });
  }
};


export const getUserChats = async (req, res) => {
  try {
    const userId = req.user._id;

    const chats = await Chat.find({
      $or: [{ user1_id: userId }, { user2_id: userId }],
      deletedBy: { $ne: userId },
    })
      .populate("user1_id", "name profile_image")
      .populate("user2_id", "name profile_image")
      .lean();

    const chatsWithDetails = await Promise.all(
      chats.map(async (chat) => {
        const lastMessage = await Message.findOne({ chat_id: chat._id })
          .sort({ createdAt: -1 })
          .select("content file_url file_type createdAt")
          .lean();

        const unreadCount = await Message.countDocuments({
          chat_id: chat._id,
          sender_id: { $ne: userId },
          read: false,
        });

        return {
          ...chat,
          lastMessage: lastMessage
            ? lastMessage.file_url
              ? `[${lastMessage.file_type === "pdf" ? "PDF" : "Image"}] ${lastMessage.content || ""}`
              : lastMessage.content || "No messages yet"
            : "No messages yet",
          lastMessageTime: lastMessage ? lastMessage.createdAt : null,
          unreadCount,
        };
      })
    );

    res.status(200).json(chatsWithDetails);
  } catch (error) {
    console.error("Error in getUserChats:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getChatMessages = async (req, res) => {
  const { chatId } = req.params;
  try {
    const chat = await Chat.findById(chatId)
      .populate("user1_id", "name profile_image")
      .populate("user2_id", "name profile_image");
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }
    if (
      chat.user1_id?._id.toString() !== req.user._id.toString() &&
      chat.user2_id?._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const messages = await Message.find({ chat_id: chatId })
      .populate({
        path: "sender_id",
        select: "name profile_image",
      })
      .sort({ createdAt: 1 })
      .lean();

    await Message.updateMany(
      { chat_id: chatId, sender_id: { $ne: req.user._id }, read: false },
      { read: true }
    );

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error in getChatMessages:", error);
    res.status(500).json({ message: "Server error" });
  }
};


export const editMessage = async (req, res) => {
  const { chatId, messageId } = req.params;
  const { content } = req.body;
  const userId = req.user._id.toString();

  try {
    const chat = await Chat.findById(chatId)
      .populate("user1_id", "name")
      .populate("user2_id", "name");
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }
    if (
      chat.user1_id?._id.toString() !== userId &&
      chat.user2_id?._id.toString() !== userId
    ) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }
    if (message.sender_id.toString() !== userId) {
      return res.status(403).json({ message: "You can only edit your own messages" });
    }
    if (message.file_url) {
      return res.status(400).json({ message: "Cannot edit messages with files" });
    }

    message.content = content;
    message.isEdited = true;
    message.updatedAt = new Date();
    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate("sender_id", "name profile_image")
      .populate({
        path: "replyTo",
        select: "content sender_id file_url file_type isDeleted",
        populate: {
          path: "sender_id",
          select: "name profile_image",
        },
      });

    const modifiedMessage = {
      ...populatedMessage.toObject(),
      sender_id: {
        _id: populatedMessage.sender_id?._id.toString() || userId,
        name: populatedMessage.sender_id?.name || "User deleted",
        profile_image: populatedMessage.sender_id?.profile_image || null,
        isDeleted: !populatedMessage.sender_id,
      },
      replyTo: populatedMessage.replyTo
        ? {
            ...populatedMessage.replyTo,
            sender_id: {
              _id: populatedMessage.replyTo.sender_id?._id.toString(),
              name: populatedMessage.replyTo.sender_id?.name || "User deleted",
              isDeleted: !populatedMessage.replyTo.sender_id,
            },
            isDeleted: populatedMessage.replyTo.isDeleted || false,
          }
        : null,
    };

    const io = req.app.get("io");
    io.to(chatId).emit("message_updated", modifiedMessage);

    res.status(200).json({ message: "Message updated successfully", message: modifiedMessage });
  } catch (error) {
    console.error("Error in editMessage:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const deleteMessage = async (req, res) => {
  const { chatId, messageId } = req.params;
  const userId = req.user._id.toString();

  try {
    const chat = await Chat.findById(chatId)
      .populate("user1_id", "name")
      .populate("user2_id", "name");
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }
    if (
      chat.user1_id?._id.toString() !== userId &&
      chat.user2_id?._id.toString() !== userId
    ) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }
    if (message.sender_id.toString() !== userId) {
      return res.status(403).json({ message: "You can only delete your own messages" });
    }

    if (message.public_id) {
      try {
        await cloudinary.uploader.destroy(message.public_id, {
          resource_type: message.file_type === "pdf" ? "raw" : "image",
        });
      } catch (error) {
        console.error("Error deleting file:", error);
        return res.status(500).json({ message: "Error deleting file", error: error.message });
      }
    }

    message.content = "This message was deleted";
    message.isDeleted = true;
    message.file_url = null;
    message.thumbnail_url = null;
    message.file_type = null;
    message.public_id = null;
    await message.save();

    const populatedDeletedMessage = await Message.findById(message._id)
      .populate("sender_id", "name profile_image")
      .populate({
        path: "replyTo",
        select: "content sender_id file_url file_type isDeleted",
        populate: {
          path: "sender_id",
          select: "name profile_image",
        },
      });

    const modifiedDeletedMessage = {
      ...populatedDeletedMessage.toObject(),
      sender_id: {
        _id: populatedDeletedMessage.sender_id?._id.toString() || userId,
        name: populatedDeletedMessage.sender_id?.name || "User deleted",
        profile_image: populatedDeletedMessage.sender_id?.profile_image || null,

        isDeleted: !populatedDeletedMessage.sender_id,
      },
      replyTo: populatedDeletedMessage.replyTo
        ? {
            ...populatedDeletedMessage.replyTo,
            sender_id: {
              _id: populatedDeletedMessage.replyTo.sender_id?._id.toString(),
              name: populatedDeletedMessage.replyTo.sender_id?.name || "User deleted",
              isDeleted: !populatedDeletedMessage.replyTo.sender_id,
            },
            isDeleted: populatedDeletedMessage.replyTo.isDeleted || false,
          }
        : null,
    };

    const io = req.app.get("io");
    io.to(chatId).emit("message_deleted", modifiedDeletedMessage);

    res.status(200).json({ message: "Message deleted successfully" });
  } catch (error) {
    console.error("Error in deleteMessage:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const markMessageSeen = async (req, res) => {
  const { chatId } = req.params;
  const { messageIds } = req.body;
  const userId = req.user._id;

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }
    if (
      chat.user1_id.toString() !== userId.toString() &&
      chat.user2_id.toString() !== userId.toString()
    ) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await Message.updateMany(
      { _id: { $in: messageIds }, chat_id: chatId },
      { $addToSet: { seenBy: userId } }
    );

    const io = req.app.get("io");
    messageIds.forEach((messageId) => {
      io.to(chatId).emit("message_seen", { messageId, userId });
    });

    res.status(200).json({ message: "Messages marked as seen" });
  } catch (error) {
    console.error("Error in markMessageSeen:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const downloadFile = async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user._id;

  try {
    const message = await Message.findById(messageId).populate("chat_id");
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }
    const chat = message.chat_id;
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }
    if (
      chat.user1_id.toString() !== userId.toString() &&
      chat.user2_id.toString() !== userId.toString()
    ) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (!message.file_url || message.file_type !== "pdf") {
      return res.status(400).json({ message: "No PDF file associated with this message" });
    }
    if (!message.public_id) {
      return res.status(400).json({ message: "No public ID associated with this message" });
    }

    const pdfUrl = cloudinary.url(message.public_id, {
      resource_type: "raw",
      sign_url: true,
      attachment: true,
      flags: "attachment",
    });

    const fileResponse = await fetch(pdfUrl, {
      method: "GET",
      headers: { Accept: "application/pdf" },
    });

    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch file from Cloudinary: ${fileResponse.statusText}`);
    }

    const contentType = fileResponse.headers.get("content-type");
    if (!contentType || !contentType.includes("application/pdf")) {
      throw new Error("Received file is not a PDF");
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="document-${messageId}.pdf"`);

    const stream = new PassThrough();
    fileResponse.body.pipe(stream);
    stream.pipe(res);
  } catch (error) {
    console.error("Error in downloadFile:", error);
    res.status(500).json({ message: "Failed to download file", error: error.message });
  }
};

export const deleteChat = async (req, res) => {
  const { chatId } = req.params;
  const userId = req.user._id.toString();

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }
    if (
      chat.user1_id.toString() !== userId &&
      chat.user2_id.toString() !== userId
    ) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    chat.deletedBy = [...new Set([...chat.deletedBy, userId])];
    await chat.save();

    const io = req.app.get("io");
    const users = req.app.get("users");
    const userSocket = users.get(userId);
    if (userSocket) {
      io.to(userSocket).emit("chat_deleted", { chatId });
    }

    res.status(200).json({ message: "Chat deleted successfully" });
  } catch (error) {
    console.error("Error in deleteChat:", error);
    res.status(500).json({ message: "Server error" });
  }
};