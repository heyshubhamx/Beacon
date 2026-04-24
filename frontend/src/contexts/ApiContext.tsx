import { createContext, useContext, useState, ReactNode } from 'react';

type ApiContextType = {
  apiKey: string;
  setApiKey: (key: string) => void;
  apiUrl: string;
  isAuthenticated: boolean;
  authenticate: (key: string) => Promise<boolean>;
  logout: () => void;
};

// Dashboard is served from the same origin as the API
const API_URL = window.location.origin;

const ApiContext = createContext<ApiContextType | undefined>(undefined);

export const ApiProvider = ({ children }: { children: ReactNode }) => {
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('apiKey') || '';
  });
  
  const [apiUrl] = useState<string>(API_URL);

  const isAuthenticated = !!apiKey;

  const authenticate = async (key: string): Promise<boolean> => {
    try {
      // BUG-11 FIX: Use dedicated /auth/validate endpoint instead of /health (which is public and always returns 200)
      const response = await fetch(`${apiUrl}/auth/validate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        setApiKey(key);
        localStorage.setItem('apiKey', key);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Authentication error:', error);
      return false;
    }
  };

  const logout = () => {
    setApiKey('');
    localStorage.removeItem('apiKey');
  };

  return (
    <ApiContext.Provider value={{ 
      apiKey, 
      setApiKey, 
      apiUrl,
      isAuthenticated,
      authenticate,
      logout
    }}>
      {children}
    </ApiContext.Provider>
  );
};

export const useApi = (): ApiContextType => {
  const context = useContext(ApiContext);
  if (context === undefined) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return context;
};