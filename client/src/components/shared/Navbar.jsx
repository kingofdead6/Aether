import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Bell, X, Menu } from "lucide-react";
import { useState, useEffect } from "react";
import { useSocket } from "../../context/SocketContext";
import { API_BASE_URL } from "../../../api";

const links = [
  { to: "/dashboard/posts", label: "Posts" },
  { to: "/dashboard/people", label: "People" },
  { to: "/dashboard/chats", label: "Chats" },
  { to: "/dashboard/profile", label: "Profile" },
];

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { socket, connectionError } = useSocket();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch notifications on mount
  useEffect(() => {
    const fetchNotifications = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_BASE_URL}/api/notifications`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        const data = await response.json();
        if (response.ok) {
          setNotifications(data);
        } else {
          setError(data.message || "Failed to fetch notifications");
        }
      } catch (error) {
        setError("Error fetching notifications: " + error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  // Listen for real-time notifications
  useEffect(() => {
    if (socket) {
      socket.on("receive_notification", (notification) => {
        console.log("Received notification:", notification);
        setNotifications((prev) => [notification, ...prev]);
      });

      return () => {
        socket.off("receive_notification");
      };
    }
  }, [socket]);

  // Mark notification as read and navigate based on type
  const handleMarkAsRead = async (notificationId, notificationType, relatedId) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/notifications/${notificationId}/read`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      if (response.ok) {
        setNotifications((prev) =>
          prev.map((notif) =>
            notif._id === notificationId ? { ...notif, read: true } : notif
          )
        );
        if (notificationType === "follow") {
          navigate(`/dashboard/profile?userId=${relatedId}`);
          setIsDropdownOpen(false);
          setIsMobileMenuOpen(false);
        } else if (notificationType === "new_message") {
          navigate(`/dashboard/chats/${relatedId}`);
          setIsDropdownOpen(false);
          setIsMobileMenuOpen(false);
        }
      } else {
        const data = await response.json();
        setError(data.message || "Failed to mark notification as read");
      }
    } catch (error) {
      setError("Error marking notification as read: " + error.message);
    }
  };

  // Delete notification
  const handleDeleteNotification = async (notificationId) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/notifications/${notificationId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      if (response.ok) {
        setNotifications((prev) =>
          prev.filter((notif) => notif._id !== notificationId)
        );
      } else {
        const data = await response.json();
        setError(data.message || "Failed to delete notification");
      }
    } catch (error) {
      setError("Error deleting notification: " + error.message);
    }
  };

  // Mark all notifications as read
  const handleMarkAllRead = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/mark-read`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (response.ok) {
        setNotifications((prev) =>
          prev.map((notif) => ({ ...notif, read: true }))
        );
      } else {
        const data = await response.json();
        setError(data.message || "Failed to mark all notifications as read");
      }
    } catch (error) {
      setError("Error marking all notifications as read: " + error.message);
    }
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      setIsLoggingOut(true);
      localStorage.removeItem("token");
      localStorage.removeItem("userId");
      navigate("/login");
      setIsMobileMenuOpen(false); // Close mobile menu on logout
    }
  };

  const unreadCount = notifications.filter((notif) => !notif.read).length;

  return (
    <motion.nav
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="bg-gradient-to-r from-[#1a002f] to-[#2a004f] p-4 shadow-lg fixed top-0 left-0 right-0 z-50"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Hamburger Menu for Mobile */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="lg:hidden text-white/90 hover:text-pink-300 transition duration-300"
        >
          <Menu size={24} />
        </motion.button>

        {/* Navigation Links - Hidden on Mobile */}
        <div className="hidden lg:flex items-center gap-6">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`relative text-lg font-medium text-white/90 hover:text-pink-300 transition-all duration-300 ${
                location.pathname === link.to ? "text-pink-400" : ""
              }`}
            >
              {link.label}
              {location.pathname === link.to && (
                <motion.div
                  className="absolute -bottom-1 left-0 right-0 h-0.5 bg-pink-400"
                  layoutId="underline"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.3 }}
                />
              )}
            </Link>
          ))}
        </div>

        {/* Right Side: Notifications and Logout */}
        <div className="flex items-center gap-4">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative cursor-pointer"
            onClick={() => {
              setIsDropdownOpen(!isDropdownOpen);
              setError("");
              setIsMobileMenuOpen(false);
            }}
          >
            <Bell
              size={20}
              className="text-white/90 hover:text-pink-300 transition duration-300"
            />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </motion.div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="hidden lg:flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white px-5 py-2 rounded-xl transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-pink-500/30 text-base"
          >
            <LogOut size={16} />
            {isLoggingOut ? "Logging out..." : "Logout"}
          </motion.button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.3 }}
            className="lg:hidden fixed top-0 left-0 w-3/4 max-w-[280px] bg-gradient-to-b from-[#1a002f] to-[#2a004f] h-full shadow-lg z-50 p-4"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-white font-semibold text-lg">Menu</h3>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-white/90 hover:text-pink-300 transition duration-300"
              >
                <X size={24} />
              </motion.button>
            </div>
            <div className="flex flex-col gap-4">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`relative text-base font-medium text-white/90 hover:text-pink-300 transition-all duration-300 ${
                    location.pathname === link.to ? "text-pink-400" : ""
                  }`}
                >
                  {link.label}
                  {location.pathname === link.to && (
                    <motion.div
                      className="absolute -bottom-1 left-0 right-0 h-0.5 bg-pink-400"
                      layoutId="mobile-underline"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.3 }}
                    />
                  )}
                </Link>
              ))}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-xl transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-pink-500/30 text-base mt-4"
              >
                <LogOut size={16} />
                {isLoggingOut ? "Logging out..." : "Logout"}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notification Dropdown */}
      <AnimatePresence>
        {isDropdownOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed top-16 right-0 w-full max-w-[90%] sm:max-w-[360px] mx-auto bg-white/10 backdrop-blur-xl rounded-lg shadow-xl border border-white/20 z-50 max-h-[70vh] overflow-y-auto"
          >
            <div className="p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-white font-semibold text-base">Notifications</h3>
                {notifications.length > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-pink-300 text-sm hover:text-pink-400"
                  >
                    Mark all as read
                  </button>
                )}
              </div>
              {error && (
                <p className="text-red-500 mb-3 text-center text-sm">{error}</p>
              )}
              {connectionError && (
                <p className="text-red-500 mb-3 text-center text-sm">{connectionError}</p>
              )}
              {isLoading ? (
                <p className="text-white/70 text-center text-sm">Loading...</p>
              ) : notifications.length === 0 ? (
                <p className="text-white/70 text-center text-sm">No notifications</p>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif._id}
                    className={`p-3 mb-2 rounded-md ${
                      notif.read ? "bg-white/5" : "bg-pink-600/20"
                    } flex justify-between items-start gap-2`}
                  >
                    <div className="flex-1">
                      <p className="text-white text-sm">{notif.message}</p>
                      <p className="text-white/50 text-xs">
                        {new Date(notif.createdAt).toLocaleString()}
                      </p>
                      <button
                        onClick={() => handleMarkAsRead(notif._id)}
                        className="text-pink-300 text-xs hover:text-pink-400 mt-1"
                      >
                        Mark as read
                      </button>
                    </div>
                    <button
                      onClick={() => handleDeleteNotification(notif._id)}
                      className="text-white/70 hover:text-red-400"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;