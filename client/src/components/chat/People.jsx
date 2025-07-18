import { useState, useEffect, useRef } from "react";
import DashboardLayout from "./DashboardLayout";
import { motion, AnimatePresence } from "framer-motion";
import ProfilePopup from "./ProfilePopup";
import { Search } from "lucide-react";
import { API_BASE_URL } from "../../../api";

const People = () => {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const peopleListRef = useRef(null);

  // Fisher-Yates shuffle algorithm
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const fetchUsers = async (query = "") => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/auth/search?query=${encodeURIComponent(query)}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      const data = await response.json();
      if (response.ok) {
        // Shuffle users if no query, or filter and shuffle if query exists
        const processedUsers = query ? data : shuffleArray(data);
        setUsers(processedUsers);
      } else {
        console.error("Failed to fetch users:", data.message);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchUsers(searchQuery);
  };

  // Prevent people list from affecting page scroll
  useEffect(() => {
    if (peopleListRef.current) {
      peopleListRef.current.scrollTop = 0; // Ensure list starts at top
      console.log("People list scroll reset");
    }
  }, [users]);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto h-[calc(100vh-200px)] overflow-hidden">
        <h2 className="text-3xl font-bold mb-4 text-white">People</h2>
        <form onSubmit={handleSearch} className="mb-6 flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="w-full px-4 py-3 rounded-lg bg-white/90 text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-pink-400 shadow-sm"
            />
            <Search
              size={20}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600"
            />
          </div>
          <button
            type="submit"
            className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg"
          >
            Search
          </button>
        </form>
        <div
          ref={peopleListRef}
          className="overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 max-h-[calc(100vh-300px)]"
        >
          {isLoading ? (
            <p className="text-white/70 text-center">Loading...</p>
          ) : users.length === 0 ? (
            <p className="text-white/70 text-center">No users found</p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-4 p-2">
              {users.map((user) => (
                <motion.li
                  key={user._id}
                  whileHover={{ scale: 1.05 }}
                  className="bg-white/10 p-4 rounded-xl border border-white/20 hover:shadow-pink-500/30 transition cursor-pointer"
                  onClick={() => setSelectedUser(user._id)}
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
                    <p className="text-white font-semibold">{user.name}</p>
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <AnimatePresence>
        {selectedUser && (
          <ProfilePopup
            userId={selectedUser}
            onClose={() => setSelectedUser(null)}
          />
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
};

export default People;