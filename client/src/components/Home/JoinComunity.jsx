import React from "react";
import { Users } from "lucide-react";

const JoinCommunity = () => {
  return (
    <section className="py-20 text-white text-center">
      <div className="max-w-3xl mx-auto px-6">
        <div className="flex justify-center mb-6">
          <Users className="w-12 h-12 text-white drop-shadow-md" />
        </div>
        <h2 className="text-4xl font-bold mb-4">Join the Community</h2>
        <p className="text-lg mb-8 text-white/90">
          Meet amazing people, share your stories, and start building connections today.
        </p>
        <a
          href="/register"
          className="inline-block bg-white text-purple-700 font-semibold px-8 py-3 rounded-full shadow-lg hover:bg-purple-100 transition"
        >
          Get Started Now
        </a>
      </div>
    </section>
  );
};

export default JoinCommunity;
