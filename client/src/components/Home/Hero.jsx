import React from "react";
import { Link } from "react-router-dom";

const Hero = () => {
  return (
    <div
      className="relative min-h-screen bg-fixed bg-cover bg-center"
      style={{
        backgroundImage: `url('https://res.cloudinary.com/dtwa3lxdk/image/upload/v1752707049/20250716_2359_Futuristic_Chatscape_Vibes_simple_compose_01k0aqbs0nf7bbkcgj5x2nbbkj_apazms.png')`,
      }}
    >
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-[#0000009f] backdrop-blur-sm z-0" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen text-center px-4">
        <h1 className="text-4xl md:text-6xl font-extrabold mb-6 bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 text-transparent bg-clip-text drop-shadow-lg">
          Connect, Chat & Make New Friends
        </h1>
        <p className="text-lg md:text-xl mb-10 max-w-2xl text-white/90 drop-shadow">
          Discover people who match your vibe. Start conversations and grow your circle.
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            to="/login"
            className="px-6 py-3 rounded-xl text-white bg-[#c6265e72] backdrop-blur-lg hover:bg-pink-700 transition duration-300 text-lg shadow-lg hover:shadow-pink-500/30"
          >
            Login
          </Link>
          <Link
            to="/register"
            className="px-6 py-3 rounded-xl text-white bg-purple-600/30 backdrop-blur-lg hover:bg-purple-700 transition duration-300 text-lg shadow-lg hover:shadow-purple-500/30"
          >
            Register
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Hero;
