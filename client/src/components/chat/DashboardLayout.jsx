import Navbar from "../shared/Navbar";

const DashboardLayout = ({ children }) => {
  return (
    <div className="min-h-screen text-white">
      <Navbar />
      <main className="p-6 mt-10 sm:mt-20">{children}</main>
    </div>
  );
};

export default DashboardLayout;
