import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useApi } from '../../contexts/ApiContext';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

const Layout = () => {
  const { isAuthenticated } = useApi();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {isAuthenticated && (
        <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      )}
      
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {isAuthenticated && (
          <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        )}
        
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="container mx-auto max-w-7xl px-4 md:px-6 py-6 page-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;