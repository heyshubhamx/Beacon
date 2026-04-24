import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Button from '../components/common/Button';

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <h1 className="text-9xl font-extrabold text-indigo-600">404</h1>
        <h2 className="mt-6 text-3xl font-bold text-gray-900">Page not found</h2>
        <p className="mt-2 text-sm text-gray-500">
          Sorry, we couldn't find the page you're looking for.
        </p>
        <div className="mt-6">
          <Link to="/">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;