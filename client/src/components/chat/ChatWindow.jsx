import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X, Wifi, WifiOff, Paperclip, Mic, Play, Pause, Edit2, Trash2, Reply, Check, CheckCheck, Menu, LogOut, MoreVertical } from "lucide-react";
import { API_BASE_URL } from "../../../api";

const ChatWindow = ({ chatId, otherUser, onClose, socket }) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [playingAudio, setPlayingAudio] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [showMessageActions, setShowMessageActions] = useState(null);
  const messagesEndRef = useRef(null);
  const messageContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);
  const isSendingRef = useRef(false);
  const touchStartX = useRef(null);
  const messageRefs = useRef({});

  const scrollToBottom = (behavior = "smooth") => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: "end" });
    }
  };

  const scrollToMessage = (messageId) => {
    const messageElement = messageRefs.current[messageId];
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
      messageElement.classList.add("bg-yellow-500/20");
      setTimeout(() => {
        messageElement.classList.remove("bg-yellow-500/20");
      }, 2000);
    }
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      setIsSending(true);
      localStorage.removeItem("token");
      localStorage.removeItem("userId");
      navigate("/login");
      setIsMobileMenuOpen(false);
    }
  };

  const handleMessageInteraction = (message, e) => {
    e.preventDefault();
    if (message.isDeleted) return;
    setContextMenu({
      messageId: message._id || message.tempId,
      x: e.clientX || e.touches?.[0]?.clientX || 0,
      y: e.clientY || e.touches?.[0]?.clientY || 0,
    });
  };

  const handleTouchStart = (message, e) => {
    if (message.isDeleted) return;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (message, e) => {
    if (message.isDeleted) return;
    const touchEndX = e.changedTouches[0].clientX;
    if (touchStartX.current && touchEndX - touchStartX.current > 50) {
      setReplyingTo(message);
      setContextMenu(null);
      setShowMessageActions(null);
    }
    touchStartX.current = null;
  };

  useEffect(() => {
    if (!chatId || !socket) return;

    setIsConnected(socket.connected);
    socket.emit("join_chat", chatId);

    const fetchMessages = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/messages`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const data = await response.json();
        if (response.ok) {
          setMessages(data);
          setTimeout(() => scrollToBottom("instant"), 150);
        } else {
          setError(data.message || "Failed to fetch messages");
        }
      } catch (error) {
        setError("Error fetching messages: " + error.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMessages();

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("join_chat", chatId);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("connect_error", (error) => {
      setError("Connection lost. Retrying...");
    });

    socket.on("receive_message", (message) => {
      if (message.chat_id === chatId) {
        setMessages((prev) => {
          if (prev.some((msg) => msg._id === message._id || msg.tempId === message.tempId)) {
            return prev.map((msg) =>
              msg.tempId === message.tempId ? { ...message, status: "sent" } : msg
            );
          }
          return [...prev, { ...message, status: "sent" }];
        });
        setIsSending(false);
        setReplyingTo(null); // Clear reply only when message is successfully received
        scrollToBottom();
      }
    });

    socket.on("message_updated", (updatedMessage) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === updatedMessage._id ? { ...msg, ...updatedMessage } : msg
        )
      );
    });

    socket.on("message_deleted", (deletedMessage) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === deletedMessage._id ? { ...msg, ...deletedMessage } : msg
        )
      );
    });

    socket.on("message_seen", ({ messageId, userId }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId
            ? { ...msg, seenBy: [...new Set([...msg.seenBy, userId])] }
            : msg
        )
      );
    });

    socket.on("message_error", ({ tempId, error }) => {
      setError(error);
      setMessages((prev) => prev.filter((msg) => msg.tempId !== tempId));
      setIsSending(false);
      setReplyingTo(null); // Clear reply on error
    });

    socket.on("error", ({ message }) => {
      setError(message);
      setIsSending(false);
      setReplyingTo(null); // Clear reply on error
    });

    socket.on("typing", ({ userId }) => {
      if (userId !== localStorage.getItem("userId")) {
        setIsTyping(true);
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
      }
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("receive_message");
      socket.off("message_updated");
      socket.off("message_deleted");
      socket.off("message_seen");
      socket.off("message_error");
      socket.off("error");
      socket.off("typing");
      clearTimeout(typingTimeoutRef.current);
    };
  }, [chatId, socket]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, isSending]);

  useEffect(() => {
    if (newMessage.trim() && socket?.connected) {
      socket.emit("typing", { chatId, userId: localStorage.getItem("userId") });
    }
  }, [newMessage, socket, chatId]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const startRecording = async () => {
    if (isRecording || isSendingRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/ogg")
        ? "audio/ogg"
        : null;
      if (!mimeType) {
        throw new Error("No supported audio format found");
      }
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const fileExtension = mimeType.includes("ogg") ? "ogg" : "webm";
        const file = new File([audioBlob], `voice-message-${Date.now()}.${fileExtension}`, {
          type: mimeType,
        });
        await sendMediaMessage(file, "audio");
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
      };

      mediaRecorderRef.current.start(100);
      setIsRecording(true);
    } catch (error) {
      setError("Failed to start recording: " + error.message);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const toggleAudioPlayback = (messageId, fileUrl) => {
    if (playingAudio === messageId) {
      if (audioRef.current) {
        audioRef.current.pause();
        setPlayingAudio(null);
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(fileUrl);
      audioRef.current.onended = () => {
        setPlayingAudio(null);
        audioRef.current = null;
      };
      audioRef.current.play().catch((err) => console.error("Audio playback error:", err));
      setPlayingAudio(messageId);
    }
  };

  const handleEditMessage = async (messageId, content) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/messages/${messageId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to edit message");
      }
      setEditingMessageId(null);
      setEditContent("");
      setContextMenu(null);
      setShowMessageActions(null);
    } catch (error) {
      setError("Error editing message: " + error.message);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/messages/${messageId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to delete message");
      }
      setContextMenu(null);
      setShowMessageActions(null);
    } catch (error) {
      setError("Error deleting message: " + error.message);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSendingRef.current || (!newMessage.trim() && !selectedFile)) return;

    isSendingRef.current = true;
    setIsSending(true);
    const tempId = `${Date.now()}-${Math.random()}`;
    const tempMessage = {
      chat_id: chatId,
      sender_id: { _id: localStorage.getItem("userId") },
      content: newMessage,
      file_url: selectedFile ? URL.createObjectURL(selectedFile) : null,
      file_type: selectedFile
        ? selectedFile.type.startsWith("image")
          ? "image"
          : selectedFile.type.startsWith("video")
          ? "video"
          : "pdf"
        : null,
      tempId,
      createdAt: new Date().toISOString(),
      status: "sending",
      seenBy: [localStorage.getItem("userId")],
      replyTo: replyingTo?._id ? { _id: replyingTo._id, content: replyingTo.content, sender_id: replyingTo.sender_id, file_url: replyingTo.file_url, file_type: replyingTo.file_type } : null,
    };
    setMessages((prev) => [...prev, tempMessage]);
    setNewMessage("");
    setSelectedFile(null);
    setError(null);

    setTimeout(() => scrollToBottom("instant"), 0);

    try {
      if (socket.connected && !selectedFile) {
        socket.emit("send_message", {
          chatId,
          senderId: localStorage.getItem("userId"),
          content: newMessage,
          tempId,
          replyTo: replyingTo?._id || null,
        });
      } else {
        const formData = new FormData();
        formData.append("content", newMessage);
        formData.append("tempId", tempId);
        if (selectedFile) {
          formData.append("file", selectedFile);
        }
        if (replyingTo) {
          formData.append("replyTo", replyingTo._id);
        }

        const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/message`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: formData,
        });
        const data = await response.json();
        if (!response.ok) {
          setError(data.message || "Failed to send message");
          setMessages((prev) => prev.filter((msg) => msg.tempId !== tempId));
          setIsSending(false);
          setReplyingTo(null); // Clear reply only on error
        } else {
          setReplyingTo(null); // Clear reply on successful send
        }
      }
    } catch (error) {
      setError("Error sending message: " + error.message);
      setMessages((prev) => prev.filter((msg) => msg.tempId !== tempId));
      setIsSending(false);
      setReplyingTo(null); // Clear reply on error
    } finally {
      isSendingRef.current = false;
    }
  };

  const sendMediaMessage = async (file, fileType) => {
    if (isSendingRef.current) return;

    isSendingRef.current = true;
    setIsSending(true);
    const tempId = `${Date.now()}-${Math.random()}`;
    const tempMessage = {
      chat_id: chatId,
      sender_id: { _id: localStorage.getItem("userId") },
      content: "",
      file_url: URL.createObjectURL(file),
      file_type: fileType,
      tempId,
      createdAt: new Date().toISOString(),
      status: "sending",
      seenBy: [localStorage.getItem("userId")],
      replyTo: replyingTo?._id ? { _id: replyingTo._id, content: replyingTo.content, sender_id: replyingTo.sender_id, file_url: replyingTo.file_url, file_type: replyingTo.file_type } : null,
    };
    setMessages((prev) => [...prev, tempMessage]);
    setError(null);
    setTimeout(() => scrollToBottom("instant"), 0);

    try {
      const formData = new FormData();
      formData.append("content", "");
      formData.append("tempId", tempId);
      formData.append("file", file);
      if (replyingTo) {
        formData.append("replyTo", replyingTo._id);
      }

      const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/message`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "Failed to send media");
        setMessages((prev) => prev.filter((msg) => msg.tempId !== tempId));
        setIsSending(false);
        setReplyingTo(null); // Clear reply only on error
      } else {
        setReplyingTo(null); // Clear reply on successful send
      }
    } catch (error) {
      setError("Error sending media: " + error.message);
      setMessages((prev) => prev.filter((msg) => msg.tempId !== tempId));
      setIsSending(false);
      setReplyingTo(null); // Clear reply on error
    } finally {
      isSendingRef.current = false;
    }
  };

  const formatTimestamp = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="relative flex flex-col h-full bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl border border-gray-700/20 overflow-hidden">
      <div className="flex items-center justify-between p-4 bg-gray-900/90 border-b border-gray-700/30 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <motion.img
            src={otherUser.profile_image || "https://via.placeholder.com/40?text=User"}
            alt={otherUser.name}
            className="w-12 h-12 rounded-full object-cover border-2 border-indigo-500/50 shadow-lg"
            whileHover={{ scale: 1.1 }}
            transition={{ duration: 0.2 }}
          />
          <div>
            <h3 className="text-lg font-semibold text-white">{otherUser.name}</h3>
          </div>
        </div>
        <motion.button
          onClick={onClose}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="cursor-pointer p-2 rounded-full text-gray-300 hover:text-red-500 hover:bg-gray-700/50 transition duration-300"
        >
          <X size={20} />
        </motion.button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-red-400 text-center p-3 bg-red-900/30 border-b border-red-700/40 text-sm"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div
        ref={messageContainerRef}
        className="flex-1 p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-indigo-500/50 scrollbar-track-gray-800/30"
        style={{ maxHeight: "calc(100vh - 200px)", overscrollBehaviorY: "contain" }}
      >
        {isLoading ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-gray-300 text-center text-sm"
          >
            Loading messages...
          </motion.p>
        ) : messages.length === 0 ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-gray-300 text-center text-sm"
          >
            No messages yet
          </motion.p>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <motion.div
                key={message._id || message.tempId}
                ref={(el) => (messageRefs.current[message._id || message.tempId] = el)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={`flex ${
                  message.sender_id._id === localStorage.getItem("userId")
                    ? "justify-end"
                    : "justify-start"
                } relative group transition-all duration-300`}
                onTouchStart={(e) => handleTouchStart(message, e)}
                onTouchEnd={(e) => handleTouchEnd(message, e)}
                onContextMenu={(e) => handleMessageInteraction(message, e)}
                drag={message.isDeleted ? false : "x"}
                dragConstraints={{ left: -50, right: 0 }}
                dragElastic={0.2}
                onDragEnd={(e, info) => {
                  if (info.offset.x < -50) {
                    setReplyingTo(message);
                    setContextMenu(null);
                    setShowMessageActions(null);
                  }
                }}
                whileDrag={{ scale: 0.98, backgroundColor: "#4b5563" }}
              >
                <div
                  className={`max-w-[75%] sm:max-w-[60%] p-4 rounded-2xl shadow-lg relative ${
                    message.sender_id._id === localStorage.getItem("userId")
                      ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white"
                      : "bg-gray-700/80 text-gray-100"
                  }`}
                >
                  <motion.button
                    className="cursor-pointer hidden sm:block absolute top-2 right-2 p-1 rounded-full bg-gray-800/80 text-gray-300 hover:bg-gray-700 hover:text-white transition"
                    onClick={() => setShowMessageActions(showMessageActions === (message._id || message.tempId) ? null : message._id || message.tempId)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <MoreVertical size={16} />
                  </motion.button>
                  <AnimatePresence>
                    {showMessageActions === (message._id || message.tempId) && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute -top-12 right-0 bg-gray-800/90 rounded-lg p-2 shadow-lg flex flex-col gap-1 z-10 sm:w-32"
                      >
                        <motion.button
                          whileHover={{ backgroundColor: "#4b5563" }}
                          onClick={() => {
                            setReplyingTo(message);
                            setShowMessageActions(null);
                          }}
                          className="cursor-pointer flex items-center gap-2 p-2 text-gray-300 hover:text-white text-sm rounded"
                        >
                          <Reply size={14} /> Reply
                        </motion.button>
                        {message.sender_id._id === localStorage.getItem("userId") && !message.isDeleted && (
                          <>
                            <motion.button
                              whileHover={{ backgroundColor: "#4b5563" }}
                              onClick={() => {
                                setEditingMessageId(message._id || message.tempId);
                                setEditContent(message.content);
                                setShowMessageActions(null);
                              }}
                              className="cursor-pointer flex items-center gap-2 p-2 text-gray-300 hover:text-white text-sm rounded"
                            >
                              <Edit2 size={14} /> Edit
                            </motion.button>
                            <motion.button
                              whileHover={{ backgroundColor: "#4b5563" }}
                              onClick={() => {
                                handleDeleteMessage(message._id);
                                setShowMessageActions(null);
                              }}
                              className="cursor-pointer flex items-center gap-2 p-2 text-gray-300 hover:text-white text-sm rounded"
                            >
                              <Trash2 size={14} /> Delete
                            </motion.button>
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {message.isDeleted ? (
                    <p className="italic text-gray-400 text-sm">This message was deleted</p>
                  ) : (
                    <>
                      {message.replyTo && (
                        <motion.div
                          className="mb-3 p-3 bg-gray-800/90 rounded-lg text-sm border-l-4 border-indigo-500 cursor-pointer hover:bg-gray-800 transition-colors"
                          onClick={() => scrollToMessage(message.replyTo._id)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <p className="text-indigo-300 font-medium">
                            Replying to {message.replyTo.sender_id?.name || "Unknown"}
                          </p>
                          <p className="text-gray-200 truncate">
                            {message.replyTo.isDeleted
                              ? "Deleted message"
                              : message.replyTo.content || `[${message.replyTo.file_type || "Media"}]`}
                          </p>
                        </motion.div>
                      )}
                      {message.file_type === "image" && message.file_url && (
                        <img
                          src={message.file_url}
                          alt="Attachment"
                          className="max-w-full h-auto rounded-lg mb-3 shadow-sm"
                        />
                      )}
                      {message.file_type === "video" && message.file_url && (
                        <video
                          src={message.file_url}
                          controls
                          poster={message.thumbnail_url}
                          className="max-w-full h-auto rounded-lg mb-3 shadow-sm"
                        />
                      )}
                      {message.file_type === "audio" && message.file_url && (
                        <div className="flex items-center gap-3 mb-3">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => toggleAudioPlayback(message._id || message.tempId, message.file_url)}
                            className="cursor-pointer p-2 bg-indigo-500/80 rounded-full text-white hover:bg-indigo-600 transition"
                          >
                            {playingAudio === (message._id || message.tempId) ? (
                              <Pause size={16} />
                            ) : (
                              <Play size={16} />
                            )}
                          </motion.button>
                          <audio
                            src={message.file_url}
                            preload="metadata"
                            className="w-full"
                          >
                            <source src={message.file_url} type="audio/webm" />
                            <source src={message.file_url} type="audio/ogg" />
                            <source src={message.file_url} type="audio/mpeg" />
                          </audio>
                        </div>
                      )}
                      {message.file_type === "pdf" && message.file_url && (
                        <a
                          href={message.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-400 underline mb-3 block text-sm hover:text-indigo-300"
                        >
                          View PDF
                        </a>
                      )}
                      {editingMessageId === (message._id || message.tempId) ? (
                        <div className="flex flex-col gap-2">
                          <input
                            type="text"
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="p-2 rounded-lg bg-gray-800/70 text-white border border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm"
                          />
                          <div className="flex gap-2">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleEditMessage(message._id, editContent)}
                              className="cursor-pointer px-4 py-2 bg-indigo-500 rounded-lg text-white hover:bg-indigo-600 transition"
                            >
                              Save
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setEditingMessageId(null)}
                              className="cursor-pointer px-4 py-2 bg-gray-600 rounded-lg text-white hover:bg-gray-700 transition"
                            >
                              Cancel
                            </motion.button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {message.content && <p className="text-sm">{message.content}</p>}
                          <div className="flex items-center justify-end gap-2 mt-2">
                            <span className="text-xs text-gray-300">{formatTimestamp(message.createdAt)}</span>
                            {message.sender_id._id === localStorage.getItem("userId") && (
                              <div className="flex items-center gap-1">
                                {message.status === "sending" ? (
                                  <span className="text-xs text-gray-300">Sending...</span>
                                ) : message.seenBy.length > 1 ? (
                                  <>
                                    <CheckCheck size={14} className="text-blue-400" />
                                    <span className="text-xs text-blue-400">Seen</span>
                                  </>
                                ) : (
                                  <>
                                    <Check size={14} className="text-gray-300" />
                                    <span className="text-xs text-gray-300">Sent</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            ))}
            <AnimatePresence>
              {isTyping && (
                <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="flex justify-start px-4 py-2"
    >
      <div className="bg-gray-700/80 p-3 rounded-2xl shadow-md">
        <div className="typing-dot flex space-x-1">
          <span className="dot w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:0s]" />
          <span className="dot w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:0.2s]" />
          <span className="dot w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:0.4s]" />
        </div>
      </div>
    </motion.div>
              )}
              {isSending && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex justify-end"
                >
                  <div className="bg-indigo-600/80 p-3 rounded-2xl shadow-md">
                    <span className="text-white text-sm">Sending...</span>
                    {replyingTo && (
                      <motion.div
                        className="mt-2 p-2 bg-gray-800/90 rounded-lg text-xs border-l-4 border-indigo-500 cursor-pointer hover:bg-gray-800 transition-colors"
                        onClick={() => scrollToMessage(replyingTo._id)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <p className="text-indigo-300 font-medium">
                          Replying to {replyingTo.sender_id?.name || "Unknown"}
                        </p>
                        <p className="text-gray-200 truncate">
                          {replyingTo.content || `[${replyingTo.file_type || "Media"}]`}
                        </p>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed bg-gray-800/95 border border-gray-700/50 rounded-lg shadow-xl p-2 z-50 -ml-20"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <div className="flex flex-col gap-2">
              <motion.button
                whileHover={{ backgroundColor: "#4B5563" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  const message = messages.find((msg) => msg._id === contextMenu.messageId || msg.tempId === contextMenu.messageId);
                  if (message) setReplyingTo(message);
                  setContextMenu(null);
                  setShowMessageActions(null);
                }}
                className="cursor-pointer flex items-center gap-2 px-3 py-2 text-white/90 hover:text-indigo-400 transition text-sm"
              >
                <Reply size={16} />
                Reply
              </motion.button>
              {messages.find((msg) => msg._id === contextMenu.messageId || msg.tempId === contextMenu.messageId)?.sender_id._id === localStorage.getItem("userId") && (
                <>
                  <motion.button
                    whileHover={{ backgroundColor: "#4B5563" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      const message = messages.find((msg) => msg._id === contextMenu.messageId || msg.tempId === contextMenu.messageId);
                      if (message) {
                        setEditingMessageId(message._id || message.tempId);
                        setEditContent(message.content);
                      }
                      setContextMenu(null);
                      setShowMessageActions(null);
                    }}
                    className="cursor-pointer flex items-center gap-2 px-3 py-2 text-white/90 hover:text-indigo-400 transition text-sm"
                  >
                    <Edit2 size={16} />
                    Edit
                  </motion.button>
                  <motion.button
                    whileHover={{ backgroundColor: "#4B5563" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      const message = messages.find((msg) => msg._id === contextMenu.messageId || msg.tempId === contextMenu.messageId);
                      if (message) handleDeleteMessage(message._id);
                    }}
                    className="cursor-pointer flex items-center gap-2 px-3 py-2 text-white/90 hover:text-red-400 transition text-sm"
                  >
                    <Trash2 size={16} />
                    Delete
                  </motion.button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSendMessage} className="p-4 bg-gray-900/90 border-t border-gray-700/30" style={{ overscrollBehaviorY: "contain" }}>
        {replyingTo && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-3 p-3 bg-gray-800/90 rounded-lg text-sm border-l-4 border-indigo-500 flex justify-between items-center cursor-pointer"
            onClick={() => scrollToMessage(replyingTo._id)}
          >
            <div>
              <p className="text-indigo-300 font-medium">Replying to {replyingTo.sender_id?.name || "Unknown"}</p>
              <p className="text-gray-200 truncate">{replyingTo.content || `[${replyingTo.file_type || "Media"}]`}</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                setReplyingTo(null);
              }}
              className="cursor-pointer p-1 text-gray-300 hover:text-white"
            >
              <X size={16} />
            </motion.button>
          </motion.div>
        )}
        <div className="flex items-center gap-1 overflow-scroll md:overflow-hidden">
          <input
            type="file"
            accept="image/jpeg,image/png,video/mp4,video/webm"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="p-3 rounded-lg bg-gray-800/70 text-gray-300 border border-gray-600/50 hover:bg-gray-700/70 hover:text-white transition cursor-pointer"
          >
            <Paperclip size={20} />
          </label>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 p-3 rounded-lg bg-gray-800/70 text-white border border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm"
            disabled={isRecording}
          />
          <motion.button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`cursor-pointer p-3 rounded-lg text-white transition ${
              isRecording
                ? "bg-red-600 hover:bg-red-700"
                : "bg-gray-800/70 hover:bg-gray-700/70"
            }`}
          >
            <Mic size={20} />
          </motion.button>
          <motion.button
            type="submit"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="cursor-pointer p-3 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-lg text-white hover:from-indigo-600 hover:to-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={(!newMessage.trim() && !selectedFile) || isLoading || isRecording}
          >
            <Send size={20} />
          </motion.button>
        </div>
        {selectedFile && (
          <div className="mt-3 text-sm text-gray-300">
            Selected: {selectedFile.name}
            <button
              onClick={() => setSelectedFile(null)}
              className="cursor-pointer ml-2 text-red-400 hover:text-red-500"
            >
              Remove
            </button>
          </div>
        )}
      </form>

      <div className="flex items-center justify-center p-2 bg-gray-900/90">
        {isConnected ? (
          <div className="flex items-center gap-2 text-green-400">
            <Wifi size={14} />
            <span className="text-xs">Connected</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-red-400">
            <WifiOff size={14} />
            <span className="text-xs">Disconnected, retrying...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatWindow;