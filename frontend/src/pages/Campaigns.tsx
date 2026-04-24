import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Users, Bell, Copy, Edit, Trash2, MoreHorizontal, RefreshCw } from 'lucide-react';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { toast } from 'react-hot-toast';
import { useSocket } from '../hooks/useSocket';
import Pagination from '../components/common/Pagination';
import { useApi } from '../contexts/ApiContext';

// Import shadcn/ui components from index file
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
  Button,
  Badge,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Tabs, TabsContent, TabsList, TabsTrigger,
  Progress,
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  Checkbox
} from '../components/ui';

// Define types
interface Campaign {
  id: string;
  title: string;
  description: string;
  websiteId: string;
  scheduledFor: string;
  createdAt: string;
  status: 'draft' | 'scheduled' | 'sent' | 'completed';
  notificationId?: string;
  sentCount: number;
  deliveredCount: number;
  clickCount: number;
  failedCount: number;
  domain?: string;
  siteCount?: number;
}

interface CampaignStats {
  deliveryRate: number;
  clickRate: number;
  failureRate: number;
}

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const Campaigns = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const navigate = useNavigate();
  const { apiUrl, apiKey } = useApi();
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationInfo, setPaginationInfo] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    limit: 20,
    pages: 1
  });

  // Fetch campaigns function that can be called from anywhere in the component
  const fetchCampaigns = useCallback(async (page = 1, silent = false) => {
    // Only show loading state for user-initiated refreshes
    if (!silent) {
      setIsLoading(true);
    } else {
      setIsBackgroundRefreshing(true);
    }

    try {
      // Use the new paginated API endpoint
      const response = await fetch(`${apiUrl}/campaigns?page=${page}&limit=20`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch campaigns');
      }
      
      const result = await response.json();
      const notificationsData = result.data || [];
      setPaginationInfo(result.pagination);
      setCurrentPage(page);

      // Get website domains to enrich the data
      const websitesResponse = await fetch(`${apiUrl}/websites`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      
      let websiteMap: Record<string, string> = {};
      if (websitesResponse.ok) {
        const websites = await websitesResponse.json();
        websiteMap = websites.reduce((acc: Record<string, string>, website: any) => {
          acc[website.id] = website.domain;
          return acc;
        }, {});
      }

      // Transform notifications into campaigns
      const campaignData = notificationsData.map((notification: any) => {
        // Determine the status - ensure 'draft' and 'scheduled' statuses are correctly handled
        let status = notification.status || 'sent';
        
        // If it's a scheduled notification and the scheduled time is in the future, make sure it shows as 'scheduled'
        if (status === 'scheduled' && notification.scheduledFor) {
          const scheduledTime = new Date(notification.scheduledFor);
          const now = new Date();
          if (scheduledTime <= now) {
            status = 'sent'; // It should have been sent by now
          }
        }
        
        return {
          id: notification.id,
          title: notification.data?.campaign?.name || notification.title || 'Untitled Campaign',
          description: notification.data?.campaign?.description || notification.body || 'No description',
          websiteId: notification.websiteId,
          domain: websiteMap[notification.websiteId] || 'Unknown',
          scheduledFor: notification.scheduledFor || notification.timestamp,
          createdAt: notification.timestamp,
          status: status,
          notificationId: notification.id,
          sentCount: notification.sentCount || 0,
          deliveredCount: notification.deliveredCount || 0,
          clickCount: notification.clickCount || 0,
          failedCount: notification.failedCount || 0,
          siteCount: notification.siteCount || 1
        };
      });

      setCampaigns(campaignData);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      if (!silent) {
        toast.error('Failed to load campaigns');
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      } else {
        setIsBackgroundRefreshing(false);
      }
    }
  }, [apiUrl, apiKey]);

  // Initial fetch
  useEffect(() => {
    fetchCampaigns(currentPage);
  }, [fetchCampaigns, currentPage]);

  // BUG-13 FIX: Use shared socket hook instead of creating a new connection
  useSocket('stats_update', () => {
    fetchCampaigns(currentPage, true);
  });

  // Handle page change
  const handlePageChange = (page: number) => {
    fetchCampaigns(page, false); // Not silent - show loading state
  };

  // Manual refresh function
  const handleManualRefresh = () => {
    fetchCampaigns(currentPage, false); // Not silent - show loading state
    toast.success('Campaigns refreshed');
  };

  // Handle clicking outside dropdown menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close all campaign menus when clicking outside
      const openMenus = document.querySelectorAll('[id^="campaign-menu-"]');
      openMenus.forEach(menu => {
        if (!menu.contains(event.target as Node) && !menu.classList.contains('hidden')) {
          menu.classList.add('hidden');
        }
      });
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
    
    return {
      deliveryRate,
      clickRate,
      failureRate
    };
  };

  // Filter campaigns based on active tab
  const filteredCampaigns = campaigns.filter(campaign => {
    if (activeTab === 'all') return true;
    return campaign.status === activeTab;
  });

  // View campaign details
  const viewCampaignDetails = (campaignId: string) => {
    navigate(`/campaign/${campaignId}`);
  };

  // Create new campaign
  const createNewCampaign = () => {
    navigate('/send-notification');
  };
  
  // Edit campaign
  const editCampaign = (campaign: Campaign) => {
    // For drafts, we can edit directly
    if (campaign.status === 'draft') {
      navigate(`/send-notification?edit=${campaign.id}`);
    } else {
      // For sent or scheduled campaigns, we can clone and edit
      toast('Creating a copy for editing', { icon: '📝' });
      cloneCampaign(campaign, true);
    }
  };

  // Delete campaign
  const openDeleteDialog = (campaign: Campaign) => {
    setCampaignToDelete(campaign);
    setShowDeleteDialog(true);
  };

  const confirmDeleteCampaign = async () => {
    if (!campaignToDelete) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`${apiUrl}/campaign/${campaignToDelete.id}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      if (!response.ok) throw new Error('Delete failed');
      
      toast.success('Campaign deleted successfully');
      setCampaigns(campaigns.filter(c => c.id !== campaignToDelete.id));
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast.error('Failed to delete campaign');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setCampaignToDelete(null);
    }
  };

  // Clone campaign
  const cloneCampaign = async (campaign: Campaign, navigateToEdit = false) => {
    try {
      // Get the full notification details via API
      const detailResponse = await fetch(`${apiUrl}/campaign/${campaign.id}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      
      if (!detailResponse.ok) throw new Error('Failed to fetch campaign details');
      const notification = await detailResponse.json();
      
      // Create a new notification as a draft via the notify-site endpoint
      const createResponse = await fetch(`${apiUrl}/notify-site`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          websiteId: notification.websiteId,
          notification: {
            title: notification.title,
            options: {
              body: notification.body,
              icon: notification.icon,
              image: notification.image,
              data: { url: notification.url }
            }
          },
          campaign: {
            name: `Copy of ${notification.data?.campaign?.name || notification.title}`,
            description: notification.data?.campaign?.description || notification.body,
            status: 'draft'
          }
        })
      });
      
      if (!createResponse.ok) throw new Error('Failed to clone campaign');
      const newCampaign = await createResponse.json();
      
      toast.success('Campaign cloned successfully');
      
      if (navigateToEdit && newCampaign.id) {
        navigate(`/send-notification?edit=${newCampaign.id}`);
      } else {
        fetchCampaigns();
      }
    } catch (error) {
      console.error('Error cloning campaign:', error);
      toast.error('Failed to clone campaign');
    }
  };

  // Toggle selection of a single campaign
  const toggleCampaignSelection = (campaignId: string) => {
    setSelectedCampaigns(prev => 
      prev.includes(campaignId) 
        ? prev.filter(id => id !== campaignId)
        : [...prev, campaignId]
    );
  };

  // Toggle selection of all visible campaigns
  const toggleSelectAll = () => {
    if (selectedCampaigns.length === filteredCampaigns.length) {
      // If all are selected, unselect all
      setSelectedCampaigns([]);
    } else {
      // Otherwise, select all visible campaigns
      setSelectedCampaigns(filteredCampaigns.map(campaign => campaign.id));
    }
  };

  // Clear selections when changing tabs
  useEffect(() => {
    setSelectedCampaigns([]);
  }, [activeTab]);

  // Handle bulk delete
  const openBulkDeleteDialog = () => {
    setShowBulkDeleteDialog(true);
  };

  const confirmBulkDelete = async () => {
    if (selectedCampaigns.length === 0) return;
    
    setIsBulkDeleting(true);
    try {
      const response = await fetch(`${apiUrl}/notifications/bulk-delete`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ ids: selectedCampaigns })
      });
      
      if (!response.ok) throw new Error('Bulk delete failed');
      
      toast.success(`${selectedCampaigns.length} campaigns deleted successfully`);
      setCampaigns(campaigns.filter(c => !selectedCampaigns.includes(c.id)));
      setSelectedCampaigns([]);
    } catch (error) {
      console.error('Error deleting campaigns:', error);
      toast.error('Failed to delete some campaigns');
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h1 className="text-3xl font-bold mb-4 md:mb-0">Campaigns</h1>
        <div className="flex space-x-3">
          <Button 
            variant="outline" 
            onClick={handleManualRefresh} 
            disabled={isLoading}
            className="flex items-center"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isBackgroundRefreshing ? 'animate-spin text-muted-foreground' : ''}`} />
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
          {selectedCampaigns.length > 0 && (
            <Button 
              variant="destructive" 
              onClick={openBulkDeleteDialog}
              className="flex items-center gap-2 text-white"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete ({selectedCampaigns.length})</span>
            </Button>
          )}
          <Button onClick={createNewCampaign}>Create New Campaign</Button>
        </div>
      </div>

      {/* Add a subtle indicator for background refreshing */}
      {isBackgroundRefreshing && (
        <div className="flex items-center justify-end mb-2 text-xs text-muted-foreground">
          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
          <span>Updating stats...</span>
        </div>
      )}

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid grid-cols-4 md:w-[400px]">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
        </TabsList>
      </Tabs>

      {filteredCampaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-medium mb-2">No campaigns found</h3>
            <p className="text-muted-foreground mb-6">
              {activeTab === 'all' 
                ? "You haven't created any campaigns yet." 
                : `You don't have any ${activeTab} campaigns.`}
            </p>
            <Button onClick={createNewCampaign}>Create Your First Campaign</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Add select all checkbox */}
          <div className="flex items-center mb-4 space-x-2">
            <Checkbox 
              id="select-all" 
              checked={selectedCampaigns.length > 0 && selectedCampaigns.length === filteredCampaigns.length}
              onCheckedChange={toggleSelectAll}
              className={selectedCampaigns.length > 0 && selectedCampaigns.length < filteredCampaigns.length ? "opacity-70" : ""}
            />
            <label htmlFor="select-all" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              {selectedCampaigns.length === 0 ? "Select All" : 
               selectedCampaigns.length === filteredCampaigns.length ? "Deselect All" : 
               `Selected ${selectedCampaigns.length} of ${filteredCampaigns.length}`}
            </label>
          </div>
          <div className="grid grid-cols-1 gap-6">
            {filteredCampaigns.map(campaign => {
              const stats = calculateStats(campaign);
              
              // Format date - convert from UTC to IST
              const date = new Date(campaign.createdAt);
              // Format as DD/MM/YYYY HH:MM:SS in IST
              const formattedDate = new Date(date).toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              });
              
              // Determine status badge
              let statusBadge;
              switch(campaign.status) {
                case 'draft':
                  statusBadge = <Badge variant="outline">Draft</Badge>;
                  break;
                case 'scheduled':
                  statusBadge = <Badge variant="secondary">Scheduled</Badge>;
                  break;
                case 'sent':
                  statusBadge = <Badge>Sent</Badge>;
                  break;
                case 'completed':
                  statusBadge = <Badge variant="success">Completed</Badge>;
                  break;
                default:
                  statusBadge = <Badge>{campaign.status}</Badge>;
              }

              const isSelected = selectedCampaigns.includes(campaign.id);

              return (
                <Card key={campaign.id} className={`overflow-hidden ${isSelected ? 'border-primary border-2' : ''}`}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-3">
                        <Checkbox 
                          checked={isSelected}
                          onCheckedChange={() => toggleCampaignSelection(campaign.id)}
                          className="mt-1"
                        />
                        <div>
                          <CardTitle>{campaign.title}</CardTitle>
                          <CardDescription className="mt-1">
                            {campaign.siteCount && campaign.siteCount > 1 ? (
                              <Badge variant="outline" className="mr-2 bg-blue-50 text-blue-700 border-blue-200">
                                {campaign.siteCount} Websites
                              </Badge>
                            ) : (
                              <span>{campaign.domain} • </span>
                            )}
                            {formattedDate}
                            {campaign.status === 'scheduled' && (
                              <div className="text-xs text-blue-600 mt-1">
                                Scheduled for: {new Date(campaign.scheduledFor).toLocaleString('en-IN', {
                                  timeZone: 'Asia/Kolkata',
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit'
                                })} IST
                              </div>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {statusBadge}
                        <div className="relative inline-block">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                            <MoreHorizontal className="h-4 w-4" onClick={(e) => {
                              e.stopPropagation();
                              const menu = document.getElementById(`campaign-menu-${campaign.id}`);
                              if (menu) {
                                menu.classList.toggle('hidden');
                              }
                            }} />
                          </Button>
                          <div 
                            id={`campaign-menu-${campaign.id}`} 
                            className="hidden absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-md overflow-hidden z-10 border"
                          >
                            <div className="py-1">
                              <button 
                                onClick={() => editCampaign(campaign)}
                                className="flex items-center w-full px-4 py-2 text-sm text-left hover:bg-gray-100"
                              >
                                <Edit className="h-4 w-4 mr-2" /> Edit
                              </button>
                              <button 
                                onClick={() => cloneCampaign(campaign)}
                                className="flex items-center w-full px-4 py-2 text-sm text-left hover:bg-gray-100"
                              >
                                <Copy className="h-4 w-4 mr-2" /> Clone
                              </button>
                              <button 
                                onClick={() => openDeleteDialog(campaign)}
                                className="flex items-center w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-gray-100"
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <p className="text-sm mb-4 line-clamp-2">{campaign.description}</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground mb-1">Sent</span>
                        <span className="text-xl font-semibold">{campaign.sentCount}</span>
                      </div>
                      
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground mb-1">Delivered</span>
                        <span className="text-xl font-semibold">{campaign.deliveredCount}</span>
                      </div>
                      
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground mb-1">Clicks</span>
                        <span className="text-xl font-semibold">{campaign.clickCount}</span>
                      </div>
                      
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground mb-1">Click Rate</span>
                        <span className="text-xl font-semibold">{stats.clickRate.toFixed(1)}%</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>Delivery Rate</span>
                          <span>{stats.deliveryRate.toFixed(1)}%</span>
                        </div>
                        <Progress value={stats.deliveryRate} />
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>Click Rate</span>
                          <span>{stats.clickRate.toFixed(1)}%</span>
                        </div>
                        <Progress value={stats.clickRate} variant={stats.clickRate > 10 ? "success" : "default"} />
                      </div>
                    </div>
                  </CardContent>
                  
                  <CardFooter className="bg-muted/50 flex justify-between">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Users className="h-4 w-4 mr-1" /> 
                      <span>{campaign.sentCount} recipients across {campaign.siteCount || 1} site(s)</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => viewCampaignDetails(campaign.id)}>
                      View Details <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Delete Campaign Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this campaign?
              {campaignToDelete && (
                <div className="mt-2 font-medium">{campaignToDelete.title}</div>
              )}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
                         <AlertDialogCancel onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
               Cancel
             </AlertDialogCancel>
             <AlertDialogAction onClick={confirmDeleteCampaign} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white">
               {isDeleting ? 'Deleting...' : 'Delete'}
             </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Bulk Delete Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Campaigns</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedCampaigns.length} selected campaigns?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowBulkDeleteDialog(false)} disabled={isBulkDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDelete} disabled={isBulkDeleting} className="bg-red-600 hover:bg-red-700 text-white">
              {isBulkDeleting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                  <span>Deleting...</span>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  <span>Delete</span>
                </span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Pagination 
        currentPage={currentPage} 
        totalPages={paginationInfo.pages} 
        onPageChange={handlePageChange} 
      />
      
    </div>
  );
};

export default Campaigns; 