import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SignInForm from '../components/Auth/SignInForm';
import SignUpForm from '../components/Auth/SignUpForm';
import { authService } from '../services/dataService';

const Auth: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const currentUser = await authService.getCurrentUser();
      if (currentUser) {
        navigate('/dashboard');
        return;
      }

      // Check URL params for auth mode
      const mode = searchParams.get('mode');
      if (mode === 'signup') {
        setAuthMode('signup');
      } else if (mode === 'signin') {
        setAuthMode('signin');
      }
    };
    
    checkAuth();
  }, [navigate, searchParams]);

  const handleSignInSuccess = () => {
    // Existing users go to dashboard or intended destination
    const redirectTo = searchParams.get('redirect') || '/dashboard';
    navigate(redirectTo);
  };

  const handleSignUpSuccess = () => {
    // New users go to onboarding first
    navigate('/onboarding');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-legal-50 to-blue-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="mx-auto h-16 w-16 bg-gradient-to-r from-legal-600 to-purple-600 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-xl">DL</span>
          </div>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">DocuLaw AI</h1>
          <p className="text-gray-600">Simplifying legal documents with AI</p>
        </div>

        {/* Auth Forms */}
        {authMode === 'signin' ? (
          <SignInForm
            onSuccess={handleSignInSuccess}
            onSwitchToSignUp={() => setAuthMode('signup')}
          />
        ) : (
          <SignUpForm
            onSuccess={handleSignUpSuccess}
            onSwitchToSignIn={() => setAuthMode('signin')}
          />
        )}

        {/* Additional Info */}
        <div className="mt-8 text-center">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Why DocuLaw AI?</h3>
            <div className="grid grid-cols-1 gap-3 text-sm text-gray-600">
              <div className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Simplify complex legal documents instantly
              </div>
              <div className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Ask questions and get clear explanations
              </div>
              <div className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Secure, private, and easy to use
              </div>
              <div className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Tailored to your English proficiency level
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth; 