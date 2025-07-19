import { useState, useEffect, useRef } from "react";
import DashboardLayout from "./DashboardLayout";
import { motion, AnimatePresence } from "framer-motion";
import { io } from "socket.io-client";
import ChatWindow from "./ChatWindow";
import { API_BASE_URL } from "../../../api";
import { useMediaQuery } from "react-responsive";

const Chats = () => {
  const [chats, setChats] = useState([]);
  const [socket, setSocket] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [socketError, setSocketError] = useState(null);
  const chatListRef = useRef(null);
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });

  // Generates dynamic background color for avatars based on name
  const getAvatarColor = (name) => {
    const colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-purple-500",
      "bg-teal-500",
      "bg-indigo-500",
      "bg-pink-500",
      "bg-orange-500",
    ];
    const index = name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  // Socket.IO setup
  useEffect(() => {
    const newSocket = io(API_BASE_URL, {
      auth: { token: localStorage.getItem("token") },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Socket.IO connected:", newSocket.id);
      const userId = localStorage.getItem("userId");
      if (userId) {
        newSocket.emit("register", userId);
      } else {
        console.error("No userId found in localStorage");
        setSocketError("Please log in again");
      }
      setSocketError(null);
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket.IO connection error:", error.message);
      setSocketError(error.message);
    });

    newSocket.on("error", (error) => {
      console.error("Socket.IO error:", error.message);
      setSocketError(error.message);
    });

    newSocket.on("chat_created", ({ chatId, user }) => {
      setChats((prevChats) => {
        if (prevChats.some((chat) => chat._id === chatId)) {
          return prevChats;
        }
        const newChat = {
          _id: chatId,
          user1_id: { _id: localStorage.getItem("userId") },
          user2_id: { _id: user._id, name: user.name, profile_image: user.profile_image },
          lastMessage: "No messages yet",
          unreadCount: 0,
        };
        return [...prevChats, newChat];
      });
    });

    newSocket.on("receive_message", (message) => {
      setChats((prevChats) =>
        prevChats.map((chat) =>
          chat._id === message.chat_id
            ? {
                ...chat,
                lastMessage: message.content || (message.file_type ? `[${message.file_type}]` : "Media"),
                unreadCount:
                  message.sender_id._id !== localStorage.getItem("userId")
                    ? chat.unreadCount + 1
                    : chat.unreadCount,
              }
            : chat
        )
      );
    });

    newSocket.on("messages_seen", ({ chatId, userId }) => {
      if (userId !== localStorage.getItem("userId")) {
        setChats((prevChats) =>
          prevChats.map((chat) =>
            chat._id === chatId ? { ...chat, unreadCount: 0 } : chat
          )
        );
      }
    });

    newSocket.on("chat_updated", ({ chatId, lastMessage, unreadCount }) => {
      setChats((prevChats) =>
        prevChats.map((chat) =>
          chat._id === chatId ? { ...chat, lastMessage, unreadCount } : chat
        )
      );
    });

    return () => {
      console.log("Disconnecting Socket.IO");
      newSocket.disconnect();
    };
  }, []);

  // Fetch chats
   useEffect(() => {
    const fetchChats = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/chats`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

        const data = await response.json();

        if (response.ok) {
          setChats(data); // You MUST return lastMessage and unreadCount from your backend!
        } else {
          console.error("Failed to fetch chats:", data.message);
        }
      } catch (error) {
        console.error("Fetch error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChats();
  }, []);

  // Handle chat selection
  const handleSelectChat = (chat) => {
    setSelectedChat(chat);
  };

  // Handle closing chat window
  const handleCloseChat = () => {
    setSelectedChat(null);
  };

  // Scroll to bottom of chat list
  useEffect(() => {
    if (chatListRef.current) {
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
    }
  }, [chats]);

  // Render mobile view
  if (isMobile) {
    return (
      <DashboardLayout>
        <div className="bg-indigo-500/10 backdrop-blur-3xl p-4 min-h-[calc(100vh-100px)] rounded-2xl">
          {socketError ? (
            <div className="flex items-center justify-center h-full bg-red-50 rounded-2xl p-4 shadow-md">
              <p className="text-red-600 font-semibold">{socketError}</p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-full text-white">
              <p className="text-lg font-medium opacity-80">Loading...</p>
            </div>
          ) : chats.length === 0 ? (
            <div className="flex items-center justify-center h-full text-white">
              <p className="text-lg font-medium opacity-80">No chats available</p>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="flex flex-wrap gap-4"
            >
              {chats.map((chat) => {
                const otherUser =
                  chat.user1_id._id === localStorage.getItem("userId")
                    ? chat.user2_id
                    : chat.user1_id;
                return (
                  <motion.div
                    key={chat._id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleSelectChat(chat)}
                    className={`flex flex-col items-center relative cursor-pointer ${
                      selectedChat?._id === chat._id ? " scale-105" : ""
                    }`}
                  >
                    <div
                      className={`mt-2 w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200 shadow-md transition-transform duration-200`}
                    >
                      {otherUser.profile_image ? (
                        <img
                          src={otherUser.profile_image}
                          alt={otherUser.name}
                          className="w-full h-full rounded-full object-cover"
                          onError={(e) =>
                            (e.target.src = "https://via.placeholder.com/72?text=No+Image")
                          }
                        />
                      ) : (
                        <span
                          className={`text-2xl font-bold text-white ${getAvatarColor(
                            otherUser.name
                          )} rounded-full w-full h-full flex items-center justify-center`}
                        >
                          {otherUser.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      {chat.unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-[#e63946] text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-sm mt-2 text-center font-semibold text-white">
                      {otherUser.name.split(" ")[0]}
                    </p>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
          <AnimatePresence>
            {selectedChat && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3 }}
                className="fixed inset-0 bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 z-50"
              >
                <ChatWindow
                  chatId={selectedChat._id}
                  otherUser={
                    selectedChat.user1_id._id === localStorage.getItem("userId")
                      ? selectedChat.user2_id
                      : selectedChat.user1_id
                  }
                  onClose={handleCloseChat}
                  socket={socket}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    );
  }

  // Render desktop view
  return (
    <DashboardLayout>
      <div className="min-h-[calc(100vh-100px)] flex flex-col md:flex-row gap-4 p-4">
        {/* Chat List */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          ref={chatListRef}
          className="w-full md:w-1/3 lg:w-1/4 bg-gray-800/50 backdrop-blur-md rounded-3xl shadow-xl p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 max-h-[calc(100vh-120px)] md:max-h-[calc(100vh-150px)]"
        >
          <h2 className="text-3xl font-bold text-[#1a73e8] mb-8 tracking-tight sticky top-0 bg-gradient-to-r z-10">
            Your Chats
          </h2>
          {socketError ? (
            <div className="flex items-center justify-center h-full bg-red-50 rounded-2xl p-6 shadow-md">
              <p className="text-red-600 font-semibold text-lg">{socketError}</p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p className="text-xl font-medium opacity-80">Loading...</p>
            </div>
          ) : chats.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p className="text-xl font-medium opacity-80">No chats available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {chats.map((chat) => {
                const otherUser =
                  chat.user1_id._id === localStorage.getItem("userId")
                    ? chat.user2_id
                    : chat.user1_id;
                return (
                  <motion.div
                    key={chat._id}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelectChat(chat)}
                    className={`flex items-center p-4 rounded-2xl cursor-pointer transition-all duration-300 bg-gray-600/50 shadow-sm hover:shadow-md text-white ${
                      selectedChat?._id === chat._id
                        ? " border-[#1a73e8]"
                        : ""
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden mr-4">
                      {otherUser.profile_image ? (
                        <img
                          src={otherUser.profile_image}
                          alt={otherUser.name}
                          className="w-full h-full object-cover"
                          onError={(e) =>
                            (e.target.src = "https://via.placeholder.com/48?text=No+Image")
                          }
                        />
                      ) : (
                        <span
                          className={`text-xl font-bold text-white ${getAvatarColor(
                            otherUser.name
                          )} rounded-full w-full h-full flex items-center justify-center`}
                        >
                          {otherUser.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-white truncate">
                        {otherUser.name}
                      </p>
                      <p className="text-sm text-gray-200 truncate font-medium">
                        {chat.lastMessage}
                      </p>
                    </div>
                    {chat.unreadCount > 0 && (
                      <span className="bg-[#e63946] text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-md animate-pulse">
                        {chat.unreadCount}
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Chat Window */}
        <AnimatePresence>
          {selectedChat ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
              className="w-full md:w-2/3 lg:w-3/4 bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 h-[calc(100vh-120px)] md:h-[calc(100vh-150px)]"
            >
              <ChatWindow
                chatId={selectedChat._id}
                otherUser={
                  selectedChat.user1_id._id === localStorage.getItem("userId")
                    ? selectedChat.user2_id
                    : selectedChat.user1_id
                }
                onClose={handleCloseChat}
                socket={socket}
              />
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="hidden md:flex w-2/3 lg:w-3/4 h-[calc(100vh-150px)] items-center justify-center bg-gray-800/50 rounded-xl border border-gray-700/50 text-white/70"
            >
              Select a chat to start messaging
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
};

export default Chats;