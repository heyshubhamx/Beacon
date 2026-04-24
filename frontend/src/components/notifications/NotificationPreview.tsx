import React from 'react';
import { Bell, Globe } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

interface NotificationPayload {
  title: string;
  options: {
    body: string;
    icon?: string;
    image?: string;
    badge?: string;
    vibrate?: number[];
    data?: {
      url?: string;
      [key: string]: any;
    };
    actions?: {
      action: string;
      title: string;
      icon?: string;
    }[];
  };
}

interface NotificationPreviewProps {
  notification: NotificationPayload;
}

const NotificationPreview: React.FC<NotificationPreviewProps> = ({
  notification
}) => {
  const { title, options } = notification;
  const { body, icon, image, actions, data } = options;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preview</CardTitle>
        <CardDescription>How your notification will appear to users</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="bg-muted/50 p-4 rounded-lg">
          <div className="bg-background rounded-md shadow-sm overflow-hidden">
            <div className="p-4">
              <div className="flex items-start">
                {icon ? (
                  <img
                    src={icon}
                    alt="Icon"
                    className="h-10 w-10 rounded mr-3"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/48?text=Icon';
                    }}
                  />
                ) : (
                  <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center mr-3">
                    <Bell className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">
                      {title || 'Notification Title'}
                    </p>
                    <p className="text-xs text-muted-foreground">now</p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {body || 'Notification message will appear here'}
                  </p>
                  
                  {data?.url && (
                    <div className="mt-2 text-xs text-blue-500 flex items-center">
                      <Globe className="h-3 w-3 mr-1" />
                      {data.url.replace(/^https?:\/\//, '')}
                    </div>
                  )}
                </div>
              </div>

              {image && (
                <div className="mt-3">
                  <img
                    src={image}
                    alt="Notification"
                    className="w-full h-32 object-cover rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x200?text=Image';
                    }}
                  />
                </div>
              )}

              {actions && actions.length > 0 && (
                <div className="mt-3 flex space-x-2">
                  {actions.map((action, index) => (
                    <Badge
                      key={index}
                      variant={index === 0 ? "default" : "secondary"}
                      className="cursor-pointer"
                    >
                      {action.title}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationPreview; 