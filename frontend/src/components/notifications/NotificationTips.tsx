import React from 'react';
import { Image, Link2, AlertCircle } from 'lucide-react';

const NotificationTips: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <Image className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium">Images</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Adding images makes notifications more engaging. Use high-quality, properly sized images for best results.
          </p>
        </div>
      </div>

      <div className="flex items-start">
        <div className="flex-shrink-0">
          <Link2 className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium">Action URL</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a URL where users will be directed when they click on your notification.
          </p>
        </div>
      </div>

      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertCircle className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium">Best Practices</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep titles under 50 characters and messages under 125 characters for optimal display on all devices.
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotificationTips; 