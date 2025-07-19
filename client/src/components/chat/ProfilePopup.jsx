import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Post from "./Post";
import FollowManager from "./FollowManager";
import { API_BASE_URL } from "../../../api";

const ProfilePopup = ({ userId, onClose }) => {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isMutualFollowing, setIsMutualFollowing] = useState(false);
  const [error, setError] = useState("");
  const [showFollowManager, setShowFollowManager] = useState(false); 
  const navigate = useNavigate();
  const currentUserId = localStorage.getItem("userId");

  const fetchProfileAndFollowStatus = async () => {
    setIsLoading(true);
    setError("");
    try {
      const profileResponse = await fetch(`${API_BASE_URL}/api/auth/${userId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const profileData = await profileResponse.json();
      if (!profileResponse.ok) {
        throw new Error(profileData.message || "Failed to fetch profile");
      }
      // Normalize image_urls (handle legacy image_url if present)
      const normalizedPosts = profileData.posts.map((post) => ({
        ...post,
        image_urls: post.image_urls || (post.image_url ? [post.image_url] : []),
      }));
      setProfile({ ...profileData, posts: normalizedPosts });

      const followResponse = await fetch(`${API_BASE_URL}/api/auth/isFollowing/${userId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const followData = await followResponse.json();
      if (!followResponse.ok) {
        throw new Error(followData.message || "Failed to check follow status");
      }
      setIsFollowing(followData.isFollowing);
      setIsMutualFollowing(profileData.user.followers.includes(currentUserId));
    } catch (error) {
      setError("Error fetching profile: " + error.message);
      console.error("Fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileAndFollowStatus();
  }, [userId]);

  const handleFollow = async () => {
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/${userId}/follow`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      if (response.ok) {
        setIsFollowing(data.isFollowing);
        const profileResponse = await fetch(`${API_BASE_URL}/api/auth/${userId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        const profileData = await profileResponse.json();
        if (!profileResponse.ok) {
          throw new Error(profileData.message || "Failed to fetch profile");
        }
        const normalizedPosts = profileData.posts.map((post) => ({
          ...post,
          image_urls: post.image_urls || (post.image_url ? [post.image_url] : []),
        }));
        setProfile({ ...profileData, posts: normalizedPosts });
        setIsMutualFollowing(profileData.user.followers.includes(currentUserId));
      } else {
        setError(data.message || "Failed to follow/unfollow user");
      }
    } catch (error) {
      setError("Error following user: " + error.message);
    }
  };

  const handleChat = async () => {
    setError("");
    try {
      if (!isMutualFollowing) {
        setError("You can only chat with users you mutually follow");
        return;
      }
      const response = await fetch(`${API_BASE_URL}/api/chats`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user1_id: currentUserId,
          user2_id: userId,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        navigate(`/dashboard/chats/${data.chat._id}`);
      } else {
        setError(data.message || "Failed to create or access chat");
      }
    } catch (error) {
      setError("Error creating chat: " + error.message);
    }
  };

  const handleLikePost = async (postId) => {
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
        setProfile((prev) => ({
          ...prev,
          posts: prev.posts.map((post) =>
            post._id === postId
              ? {
                  ...post,
                  likes: data.likes === post.likes.length
                    ? post.likes.filter((id) => id.toString() !== currentUserId)
                    : [...post.likes, currentUserId],
                }
              : post
          ),
        }));
      } else {
        setError(data.message || "Failed to like/unlike post");
      }
    } catch (error) {
      setError("Error liking post: " + error.message);
      console.error("Like post error:", error);
    }
  };

  const handleAddComment = async (postId, content) => {
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
        setProfile((prev) => ({
          ...prev,
          posts: prev.posts.map((post) =>
            post._id === postId ? data.post : post
          ),
        }));
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
        setProfile((prev) => ({
          ...prev,
          posts: prev.posts.filter((post) => post._id !== postId),
          postCount: prev.postCount - 1,
        }));
      } else {
        setError(data.message || "Failed to delete post");
      }
    } catch (error) {
      setError("Error deleting post: " + error.message);
      console.error("Delete post error:", error);
    }
  };

  if (!profile) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white/10 backdrop-blur-2xl p-6 rounded-xl border border-white/20 w-full max-w-xl max-h-[80vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="cursor-pointer absolute top-4 right-4 text-white/70 hover:text-red-500"
        >
          <X size={24} />
        </button>
        {error && (
          <p className="text-red-500 mb-4 text-center">{error}</p>
        )}
        {isLoading ? (
          <p className="text-white/70 text-center">Loading...</p>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-4">
              <img
                src={
                  profile.user.profile_image ||
                  "https://via.placeholder.com/80?text=User"
                }
                alt={profile.user.name}
                className="w-20 h-20 rounded-full object-cover"
              />
              <div>
                <h3 className="text-2xl font-bold text-white">
                  {profile.user.name}
                </h3>
                <p className="text-white/70">{profile.user.bio || "No bio yet"}</p>
              </div>
            </div>
            <div className="flex justify-between mb-4">
              <p className="text-white">
                <span className="font-semibold">{profile.postCount}</span> Posts
              </p>
              <button
                onClick={() => setShowFollowManager(true)}
                className="cursor-pointer text-white hover:text-pink-400 transition"
              >
                <span className="font-semibold">{profile.user.followers.length}</span> Followers
              </button>
              <button
                onClick={() => setShowFollowManager(true)}
                className="cursor-pointer text-white hover:text-pink-400 transition"
              >
                <span className="font-semibold">{profile.user.following.length}</span> Following
              </button>
            </div>
            <div className="flex gap-4 mb-6">
              <button
                onClick={handleFollow}
                className={`cursor-pointer flex-1 py-2 rounded-lg ${
                  isFollowing
                    ? "bg-gray-600 hover:bg-gray-700"
                    : "bg-pink-600 hover:bg-pink-700"
                } text-white font-semibold transition`}
              >
                {isFollowing ? "Following" : "Follow"}
              </button>
              {isMutualFollowing && (
                <button
                  className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition flex items-center justify-center gap-2"
                >
                  <MessageSquare size={16} /> Chat is Open
                </button>
              )}
            </div>
            <h4 className="text-xl font-semibold text-white mb-3">Recent Posts</h4>
            {profile.posts.length === 0 ? (
              <p className="text-white/70 text-center">No posts yet</p>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {profile.posts.map((post) => (
                  <Post
                    key={post._id}
                    post={post}
                    userId={currentUserId}
                    onLike={handleLikePost}
                    onComment={handleAddComment}
                    onDelete={handleDeletePost}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </motion.div>
      <AnimatePresence>
        {showFollowManager && (
          <FollowManager
            userId={userId}
            onClose={() => setShowFollowManager(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ProfilePopup;