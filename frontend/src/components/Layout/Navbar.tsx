import { useNavigate, Link } from 'react-router-dom';
import { Menu, LogOut, Settings, ChevronDown } from 'lucide-react';
import { useApi } from '../../contexts/ApiContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface NavbarProps {
  onMenuClick: () => void;
}

const Navbar = ({ onMenuClick }: NavbarProps) => {
  const { logout } = useApi();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="px-4 md:px-6 h-14 flex items-center justify-between">
        {/* Left: mobile menu + breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors lg:hidden"
            aria-label="Toggle sidebar"
          >
            <Menu size={20} />
          </button>
          <h1 className="text-sm font-semibold text-foreground hidden sm:block">
            Beacon Dashboard
          </h1>
        </div>

        {/* Right: user menu */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors focus:outline-none">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs font-semibold text-white">
                  A
                </div>
                <span className="text-sm font-medium text-foreground hidden sm:inline">Admin</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;