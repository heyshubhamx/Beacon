import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Globe, Search, RefreshCw, Trash2, AlertTriangle, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApi } from '../contexts/ApiContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import WebsiteForm from '../components/websites/WebsiteForm';

// Import shadcn/ui components
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { cn } from '../lib/utils';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";

interface Website {
  id: string;
  domain: string;
  createdAt?: string;
  created_at?: string;
  stats?: {
    generatedAt?: string;
  };
  active: boolean;
  subscriptionCount: number;
}

const Websites = () => {
  const { apiUrl, apiKey } = useApi();
  const [websites, setWebsites] = useState<Website[]>([]);
  const [filteredWebsites, setFilteredWebsites] = useState<Website[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteWebsiteId, setDeleteWebsiteId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const navigate = useNavigate();

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
      
      const data: Website[] = await response.json();
      setWebsites(data);
      setFilteredWebsites(data);
    } catch (error) {
      console.error('Error fetching websites:', error);
      toast.error('Failed to load websites. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWebsites();
  }, [apiUrl, apiKey]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredWebsites(websites);
    } else {
      const filtered = websites.filter(
        (website) =>
          website.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
          website.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredWebsites(filtered);
    }
  }, [searchTerm, websites]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchWebsites();
    setIsRefreshing(false);
    toast.success('Websites refreshed');
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
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
      
      // Update the websites list
      setWebsites(
        websites.map((website) =>
          website.id === id ? { ...website, active: !currentStatus } : website
        )
      );
      
      toast.success(`Website ${data.active ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      console.error('Error toggling website status:', error);
      toast.error('Failed to update website status. Please try again.');
    }
  };

  const handleDeleteWebsite = async () => {
    if (!deleteWebsiteId) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`${apiUrl}/website/${deleteWebsiteId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete website');
      }
      
      // Remove the website from state
      setWebsites(websites.filter(website => website.id !== deleteWebsiteId));
      toast.success('Website deleted successfully');
    } catch (error) {
      console.error('Error deleting website:', error);
      toast.error('Failed to delete website. Please try again.');
    } finally {
      setIsDeleting(false);
      setDeleteWebsiteId(null);
      setDeleteDialogOpen(false);
    }
  };

  const openDeleteDialog = (id: string) => {
    setDeleteWebsiteId(id);
    setDeleteDialogOpen(true);
  };

  const handleWebsiteRegistrationSuccess = (websiteId: string) => {
    setRegisterDialogOpen(false);
    if (websiteId) {
      navigate(`/domains/${websiteId}`);
    } else {
      fetchWebsites();
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Websites</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your registered websites
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setRegisterDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Website
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search domains or IDs..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {filteredWebsites.length === 0 ? (
            <div className="text-center py-16 px-4">
              <p className="text-muted-foreground">No websites found</p>
              <Button variant="outline" className="mt-4" size="sm" onClick={() => setRegisterDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Register your first website
              </Button>
            </div>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="block md:hidden space-y-2 px-4">
                {filteredWebsites.map((website) => (
                  <div key={website.id} className="p-3 rounded-lg border border-border">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{website.domain}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{website.id}</p>
                      </div>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0",
                        website.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      )}>
                        {website.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-muted-foreground">{website.subscriptionCount || 0} subscribers</span>
                      <div className="flex gap-2">
                        <Link to={`/domains/${website.id}`} className="text-xs text-primary font-medium">Details</Link>
                        <button onClick={() => openDeleteDialog(website.id)} className="text-xs text-red-500 font-medium">Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table view */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Domain</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Subscribers</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWebsites.map((website) => (
                      <TableRow key={website.id}>
                        <TableCell className="font-medium">{website.domain}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{website.id}</TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {new Date(website.stats?.generatedAt || website.createdAt || website.created_at || new Date()).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <span className={cn(
                            "px-2 py-0.5 text-xs font-medium rounded-full",
                            website.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          )}>
                            {website.active ? 'Active' : 'Inactive'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{website.subscriptionCount || 0}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link to={`/domains/${website.id}`} className="text-xs text-primary hover:text-primary/80 font-medium">Details</Link>
                            <Link to={`/prompt-editor/${website.id}`} className="text-xs text-muted-foreground hover:text-foreground font-medium">Prompt</Link>
                            <button
                              onClick={() => handleToggleStatus(website.id, website.active)}
                              className={cn("text-xs font-medium", website.active ? "text-amber-600" : "text-green-600")}
                            >
                              {website.active ? 'Pause' : 'Activate'}
                            </button>
                            <button onClick={() => openDeleteDialog(website.id)} className="text-xs text-red-500 hover:text-red-600 font-medium">Delete</button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Website Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the website and all associated subscriptions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWebsite}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? (
                <span className="flex items-center">
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </span>
              ) : (
                <span className="flex items-center">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Register Website Dialog */}
      <Dialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register a New Website</DialogTitle>
            <DialogDescription>
              Enter your website domain to register it for push notifications.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <WebsiteForm onSuccess={handleWebsiteRegistrationSuccess} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Websites;