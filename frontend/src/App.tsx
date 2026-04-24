import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ApiProvider } from './contexts/ApiContext';
import Layout from './components/Layout/Layout';
import LoadingSpinner from './components/common/LoadingSpinner';
import ErrorBoundary from './components/common/ErrorBoundary';

// Lazy-loaded routes for better performance
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Login = lazy(() => import('./pages/Login'));
const Home = lazy(() => import('./pages/Home'));
const Websites = lazy(() => import('./pages/Websites'));
const WebsiteDetails = lazy(() => import('./pages/WebsiteDetails'));
const NotificationComposer = lazy(() => import('./pages/NotificationComposer'));
const PromptEditor = lazy(() => import('./pages/PromptEditor'));
const Settings = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const CampaignDetails = lazy(() => import('./pages/CampaignDetails'));
const Subscriptions = lazy(() => import('./pages/Subscriptions'));

function App() {
  return (
    <ApiProvider>
      <Router future={{ 
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}>
        <Toaster position="top-right" />
        <ErrorBoundary>
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              {/* Public routes that don't use the app layout */}
              <Route path="/" element={<Home />} />
              
              {/* Routes that use the app layout and require authentication */}
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/domains" element={<Websites />} />
                <Route path="/domains/:id" element={<WebsiteDetails />} />
                <Route path="/send-notification" element={<NotificationComposer />} />
                <Route path="/prompt-editor/:id" element={<PromptEditor />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/campaigns" element={<Campaigns />} />
                <Route path="/campaign/:id" element={<CampaignDetails />} />
                <Route path="/subscriptions" element={<Subscriptions />} />
              </Route>
              
              {/* Authentication routes */}
              <Route path="/login" element={<Login />} />
              
              {/* Fallback route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </Router>
    </ApiProvider>
  );
}

export default App;