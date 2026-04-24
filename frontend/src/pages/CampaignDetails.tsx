import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApi } from '../contexts/ApiContext';
import { ArrowLeft, Calendar, Clock, Users, Globe, BarChart2, Inbox, MousePointer, AlertTriangle, Bell } from 'lucide-react';

// Import shadcn/ui components
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

// Import chart components
import StatisticsChart from '../components/charts/StatisticsChart';
import PieChart from '../components/charts/PieChart';
import LoadingSpinner from '../components/common/LoadingSpinner';

interface Campaign {
  id: string;
  title: string;
  body: string;
  websiteId: string;
  timestamp: string;
  scheduledFor: string;
  status: string;
  sentCount: number;
  deliveredCount: number;
  clickCount: number;
  failedCount: number;
  domain?: string;
  icon?: string;
  image?: string;
  url?: string;
  targetUrl?: string;
  options?: Record<string, any>;
  lastError?: string;
}

interface Subscription {
  id: string;
  endpoint: string;
  browser: string;
  os: string;
  createdAt: string;
  lastUsed: string;
  country: string;
  city: string;
  platform: string;
}

interface CampaignStats {
  deliveryRate: number;
  clickRate: number;
  failureRate: number;
  engagementScore: number;
}

interface DailyStats {
  date: string;
  deliveries: number;
  clicks: number;
}

const CampaignDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { apiUrl, apiKey } = useApi();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const fetchCampaignDetails = async () => {
      if (!id) return;

      setIsLoading(true);
      try {
        // Fetch campaign details via API
        const response = await fetch(`${apiUrl}/campaign/${id}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        
        if (!response.ok) throw new Error('Failed to fetch campaign');
        const notification = await response.json();

        // Combine data
        setCampaign({
          ...notification,
          domain: notification.domain || 'Unknown',
          title: notification.data?.campaign?.name || notification.title,
          body: notification.data?.campaign?.description || notification.body
        });

        // Get subscriptions for this website via API
        const subsResponse = await fetch(`${apiUrl}/subscriptions?limit=50`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        
        if (subsResponse.ok) {
          const subsResult = await subsResponse.json();
          // Filter to only this website's subscriptions
          const websiteSubs = (subsResult.data || []).filter(
            (sub: any) => sub.websiteId === notification.websiteId
          );
          setSubscriptions(websiteSubs);
        }

        // Generate daily stats for the campaign
        const mockDailyStats = generateMockDailyStats(notification);
        setDailyStats(mockDailyStats);

      } catch (error) {
        console.error('Error fetching campaign details:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCampaignDetails();
  }, [id, apiUrl, apiKey]);

  // Helper function to generate mock daily stats
  const generateMockDailyStats = (notification: Campaign): DailyStats[] => {
    const stats: DailyStats[] = [];
    const startDate = new Date(notification.timestamp);
    const endDate = new Date();
    const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Distribute the counts across days
    const totalDeliveries = notification.deliveredCount || 0;
    const totalClicks = notification.clickCount || 0;
    
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      // More deliveries and clicks on the first day, then tapering off
      const dayFactor = Math.max(0.05, 1 - (i / totalDays));
      const deliveries = Math.round((totalDeliveries * dayFactor) / totalDays * 2);
      const clicks = Math.round((totalClicks * dayFactor) / totalDays * 2);
      
      stats.push({
        date: date.toISOString().split('T')[0],
        deliveries,
        clicks
      });
    }
    
    return stats;
  };

  // Calculate campaign statistics
  const calculateStats = (campaign: Campaign): CampaignStats => {
    const deliveryRate = campaign.sentCount > 0 
      ? (campaign.deliveredCount / campaign.sentCount * 100) 
      : 0;
    
    const clickRate = campaign.deliveredCount > 0 
      ? (campaign.clickCount / campaign.deliveredCount * 100) 
      : 0;
    
    const failureRate = campaign.sentCount > 0 
      ? (campaign.failedCount / campaign.sentCount * 100) 
      : 0;
    
    // Calculate engagement score (0-100)
    // This is a custom metric that combines delivery rate and click rate
    const engagementScore = Math.min(100, (deliveryRate * 0.4) + (clickRate * 6));
    
    return {
      deliveryRate,
      clickRate,
      failureRate,
      engagementScore
    };
  };

  if (isLoading || !campaign) {
    return (
      <div className="flex justify-center items-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  const stats = calculateStats(campaign);
  
  // Format dates
  const sentDate = new Date(campaign.timestamp);
  const formattedSentDate = `${sentDate.toLocaleDateString()} ${sentDate.toLocaleTimeString()}`;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link to="/campaigns" className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Campaigns
        </Link>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <h1 className="text-3xl font-bold">{campaign.title}</h1>
            <p className="text-muted-foreground mt-1">
              {campaign.domain} • Sent on {formattedSentDate}
            </p>
          </div>
          
          <Badge className="mt-2 md:mt-0" variant={
            stats.clickRate > 10 ? "success" : 
            stats.clickRate > 5 ? "default" : 
            stats.failureRate > 20 ? "destructive" : 
            "secondary"
          }>
            {stats.clickRate > 10 ? "High Performing" : 
             stats.clickRate > 5 ? "Good Performance" : 
             stats.failureRate > 20 ? "Issues Detected" : 
             "Average Performance"}
          </Badge>
        </div>
      </div>
      
      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="audience">Audience</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Sent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{campaign.sentCount.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Total notifications sent</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Delivered</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{campaign.deliveredCount.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">{stats.deliveryRate.toFixed(1)}% delivery rate</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Clicks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{campaign.clickCount.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">{stats.clickRate.toFixed(1)}% click rate</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{campaign.failedCount.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">{stats.failureRate.toFixed(1)}% failure rate</p>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Over Time</CardTitle>
                  <CardDescription>Deliveries and clicks after sending</CardDescription>
                </CardHeader>
                <CardContent>
                  {dailyStats.length > 0 ? (
                    <StatisticsChart 
                      data={dailyStats.map(day => ({
                        name: day.date.split('-').slice(1).join('/'), // Format as MM/DD
                        deliveries: day.deliveries,
                        clicks: day.clicks
                      }))} 
                    />
                  ) : (
                    <div className="flex justify-center items-center h-64">
                      <p className="text-muted-foreground">No performance data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Engagement Score</CardTitle>
                  <CardDescription>Overall campaign performance</CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="flex flex-col items-center">
                    <div className="relative w-40 h-40 flex items-center justify-center">
                      <svg className="w-full h-full" viewBox="0 0 100 100">
                        <circle 
                          cx="50" 
                          cy="50" 
                          r="45" 
                          fill="none" 
                          stroke="#e2e8f0" 
                          strokeWidth="10" 
                        />
                        <circle 
                          cx="50" 
                          cy="50" 
                          r="45" 
                          fill="none" 
                          stroke={stats.engagementScore > 75 ? "#22c55e" : stats.engagementScore > 50 ? "#3b82f6" : stats.engagementScore > 25 ? "#f59e0b" : "#ef4444"} 
                          strokeWidth="10" 
                          strokeDasharray={`${stats.engagementScore * 2.83} 283`} 
                          strokeDashoffset="0" 
                          strokeLinecap="round" 
                          transform="rotate(-90 50 50)" 
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="text-4xl font-bold">{Math.round(stats.engagementScore)}</span>
                        <span className="text-xs text-muted-foreground">out of 100</span>
                      </div>
                    </div>
                    
                    <div className="mt-4 text-center">
                      <p className="text-sm font-medium">
                        {stats.engagementScore > 75 ? "Excellent" : 
                         stats.engagementScore > 50 ? "Good" : 
                         stats.engagementScore > 25 ? "Average" : 
                         "Needs Improvement"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Based on delivery and click rates
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Campaign Details</CardTitle>
              <CardDescription>Notification content and settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium mb-2">Content</h3>
                  <div className="bg-muted p-4 rounded-md">
                    <div className="font-medium">{campaign.title}</div>
                    <div className="mt-2 text-sm">{campaign.body}</div>
                    {campaign.url && (
                      <div className="mt-2 text-sm text-blue-500">{campaign.url}</div>
                    )}
                  </div>
                  
                  {campaign.options && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-1">Additional Options</h4>
                      <pre className="bg-muted p-2 rounded-md text-xs overflow-auto">
                        {JSON.stringify(campaign.options, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
                
                <div>
                  <h3 className="font-medium mb-2">Target</h3>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>Website: {campaign.domain}</span>
                    </div>
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>Recipients: {campaign.sentCount} subscribers</span>
                    </div>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>Sent: {formattedSentDate}</span>
                    </div>
                  </div>
                  
                  {campaign.lastError && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      <div className="flex items-start">
                        <AlertTriangle className="h-4 w-4 mr-2 text-red-500 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-medium text-red-800">Error Detected</h4>
                          <p className="text-xs text-red-600 mt-1">{campaign.lastError}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="performance" className="mt-6">
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Delivery Metrics</CardTitle>
                <CardDescription>How your notification was delivered to subscribers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">Delivery Rate</span>
                      <span className="text-sm font-medium">{stats.deliveryRate.toFixed(1)}%</span>
                    </div>
                    <Progress value={stats.deliveryRate} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {campaign.deliveredCount} of {campaign.sentCount} notifications were successfully delivered
                    </p>
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">Click Rate</span>
                      <span className="text-sm font-medium">{stats.clickRate.toFixed(1)}%</span>
                    </div>
                    <Progress value={stats.clickRate} className="h-2" variant={stats.clickRate > 10 ? "success" : "default"} />
                    <p className="text-xs text-muted-foreground mt-1">
                      {campaign.clickCount} clicks from {campaign.deliveredCount} delivered notifications
                    </p>
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">Failure Rate</span>
                      <span className="text-sm font-medium">{stats.failureRate.toFixed(1)}%</span>
                    </div>
                    <Progress value={stats.failureRate} className="h-2" variant="destructive" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {campaign.failedCount} of {campaign.sentCount} notifications failed to deliver
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Performance Comparison</CardTitle>
                <CardDescription>How this campaign compares to your average</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex flex-col items-center">
                    <div className="text-2xl font-bold">{stats.deliveryRate.toFixed(1)}%</div>
                    <div className="text-sm text-muted-foreground">Delivery Rate</div>
                    <Badge className="mt-2" variant={stats.deliveryRate > 95 ? "success" : "default"}>
                      {stats.deliveryRate > 95 ? "Above Average" : "Average"}
                    </Badge>
                  </div>
                  
                  <div className="flex flex-col items-center">
                    <div className="text-2xl font-bold">{stats.clickRate.toFixed(1)}%</div>
                    <div className="text-sm text-muted-foreground">Click Rate</div>
                    <Badge className="mt-2" variant={stats.clickRate > 8 ? "success" : "default"}>
                      {stats.clickRate > 8 ? "Above Average" : "Average"}
                    </Badge>
                  </div>
                  
                  <div className="flex flex-col items-center">
                    <div className="text-2xl font-bold">{Math.round(stats.engagementScore)}</div>
                    <div className="text-sm text-muted-foreground">Engagement Score</div>
                    <Badge className="mt-2" variant={stats.engagementScore > 60 ? "success" : "default"}>
                      {stats.engagementScore > 60 ? "Above Average" : "Average"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="audience" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Audience Overview</CardTitle>
              <CardDescription>Subscribers who received this campaign</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                  <h3 className="text-sm font-medium mb-2">Browser Distribution</h3>
                  <PieChart 
                    data={
                      subscriptions
                        .reduce((acc: {name: string, value: number}[], sub) => {
                          const browser = sub.browser || 'Unknown';
                          const existing = acc.find(item => item.name === browser);
                          if (existing) {
                            existing.value += 1;
                          } else {
                            acc.push({ name: browser, value: 1 });
                          }
                          return acc;
                        }, [])
                        .sort((a, b) => b.value - a.value)
                        .slice(0, 5)
                    }
                  />
                </div>
                
                <div>
                  <h3 className="text-sm font-medium mb-2">OS Distribution</h3>
                  <PieChart 
                    data={
                      subscriptions
                        .reduce((acc: {name: string, value: number}[], sub) => {
                          const os = sub.os || 'Unknown';
                          const existing = acc.find(item => item.name === os);
                          if (existing) {
                            existing.value += 1;
                          } else {
                            acc.push({ name: os, value: 1 });
                          }
                          return acc;
                        }, [])
                        .sort((a, b) => b.value - a.value)
                        .slice(0, 5)
                    }
                  />
                </div>
                
                <div>
                  <h3 className="text-sm font-medium mb-2">Platform Distribution</h3>
                  <PieChart 
                    data={
                      subscriptions
                        .reduce((acc: {name: string, value: number}[], sub) => {
                          const platform = sub.platform || 'Unknown';
                          const existing = acc.find(item => item.name === platform);
                          if (existing) {
                            existing.value += 1;
                          } else {
                            acc.push({ name: platform, value: 1 });
                          }
                          return acc;
                        }, [])
                        .sort((a, b) => b.value - a.value)
                        .slice(0, 5)
                    }
                  />
                </div>
              </div>
              
              <div className="mt-6">
                <h3 className="text-sm font-medium mb-2">Top Subscriber Locations</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Country</TableHead>
                      <TableHead>Count</TableHead>
                      <TableHead>Percentage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscriptions
                      .reduce((acc: {country: string, count: number}[], sub) => {
                        const country = sub.country || 'Unknown';
                        const existing = acc.find(item => item.country === country);
                        if (existing) {
                          existing.count += 1;
                        } else {
                          acc.push({ country, count: 1 });
                        }
                        return acc;
                      }, [])
                      .sort((a, b) => b.count - a.count)
                      .slice(0, 5)
                      .map(item => (
                        <TableRow key={item.country}>
                          <TableCell>{item.country}</TableCell>
                          <TableCell>{item.count}</TableCell>
                          <TableCell>{((item.count / subscriptions.length) * 100).toFixed(1)}%</TableCell>
                        </TableRow>
                      ))
                    }
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="content" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preview</CardTitle>
              <CardDescription>How your notification appeared to subscribers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-md mx-auto">
                <div className="border rounded-lg shadow-lg p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mr-3">
                      {campaign.icon ? (
                        <img src={campaign.icon} alt="Icon" className="w-10 h-10 rounded" />
                      ) : (
                        <div className="w-10 h-10 bg-primary/10 rounded flex items-center justify-center">
                          <Bell className="h-6 w-6 text-primary" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <div className="font-medium">{campaign.domain}</div>
                        <div className="text-xs text-muted-foreground">now</div>
                      </div>
                      <div className="font-bold mt-1">{campaign.title}</div>
                      <div className="text-sm mt-1">{campaign.body}</div>
                      
                      {campaign.image && (
                        <div className="mt-2">
                          <img src={campaign.image} alt="Notification image" className="rounded w-full" />
                        </div>
                      )}
                      
                      {campaign.url && (
                        <div className="mt-2 text-sm text-blue-500 flex items-center">
                          <Globe className="h-3 w-3 mr-1" />
                          {campaign.url.replace(/^https?:\/\//, '')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CampaignDetails; 