import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Bell, ExternalLink } from 'lucide-react';
import { useApi } from '../contexts/ApiContext';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Button from '../components/common/Button';

const Register = () => {
  const { apiUrl } = useApi();
  const navigate = useNavigate();
  
  const [domain, setDomain] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerResponse, setRegisterResponse] = useState<{
    success?: boolean;
    websiteId?: string;
    message?: string;
    error?: string;
  } | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegistering(true);
    
    try {
      const response = await fetch(`${apiUrl}/add-website`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ domain })
      });
      
      const data = await response.json();
      setRegisterResponse(data);
      
      if (data.success) {
        toast.success('Website registered successfully!');
        // Automatically redirect to website details page after 1.5 seconds
        setTimeout(() => {
          navigate(`/domains/${data.websiteId}`);
        }, 1500);
      } else {
        toast.error(data.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Failed to register website. Please try again.');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleViewWebsiteDetails = () => {
    if (registerResponse && registerResponse.websiteId) {
      navigate(`/domains/${registerResponse.websiteId}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
            <Bell className="h-6 w-6 text-indigo-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Beacon Dashboard
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Register your website for web push notifications
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <Card>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Register a New Website</h3>
                <form onSubmit={handleRegister} className="mt-4">
                  <Input
                    label="Domain"
                    type="text"
                    placeholder="example.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    required
                  />
                  <Button 
                    type="submit" 
                    className="w-full mt-4"
                    isLoading={isRegistering}
                    disabled={isRegistering || !domain}
                  >
                    Register Website
                  </Button>
                </form>
              </div>

              {registerResponse && registerResponse.websiteId && (
                <div className="p-4 bg-green-50 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-green-800">Registration successful</h3>
                      <div className="mt-2 text-sm text-green-700">
                        <p>Your Website ID: <span className="font-mono font-bold">{registerResponse.websiteId}</span></p>
                        <p className="mt-1">Redirecting to website details...</p>
                        <Button 
                          onClick={handleViewWebsiteDetails}
                          className="mt-3 flex items-center"
                          variant="outline"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Website Details
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or</span>
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Already have an API key?
                </p>
                <Link 
                  to="/login" 
                  className="mt-2 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
                >
                  Log In
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Register;