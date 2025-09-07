import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authService } from '../services/dataService';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  const currentUser = authService.getCurrentUser();

  if (!currentUser) {
    // If user is trying to access the root protected routes, send to landing
    if (location.pathname === '/dashboard' || location.pathname === '/home') {
      return <Navigate to="/" replace />;
    }
    // Otherwise, redirect to auth page with current location as redirect parameter
    return <Navigate to={`/auth?mode=signin&redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute; 