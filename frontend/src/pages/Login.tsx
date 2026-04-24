import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Zap, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useApi } from '../contexts/ApiContext';

const Login = () => {
  const { authenticate, isAuthenticated } = useApi();
  const navigate = useNavigate();
  
  const [apiKey, setApiKey] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Auto-redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleAuthenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    
    try {
      const success = await authenticate(apiKey);
      if (success) {
        toast.success('Welcome back!');
        navigate('/dashboard');
      } else {
        toast.error('Invalid password. Please try again.');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      toast.error('Authentication failed. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 p-4">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent pointer-events-none" />
      
      <div className="relative w-full max-w-md">
        {/* Glow effect behind card */}
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-violet-500/20 rounded-2xl blur-xl" />
        
        <div className="relative bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="mx-auto h-14 w-14 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-4">
              <Zap className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">
              Welcome Back
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Sign in to your Beacon dashboard
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleAuthenticate} className="space-y-5">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                Dashboard Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isAuthenticating || !apiKey}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {isAuthenticating ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-slate-500">
            Beacon v2.0 • Self-Hosted Push Platform
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login; 