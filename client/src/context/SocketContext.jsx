import { createContext, useContext, useEffect, useState } from "react";
import io from "socket.io-client";
import { API_BASE_URL } from "../../api";

export const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connectionError, setConnectionError] = useState(null);

  useEffect(() => {
    const newSocket = io(API_BASE_URL, {
      auth: { token: localStorage.getItem("token") },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on("connect", () => {
      console.log("Socket.IO connected:", newSocket.id);
      const userId = localStorage.getItem("userId");
      if (userId) {
        newSocket.emit("register", userId);
        console.log(`User ${userId} registered with Socket.IO`);
      }
      setConnectionError(null);
      setSocket(newSocket);
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket.IO connection error:", error.message);
      setConnectionError(error.message || "Failed to connect to real-time server");
    });

    newSocket.on("error", (error) => {
      console.error("Socket.IO error:", error.message);
      setConnectionError(error.message || "Socket error occurred");
    });

    return () => {
      console.log("Disconnecting Socket.IO");
      newSocket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connectionError }}>
      {children}
    </SocketContext.Provider>
  );
};