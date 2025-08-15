import React from "react";
import { FaFacebookF, FaTwitter, FaInstagram, FaLinkedin, FaGooglePlay, FaDownload } from "react-icons/fa";

const Footer = () => {
  return (
    <footer className="bg-gradient-to-t from-[#0f0f0f] to-[#1a1a1a] text-white px-6 py-10">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 text-center md:text-left">
        {/* Brand */}
        <div>
          <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 mb-4">
            Aether
          </h2>
          <p className="text-gray-400">
            A place to connect, chat, and grow your vibe. Meet like-minded people in a world made for interaction.
          </p>
        </div>

        {/* Navigation */}
        <div>
          <h3 className="text-xl font-semibold mb-4 text-white">Quick Links</h3>
          <ul className="space-y-2 text-gray-400">
            <li><a href="/" className="hover:text-pink-400 transition">Home</a></li>
            <li><a href="/login" className="hover:text-pink-400 transition">Login</a></li>
            <li><a href="/register" className="hover:text-pink-400 transition">Register</a></li>
          </ul>
        </div>

        {/* Download Our App */}
        <div>
          <h3 className="text-xl font-semibold mb-4 text-white">Download Our App</h3>
          <p className="text-gray-400 mb-4">Get Aether on your phone and connect anytime, anywhere.</p>
          <div className="flex justify-center md:justify-start gap-4">
            <a href="https://aether-file.vercel.app/Aether.apk" className="flex justify-center md:justify-start gap-4 text-pink-400">
              <FaDownload className="hover:text-white transition" />
            </a>
          </div>
        </div>

        {/* Social */}
        <div>
          <h3 className="text-xl font-semibold mb-4 text-white">Follow Us</h3>
          <div className="flex justify-center md:justify-start gap-4 text-pink-400">
            <a href="#"><FaTwitter className="hover:text-white transition" /></a>
            <a href="#"><FaInstagram className="hover:text-white transition" /></a>
            <a href="#"><FaLinkedin className="hover:text-white transition" /></a>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-700 mt-10 pt-6 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} Aether. All rights reserved. <br />
        Built by <a href="https://softwebelevation.com" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:text-white transition">SoftWebElevation</a>
      </div>
    </footer>
  );
};

export default Footer;
