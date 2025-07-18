import { useState, useEffect } from "react";
import DashboardLayout from "./DashboardLayout";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X } from "lucide-react";
import Post from "./Post";
import { API_BASE_URL } from "../../../api";

const Posts = () => {
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [postImages, setPostImages] = useState([]);
  const [previewImages, setPreviewImages] = useState([]);

  const userId = localStorage.getItem("userId");

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/posts/followed`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setPosts(data.posts || []);
      } else {
        setError(data.message || "Failed to fetch posts");
      }
    } catch (error) {
      setError("Error fetching posts: " + error.message);
      console.error("Fetch posts error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + postImages.length > 5) {
      setError("Maximum 5 images allowed");
      return;
    }
    const validFiles = files.filter((file) => {
      if (!file.type.startsWith("image/")) {
        setError("Please select valid image files (e.g., JPG, PNG)");
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("Each image must be less than 5MB");
        return false;
      }
      return true;
    });
    setPostImages([...postImages, ...validFiles]);
    setPreviewImages([...previewImages, ...validFiles.map((file) => URL.createObjectURL(file))]);
    setError("");
    console.log("Selected images:", validFiles.map((file) => file.name));
  };

  const removeImage = (index) => {
    URL.revokeObjectURL(previewImages[index]);
    setPostImages(postImages.filter((_, i) => i !== index));
    setPreviewImages(previewImages.filter((_, i) => i !== index));
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!postContent) {
      setError("Post content is required");
      return;
    }
    if (postImages.length === 0) {
      setError("At least one image is required");
      return;
    }
    setError("");
    setIsLoading(true);

    const formData = new FormData();
    formData.append("content", postContent);
    postImages.forEach((image) => {
      formData.append("images", image);
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/posts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });
      const data = await response.json();
      console.log("Create post response:", data);
      if (response.ok) {
        setPosts([data.post, ...posts]);
        setPostContent("");
        setPostImages([]);
        previewImages.forEach((url) => URL.revokeObjectURL(url));
        setPreviewImages([]);
        setShowCreatePost(false);
      } else {
        setError(data.message || "Failed to create post");
      }
    } catch (error) {
      setError("Error creating post: " + error.message);
      console.error("Create post error:", error);
    } finally {
      setIsLoading(false);
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
        setPosts(posts.map((post) =>
          post._id === postId
            ? { ...post, likes: data.likes === post.likes.length ? post.likes.filter((id) => id.toString() !== userId) : [...post.likes, userId] }
            : post
        ));
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
        setPosts(posts.map((post) =>
          post._id === postId ? data.post : post
        ));
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
        setPosts(posts.filter((post) => post._id !== postId));
      } else {
        setError(data.message || "Failed to delete post");
      }
    } catch (error) {
      setError("Error deleting post: " + error.message);
      console.error("Delete post error:", error);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-white">Posts</h2>
          <button
            onClick={() => setShowCreatePost(true)}
            className="py-2 px-4 bg-pink-600 hover:bg-pink-700 text-white rounded-lg flex items-center gap-2"
          >
            <Send size={16} /> Create Post
          </button>
        </div>
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-red-400 text-center mb-4"
          >
            {error}
          </motion.p>
        )}
        {isLoading && <p className="text-white/70 text-center">Loading...</p>}
        {!isLoading && posts.length === 0 && (
          <p className="text-white/70 text-center">No posts to display</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {posts.map((post) => (
            <Post
              key={post._id}
              post={post}
              userId={userId}
              onLike={handleLikePost}
              onComment={handleAddComment}
              onDelete={handleDeletePost}
            />
          ))}
        </div>
      </div>

      {/* Create Post Popup */}
      <AnimatePresence>
        {showCreatePost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white/10 p-6 rounded-xl border border-white/20 w-full max-w-md"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-white">Create Post</h3>
                <button
                  onClick={() => {
                    setShowCreatePost(false);
                    setPostContent("");
                    setPostImages([]);
                    previewImages.forEach((url) => URL.revokeObjectURL(url));
                    setPreviewImages([]);
                    setError("");
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleCreatePost}>
                <textarea
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="What's on your mind? (280 characters max)"
                  maxLength={280}
                  className="w-full px-4 py-3 rounded-lg bg-white/90 text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-pink-400 mb-4"
                />
                <div className="flex flex-wrap gap-2 mb-4">
                  {previewImages.map((url, index) => (
                    <div key={index} className="relative">
                      <img src={url} alt="Preview" className="w-20 h-20 object-cover rounded-lg" />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-0 right-0 bg-red-600 text-white rounded-full p-1"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <label className="block mb-4">
                  <span className="text-gray-400">Add images (1-5 required)</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                    className="mt-2 text-white"
                  />
                </label>
                {error && (
                  <p className="text-red-400 text-center mb-4">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={isLoading || !postContent || postImages.length === 0}
                  className="w-full py-3 rounded-lg bg-pink-600 hover:bg-pink-700 text-white font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Posting..." : "Post"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
};

export default Posts;