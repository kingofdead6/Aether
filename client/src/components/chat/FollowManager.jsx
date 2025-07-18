import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, User } from "lucide-react";
import ProfilePopup from "./ProfilePopup";
import { API_BASE_URL } from "../../../api";

const FollowManager = ({ userId, onClose }) => {
  const [tab, setTab] = useState("followers"); // Track active tab: "followers" or "following"
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(null); // For opening ProfilePopup
  const currentUserId = localStorage.getItem("userId");

  const fetchFollowData = async () => {
    setIsLoading(true);
    setError("");
    try {
      // Fetch user's profile to get followers and following
      const profileResponse = await fetch(`${API_BASE_URL}/api/auth/${userId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const profileData = await profileResponse.json();
      if (!profileResponse.ok) {
        throw new Error(profileData.message || "Failed to fetch profile");
      }

      // Fetch detailed user info for followers
      const followersPromises = profileData.user.followers.map(async (followerId) => {
        const userResponse = await fetch(`${API_BASE_URL}/api/auth/${followerId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        const userData = await userResponse.json();
        if (!userResponse.ok) {
          throw new Error(userData.message || "Failed to fetch follower data");
        }
        // Check if current user is following this follower
        const followResponse = await fetch(`${API_BASE_URL}/api/auth/isFollowing/${followerId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        const followData = await followResponse.json();
        return {
          ...userData.user,
          isFollowing: followData.isFollowing,
        };
      });

      // Fetch detailed user info for following
      const followingPromises = profileData.user.following.map(async (followingId) => {
        const userResponse = await fetch(`${API_BASE_URL}/api/auth/${followingId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        const userData = await userResponse.json();
        if (!userResponse.ok) {
          throw new Error(userData.message || "Failed to fetch following data");
        }
        return {
          ...userData.user,
          isFollowing: true, // Already following
        };
      });

      const [followersData, followingData] = await Promise.all([
        Promise.all(followersPromises),
        Promise.all(followingPromises),
      ]);

      setFollowers(followersData);
      setFollowing(followingData);
    } catch (error) {
      setError("Error fetching follow data: " + error.message);
      console.error("Fetch follow data error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowData();
  }, [userId]);

  const handleFollow = async (targetUserId) => {
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/${targetUserId}/follow`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      if (response.ok) {
        // Update followers and following lists
        setFollowers((prev) =>
          prev.map((user) =>
            user._id === targetUserId ? { ...user, isFollowing: data.isFollowing } : user
          )
        );
        setFollowing((prev) =>
          data.isFollowing
            ? [...prev, { ...followers.find((u) => u._id === targetUserId), isFollowing: true }]
            : prev.filter((u) => u._id !== targetUserId)
        );
      } else {
        setError(data.message || "Failed to follow/unfollow user");
      }
    } catch (error) {
      setError("Error following user: " + error.message);
      console.error("Follow error:", error);
    }
  };

  const handleViewProfile = (targetUserId) => {
    setSelectedUserId(targetUserId);
  };

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
        className="bg-white/10 backdrop-blur-2xl p-6 rounded-xl border border-white/20 w-full max-w-lg max-h-[80vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/70 hover:text-white"
        >
          <X size={24} />
        </button>
        {error && (
          <p className="text-red-500 mb-4 text-center">{error}</p>
        )}
        <div className="flex justify-center gap-4 mb-4">
          <button
            onClick={() => setTab("followers")}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              tab === "followers"
                ? "bg-pink-600 text-white"
                : "bg-white/10 text-gray-400 hover:bg-white/20"
            }`}
          >
            Followers
          </button>
          <button
            onClick={() => setTab("following")}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              tab === "following"
                ? "bg-pink-600 text-white"
                : "bg-white/10 text-gray-400 hover:bg-white/20"
            }`}
          >
            Following
          </button>
        </div>
        {isLoading ? (
          <p className="text-white/70 text-center">Loading...</p>
        ) : (
          <div className="space-y-4">
            {(tab === "followers" ? followers : following).length === 0 ? (
              <p className="text-white/70 text-center">
                {tab === "followers" ? "No followers yet" : "Not following anyone yet"}
              </p>
            ) : (
              (tab === "followers" ? followers : following).map((user) => (
                <div
                  key={user._id}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        user.profile_image ||
                        "https://via.placeholder.com/40?text=User"
                      }
                      alt={user.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div>
                      <p className="text-white font-semibold">{user.name}</p>
                      <p className="text-gray-400 text-sm">
                        {user.bio || "No bio yet"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {user._id !== currentUserId && (
                      <button
                        onClick={() => handleFollow(user._id)}
                        className={`px-3 py-1 rounded-lg text-sm font-semibold transition ${
                          user.isFollowing
                            ? "bg-gray-600 hover:bg-gray-700 text-white"
                            : "bg-pink-600 hover:bg-pink-700 text-white"
                        }`}
                      >
                        {user.isFollowing ? "Unfollow" : "Follow"}
                      </button>
                    )}
                    <button
                      onClick={() => handleViewProfile(user._id)}
                      className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition"
                    >
                      Profile
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </motion.div>
      <AnimatePresence>
        {selectedUserId && (
          <ProfilePopup
            userId={selectedUserId}
            onClose={() => setSelectedUserId(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default FollowManager;