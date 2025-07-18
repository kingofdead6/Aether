import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, Trash2, X } from "lucide-react";
import { API_BASE_URL } from "../../../api";

const Post = ({ post, userId, onLike, onComment, onDelete }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % post.image_urls.length);
  };

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + post.image_urls.length) % post.image_urls.length);
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    onComment(post._id, newComment);
    setNewComment("");
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/10 p-4 rounded-xl border border-white/20 flex flex-col"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <img
            src={post.user_id.profile_image || "https://via.placeholder.com/40?text=User"}
            alt={post.user_id.name}
            className="w-10 h-10 rounded-full object-cover border-2 border-pink-500/50"
          />
          <div>
            <p className="text-white font-semibold">{post.user_id.name}</p>
            <p className="text-gray-400 text-sm">{formatDate(post.createdAt)}</p>
          </div>
        </div>
        {post.user_id._id.toString() === userId && (
          <button
            onClick={() => onDelete(post._id)}
            className="text-gray-400 hover:text-red-600"
            title="Delete Post"
          >
            <Trash2 size={20} />
          </button>
        )}
      </div>
      {post.image_urls.length > 0 && (
        <div className="relative mb-3">
          <img
            src={post.image_urls[currentImageIndex]}
            alt="Post"
            className="w-full h-64 object-cover rounded-lg"
          />
          {post.image_urls.length > 1 && (
            <>
              <button
                onClick={handlePrevImage}
                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white p-2 rounded-full"
              >
                ←
              </button>
              <button
                onClick={handleNextImage}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white p-2 rounded-full"
              >
                →
              </button>
              <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-2 py-1 rounded-full text-sm">
                {currentImageIndex + 1}/{post.image_urls.length}
              </div>
            </>
          )}
        </div>
      )}
      <p className="text-gray-100 mb-3">{post.content}</p>
      <div className="flex items-center gap-4 mb-3">
        <button
          onClick={() => onLike(post._id)}
          className="flex items-center gap-1 text-gray-400 hover:text-pink-600"
        >
          <Heart
            size={20}
            className={post.likes.includes(userId) ? "fill-pink-600 text-pink-600" : ""}
          />
          <span>{post.likes.length}</span>
        </button>
        <button
          onClick={() => setShowComments(true)}
          className="flex items-center gap-1 text-gray-400 hover:text-pink-600"
        >
          <MessageCircle size={20} />
          <span>{post.comments.length}</span>
        </button>
      </div>

      {/* Comments Popup */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white/40 backdrop-blur-md p-6 rounded-xl border border-white/20 w-full max-w-md"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-white">Comments</h3>
                <button
                  onClick={() => setShowComments(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto mb-4">
                {post.comments.length === 0 ? (
                  <p className="text-gray-400 text-center">No comments yet</p>
                ) : (
                  post.comments.map((comment, index) => (
                    <div key={index} className="flex gap-2 mt-2">
                      <img
                        src={comment.user_id.profile_image || "https://via.placeholder.com/30?text=User"}
                        alt={comment.user_id.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <div>
                        <p className="text-white font-semibold">{comment.user_id.name}</p>
                        <p className="text-gray-100">{comment.content}</p>
                        <p className="text-gray-400 text-sm">{formatDate(comment.createdAt)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  maxLength={280}
                  className="flex-1 px-3 py-2 rounded-lg bg-white/90 text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-pink-400"
                />
                <button
                  onClick={handleAddComment}
                  className="px-3 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg"
                >
                  Post
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Post;