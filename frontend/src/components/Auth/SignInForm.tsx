import React, { useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { authService } from '../../services/dataService';
import { useNavigate } from 'react-router-dom';

interface SignInFormProps {
  onSuccess: () => void;
  onSwitchToSignUp: () => void;
}

const SignInForm: React.FC<SignInFormProps> = ({ onSuccess, onSwitchToSignUp }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('demo@doculaw.ai');
  const [password, setPassword] = useState('demo123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    console.log('🔐 SignInForm: Attempting sign in...');

    try {
      const result = await authService.signIn(email, password);
      
      if (!result.success) {
        console.log('❌ SignInForm: Sign in failed:', result.error);
        setError(result.error || 'Sign in failed');
      } else {
        console.log('✅ SignInForm: Sign in successful');
        onSuccess();
      }
    } catch (err) {
      console.error('❌ SignInForm: Unexpected error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Welcome Back</h2>
          <p className="text-gray-600 mt-2">Sign in to your DocuLaw account</p>
        </div>

        {/* Demo credentials notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>🎭 Demo Mode Active</strong><br />
            Email: demo@doculaw.ai<br />
            Password: demo123
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-legal-500 focus:border-legal-500"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-legal-500 focus:border-legal-500"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                ) : (
                  <EyeIcon className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
            
            <button
              type="button"
              onClick={async () => {
                setLoading(true);
                setError(null);
                try {
                  const result = await authService.signIn('demo@doculaw.ai', 'demo123');
                  if (result.success) {
                    onSuccess();
                  } else {
                    setError(result.error || 'Demo login failed');
                  }
                } catch (err) {
                  setError('Demo login failed');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🎭 Quick Demo Login
            </button>
            
            <button
              type="button"
              onClick={async () => {
                setLoading(true);
                setError(null);
                try {
                  // First authenticate the user
                  const result = await authService.signIn('demo@doculaw.ai', 'demo123');
                  if (result.success) {
                    // Navigate directly to onboarding for the demo walkthrough
                    navigate('/onboarding?demo=true');
                  } else {
                    setError(result.error || 'Demo failed');
                  }
                } catch (err) {
                  setError('Demo failed');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 px-4 rounded-lg font-medium hover:from-green-600 hover:to-emerald-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🚀 Demo Onboarding Walkthrough
            </button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <button
              onClick={onSwitchToSignUp}
              className="text-legal-600 hover:text-legal-700 font-medium"
            >
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignInForm; 