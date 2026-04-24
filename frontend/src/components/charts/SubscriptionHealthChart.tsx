import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';

interface SubscriptionHealthProps {
  totalSubscriptions: number;
  activeSubscriptions: number;
  inactiveSubscriptions: number;
  failingSubscriptions: number;
  isLoading?: boolean;
}

const SubscriptionHealthChart: React.FC<SubscriptionHealthProps> = ({
  totalSubscriptions,
  activeSubscriptions,
  inactiveSubscriptions,
  failingSubscriptions,
  isLoading = false
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle><Skeleton className="h-6 w-48" /></CardTitle>
          <CardDescription><Skeleton className="h-4 w-32" /></CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate percentages
  const activePercent = totalSubscriptions > 0 ? (activeSubscriptions / totalSubscriptions * 100) : 0;
  const inactivePercent = totalSubscriptions > 0 ? (inactiveSubscriptions / totalSubscriptions * 100) : 0;
  const failingPercent = totalSubscriptions > 0 ? (failingSubscriptions / totalSubscriptions * 100) : 0;
  const healthyPercent = totalSubscriptions > 0 ? (100 - failingPercent) : 0;

  // Determine overall health status
  let healthStatus = 'Excellent';
  let healthVariant = 'success';
  
  if (failingPercent > 25) {
    healthStatus = 'Poor';
    healthVariant = 'destructive';
  } else if (failingPercent > 10) {
    healthStatus = 'Fair';
    healthVariant = 'warning';
  } else if (failingPercent > 5) {
    healthStatus = 'Good';
    healthVariant = 'default';
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Subscription Health</span>
          <Badge variant={healthVariant as any}>{healthStatus}</Badge>
        </CardTitle>
        <CardDescription>
          {totalSubscriptions.toLocaleString()} total subscriptions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium">Active Subscriptions</span>
              <span className="text-sm font-medium">{activePercent.toFixed(1)}%</span>
            </div>
            <Progress value={activePercent} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {activeSubscriptions.toLocaleString()} subscriptions used in the last 30 days
            </p>
          </div>
          
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium">Inactive Subscriptions</span>
              <span className="text-sm font-medium">{inactivePercent.toFixed(1)}%</span>
            </div>
            <Progress value={inactivePercent} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {inactiveSubscriptions.toLocaleString()} subscriptions with no activity in 30+ days
            </p>
          </div>
          
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium">Failing Subscriptions</span>
              <span className="text-sm font-medium">{failingPercent.toFixed(1)}%</span>
            </div>
            <Progress value={failingPercent} className="h-2" variant="destructive" />
            <p className="text-xs text-muted-foreground mt-1">
              {failingSubscriptions.toLocaleString()} subscriptions with delivery failures
            </p>
          </div>
          
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium">Overall Health</span>
              <span className="text-sm font-medium">{healthyPercent.toFixed(1)}%</span>
            </div>
            <Progress value={healthyPercent} className="h-2" variant={healthVariant === 'destructive' ? 'destructive' : 'default'} />
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          Based on delivery success rates and subscription activity over the last 30 days.
        </p>
      </CardFooter>
    </Card>
  );
};

export default SubscriptionHealthChart; 