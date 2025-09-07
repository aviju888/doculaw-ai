import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  HomeIcon,
  DocumentTextIcon,
  ChatBubbleBottomCenterTextIcon,
  MagnifyingGlassIcon,
  CloudArrowUpIcon,
  ChartBarIcon,
  Bars3Icon,
  XMarkIcon,
  UserCircleIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { clsx } from '../../utils/helpers';
import { authService } from '../../services/dataService';

interface LayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Home', href: '/home', icon: HomeIcon },
  { name: 'Upload', href: '/upload', icon: CloudArrowUpIcon },
  { name: 'Documents', href: '/documents', icon: DocumentTextIcon },
  { name: 'Chat', href: '/chat', icon: ChatBubbleBottomCenterTextIcon },
  { name: 'Search', href: '/search', icon: MagnifyingGlassIcon },
  { name: 'Dashboard', href: '/dashboard', icon: ChartBarIcon },
];

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Get user profile from auth service (now synchronous)
  const currentUser = authService.getCurrentUser();
  
  const userName = currentUser?.username || 'User';
  const englishLevel = 'intermediate'; // Default level

  const handleSignOut = () => {
    authService.signOut();
    navigate('/');
  };

  const isCurrentPage = (href: string) => {
    if (href === '/home') {
      return location.pathname === '/home';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Mobile sidebar */}
      <div className={clsx(
        'fixed inset-0 z-50 lg:hidden',
        sidebarOpen ? 'block' : 'hidden'
      )}>
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col">
          <div className="card-elevated h-full bg-white/95 backdrop-blur-md">
            <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200/50">
              <Link to="/home" className="flex items-center space-x-2">
                <img 
                  src="/assets/logo-mark.svg" 
                  alt="DocuLaw AI" 
                  className="h-8 w-8"
                />
                <span className="text-lg font-bold gradient-text">DocuLaw AI</span>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            {/* User Profile Section */}
            <div className="p-4 border-b border-gray-200/50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-legal-600 to-purple-600 rounded-full flex items-center justify-center">
                  <UserCircleIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{userName}</p>
                  <p className="text-xs text-gray-500 capitalize">{englishLevel} Level</p>
                </div>
              </div>
            </div>
            
            <nav className="flex-1 px-4 py-4">
              <ul className="space-y-2">
                {navigation.map((item, index) => (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      className={clsx(
                        'flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-all duration-300 group',
                        isCurrentPage(item.href)
                          ? 'bg-legal-100 text-legal-700 shadow-md scale-105'
                          : 'text-gray-700 hover:bg-gray-100 hover:scale-102 hover:shadow-sm'
                      )}
                      onClick={() => setSidebarOpen(false)}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <item.icon className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform" />
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            
            {/* Settings */}
            <div className="p-4 border-t border-gray-200/50">
              <Link
                to="/settings"
                className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-all duration-300 hover:scale-102"
              >
                <Cog6ToothIcon className="h-5 w-5 mr-3" />
                Settings
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:z-40">
        <div className="flex flex-col flex-grow">
          <div className="card-elevated h-full bg-white/95 backdrop-blur-md border-r border-gray-200/50">
            <div className="flex h-16 items-center px-4 border-b border-gray-200/50">
              <Link to="/home" className="flex items-center space-x-2">
                <img 
                  src="/assets/logo-mark.svg" 
                  alt="DocuLaw AI" 
                  className="h-8 w-8"
                />
                <span className="text-lg font-bold gradient-text">DocuLaw AI</span>
              </Link>
            </div>
            
            {/* User Profile Section */}
            <div className="p-4 border-b border-gray-200/50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-legal-600 to-purple-600 rounded-full flex items-center justify-center">
                  <UserCircleIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{userName}</p>
                  <p className="text-xs text-gray-500 capitalize">{englishLevel} Level</p>
                </div>
              </div>
            </div>
            
            <nav className="flex-1 px-4 py-4">
              <ul className="space-y-2">
                {navigation.map((item, index) => (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      className={clsx(
                        'flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-all duration-300 group',
                        isCurrentPage(item.href)
                          ? 'bg-legal-100 text-legal-700 shadow-md scale-105'
                          : 'text-gray-700 hover:bg-gray-100 hover:scale-102 hover:shadow-sm'
                      )}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <item.icon className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform" />
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            
            {/* Settings */}
            <div className="p-4 border-t border-gray-200/50">
              <Link
                to="/settings"
                className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-all duration-300 hover:scale-102"
              >
                <Cog6ToothIcon className="h-5 w-5 mr-3" />
                Settings
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200/50 shadow-sm">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-500 hover:text-gray-600 lg:hidden transition-colors"
            >
              <Bars3Icon className="h-6 w-6" />
            </button>
            <div className="flex items-center space-x-4">
              <div className="hidden sm:block">
                <h1 className="text-lg font-semibold text-gray-900">
                  {navigation.find(item => isCurrentPage(item.href))?.name || 'DocuLaw AI'}
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-2 text-sm text-gray-600">
                <span>English Level:</span>
                <span className="font-medium capitalize bg-legal-100 text-legal-700 px-2 py-1 rounded-full">
                  {englishLevel}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button className="w-8 h-8 bg-gradient-to-r from-legal-600 to-purple-600 rounded-full flex items-center justify-center text-white hover:scale-110 transition-transform">
                  <UserCircleIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={handleSignOut}
                  className="hidden sm:flex items-center px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-all duration-300"
                  title="Sign Out"
                >
                  <ArrowRightOnRectangleIcon className="h-4 w-4 mr-1" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1">
          <div className="py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout; 