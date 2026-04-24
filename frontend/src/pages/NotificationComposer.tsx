import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApi } from '../contexts/ApiContext';


// Format a date object for the datetime-local input in IST timezone
const formatDateForInput = (date: Date): string => {
  // When creating a new default date for scheduling, add 30 minutes to current time
  const now = new Date();
  const dateTime = date.getTime();
  const nowTime = now.getTime();
  // If the date is less than 1 second away from current time, it's likely the default "now" value
  if (Math.abs(dateTime - nowTime) < 1000) {
    date = new Date(date.getTime() + 30 * 60000); // Add 30 minutes
  }
  
  // Get the date components
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  // Format as YYYY-MM-DDThh:mm (required format for datetime-local input)
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Import shadcn/ui components
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';

// Import custom components
import NotificationPreview from '../components/notifications/NotificationPreview';
import NotificationTips from '../components/notifications/NotificationTips';
import FormField from '../components/notifications/FormField';

interface Website {
  id: string;
  domain: string;
  active: boolean;
}

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
      campaignId?: string;
      [key: string]: any;
    };
    actions?: {
      action: string;
      title: string;
      icon?: string;
    }[];
  };
}

interface CampaignData {
  name: string;
  description?: string; // Make description optional
  scheduledFor?: string;
  isDraft: boolean;
}

const NotificationComposer = () => {
  const { id } = useParams<{ id?: string }>();
  const { apiUrl, apiKey } = useApi();
  const navigate = useNavigate();
  
  // Get the edit parameter from URL
  const location = window.location;
  const searchParams = new URLSearchParams(location.search);
  const editCampaignId = searchParams.get('edit');
  
  const [websites, setWebsites] = useState<Website[]>([]);
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string>(id || '');
  const [selectedWebsiteIds, setSelectedWebsiteIds] = useState<string[]>(id ? [id] : []);
  const [targetType, setTargetType] = useState<'single' | 'multiple' | 'all'>('single');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isEditing, setIsEditing] = useState(!!editCampaignId);
  const [showActionButtons, setShowActionButtons] = useState(false);
  
  const [notification, setNotification] = useState<NotificationPayload>({
    title: '',
    options: {
      body: '',
      icon: '',
      image: '',
      data: {
        url: '',
      },
      actions: [
        {
          action: 'view',
          title: 'View',
        },
        {
          action: 'close',
          title: 'Close',
        },
      ],
    },
  });

  const [campaign, setCampaign] = useState<CampaignData>({
    name: '',
    description: '',
    scheduledFor: '',
    isDraft: false
  });

  useEffect(() => {
    const fetchWebsites = async () => {
      setIsLoading(true);
      
      try {
        const response = await fetch(`${apiUrl}/websites`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch websites');
        }
        
        const data = await response.json();
        setWebsites(data);
        
        // Set the first website as selected if no id provided
        if (!id && data.length > 0 && !editCampaignId) {
          setSelectedWebsiteId(data[0].id);
        }
      } catch (error) {
        console.error('Error fetching websites:', error);
        toast.error('Failed to load websites. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchWebsites();
  }, [apiUrl, apiKey, id, editCampaignId]);

  // Fetch campaign data if in edit mode
  useEffect(() => {
    const fetchCampaignData = async () => {
      if (!editCampaignId) return;
      
      setIsLoading(true);
      try {
        // Get the campaign from the API
        const response = await fetch(`${apiUrl}/campaign/${editCampaignId}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        
        if (!response.ok) throw new Error('Failed to fetch campaign');
        const notificationData = await response.json();
        
        // Set website ID
        setSelectedWebsiteId(notificationData.websiteId);
        
        // Set notification data
        setNotification({
          title: notificationData.title || '',
          options: {
            body: notificationData.body || '',
            icon: notificationData.icon || '',
            image: notificationData.image || '',
            data: {
              url: notificationData.url || '',
              ...(notificationData.data || {})
            },
            actions: notificationData.data?.actions || [
              {
                action: 'view',
                title: 'View',
              },
              {
                action: 'close',
                title: 'Close',
              },
            ]
          }
        });
        
        // Set campaign data
        setCampaign({
          name: notificationData.data?.campaign?.name || notificationData.title || '',
          description: notificationData.data?.campaign?.description || notificationData.body || '',
          scheduledFor: notificationData.scheduledFor || '',
          isDraft: notificationData.status === 'draft'
        });

        // Check if there are custom action buttons
        if (notificationData.data?.actions && notificationData.data.actions.length > 0) {
          setShowActionButtons(true);
        }
        
        toast.success('Loaded campaign for editing');
      } catch (error) {
        console.error('Error loading campaign data:', error);
        toast.error('Failed to load campaign data');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchCampaignData();
  }, [editCampaignId]);

  useEffect(() => {
    // Initial setup - check if notification already has action buttons defined
    if (notification.options.actions && notification.options.actions.length > 0) {
      setShowActionButtons(true);
    }
  }, []);

  useEffect(() => {
    // Set campaign name from notification title
    if (notification.title && !campaign.name) {
      setCampaign({
        ...campaign,
        name: notification.title
      });
    }

    // Set campaign description from notification body
    if (notification.options.body && !campaign.description) {
      setCampaign({
        ...campaign,
        description: notification.options.body
      });
    }
  }, [notification.title, notification.options.body]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    
    if (name === 'title') {
      setNotification({ ...notification, title: value });
    } else if (name === 'body') {
      setNotification({
        ...notification,
        options: { ...notification.options, body: value },
      });
    } else if (name === 'icon') {
      setNotification({
        ...notification,
        options: { ...notification.options, icon: value },
      });
    } else if (name === 'image') {
      setNotification({
        ...notification,
        options: { ...notification.options, image: value },
      });
    } else if (name === 'url') {
      setNotification({
        ...notification,
        options: {
          ...notification.options,
          data: { ...notification.options.data, url: value },
        },
      });
    } else if (name === 'websiteId') {
      setSelectedWebsiteId(value);
      setSelectedWebsiteIds([value]);
    } else if (name === 'targetType') {
      setTargetType(value as 'single' | 'multiple' | 'all');
      if (value === 'all') {
        setSelectedWebsiteIds([]);
        setSelectedWebsiteId('');
      } else if (value === 'single') {
        setSelectedWebsiteIds(selectedWebsiteId ? [selectedWebsiteId] : []);
      }
    } else if (name === 'campaignName') {
      setCampaign({
        ...campaign,
        name: value
      });
    } else if (name === 'scheduledFor') {
      // Input value is in local timezone format YYYY-MM-DDThh:mm
      // Create a date object from this input
      const selectedDate = new Date(value);
      
      // Convert to ISO string to store in the database
      const isoString = selectedDate.toISOString();
      
      // Log the selected date in IST format for clarity
      const istTimeString = selectedDate.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      console.log(`User selected time: ${value}`);
      console.log(`Scheduling for: ${istTimeString} IST`);
      console.log(`Stored as ISO: ${isoString}`);
      
      setCampaign({
        ...campaign,
        scheduledFor: isoString
      });
    }
  };

  const handleDraftToggle = (checked: boolean) => {
    setCampaign({
      ...campaign,
      isDraft: checked
    });
  };

  const handleActionButtonsToggle = (checked: boolean) => {
    setShowActionButtons(checked);
    
    // If toggling off, we don't need to do anything to the notification state
    // as the buttons will be removed at send time
    
    // If toggling on and there are no actions defined, add default actions
    if (checked && (!notification.options.actions || notification.options.actions.length === 0)) {
      setNotification({
        ...notification,
        options: {
          ...notification.options,
          actions: [
            {
              action: 'view',
              title: 'View',
            },
            {
              action: 'close',
              title: 'Close',
            },
          ]
        }
      });
    }
  };

  const handleActionChange = (index: number, field: string, value: string) => {
    const updatedActions = [...(notification.options.actions || [])];
    updatedActions[index] = {
      ...updatedActions[index],
      [field]: value,
    };
    
    setNotification({
      ...notification,
      options: { ...notification.options, actions: updatedActions },
    });
  };

  const handleWebsiteToggle = (websiteId: string) => {
    if (selectedWebsiteIds.includes(websiteId)) {
      setSelectedWebsiteIds(selectedWebsiteIds.filter(id => id !== websiteId));
    } else {
      setSelectedWebsiteIds([...selectedWebsiteIds, websiteId]);
    }
  };

  const handleSelectAllWebsites = () => {
    setSelectedWebsiteIds(websites.filter(w => w.active).map(w => w.id));
  };

  const handleDeselectAllWebsites = () => {
    setSelectedWebsiteIds([]);
  };

  const handleSendNotification = async () => {
    // Validate based on target type
    if (targetType === 'single' && !selectedWebsiteId) {
      toast.error('Please select a website');
      return;
    }
    
    if (targetType === 'multiple' && selectedWebsiteIds.length === 0) {
      toast.error('Please select at least one website');
      return;
    }
    
    if (!notification.title) {
      toast.error('Notification title is required');
      return;
    }
    
    if (!notification.options.body) {
      toast.error('Notification body is required');
      return;
    }
    
    setIsSending(true);
    
    try {
      // Add campaign ID to notification data
      const campaignId = editCampaignId || `campaign_${Date.now()}`;
      
      // Create a copy of the notification that we can modify
      const notificationToSend = {
        ...notification,
        options: {
          ...notification.options,
          data: {
            ...notification.options.data,
            campaignId,
          }
        }
      };
      
      // Remove action buttons if they're disabled
      if (!showActionButtons) {
        delete notificationToSend.options.actions;
      }
      
      // Build the request body based on target type
      const requestBody = {
        targetType,
        websiteId: targetType === 'single' ? selectedWebsiteId : undefined,
        websiteIds: targetType === 'multiple' ? selectedWebsiteIds : undefined,
        notification: notificationToSend,
        campaign: {
          name: campaign.name || notification.title,
          description: notification.options.body, // Use notification body as description
          scheduledFor: campaign.scheduledFor || new Date().toISOString(),
          status: campaign.isDraft ? 'draft' : (campaign.scheduledFor && new Date(campaign.scheduledFor) > new Date() ? 'scheduled' : 'sent')
        }
      };

      // If editing, delete the old campaign first
      if (isEditing && editCampaignId) {
        try {
          await fetch(`${apiUrl}/notifications/bulk-delete`, {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ ids: [editCampaignId] })
          });
        } catch (error) {
          console.warn('Failed to delete old campaign:', error);
          // Continue anyway
        }
      }
      
      // Send notification - use appropriate endpoint based on target type
      let endpoint = '/notify-site';
      if (targetType === 'all') {
        endpoint = '/notify-all';
      } else if (targetType === 'multiple') {
        endpoint = '/notify-multiple';
      }
      
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });
      
      // First check if the response is ok and get the data in one step
      let responseData;
      try {
        responseData = await response.json();
        if (!response.ok) {
          throw new Error(responseData.error || 'Failed to send notification');
        }
      } catch (error) {
        throw new Error('Failed to parse server response');
      }
      
      console.log('Full server response:', responseData);
      
      // Get the campaign ID from the response
      // The server returns different formats depending on the notification type:
      // - For drafts and scheduled: { id: "uuid", status: "draft|scheduled", ... }
      // - For immediate: { notificationId: "uuid", sent: N, failed: M, ... }
      const newCampaignId = responseData?.id || responseData?.notificationId;
      
      if (!newCampaignId) {
        console.error('Server did not return a valid ID', responseData);
        toast.error('Campaign created but could not get ID. Redirecting to campaigns list.');
        navigate('/campaigns');
        return;
      }
      
      console.log('Campaign created/updated successfully. Redirecting to details page.');
      console.log('Campaign ID for redirect:', newCampaignId);
      
      // Success message based on action (edit/create) and status (draft/scheduled/sent)
      const websiteCount = targetType === 'all' ? 'all websites' : 
                          targetType === 'multiple' ? `${selectedWebsiteIds.length} websites` : 
                          '1 website';
      
      if (isEditing) {
        if (campaign.isDraft) {
          toast.success(`Campaign draft updated successfully for ${websiteCount}!`);
        } else if (campaign.scheduledFor && new Date(campaign.scheduledFor) > new Date()) {
          toast.success(`Scheduled campaign updated successfully for ${websiteCount}!`);
        } else {
          toast.success(`Campaign updated and sent successfully to ${websiteCount}!`);
        }
      } else {
        if (campaign.isDraft) {
          toast.success(`Campaign saved as draft for ${websiteCount}!`);
        } else if (campaign.scheduledFor && new Date(campaign.scheduledFor) > new Date()) {
          toast.success(`Campaign scheduled successfully for ${websiteCount}!`);
        } else {
          toast.success(`Campaign sent successfully to ${websiteCount}!`);
        }
      }
      
      // Navigate to campaign details page or list if enqueued
      if (responseData?.status === 'enqueued') {
        navigate('/campaigns');
      } else {
        navigate(`/campaign/${newCampaignId}`);
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send campaign');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">{isEditing ? 'Edit Campaign' : 'Create Campaign'}</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Details</CardTitle>
              <CardDescription>
                Configure your push notification campaign
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <FormField
                  label="Target Audience"
                  description="Choose who will receive this campaign"
                >
                  <div className="space-y-4">
                    {/* Target Type Selection */}
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="targetType"
                          value="single"
                          checked={targetType === 'single'}
                          onChange={handleChange}
                          className="mr-2"
                        />
                        Single Website
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="targetType"
                          value="multiple"
                          checked={targetType === 'multiple'}
                          onChange={handleChange}
                          className="mr-2"
                        />
                        Multiple Websites
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="targetType"
                          value="all"
                          checked={targetType === 'all'}
                          onChange={handleChange}
                          className="mr-2"
                        />
                        All Websites
                      </label>
                    </div>

                    {/* Single Website Selection */}
                    {targetType === 'single' && (
                      <select
                        name="websiteId"
                        value={selectedWebsiteId}
                        onChange={handleChange}
                        className="w-full p-2 border rounded-md"
                        disabled={isLoading}
                      >
                        <option value="">Select a website</option>
                        {websites.map((website) => (
                          <option key={website.id} value={website.id}>
                            {website.domain} {website.active ? '' : '(inactive)'}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Multiple Website Selection */}
                    {targetType === 'multiple' && (
                      <div className="space-y-3">
                        <div className="flex space-x-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleSelectAllWebsites}
                            disabled={isLoading}
                          >
                            Select All Active
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleDeselectAllWebsites}
                            disabled={isLoading}
                          >
                            Deselect All
                          </Button>
                        </div>
                        <div className="max-h-40 overflow-y-auto border rounded-md p-2">
                          {websites.map((website) => (
                            <label key={website.id} className="flex items-center space-x-2 py-1">
                              <input
                                type="checkbox"
                                checked={selectedWebsiteIds.includes(website.id)}
                                onChange={() => handleWebsiteToggle(website.id)}
                                disabled={isLoading || !website.active}
                                className="rounded"
                              />
                              <span className={`text-sm ${website.active ? 'text-gray-900' : 'text-gray-400'}`}>
                                {website.domain} {website.active ? '' : '(inactive)'}
                              </span>
                            </label>
                          ))}
                        </div>
                        {selectedWebsiteIds.length > 0 && (
                          <p className="text-sm text-gray-600">
                            {selectedWebsiteIds.length} website{selectedWebsiteIds.length !== 1 ? 's' : ''} selected
                          </p>
                        )}
                      </div>
                    )}

                    {/* All Websites Selection */}
                    {targetType === 'all' && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <p className="text-sm text-blue-800">
                          This campaign will be sent to all active websites ({websites.filter(w => w.active).length} websites)
                        </p>
                      </div>
                    )}
                  </div>
                </FormField>
                
                <FormField
                  label="Campaign Name"
                  description="Internal name for this campaign"
                >
                  <Input
                    name="campaignName"
                    value={campaign.name}
                    onChange={handleChange}
                    placeholder="Summer Sale Campaign"
                  />
                </FormField>
                

                
                <FormField
                  label="Notification Title"
                  description="Title that will appear in the notification"
                  required
                >
                  <Input
                    name="title"
                    value={notification.title}
                    onChange={handleChange}
                    placeholder="Your notification title"
                  />
                </FormField>
                
                <FormField
                  label="Notification Body"
                  description="Main text of the notification"
                  required
                >
                  <Textarea
                    name="body"
                    value={notification.options.body}
                    onChange={handleChange}
                    placeholder="Your notification message"
                    className="min-h-20"
                  />
                </FormField>
                
                <FormField
                  label="Notification Icon"
                  description="Small icon displayed in the notification (recommended size: 192x192)"
                >
                  <Input
                    name="icon"
                    value={notification.options.icon || ''}
                    onChange={handleChange}
                    placeholder="https://example.com/icon.png"
                  />
                </FormField>
                
                <FormField
                  label="Notification Image"
                  description="Large image displayed in the notification (recommended aspect ratio: 2:1)"
                >
                  <Input
                    name="image"
                    value={notification.options.image || ''}
                    onChange={handleChange}
                    placeholder="https://example.com/image.jpg"
                  />
                </FormField>
                
                <FormField
                  label="Enable Action Buttons"
                  description="Add custom action buttons to your notification (not supported by all browsers)"
                >
                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={showActionButtons} 
                      onCheckedChange={handleActionButtonsToggle} 
                      id="action-buttons-toggle" 
                    />
                    <Label htmlFor="action-buttons-toggle">
                      {showActionButtons ? 'Action buttons enabled' : 'Action buttons disabled'}
                    </Label>
                  </div>
                </FormField>
                
                {showActionButtons && (
                  <div className="space-y-4 border-l-2 pl-4 mt-2 mb-2 border-blue-200">
                    <p className="text-sm text-muted-foreground">
                      Configure action buttons that will appear in your notification.
                    </p>
                    
                    {notification.options.actions?.map((action, index) => (
                      <div key={index} className="border p-4 rounded-md space-y-3">
                        <FormField label={`Action ${index + 1} ID`}>
                          <Input
                            value={action.action}
                            onChange={(e) => handleActionChange(index, 'action', e.target.value)}
                            placeholder="action_id"
                          />
                        </FormField>
                        
                        <FormField label={`Action ${index + 1} Title`}>
                          <Input
                            value={action.title}
                            onChange={(e) => handleActionChange(index, 'title', e.target.value)}
                            placeholder="Button Text"
                          />
                        </FormField>
                      </div>
                    ))}
                  </div>
                )}
                
                <FormField
                  label="URL"
                  description="Link to open when notification is clicked"
                >
                  <Input
                    name="url"
                    value={notification.options.data?.url || ''}
                    onChange={handleChange}
                    placeholder="https://example.com/landing-page"
                  />
                </FormField>
                
                {/* Essential fields from schedule tab */}
                <FormField
                  label="Schedule for later"
                  description={
                    <span>
                      Set a future date and time to send this campaign{' '}
                      <span 
                        title="The time you select will be interpreted as your local time and converted to IST for scheduling" 
                        className="inline-flex items-center cursor-help underline decoration-dotted"
                      >
                        (automatically converts to IST)
                      </span>
                    </span>
                  }
                >
                  <div className="flex items-center space-x-2">
                    <Input
                      type="datetime-local"
                      name="scheduledFor"
                      value={campaign.scheduledFor ? formatDateForInput(new Date(campaign.scheduledFor)) : ''}
                      onChange={handleChange}
                      min={formatDateForInput(new Date())}
                    />
                    {campaign.scheduledFor && (
                      <div className="text-xs mt-2">
                        <span className="font-semibold text-blue-600">Scheduled time (IST):</span>{' '}
                        {new Date(campaign.scheduledFor).toLocaleString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </div>
                    )}
                  </div>
                </FormField>
                
                <FormField
                  label="Save as draft"
                  description="Save this campaign as a draft without sending"
                >
                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={campaign.isDraft} 
                      onCheckedChange={handleDraftToggle} 
                      id="draft-mode" 
                    />
                    <Label htmlFor="draft-mode">
                      {campaign.isDraft ? 'Draft mode' : 'Send immediately'}
                    </Label>
                  </div>
                </FormField>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => navigate('/campaigns')}>
                Cancel
              </Button>
              <Button 
                onClick={handleSendNotification} 
                disabled={isSending || isLoading}
              >
                {isSending ? (
                  'Saving...'
                ) : isEditing ? (
                  campaign.isDraft ? (
                    'Update Draft'
                  ) : campaign.scheduledFor && new Date(campaign.scheduledFor) > new Date() ? (
                    'Update Schedule'
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Update & Send
                    </>
                  )
                ) : campaign.isDraft ? (
                  'Save Draft'
                ) : campaign.scheduledFor && new Date(campaign.scheduledFor) > new Date() ? (
                  'Schedule Campaign'
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Campaign
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        <div className="space-y-6">
          <NotificationPreview notification={notification} />
          <NotificationTips />
        </div>
      </div>
    </div>
  );
};

export default NotificationComposer;