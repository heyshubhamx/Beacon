import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Key, LogOut, Trash2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApi } from '../contexts/ApiContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const Settings = () => {
  const { apiKey, setApiKey, apiUrl, logout } = useApi();
  const navigate = useNavigate();
  
  const [showApiKey, setShowApiKey] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isCleaningSubscriptions, setIsCleaningSubscriptions] = useState(false);

  const handleResetApiKey = async () => {
    setIsResetting(true);
    
    try {
      // Call the server endpoint to generate a new API key
      const response = await fetch(`${apiUrl}/reset-api-key`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to reset API key');
      }
      
      // Get the new API key from the response
      const data = await response.json();
      const newApiKey = data.apiKey;
      
      if (!newApiKey) {
        throw new Error('No API key returned from server');
      }
      
      // Update the API key in the app state and local storage
      setApiKey(newApiKey);
      localStorage.setItem('apiKey', newApiKey);
      toast.success('API key reset successfully');
    } catch (error) {
      console.error('Error resetting API key:', error);
      toast.error('Failed to reset API key. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleCleanSubscriptions = async () => {
    setIsCleaningSubscriptions(true);
    
    try {
      const response = await fetch(`${apiUrl}/clean-expired-subscriptions`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to clean expired subscriptions');
      }
      
      const data = await response.json();
      
      toast.success(`Checked ${data.total} subscriptions, removed ${data.cleaned} invalid ones`);
    } catch (error) {
      console.error('Error cleaning subscriptions:', error);
      toast.error('Failed to clean expired subscriptions. Please try again.');
    } finally {
      setIsCleaningSubscriptions(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    toast.success('Logged out successfully');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your account and application settings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Settings</CardTitle>
          <CardDescription>Manage your application's master API key</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label 
              htmlFor="current-api-key" 
              className="text-sm font-medium text-gray-700"
            >
              Current API Key
            </label>
            <div className="flex gap-2">
              <Input
                type={showApiKey ? "text" : "password"}
                id="current-api-key"
                value={apiKey}
                readOnly
                className="font-mono bg-slate-50"
              />
              <Button
                variant="outline"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? 'Hide' : 'Show'}
              </Button>
            </div>
            <p className="text-sm text-gray-500">
              This is your master API key. Keep it secure.
            </p>
          </div>

          <div className="pt-4 border-t">
            <h3 className="text-sm font-medium text-gray-900 mb-1">
              Reset API Key
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Generate a new API key and invalidate the current one. This action cannot be undone.
            </p>
            <Button
              onClick={handleResetApiKey}
              disabled={isResetting}
              variant="destructive"
            >
              {isResetting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-inherit border-t-transparent"></span>
                  Resetting...
                </span>
              ) : (
                <>
                  <Key className="h-4 w-4 mr-2" />
                  Reset API Key
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Maintenance</CardTitle>
          <CardDescription>Perform background maintenance operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-1">
                Clean Expired Subscriptions
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                This will check and remove expired or invalid push notification subscriptions by sending silent notifications and detecting failures.
              </p>
              <Button
                onClick={handleCleanSubscriptions}
                disabled={isCleaningSubscriptions}
                variant="secondary"
              >
                {isCleaningSubscriptions ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-inherit border-t-transparent"></span>
                    Cleaning...
                  </span>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Clean Expired Subscriptions
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <p className="text-sm text-gray-500 mb-4">
              This will log you out of the current session.
            </p>
            <Button 
              onClick={handleLogout}
              variant="destructive"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;