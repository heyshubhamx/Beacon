import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Send, Users, Bell, Settings, RefreshCw, Globe, Download, Copy, Check, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApi } from '../contexts/ApiContext';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { cn } from '../lib/utils';

// Use the current origin for generating integration snippets
const API_URL = window.location.origin;

interface WebsiteDetails {
  id: string;
  domain: string;
  createdAt: string;
  active: boolean;
  subscriptionCount: number;
}

interface WebsiteStats {
  browsers: Record<string, number>;
  platforms: Record<string, number>;
  countries: Record<string, number>;
  os: Record<string, number>;
  devices: Record<string, number>;
  activity: {
    activeLastWeek: number;
    activeLastMonth: number;
    totalActive: number;
  };
  notifications: {
    total: number;
    successful: number;
    failed: number;
  };
  activeSubscriptions: number;
  lastNotification: string;
  generatedAt: string;
}

interface PromptMetrics {
  impressions: number;
  allowed: number;
  later: number;
  conversionRate: number;
}

const WebsiteDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const { apiUrl, apiKey } = useApi();
  const [website, setWebsite] = useState<WebsiteDetails | null>(null);
  const [stats, setStats] = useState<WebsiteStats | null>(null);
  const [promptMetrics, setPromptMetrics] = useState<PromptMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [copiedSDK, setCopiedSDK] = useState(false);
  const [copiedSW, setCopiedSW] = useState(false);

  useEffect(() => {
    const fetchWebsiteDetails = async () => {
      setIsLoading(true);
      
      try {
        // Fetch website details
        const detailsResponse = await fetch(`${apiUrl}/website/${id}`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        });
        
        if (!detailsResponse.ok) {
          throw new Error('Failed to fetch website details');
        }
        
        const websiteData = await detailsResponse.json();
        setWebsite(websiteData);
        
        // Fetch website stats
        const statsResponse = await fetch(`${apiUrl}/website/${id}/stats`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        });
        
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData);
        }
        
        // Fetch prompt metrics
        const metricsResponse = await fetch(`${apiUrl}/website/${id}/prompt-metrics`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        });
        
        if (metricsResponse.ok) {
          const metricsData = await metricsResponse.json();
          setPromptMetrics(metricsData);
        }
      } catch (error) {
        console.error('Error fetching website data:', error);
        toast.error('Failed to load website data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchWebsiteDetails();
    }
  }, [id, apiUrl, apiKey]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      // Refetch website stats
      const statsResponse = await fetch(`${apiUrl}/website/${id}/stats`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }
      
      // Refetch prompt metrics
      const metricsResponse = await fetch(`${apiUrl}/website/${id}/prompt-metrics`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        setPromptMetrics(metricsData);
      }
      
      toast.success('Statistics refreshed successfully');
    } catch (error) {
      console.error('Error refreshing stats:', error);
      toast.error('Failed to refresh statistics. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!website) return;
    
    try {
      const response = await fetch(`${apiUrl}/website/${id}/toggle-status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to toggle website status');
      }
      
      const data = await response.json();
      setWebsite({ ...website, active: data.active });
      
      toast.success(`Website ${data.active ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      console.error('Error toggling website status:', error);
      toast.error('Failed to update website status. Please try again.');
    }
  };

  // Copy text to clipboard
  const copyToClipboard = (text: string, type: 'sdk' | 'sw') => {
    navigator.clipboard.writeText(text);
    if (type === 'sdk') {
      setCopiedSDK(true);
      setTimeout(() => setCopiedSDK(false), 2000);
    } else {
      setCopiedSW(true);
      setTimeout(() => setCopiedSW(false), 2000);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!website) {
    return (
      <div className="bg-red-50 p-4 rounded-md">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Website not found</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>The website you're looking for doesn't exist or you don't have access to it.</p>
              <Link to="/domains" className="block mt-2 text-sm font-medium text-red-800 underline">
                Back to websites
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center">
          <Link to="/domains" className="mr-2 text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{website.domain}</h1>
            <p className="mt-1 text-sm text-gray-500">
              Website ID: <span className="font-mono">{website.id}</span>
            </p>
          </div>
        </div>
        <div className="mt-4 sm:mt-0 flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            isLoading={isRefreshing}
            disabled={isRefreshing}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Stats
          </Button>
          <Link to={`/prompt-editor/${website.id}`}>
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Edit Prompt
            </Button>
          </Link>
          <Link to="/send-notification">
            <Button>
              <Send className="h-4 w-4 mr-2" />
              Send Notification
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <span
          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
            website.active
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {website.active ? 'Active' : 'Inactive'}
        </span>
        <button
          onClick={handleToggleStatus}
          className="text-sm text-indigo-600 hover:text-indigo-900 font-medium"
        >
          {website.active ? 'Deactivate' : 'Activate'} Website
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="transform transition-all hover:scale-105">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-indigo-50">
              <Users className="h-6 w-6 text-indigo-500" />
            </div>
            <div className="ml-5">
              <p className="text-sm font-medium text-gray-500">Total Subscribers</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">
                {website.subscriptionCount || 0}
              </p>
            </div>
          </div>
        </Card>
        
        <Card className="transform transition-all hover:scale-105">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-50">
              <Bell className="h-6 w-6 text-purple-500" />
            </div>
            <div className="ml-5">
              <p className="text-sm font-medium text-gray-500">Notifications Sent</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">
                {stats?.notifications?.total || 0}
              </p>
            </div>
          </div>
        </Card>
        
        <Card className="transform transition-all hover:scale-105">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-50">
              <Globe className="h-6 w-6 text-green-500" />
            </div>
            <div className="ml-5">
              <p className="text-sm font-medium text-gray-500">Active Devices</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">
                {stats?.activity?.activeLastWeek || 0}
              </p>
              <p className="text-xs text-gray-500">
                Last 7 days
              </p>
            </div>
          </div>
        </Card>
      </div>
      
      {/* Prompt Metrics */}
      <Card title="Prompt Performance">
        <div className="p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Prompt Performance</h3>
          
          {promptMetrics ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-blue-700">Impressions</p>
                <p className="mt-1 text-2xl font-semibold text-blue-900">{promptMetrics.impressions}</p>
                <p className="text-xs text-blue-600">Total times prompt shown</p>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-green-700">Allowed</p>
                <p className="mt-1 text-2xl font-semibold text-green-900">{promptMetrics.allowed}</p>
                <p className="text-xs text-green-600">Users who clicked Allow</p>
              </div>
              
              <div className="bg-amber-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-amber-700">Later</p>
                <p className="mt-1 text-2xl font-semibold text-amber-900">{promptMetrics.later}</p>
                <p className="text-xs text-amber-600">Users who clicked Later</p>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-purple-700">Conversion Rate</p>
                <p className="mt-1 text-2xl font-semibold text-purple-900">{promptMetrics.conversionRate}%</p>
                <p className="text-xs text-purple-600">Allowed ÷ Impressions</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No prompt metrics available yet
            </div>
          )}
        </div>
      </Card>

      {/* Detailed Stats */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Browser Distribution">
            <div className="h-64">
              {Object.entries(stats.browsers || {}).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(stats.browsers).map(([browser, count]) => (
                    <div key={browser}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-700">{browser}</span>
                        <span className="text-sm text-gray-500">{count}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-indigo-600 h-2 rounded-full"
                          style={{
                            width: `${(count / Math.max(...Object.values(stats.browsers))) * 100}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">No browser data available</p>
                </div>
              )}
            </div>
          </Card>

          <Card title="Platform Distribution">
            <div className="h-64">
              {Object.entries(stats.platforms || {}).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(stats.platforms).map(([platform, count]) => (
                    <div key={platform}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-700">{platform}</span>
                        <span className="text-sm text-gray-500">{count}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full"
                          style={{
                            width: `${(count / Math.max(...Object.values(stats.platforms))) * 100}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">No platform data available</p>
                </div>
              )}
            </div>
          </Card>

          <Card title="Geographic Distribution">
            <div className="h-64">
              {Object.entries(stats.countries || {}).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(stats.countries).map(([country, count]) => (
                    <div key={country}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-700">{country}</span>
                        <span className="text-sm text-gray-500">{count}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{
                            width: `${(count / Math.max(...Object.values(stats.countries))) * 100}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">No geographic data available</p>
                </div>
              )}
            </div>
          </Card>

          <Card title="Device Types">
            <div className="h-64">
              {Object.entries(stats.devices || {}).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(stats.devices).map(([device, count]) => (
                    <div key={device}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-700">
                          {device.charAt(0).toUpperCase() + device.slice(1)}
                        </span>
                        <span className="text-sm text-gray-500">{count}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${(count / Math.max(...Object.values(stats.devices))) * 100}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">No device data available</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Integration Code */}
      <Card title="Integration Code">
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            Add this script to your website to enable push notifications:
          </p>
          <div className="bg-gray-50 rounded-md p-4 overflow-x-auto relative">
            <button 
              onClick={() => copyToClipboard(`<script src="${API_URL}/cdn-sdk/push-sdk.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', function() {
    Beacon.init({
      websiteId: '${website?.id}',
      serviceWorkerPath: '/service-worker.js',
      autoRegister: true
    });
  });
</script>`, 'sdk')}
              className="absolute top-2 right-2 p-1 rounded-md bg-white/80 hover:bg-white border border-gray-200 shadow-sm"
              title="Copy to clipboard"
            >
              {copiedSDK ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-500" />}
            </button>
            <pre className="text-sm text-gray-800">
              {`<script src="${API_URL}/cdn-sdk/push-sdk.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', function() {
    Beacon.init({
      websiteId: '${website?.id}',
      serviceWorkerPath: '/service-worker.js',
      autoRegister: true
    });
  });
</script>`}
            </pre>
          </div>
        </div>
        
        <div>
          <p className="text-sm text-gray-600 mb-2">
            Create a service worker file at the root of your website "service-worker.js":
          </p>
          <div className="bg-gray-50 rounded-md p-4 overflow-x-auto relative">
            <button 
              onClick={() => copyToClipboard(`// Import the main service worker from Beacon
self.importScripts('${API_URL}/cdn-sdk/push-service-worker.js');

// Version number to force updates
const SW_VERSION = '1.4.0';

// Get the current domain
const currentDomain = self.location.hostname;

// You can add custom handling here if needed
console.log(\`Custom service worker initialized for \${currentDomain} (version \${SW_VERSION})\`);

// IMPORTANT: We're completely removing the push event handler and notification click handler from this file
// to prevent duplicate handling. The imported service worker will handle all push events and notification clicks.
// The comprehensive version now includes click tracking functionality.`, 'sw')}
              className="absolute top-2 right-2 p-1 rounded-md bg-white/80 hover:bg-white border border-gray-200 shadow-sm"
              title="Copy to clipboard"
            >
              {copiedSW ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-500" />}
            </button>
            <pre className="text-sm text-gray-800">
              {`// Import the main service worker from Beacon
self.importScripts('${API_URL}/cdn-sdk/push-service-worker.js');

// Version number to force updates
const SW_VERSION = '1.4.0';

// Get the current domain
const currentDomain = self.location.hostname;

// You can add custom handling here if needed
console.log(\`Custom service worker initialized for \${currentDomain} (version \${SW_VERSION})\`);

// IMPORTANT: We're completely removing the push event handler and notification click handler from this file
// to prevent duplicate handling. The imported service worker will handle all push events and notification clicks.
// The comprehensive version now includes click tracking functionality.`}
            </pre>
          </div>
          <div className="mt-3 flex">
            <a 
              href={`${apiUrl}/cdn-sdk/service-worker.js`}
              download="service-worker.js"
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Service Worker
            </a>
            <div className="ml-2 text-sm text-gray-500 flex items-center">
              Save this file to the root of your website
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default WebsiteDetailsPage;