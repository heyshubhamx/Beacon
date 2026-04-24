import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, Trash2, Smartphone, Monitor, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApi } from '../contexts/ApiContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Pagination from '../components/common/Pagination';

import {
  Card, CardContent, CardHeader, CardTitle,
  Button,
  Input,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  Badge,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Checkbox
} from '../components/ui';

interface Subscription {
  id: string;
  endpoint: string;
  websiteId: string;
  createdAt: string;
  lastUsed: string;
  browser: string;
  browserVersion: string;
  os: string;
  country: string;
  platform: string;
  isMobile: boolean;
}

interface Website {
  id: string;
  domain: string;
}

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const Subscriptions = () => {
  const { apiUrl, apiKey } = useApi();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [filteredSubscriptions, setFilteredSubscriptions] = useState<Subscription[]>([]);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [websiteFilter, setWebsiteFilter] = useState<string>('all');
  const [browserFilter, setBrowserFilter] = useState<string>('all');
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [selectedSubscriptions, setSelectedSubscriptions] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showPingDialog, setShowPingDialog] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [pingData, setPingData] = useState({ title: '', body: '', url: '' });
  
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationInfo, setPaginationInfo] = useState<PaginationInfo>({
    total: 0, page: 1, limit: 20, pages: 1
  });
  
  const fetchSubscriptions = useCallback(async (page = 1, silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsBackgroundRefreshing(true);
    
    try {
      const response = await fetch(`${apiUrl}/subscriptions?page=${page}&limit=20`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      
      if (!response.ok) throw new Error('Failed to fetch subscriptions');
      
      const result = await response.json();
      setSubscriptions(result.data);
      setFilteredSubscriptions(result.data);
      setPaginationInfo(result.pagination);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      if (!silent) toast.error('Failed to load subscriptions.');
    } finally {
      if (!silent) setIsLoading(false);
      else setIsBackgroundRefreshing(false);
    }
  }, [apiUrl, apiKey]);

  const fetchWebsites = async () => {
    try {
      const response = await fetch(`${apiUrl}/websites`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (!response.ok) throw new Error('Failed to fetch websites');
      const data: Website[] = await response.json();
      setWebsites(data);
    } catch (error) {
      console.error('Error fetching websites:', error);
    }
  };

  useEffect(() => {
    fetchSubscriptions(currentPage);
    fetchWebsites();
    
    const intervalId = setInterval(() => {
      fetchSubscriptions(currentPage, true);
    }, 30000);
    
    return () => clearInterval(intervalId);
  }, [fetchSubscriptions, currentPage]);

  useEffect(() => {
    let filtered = [...subscriptions];
    
    if (websiteFilter !== 'all') filtered = filtered.filter(sub => sub.websiteId === websiteFilter);
    if (browserFilter !== 'all') filtered = filtered.filter(sub => sub.browser?.toLowerCase() === browserFilter.toLowerCase());
    if (deviceFilter === 'mobile') filtered = filtered.filter(sub => sub.isMobile);
    else if (deviceFilter === 'desktop') filtered = filtered.filter(sub => !sub.isMobile);
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(sub =>
        sub.id?.toLowerCase().includes(term) ||
        sub.browser?.toLowerCase().includes(term) ||
        sub.os?.toLowerCase().includes(term) ||
        sub.country?.toLowerCase().includes(term) ||
        sub.platform?.toLowerCase().includes(term)
      );
    }
    
    setFilteredSubscriptions(filtered);
  }, [searchTerm, subscriptions, websiteFilter, browserFilter, deviceFilter]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchSubscriptions(currentPage, false);
    setIsRefreshing(false);
    toast.success('Subscriptions refreshed');
  };

  const handlePageChange = (page: number) => fetchSubscriptions(page, false);

  const handleDeleteSubscription = async () => {
    if (!selectedSubscription) return;
    
    try {
      const response = await fetch(`${apiUrl}/remove-subscription`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: { endpoint: selectedSubscription.endpoint } })
      });
      
      if (!response.ok) throw new Error('Failed to delete subscription');
      setSubscriptions(subscriptions.filter(sub => sub.id !== selectedSubscription.id));
      toast.success('Subscription deleted');
    } catch (error) {
      console.error('Error deleting subscription:', error);
      toast.error('Failed to delete subscription.');
    } finally {
      setDeleteDialogOpen(false);
      setSelectedSubscription(null);
    }
  };

  const openDeleteDialog = (subscription: Subscription) => {
    setSelectedSubscription(subscription);
    setDeleteDialogOpen(true);
  };

  const getWebsiteDomain = (websiteId: string) => {
    const website = websites.find(site => site.id === websiteId);
    return website ? website.domain : websiteId;
  };

  const uniqueBrowsers = Array.from(new Set(subscriptions.map(sub => sub.browser))).filter(Boolean).sort();

  const toggleSubscriptionSelection = (subscriptionId: string) => {
    setSelectedSubscriptions(prev =>
      prev.includes(subscriptionId)
        ? prev.filter(id => id !== subscriptionId)
        : [...prev, subscriptionId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedSubscriptions.length === filteredSubscriptions.length) {
      setSelectedSubscriptions([]);
    } else {
      setSelectedSubscriptions(filteredSubscriptions.map(sub => sub.id));
    }
  };

  useEffect(() => {
    setSelectedSubscriptions([]);
  }, [websiteFilter, browserFilter, deviceFilter, searchTerm]);

  const confirmBulkDelete = async () => {
    if (selectedSubscriptions.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const endpointsToDelete = subscriptions
        .filter(sub => selectedSubscriptions.includes(sub.id))
        .map(sub => sub.endpoint);
      
      const response = await fetch(`${apiUrl}/subscriptions/bulk-delete`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${apiKey}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ endpoints: endpointsToDelete })
      });
      
      if (!response.ok) throw new Error(`Bulk deletion failed`);
      
      toast.success(`${selectedSubscriptions.length} subscriptions deleted`);
      setSubscriptions(subscriptions.filter(sub => !selectedSubscriptions.includes(sub.id)));
      setSelectedSubscriptions([]);
    } catch (error) {
      console.error('Error deleting subscriptions:', error);
      toast.error('Failed to delete some subscriptions');
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const handleCustomPing = async () => {
    if (selectedSubscriptions.length === 0 || !pingData.title || !pingData.body) {
      toast.error('Title and message are required');
      return;
    }
    
    setIsPinging(true);
    let successCount = 0;
    
    try {
      const endpointsToPing = subscriptions
        .filter(sub => selectedSubscriptions.includes(sub.id))
        .map(sub => sub.endpoint);
        
      for (const endpoint of endpointsToPing) {
        try {
          const response = await fetch(`${apiUrl}/notify-me`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscription: { endpoint },
              notification: {
                title: pingData.title,
                options: {
                  body: pingData.body,
                  data: { url: pingData.url }
                }
              }
            })
          });
          if (response.ok) successCount++;
        } catch (e) {
          console.error('Failed to notify endpoint', endpoint, e);
        }
      }
      
      if (successCount === selectedSubscriptions.length) {
        toast.success(`Successfully pinged ${successCount} devices!`);
      } else {
        toast.success(`Pinged ${successCount} out of ${selectedSubscriptions.length} devices.`);
      }
    } catch (error) {
      console.error('Error sending pings:', error);
      toast.error('Failed to send some pings');
    } finally {
      setIsPinging(false);
      setShowPingDialog(false);
      setPingData({ title: '', body: '', url: '' });
      setSelectedSubscriptions([]);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {paginationInfo.total} total subscribers across all websites
          </p>
        </div>
        <div className="flex gap-2">
          {selectedSubscriptions.length > 0 && (
            <>
              <Button variant="outline" className="bg-primary/5 text-primary hover:bg-primary/10 border-primary/20" size="sm" onClick={() => setShowPingDialog(true)}>
                <Send className="h-4 w-4 mr-1.5" />
                Ping ({selectedSubscriptions.length})
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setShowBulkDeleteDialog(true)}>
                <Trash2 className="h-4 w-4 mr-1.5" />
                Delete ({selectedSubscriptions.length})
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by browser, OS, country..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {/* Filters — horizontal scroll on mobile */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              <Select value={websiteFilter} onValueChange={setWebsiteFilter}>
                <SelectTrigger className="w-[160px] min-w-[160px]">
                  <SelectValue placeholder="Website" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Websites</SelectItem>
                  {websites.map(website => (
                    <SelectItem key={website.id} value={website.id}>{website.domain}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={browserFilter} onValueChange={setBrowserFilter}>
                <SelectTrigger className="w-[150px] min-w-[150px]">
                  <SelectValue placeholder="Browser" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Browsers</SelectItem>
                  {uniqueBrowsers.map(browser => (
                    <SelectItem key={browser} value={browser}>{browser}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                <SelectTrigger className="w-[140px] min-w-[140px]">
                  <SelectValue placeholder="Device" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Devices</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                  <SelectItem value="desktop">Desktop</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {filteredSubscriptions.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground">No subscriptions found</p>
            </div>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="block md:hidden space-y-2 px-4">
                {filteredSubscriptions.map((sub) => {
                  const isSelected = selectedSubscriptions.includes(sub.id);
                  return (
                    <div 
                      key={sub.id} 
                      className={`p-3 rounded-lg border transition-colors ${isSelected ? 'bg-primary/5 border-primary/20' : 'border-border'}`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSubscriptionSelection(sub.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {sub.isMobile ? (
                              <Smartphone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <Monitor className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            )}
                            <span className="text-sm font-medium truncate">
                              {sub.os} • {sub.browser}
                            </span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700 ml-auto flex-shrink-0">
                              Active
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {getWebsiteDomain(sub.websiteId)}
                          </p>
                          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                            <span>Joined {new Date(sub.createdAt).toLocaleDateString()}</span>
                            <button 
                              onClick={() => openDeleteDialog(sub)}
                              className="text-red-500 hover:text-red-600 p-1 -mr-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table view */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={selectedSubscriptions.length > 0 && selectedSubscriptions.length === filteredSubscriptions.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Website</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>First Seen</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubscriptions.map((sub) => {
                      const isSelected = selectedSubscriptions.includes(sub.id);
                      return (
                        <TableRow key={sub.id} className={isSelected ? "bg-muted/30" : undefined}>
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSubscriptionSelection(sub.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {sub.isMobile ? (
                                <Smartphone className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Monitor className="h-4 w-4 text-muted-foreground" />
                              )}
                              <div>
                                <p className="text-sm font-medium">{sub.os}</p>
                                <p className="text-xs text-muted-foreground">{sub.browser} {sub.browserVersion}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{getWebsiteDomain(sub.websiteId)}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50 text-xs">
                              Subscribed
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm tabular-nums">
                            {new Date(sub.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-sm tabular-nums">
                            {sub.lastUsed ? new Date(sub.lastUsed).toLocaleDateString() : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(sub)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
          
          {/* Pagination */}
          <div className="px-4 pt-4">
            <Pagination
              currentPage={currentPage}
              totalPages={paginationInfo.pages}
              onPageChange={handlePageChange}
            />
            <p className="text-xs text-muted-foreground text-center mt-2">
              Showing {filteredSubscriptions.length} of {paginationInfo.total} subscriptions
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Delete dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this subscription. The user will need to re-subscribe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSubscription} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedSubscriptions.length} Subscriptions</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove all selected subscriptions. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDelete} disabled={isBulkDeleting} className="bg-red-600 hover:bg-red-700 text-white">
              {isBulkDeleting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Deleting...
                </span>
              ) : (
                `Delete ${selectedSubscriptions.length}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Custom Ping dialog */}
      <AlertDialog open={showPingDialog} onOpenChange={setShowPingDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Custom Ping</AlertDialogTitle>
            <AlertDialogDescription>
              Instantly send a push notification to the {selectedSubscriptions.length} selected devices.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 my-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Title *</label>
              <Input 
                placeholder="Hello there!" 
                value={pingData.title}
                onChange={(e) => setPingData({...pingData, title: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Message *</label>
              <textarea 
                className="flex w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                rows={3}
                placeholder="This is a direct message" 
                value={pingData.body}
                onChange={(e) => setPingData({...pingData, body: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Click URL (optional)</label>
              <Input 
                placeholder="https://example.com" 
                value={pingData.url}
                onChange={(e) => setPingData({...pingData, url: e.target.value})}
              />
            </div>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPinging}>Cancel</AlertDialogCancel>
            <Button onClick={handleCustomPing} disabled={isPinging || !pingData.title || !pingData.body}>
              {isPinging ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Sending...
                </span>
              ) : (
                `Send Ping`
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Subscriptions; 