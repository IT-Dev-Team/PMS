// app/unauthorized/page.tsx
import Link from 'next/link';
import { Shield, Home } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md mx-auto p-6">
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center">
            <Shield className="w-12 h-12 text-red-600" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-600 mb-6">
          You don't have permission to access this page. 
          Please contact your administrator if you believe this is an error.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Home className="w-4 h-4" />
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}