'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to portfolio page
    router.replace('/dashboard/portfolio');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        <div className="text-text-secondary">Loading...</div>
      </div>
    </div>
  );
}
