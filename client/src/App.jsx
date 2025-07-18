import { BrowserRouter as Router, Routes, Route, Navigate} from "react-router-dom";
import HomePage from "./pages/HomePage";
import Footer from "./components/shared/Footer";
import Login from "./components/auth/Login";
import Register from "./components/auth/Register";
import Posts from "./components/chat/Posts";
import People from "./components/chat/People";
import Chats from "./components/chat/Chats";
import Profile from "./components/chat/Profile";
import { SocketProvider } from "./context/SocketContext";
import NotFound from "./components/shared/NotFound";


function App() {
  return (
    <SocketProvider>
    <Router>
      <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<NotFound />} />
          <Route path="/dashboard" element={<Navigate to="/dashboard/posts" />} />
            <Route path="/dashboard/posts" element={<Posts />} />
            <Route path="/dashboard/people" element={<People />} />
            <Route path="/dashboard/chats" element={<Chats />} />
            <Route path="/dashboard/profile" element={<Profile />} />
      </Routes>
      <Footer />
    </Router>
    </SocketProvider>
  );
}

export default App;