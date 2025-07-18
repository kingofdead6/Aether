import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom"; // Added Link and useNavigate
import DashboardLayout from "./DashboardLayout";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Edit, X, Users, Menu, LogOut } from "lucide-react"; // Added Menu, LogOut
import Post from "./Post";
import FollowManager from "./FollowManager";
import { API_BASE_URL } from "../../../api";

const links = [
  { to: "/dashboard/posts", label: "Posts" },
  { to: "/dashboard/people", label: "People" },
  { to: "/dashboard/chats", label: "Chats" },
  { to: "/dashboard/profile", label: "Profile" },
];

const Profile = () => {
  const navigate = useNavigate(); // Added for logout navigation
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [likedPosts, setLikedPosts] = useState([]);
  const [commentedPosts, setCommentedPosts] = useState([]);
  const [postCount, setPostCount] = useState(0);
  const [bio, setBio] = useState("");
  const [profileImage, setProfileImage] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [showFollowManager, setShowFollowManager] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // New state for mobile menu
  const [tab, setTab] = useState("your");
  const currentUserId = localStorage.getItem("userId");

  const fetchProfileAndPosts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setUser({
          ...data.user,
          profile_image: data.user.profile_image
            ? `${data.user.profile_image}?t=${Date.now()}`
            : null,
        });
        setBio(data.user.bio || "");
        const profileResponse = await fetch(`${API_BASE_URL}/api/auth/${data.user._id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        const profileData = await profileResponse.json();
        if (profileResponse.ok) {
          const normalizedPosts = profileData.posts.map((post) => ({
            ...post,
            image_urls: post.image_urls || (post.image_url ? [post.image_url] : []),
          }));
          setPosts(normalizedPosts || []);
          setPostCount(profileData.postCount || 0);
        } else {
          setError(profileData.message || "Failed to fetch posts");
        }
        const likedResponse = await fetch(`${API_BASE_URL}/api/posts/liked`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        const likedData = await likedResponse.json();
        if (likedResponse.ok) {
          const normalizedLikedPosts = likedData.posts.map((post) => ({
            ...post,
            image_urls: post.image_urls || (post.image_url ? [post.image_url] : []),
          }));
          setLikedPosts(normalizedLikedPosts || []);
        } else {
          setError(likedData.message || "Failed to fetch liked posts");
        }
        const commentedResponse = await fetch(`${API_BASE_URL}/api/posts/commented`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        const commentedData = await commentedResponse.json();
        if (commentedResponse.ok) {
          const normalizedCommentedPosts = commentedData.posts.map((post) => ({
            ...post,
            image_urls: post.image_urls || (post.image_url ? [post.image_url] : []),
          }));
          setCommentedPosts(normalizedCommentedPosts || []);
        } else {
          setError(commentedData.message || "Failed to fetch commented posts");
        }
      } else {
        setError(data.message || "Failed to fetch profile");
      }
    } catch (error) {
      setError("Error fetching profile or posts: " + error.message);
      console.error("Fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileAndPosts();
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setError("No file selected. Please choose an image.");
      console.log("No file selected in input");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (e.g., JPG, PNG)");
      console.log("Invalid file type:", file.type);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image file size must be less than 5MB");
      console.log("File too large:", file.size);
      return;
    }
    setProfileImage(file);
    setPreviewImage(URL.createObjectURL(file));
    setError("");
    console.log("Selected image:", {
      name: file.name,
      size: file.size,
      type: file.type,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const formData = new FormData();
    if (bio) {
      formData.append("bio", bio);
      console.log("Appending bio:", bio);
    }
    if (profileImage) {
      formData.append("profile_image", profileImage, profileImage.name);
      console.log("Appending profile_image:", profileImage.name);
    }

    for (let [key, value] of formData.entries()) {
      console.log(`FormData entry: ${key}=${value.name || value}`);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });
      const data = await response.json();
      console.log("Profile update response:", data);
      if (response.ok) {
        await fetchProfileAndPosts();
        if (previewImage) {
          URL.revokeObjectURL(previewImage);
        }
        setPreviewImage(null);
        setProfileImage(null);
        setIsEditing(false);
      } else {
        setError(data.message || "Failed to update profile");
      }
    } catch (error) {
      setError("Error updating profile: " + error.message);
      console.error("Update error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleEditMode = () => {
    setIsEditing(!isEditing);
    setError("");
    if (previewImage) {
      URL.revokeObjectURL(previewImage);
      setPreviewImage(null);
      setProfileImage(null);
    }
  };

  const handleLikePost = async (postId, setPostsFn) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/posts/${postId}/like`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      if (response.ok) {
        setPostsFn((prevPosts) =>
          prevPosts.map((post) =>
            post._id === postId
              ? {
                  ...post,
                  likes: data.likes === post.likes.length
                    ? post.likes.filter((id) => id.toString() !== currentUserId)
                    : [...post.likes, currentUserId],
                }
              : post
          )
        );
        if (setPostsFn !== setLikedPosts) {
          setLikedPosts((prev) =>
            data.likes === prev.find((p) => p._id === postId)?.likes.length
              ? prev.filter((p) => p._id !== postId)
              : prev.some((p) => p._id === postId)
              ? prev
              : [posts.find((p) => p._id === postId) || commentedPosts.find((p) => p._id === postId), ...prev].filter(Boolean)
          );
        }
      } else {
        setError(data.message || "Failed to like/unlike post");
      }
    } catch (error) {
      setError("Error liking post: " + error.message);
      console.error("Like post error:", error);
    }
  };

  const handleAddComment = async (postId, content, setPostsFn) => {
    if (!content) {
      setError("Comment cannot be empty");
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/posts/${postId}/comment`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });
      const data = await response.json();
      if (response.ok) {
        setPostsFn((prevPosts) =>
          prevPosts.map((post) =>
            post._id === postId ? data.post : post
          )
        );
        if (setPostsFn !== setCommentedPosts && !commentedPosts.some((p) => p._id === postId)) {
          setCommentedPosts((prev) => [data.post, ...prev]);
        }
      } else {
        setError(data.message || "Failed to add comment");
      }
    } catch (error) {
      setError("Error adding comment: " + error.message);
      console.error("Add comment error:", error);
    }
  };

  const handleDeletePost = async (postId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/posts/${postId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setPosts((prev) => prev.filter((post) => post._id !== postId));
        setPostCount((prev) => prev - 1);
        setLikedPosts((prev) => prev.filter((post) => post._id !== postId));
        setCommentedPosts((prev) => prev.filter((post) => post._id !== postId));
      } else {
        setError(data.message || "Failed to delete post");
      }
    } catch (error) {
      setError("Error deleting post: " + error.message);
      console.error("Delete post error:", error);
    }
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      setIsLoading(true);
      localStorage.removeItem("token");
      localStorage.removeItem("userId");
      navigate("/login");
      setIsMobileMenuOpen(false);
    }
  };

  const getActivePosts = () => {
    switch (tab) {
      case "your":
        return posts;
      case "liked":
        return likedPosts;
      case "commented":
        return commentedPosts;
      default:
        return posts;
    }
  };

  if (!user) {
    return (
      <DashboardLayout>
        <p className="text-white/70 text-center">Loading...</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Hamburger Menu for Mobile */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="md:hidden fixed top-4 left-4 text-white/90 hover:text-pink-300 transition duration-300 z-50"
      >
        <Menu size={24} />
      </motion.button>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.3 }}
            className="md:hidden fixed top-0 left-0 w-3/4 sm:w-64 bg-gradient-to-b from-[#1a002f] to-[#2a004f] h-full shadow-lg z-50 p-4"
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
                </Link>
              ))}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleLogout}
                disabled={isLoading}
                className="flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-xl transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-pink-500/30 text-base mt-4"
              >
                <LogOut size={16} />
                {isLoading ? "Logging out..." : "Logout"}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-white">Profile</h2>
        <div className="bg-white/10 p-4 sm:p-6 rounded-xl border border-white/20 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row items-center sm:justify-between mb-4">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative">
                <img
                  src={
                    previewImage ||
                    (user.profile_image
                      ? `${user.profile_image}?t=${Date.now()}`
                      : "https://via.placeholder.com/80?text=User")
                  }
                  alt={user.name}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-pink-500/50"
                />
                {isEditing && (
                  <label
                    htmlFor="profileImage"
                    className="absolute bottom-0 right-0 bg-pink-600 p-1 sm:p-2 rounded-full cursor-pointer"
                  >
                    <Camera size={16} className="text-white" />
                    <input
                      id="profileImage"
                      name="profile_image"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageChange}
                      disabled={!isEditing}
                    />
                  </label>
                )}
              </div>
              <div className="text-center sm:text-left">
                <h3 className="text-lg sm:text-xl font-semibold text-white">{user.name}</h3>
                <div className="flex gap-2 sm:gap-4 mt-2 justify-center sm:justify-start">
                  <p className="text-gray-400 text-sm sm:text-base">
                    <span className="font-semibold text-white">{postCount}</span> Posts
                  </p>
                  <button
                    onClick={() => setShowFollowManager(true)}
                    className="text-gray-400 hover:text-white transition text-sm sm:text-base"
                  >
                    <span className="font-semibold text-white">{user.followers?.length || 0}</span> Followers
                  </button>
                  <button
                    onClick={() => setShowFollowManager(true)}
                    className="text-gray-400 hover:text-white transition text-sm sm:text-base"
                  >
                    <span className="font-semibold text-white">{user.following?.length || 0}</span> Following
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={toggleEditMode}
              className="mt-4 sm:mt-0 p-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg flex items-center gap-2 text-sm sm:text-base"
            >
              {isEditing ? (
                <>
                  <X size={16} /> Cancel
                </>
              ) : (
                <>
                  <Edit size={16} /> Edit Profile
                </>
              )}
            </button>
          </div>
          <div className="mb-4">
            <p className="text-gray-100 text-sm text-center sm:text-left ">{bio || "No bio yet"}</p>
            {isEditing && (
              <>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself (160 characters max)"
                  maxLength={160}
                  className="w-full px-3 py-2 mt-2 rounded-lg bg-white/90 text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-pink-400 shadow-sm text-sm sm:text-base"
                  disabled={!isEditing}
                />
                <input
                  type="file"
                  name="profile_image"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="mt-2 text-white text-sm"
                  disabled={!isEditing}
                />
              </>
            )}
          </div>
          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-400 text-center text-sm mb-4"
            >
              {error}
            </motion.p>
          )}
          {isEditing && (
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isLoading}
              className="w-full py-2 sm:py-3 rounded-lg bg-pink-600 hover:bg-pink-700 text-white font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              {isLoading ? "Saving..." : "Save Profile"}
            </button>
          )}
        </div>
        {/* Posts Section with Tabs */}
        <div className="mt-4 sm:mt-6">
          <div className="flex justify-center gap-2 sm:gap-4 mb-4 flex-wrap">
            <button
              onClick={() => setTab("your")}
              className={`px-3 py-2 rounded-lg font-semibold transition text-sm sm:text-base ${
                tab === "your"
                  ? "bg-pink-600 text-white"
                  : "bg-white/10 text-gray-400 hover:bg-white/20"
              }`}
            >
              Your Posts
            </button>
            <button
              onClick={() => setTab("liked")}
              className={`px-3 py-2 rounded-lg font-semibold transition text-sm sm:text-base ${
                tab === "liked"
                  ? "bg-pink-600 text-white"
                  : "bg-white/10 text-gray-400 hover:bg-white/20"
              }`}
            >
              Liked Posts
            </button>
            <button
              onClick={() => setTab("commented")}
              className={`px-3 py-2 rounded-lg font-semibold transition text-sm sm:text-base ${
                tab === "commented"
                  ? "bg-pink-600 text-white"
                  : "bg-white/10 text-gray-400 hover:bg-white/20"
              }`}
            >
              Commented Posts
            </button>
          </div>
          {isLoading ? (
            <p className="text-white/70 text-center text-sm sm:text-base">Loading...</p>
          ) : getActivePosts().length === 0 ? (
            <p className="text-white/70 text-center text-sm sm:text-base">
              {tab === "your"
                ? "No posts yet"
                : tab === "liked"
                ? "No liked posts yet"
                : "No commented posts yet"}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
              {getActivePosts().map((post) => (
                <Post
                  key={post._id}
                  post={post}
                  userId={currentUserId}
                  onLike={(postId) => handleLikePost(postId, tab === "your" ? setPosts : tab === "liked" ? setLikedPosts : setCommentedPosts)}
                  onComment={(postId, content) =>
                    handleAddComment(postId, content, tab === "your" ? setPosts : tab === "liked" ? setLikedPosts : setCommentedPosts)
                  }
                  onDelete={handleDeletePost}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <AnimatePresence>
        {showFollowManager && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-gradient-to-b from-[#1a002f] to-[#2a004f] rounded-lg p-4 sm:p-6"
            >
              <FollowManager
                userId={currentUserId}
                onClose={() => setShowFollowManager(false)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
};

export default Profile;