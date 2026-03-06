'use client';

import RealTimeTracking from '@/components/dashboard/RealTimeTracking';

export default function TrackingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#F5F5F5]">Live Token Tracking</h1>
        <p className="text-sm text-[#D5D5D5]/60 mt-1">Real-time token prices and market data</p>
      </div>
      <RealTimeTracking />
    </div>
  );
}
