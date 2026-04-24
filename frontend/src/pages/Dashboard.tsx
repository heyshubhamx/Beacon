import { useEffect, useState, useCallback } from 'react';
import { Users, Bell, Globe, BarChart2, MousePointer, TrendingUp, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApi } from '../contexts/ApiContext';
import { useSocket } from '../hooks/useSocket';
import StatisticsChart from '../components/charts/StatisticsChart';
import PieChart from '../components/charts/PieChart';
import LoadingSpinner from '../components/common/LoadingSpinner';

// Import shadcn/ui components
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';

interface DashboardStats {
  totalWebsites: number;
  totalSubscriptions: number;
  totalNotifications: number;
  totalClicks: number;
  clickRate: number;
  recentActivity: Array<{
    name: string;
    subscriptions: number;
    notifications: number;
    deliveries: number;
    clicks: number;
  }>;
  browserDistribution: Array<{
    name: string;
    value: number;
  }>;
  notificationPerformance: Array<{
    title: string;
    sent: number;
    delivered: number;
    clicks: number;
    clickRate: number;
  }>;
}

const statCards = [
  {
    key: 'totalWebsites',
    label: 'Total Websites',
    icon: Globe,
    gradient: 'from-blue-500 to-cyan-500',
    bgGlow: 'bg-blue-500/10',
  },
  {
    key: 'totalSubscriptions',
    label: 'Total Subscribers',
    icon: Users,
    gradient: 'from-emerald-500 to-teal-500',
    bgGlow: 'bg-emerald-500/10',
  },
  {
    key: 'totalNotifications',
    label: 'Notifications Sent',
    icon: Bell,
    gradient: 'from-indigo-500 to-violet-500',
    bgGlow: 'bg-indigo-500/10',
  },
  {
    key: 'clickRate',
    label: 'Click Rate',
    icon: MousePointer,
    gradient: 'from-amber-500 to-orange-500',
    bgGlow: 'bg-amber-500/10',
    isPercent: true,
  },
];

const Dashboard = () => {
  const { apiUrl, apiKey } = useApi();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardStats = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/dashboard-stats`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        console.error('Failed to fetch dashboard stats');
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, apiKey]);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  // BUG-13 FIX: Use shared socket hook instead of creating a new connection
  useSocket('stats_update', () => {
    fetchDashboardStats();
  });

  if (isLoading) return <LoadingSpinner />;

  if (!stats) return (
    <div className="flex flex-col items-center justify-center py-20">
      <h2 className="text-xl font-semibold text-destructive mb-2">Failed to load dashboard</h2>
      <p className="text-muted-foreground mb-4">There was a problem retrieving your data.</p>
      <Button onClick={() => window.location.reload()}>Try Again</Button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Key metrics and performance at a glance
          </p>
        </div>
        <Link to="/analytics">
          <Button variant="outline" size="sm">
            <BarChart2 className="h-4 w-4 mr-2" />
            Analytics
          </Button>
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          const value = card.isPercent 
            ? `${(stats[card.key as keyof DashboardStats] as number).toFixed(1)}%`
            : (stats[card.key as keyof DashboardStats] as number);
          
          return (
            <Card key={card.key} className="relative overflow-hidden">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{card.label}</p>
                    <p className="text-xl sm:text-2xl font-bold mt-1">{value}</p>
                  </div>
                  <div className={cn("p-2 sm:p-2.5 rounded-xl flex-shrink-0", card.bgGlow)}>
                    <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5 bg-gradient-to-r bg-clip-text", card.gradient)} style={{ color: 'var(--primary)' }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Activity Overview</CardTitle>
            <CardDescription>Weekly trend of subscriptions and notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <StatisticsChart data={stats.recentActivity} />
          </CardContent>
          <CardFooter className="pt-0 justify-center">
            <Link to="/analytics" className="text-xs text-primary hover:text-primary/80 inline-flex items-center gap-1">
              View detailed trends
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Browser Distribution</CardTitle>
            <CardDescription>Subscriber browser usage breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <PieChart data={stats.browserDistribution} />
          </CardContent>
          <CardFooter className="pt-0 justify-center">
            <Link to="/analytics" className="text-xs text-primary hover:text-primary/80 inline-flex items-center gap-1">
              View device analytics
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardFooter>
        </Card>
      </div>
      
      {/* Notification Performance Table */}
      {stats.notificationPerformance && stats.notificationPerformance.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Notifications</CardTitle>
            <CardDescription>Delivery and engagement metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-6 px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Notification</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Delivered</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Clicks</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.notificationPerformance.map((notification, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium max-w-[200px] truncate">{notification.title}</TableCell>
                      <TableCell className="text-right tabular-nums">{notification.sent}</TableCell>
                      <TableCell className="text-right tabular-nums hidden sm:table-cell">{notification.delivered}</TableCell>
                      <TableCell className="text-right tabular-nums hidden sm:table-cell">{notification.clicks}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={notification.clickRate >= 5 ? "default" : "secondary"} className="text-xs">
                          {notification.clickRate.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          <CardFooter className="pt-0 justify-center">
            <Link to="/notifications" className="text-xs text-primary hover:text-primary/80 inline-flex items-center gap-1">
              View all notifications
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardFooter>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;