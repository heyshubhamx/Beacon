import { useState } from 'react';
import { Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApi } from '../../contexts/ApiContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface WebsiteFormProps {
  onSuccess?: (websiteId: string) => void;
}

const WebsiteForm = ({ onSuccess }: WebsiteFormProps) => {
  const { apiUrl, apiKey } = useApi();
  const [isLoading, setIsLoading] = useState(false);
  const [domain, setDomain] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Validate the API key
      if (!apiKey) {
        throw new Error('No API key found. Please log out and log back in.');
      }

      const response = await fetch(`${apiUrl}/add-website`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          domain: domain.toLowerCase().trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || `Error ${response.status}: ${response.statusText}`;
        
        // Log detailed information for debugging
        console.error('Registration failed:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          apiKeyPresent: !!apiKey,
          apiKeyLength: apiKey?.length || 0
        });
        
        throw new Error(errorMsg);
      }

      toast.success('Website registered successfully!');
      setDomain('');
      const data = await response.json();
      if (data && data.websiteId) {
        onSuccess?.(data.websiteId);
      } else {
        onSuccess?.('');
      }
    } catch (error) {
      console.error('Error registering website:', error);
      const message = error instanceof Error ? error.message : 'Failed to register website';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="domain">Domain</Label>
        <Input
          id="domain"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="example.com"
          required
        />
        <p className="text-sm text-muted-foreground">
          Enter your website domain without http:// or https://
        </p>
      </div>

      {errorMessage && (
        <div className="p-3 text-sm bg-red-50 border border-red-200 rounded text-red-700">
          {errorMessage}
        </div>
      )}

      <Button 
        type="submit" 
        className="w-full"
        disabled={isLoading}
      >
        {isLoading ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Registering...
          </span>
        ) : (
          <span className="flex items-center justify-center">
            <Globe className="h-4 w-4 mr-2" />
            Register Website
          </span>
        )}
      </Button>
    </form>
  );
};

export default WebsiteForm;