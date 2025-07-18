import React from "react";
import { Link } from "react-router-dom";

const NotFound = () => {
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
        <h1 className="text-6xl md:text-8xl font-extrabold mb-4 bg-gradient-to-r from-red-500 via-pink-500 to-purple-500 text-transparent bg-clip-text drop-shadow-lg">
          404
        </h1>
        <p className="text-2xl md:text-3xl font-semibold text-white/90 mb-4 drop-shadow">
          Oops! Page not found.
        </p>
        <p className="text-base md:text-lg text-white/70 mb-10 max-w-xl">
          The page you’re looking for doesn’t exist or has been moved. But don’t worry — you can always go back.
        </p>

        <Link
          to="/"
          className="px-6 py-3 rounded-xl text-white bg-pink-600 hover:bg-pink-700 transition duration-300 text-lg shadow-lg hover:shadow-pink-500/30"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
