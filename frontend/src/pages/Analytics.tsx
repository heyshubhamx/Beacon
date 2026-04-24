import { useState, useEffect } from 'react';
import { Calendar, Filter, Download } from 'lucide-react';
import { useApi } from '../contexts/ApiContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StatisticsChart from '../components/charts/StatisticsChart';
import PieChart from '../components/charts/PieChart';
import GeoChart from '../components/charts/GeoChart';
import HeatmapChart from '../components/charts/HeatmapChart';
import SubscriptionHealthChart from '../components/charts/SubscriptionHealthChart';

// Import shadcn/ui components
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { cn } from '../lib/utils';
import { Input } from '../components/ui/input';

// Define types for our analytics data
interface AnalyticsData {
  dailyStats: Array<{
    date: string;
    subscriptions: number;
    notifications: number;
    clicks: number;
  }>;
  browserStats: Array<{
    name: string;
    value: number;
  }>;
  osStats: Array<{
    name: string;
    value: number;
  }>;
  deviceStats: Array<{
    name: string;
    value: number;
  }>;
  geoStats: Array<{
    name: string;
    value: number;
  }>;
  activityHeatmap: Array<{
    day: number;
    hour: number;
    value: number;
  }>;
  conversionRates: Array<{
    websiteId: string;
    domain: string;
    promptShown: number;
    subscribed: number;
    rate: number;
  }>;
  engagementMetrics: {
    totalNotifications: number;
    totalClicks: number;
    clickRate: number;
  };
}

// Add notification type
interface Notification {
  id: string;
  websiteId: string;
  title: string;
  body: string;
  timestamp: string;
  sentCount: number;
  deliveredCount: number;
  clickCount: number;
  failedCount: number;
  clickRate?: number;
}

// Add subscription type
interface Subscription {
  id: string;
  endpoint: string;
  keys: any;
  websiteId: string;
  createdAt: string;
  lastUsed: string;
  userAgent: string;
  browser: string;
  browserVersion: string;
  os: string;
  country: string;
  ip: string;
  referrer: string;
  platform: string;
  isMobile: boolean;
  sentCount: number;
  failedCount: number;
  lastSuccessfulDelivery: string;
  lastFailedDelivery: string;
  lastError: string;
}

const Analytics = () => {
  const { apiUrl, apiKey } = useApi();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [selectedWebsite, setSelectedWebsite] = useState<string>('all');
  const [websites, setWebsites] = useState<Array<{ id: string; domain: string }>>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [dataFetchComplete, setDataFetchComplete] = useState(false);

  // Fetch all data in a single useEffect to avoid UI flickering
  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true);
      try {
        // Step 1: Fetch websites for the filter dropdown
        const websitesResponse = await fetch(`${apiUrl}/websites`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (websitesResponse.ok) {
          const data = await websitesResponse.json();
          setWebsites(data || []);
        }

        // Step 2: Fetch aggregated analytics data from the optimized endpoint
        const analyticsResponse = await fetch(`${apiUrl}/analytics-data?range=${dateRange}&websiteId=${selectedWebsite}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        
        if (analyticsResponse.ok) {
          const data = await analyticsResponse.json();
          setAnalyticsData(data);
          
          // These are now handled better via AnalyticsData structure
          // but we keep the states for compatibility with existing UI sections
          if (data.notifications) setNotifications(data.notifications);
        }

        // Fetch basic notifications separately for the history table if needed, 
        // but for now, we'll focus on the charts.
        const notificationsRes = await fetch(`${apiUrl}/notifications?limit=50&websiteId=${selectedWebsite === 'all' ? '' : selectedWebsite}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (notificationsRes.ok) {
          const res = await notificationsRes.json();
          setNotifications(res.data || []);
        }

      } catch (error) {
        console.error('Error fetching analytics data:', error);
      } finally {
        setIsLoading(false);
        setDataFetchComplete(true);
      }
    };

    fetchAllData();
  }, [dateRange, selectedWebsite, apiUrl, apiKey]);

  // Calculate subscription health metrics (now from aggregated data)
  const calculateSubscriptionHealth = () => {
    if (!analyticsData) {
      return { totalSubscriptions: 0, activeSubscriptions: 0, inactiveSubscriptions: 0, failingSubscriptions: 0 };
    }
    
    const totalSubs = analyticsData.dailyStats?.reduce((sum, d) => sum + d.subscriptions, 0) || 0;
    
    return {
      totalSubscriptions: totalSubs,
      activeSubscriptions: Math.round(totalSubs * 0.85), // Approximate for now
      inactiveSubscriptions: Math.round(totalSubs * 0.1),
      failingSubscriptions: Math.round(totalSubs * 0.05)
    };
  };

  // Get subscription health metrics
  const subscriptionHealth = calculateSubscriptionHealth();

  // Render skeleton UI while loading
  if (isLoading || !dataFetchComplete) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
        
        {/* Key Metrics Skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center">
                  <Skeleton className="h-5 w-40 mb-2" />
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Activity Chart Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[400px] w-full rounded-lg" />
          </CardContent>
        </Card>
        
        {/* Heatmap Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full rounded-lg" />
          </CardContent>
        </Card>
        
        {/* Distribution Charts Skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-40 mb-2" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[300px] w-full rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold text-destructive mb-2">Failed to load analytics data</h2>
        <p className="text-muted-foreground mb-4">There was a problem retrieving your data.</p>
        <Button onClick={() => window.location.reload()}>Try Again</Button>
      </div>
    );
  }

  const handleExportData = () => {
    if (!analyticsData) return;

    // Create CSV content
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Add headers
    csvContent += "Date,Subscriptions,Notifications,Clicks\n";
    
    // Add data rows
    analyticsData.dailyStats.forEach(day => {
      csvContent += `${day.date},${day.subscriptions},${day.notifications},${day.clicks}\n`;
    });
    
    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `analytics-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    
    // Trigger download
    link.click();
    document.body.removeChild(link);
  };

  // Add notification performance section
  const renderNotificationPerformance = () => {
    if (notifications.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No notifications found for the selected filters.</p>
        </div>
      );
    }

    // Calculate additional metrics for each notification
    const enhancedNotifications = notifications.map(notification => {
      const deliveryRate = notification.sentCount > 0 
        ? ((notification.deliveredCount || 0) / notification.sentCount * 100).toFixed(1) 
        : '0.0';
      
      const clickRate = notification.deliveredCount > 0 
        ? ((notification.clickCount || 0) / notification.deliveredCount * 100).toFixed(1) 
        : '0.0';
      
      const failureRate = notification.sentCount > 0 
        ? ((notification.failedCount || 0) / notification.sentCount * 100).toFixed(1) 
        : '0.0';
      
      return {
        ...notification,
        deliveryRate: parseFloat(deliveryRate),
        clickRate: parseFloat(clickRate),
        failureRate: parseFloat(failureRate)
      };
    });

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Delivered</TableHead>
              <TableHead>Delivery %</TableHead>
              <TableHead>Clicks</TableHead>
              <TableHead>Click Rate</TableHead>
              <TableHead>Failed</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {enhancedNotifications.map((notification) => {
              // Format date
              const date = new Date(notification.timestamp);
              const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
              
              // Determine status badge
              let statusBadge;
              if (notification.failureRate > 20) {
                statusBadge = <Badge variant="destructive">Issues</Badge>;
              } else if (notification.clickRate > 10) {
                statusBadge = <Badge variant="success">Excellent</Badge>;
              } else if (notification.clickRate > 5) {
                statusBadge = <Badge variant="outline">Good</Badge>;
              } else {
                statusBadge = <Badge variant="secondary">Average</Badge>;
              }
              
              return (
                <TableRow key={notification.id}>
                  <TableCell className="font-medium">{notification.title}</TableCell>
                  <TableCell>{formattedDate}</TableCell>
                  <TableCell>{notification.sentCount || 0}</TableCell>
                  <TableCell>{notification.deliveredCount || 0}</TableCell>
                  <TableCell>{notification.deliveryRate}%</TableCell>
                  <TableCell>{notification.clickCount || 0}</TableCell>
                  <TableCell>{notification.clickRate}%</TableCell>
                  <TableCell>{notification.failedCount || 0}</TableCell>
                  <TableCell>{statusBadge}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h1 className="text-3xl font-bold mb-4 md:mb-0">Analytics Dashboard</h1>
        
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Website filter */}
          <select
            className="border rounded-md px-3 py-2 bg-background"
            value={selectedWebsite}
            onChange={(e) => setSelectedWebsite(e.target.value)}
          >
            <option value="all">All Websites</option>
            {websites.map((website) => (
              <option key={website.id} value={website.id}>{website.domain}</option>
            ))}
          </select>
          
          {/* Date range filter */}
          <select
            className="border rounded-md px-3 py-2 bg-background"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as '7d' | '30d' | '90d')}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          
          {/* Export button */}
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
            onClick={handleExportData}
          >
            <Download size={16} />
            Export
          </Button>
        </div>
      </div>
      
      {isLoading && !dataFetchComplete ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          {/* Overview cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Subscriptions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{subscriptionHealth.totalSubscriptions.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  {analyticsData?.engagementMetrics ? `${analyticsData.engagementMetrics.totalNotifications.toLocaleString()} notifications sent` : ''}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Click Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analyticsData?.engagementMetrics ? `${analyticsData.engagementMetrics.clickRate.toFixed(1)}%` : '0.0%'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {analyticsData?.engagementMetrics ? `${analyticsData.engagementMetrics.totalClicks.toLocaleString()} total clicks` : ''}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Notifications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(analyticsData?.engagementMetrics?.totalNotifications || 0).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  {dateRange === '7d' ? 'Last 7 days' : dateRange === '30d' ? 'Last 30 days' : 'Last 90 days'}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Websites</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(websites || []).length.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  {selectedWebsite !== 'all' ? 'Filtered by website' : 'Across all websites'}
                </p>
              </CardContent>
            </Card>
          </div>
          
          {/* Charts section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Subscription Health Chart */}
            <div className="col-span-1">
              <SubscriptionHealthChart 
                totalSubscriptions={subscriptionHealth.totalSubscriptions}
                activeSubscriptions={subscriptionHealth.activeSubscriptions}
                inactiveSubscriptions={subscriptionHealth.inactiveSubscriptions}
                failingSubscriptions={subscriptionHealth.failingSubscriptions}
                isLoading={isLoading}
              />
            </div>
            
            {/* Browser distribution */}
            <div className="col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Browser Distribution</CardTitle>
                  <CardDescription>User browser statistics</CardDescription>
                </CardHeader>
                <CardContent>
                  {analyticsData?.browserStats ? (
                    <PieChart data={analyticsData.browserStats} />
                  ) : (
                    <div className="flex justify-center items-center h-64">
                      <p className="text-muted-foreground">No browser data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            
            {/* OS distribution */}
            <div className="col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>OS Distribution</CardTitle>
                  <CardDescription>User operating system statistics</CardDescription>
                </CardHeader>
                <CardContent>
                  {analyticsData?.osStats ? (
                    <PieChart data={analyticsData.osStats} />
                  ) : (
                    <div className="flex justify-center items-center h-64">
                      <p className="text-muted-foreground">No OS data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
          
          {/* Activity Chart */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Activity Trends</CardTitle>
              <CardDescription>Subscriptions, notifications, and clicks over time</CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsData?.dailyStats ? (
                <StatisticsChart 
                  data={analyticsData.dailyStats.map(day => ({
                    name: day.date.split('-').slice(1).join('/'), // Format as MM/DD
                    subscriptions: day.subscriptions,
                    notifications: day.notifications,
                    clicks: day.clicks
                  }))} 
                />
              ) : (
                <div className="flex justify-center items-center h-64">
                  <p className="text-muted-foreground">No activity data available</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Activity Heatmap */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Notification Activity by Time</CardTitle>
              <CardDescription>When notifications are most frequently sent and interacted with</CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsData?.activityHeatmap ? (
                <HeatmapChart data={analyticsData.activityHeatmap} />
              ) : (
                <div className="flex justify-center items-center h-64">
                  <p className="text-muted-foreground">No activity heatmap data available</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Device and Geographic Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Device Type</CardTitle>
                <CardDescription>Device usage of subscribers</CardDescription>
              </CardHeader>
              <CardContent>
                {analyticsData?.deviceStats ? (
                  <PieChart 
                    data={analyticsData.deviceStats} 
                    colors={['#FF9F40', '#4BC0C0', '#FFCD56']}
                  />
                ) : (
                  <div className="flex justify-center items-center h-64">
                    <p className="text-muted-foreground">No device data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Geographic Distribution</CardTitle>
                <CardDescription>Top countries by number of subscribers</CardDescription>
              </CardHeader>
              <CardContent>
                {analyticsData?.geoStats ? (
                  <GeoChart data={analyticsData.geoStats} color="#8884d8" />
                ) : (
                  <div className="flex justify-center items-center h-64">
                    <p className="text-muted-foreground">No geographic data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Conversion Table */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Conversion Metrics by Website</CardTitle>
              <CardDescription>How effectively each website converts visitors to subscribers</CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsData?.conversionRates && analyticsData.conversionRates.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Website</TableHead>
                        <TableHead>Prompt Shown</TableHead>
                        <TableHead>Subscribed</TableHead>
                        <TableHead>Conversion Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analyticsData.conversionRates.map((site) => (
                        <TableRow key={site.websiteId}>
                          <TableCell className="font-medium">{site.domain}</TableCell>
                          <TableCell>{site.promptShown}</TableCell>
                          <TableCell>{site.subscribed}</TableCell>
                          <TableCell>
                            <Badge variant={site.rate >= 30 ? "success" : (site.rate >= 15 ? "default" : "secondary")}>
                              {site.rate.toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex justify-center items-center h-32">
                  <p className="text-muted-foreground">No conversion data available</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Notification Performance */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Notification Performance</CardTitle>
              <CardDescription>Delivery and engagement metrics for your push notifications</CardDescription>
            </CardHeader>
            <CardContent>
              {renderNotificationPerformance()}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default Analytics; 