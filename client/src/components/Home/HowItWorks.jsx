import React from "react";
import { Sparkles, UserSearch, MessageCircle } from "lucide-react";

const HowItWorks = () => {
  const features = [
    {
      icon: <UserSearch className="h-10 w-10 text-pink-400" />,
      title: "Find People",
      description: "Use our smart search to find users by name, interest, or vibe.",
    },
    {
      icon: <Sparkles className="h-10 w-10 text-yellow-400" />,
      title: "Start Chatting",
      description: "Send messages instantly, meet new people, and share moments.",
    },
    {
      icon: <MessageCircle className="h-10 w-10 text-blue-400" />,
      title: "Make Connections",
      description: "Build friendships, join communities, and grow your circle.",
    },
  ];

  return (
    <section className="py-20  dark:text-white">
      <div className="max-w-6xl mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-6">
          How It Works
        </h2>
        <p className="text-lg mb-12 text-gray-600 dark:text-gray-300">
          Connecting is easy. Just follow these steps and you’re in!
        </p>

        <div className="grid md:grid-cols-3 gap-10">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-lg hover:shadow-pink-300 transition"
            >
              <div className="mb-4 flex justify-center">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-gray-600 dark:text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
