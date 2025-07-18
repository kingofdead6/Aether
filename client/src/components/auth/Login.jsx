import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../../api";

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Store token and userId in localStorage
      localStorage.setItem('token', data.token);
      localStorage.setItem('userId', data.user._id);

      // Redirect to dashboard on successful login
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="w-full max-w-md p-8 bg-white/10 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/20"
      >
        <h2 className="text-4xl font-bold text-center text-white mb-6 drop-shadow">
          Welcome Back 👋
        </h2>

        {error && (
          <div className="text-red-500 text-center mb-4">{error}</div>
        )}

        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* Email */}
          <div>
            <label className="block text-sm text-white/80 mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your email"
              required
              className="w-full px-4 py-3 rounded-lg bg-white/90 text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-pink-400 shadow-sm"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <label className="block text-sm text-white/80 mb-1">Password</label>
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="password"
              required
              className="w-full px-4 py-3 pr-12 rounded-lg bg-white/90 text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-pink-400 shadow-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="cursor-pointer absolute right-3 top-9 text-gray-600 hover:text-pink-400 transition duration-300"
              aria-label="Toggle password visibility"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="cursor-pointer w-full py-3 rounded-lg bg-pink-500 hover:bg-pink-600 transition text-white font-semibold shadow-lg hover:shadow-pink-400 duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        {/* Sign up link */}
        <p className="text-center text-sm text-white/70 mt-8">
          Don’t have an account?
          <Link to="/register" className="text-pink-300 hover:underline ml-1">
            register
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default Login;