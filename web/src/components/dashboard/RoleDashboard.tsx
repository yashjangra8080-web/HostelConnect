import React from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { KPIStrip } from '../ui/KPIStrip.js';
import { StatusTag } from '../ui/StatusTag.js';
import { Button } from '../ui/Button.js';
import { Building2, Utensils, Shirt } from 'lucide-react';

interface RoleDashboardProps {
  onNavigate: (path: string) => void;
}

export const RoleDashboard: React.FC<RoleDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const role = user?.role || 'STUDENT';

  // Role-specific KPI metrics
  const getKpis = () => {
    switch (role) {
      case 'ADMIN':
        return [
          { id: '1', label: 'Total Bed Capacity', value: '350', subtext: 'Across BH1, BH2, GH1', badge: <StatusTag status="neutral" label="100% INVENTORY" size="sm" /> },
          { id: '2', label: 'Beds Occupied', value: '286', subtext: '81.7% occupancy rate', badge: <StatusTag status="success" label="NOMINAL" size="sm" /> },
          { id: '3', label: 'Eligible Applicants', value: '1,150', subtext: '750 Outside Delhi', badge: <StatusTag status="saffron" label="65% NON-DELHI" size="sm" /> },
          { id: '4', label: 'Database Health', value: '100%', subtext: '7 Role Pools Active', badge: <StatusTag status="success" label="ONLINE" size="sm" /> },
        ];
      case 'WARDEN':
        return [
          { id: '1', label: 'Hostel Wing', value: 'BH1', subtext: 'Boys Hostel 1', badge: <StatusTag status="primary" label="CAMPUS DWARKA" size="sm" /> },
          { id: '2', label: 'Occupancy', value: '142 / 150', subtext: '8 beds available', badge: <StatusTag status="success" label="94.6%" size="sm" /> },
          { id: '3', label: 'Active Complaints', value: '3', subtext: '2 Electrical, 1 Plumbing', badge: <StatusTag status="warning" label="SEEN" size="sm" /> },
          { id: '4', label: 'Water Quality', value: 'SAFE', subtext: 'TDS: 280 ppm, pH: 7.4', badge: <StatusTag status="success" label="WEEK 44" size="sm" /> },
        ];
      case 'STUDENT':
      default:
        return [
          { id: '1', label: 'Allotment Status', value: 'ALLOTTED', subtext: 'Academic Year 2026-27', badge: <StatusTag status="success" label="ROOM BH1-101" size="sm" /> },
          { id: '2', label: 'Merit Rank', value: '#412', subtext: 'Outside Delhi Priority', badge: <StatusTag status="saffron" label="NON-DELHI" size="sm" /> },
          { id: '3', label: 'Mess Meals Eaten', value: '84 / 120', subtext: 'Current Month: Nov 2026', badge: <StatusTag status="primary" label="DINING ACTIVE" size="sm" /> },
          { id: '4', label: 'Est. Refund Rebate', value: '₹1,440', subtext: '36 unused meals @ ₹40/meal', badge: <StatusTag status="success" label="PREVIEW" size="sm" /> },
        ];
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header Block: White card, 2px border, shadow-hard-lg */}
      <div className="bg-white border-2 border-black rounded-[4px] p-6 shadow-hard-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-black">
            {role === 'ADMIN' && 'Administrative Systems Control'}
            {role === 'HOSTEL_OFFICE' && 'Hostel Office Allotment Operations'}
            {role === 'CHIEF_WARDEN' && 'Chief Warden Executive Overview'}
            {role === 'WARDEN' && 'Hostel Warden Operations (BH1)'}
            {role === 'MESS_MANAGER' && 'Dining & Mess Financials Management'}
            {role === 'CARETAKER' && 'Hostel Caretaker Operations (BH1)'}
            {role === 'STUDENT' && 'Resident Student Portal'}
          </h1>
          <p className="text-xs text-black/75 font-medium mt-1">
            Logged in as <strong className="font-bold text-black">{user?.loginId}</strong> ({user?.role}). Operating strictly in Indian Standard Time (IST, UTC+05:30).
          </p>
        </div>
      </div>

      {/* KPI Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between text-xs text-black font-heading font-bold">
          <span className="uppercase tracking-wider">Live Operational Indicators</span>
          <span className="text-black/60 font-mono">Refreshed automatically</span>
        </div>
        <KPIStrip items={getKpis()} />
      </section>

      {/* Role Action Shortcuts */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-white border-2 border-black rounded-[4px] shadow-hard space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[4px] bg-paper text-black border-2 border-black flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4" strokeWidth={2} />
              </div>
              <div>
                <h3 className="text-sm font-heading font-bold text-black">Hostel Inventory</h3>
                <p className="text-xs text-black/70 font-medium">Inspect rooms and beds</p>
              </div>
            </div>
            <p className="text-xs text-black/80 font-medium leading-relaxed">
              Verify study-habit compatibility tags (DAY vs NIGHT) and room capacity limits (2 or 3 occupants).
            </p>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={() => onNavigate(role === 'STUDENT' ? '/student/allotment' : '/rooms')}>
            Explore Inventory →
          </Button>
        </div>

        <div className="p-5 bg-white border-2 border-black rounded-[4px] shadow-hard space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[4px] bg-saffron text-black border-2 border-black flex items-center justify-center shrink-0">
                <Utensils className="w-4 h-4" strokeWidth={2} />
              </div>
              <div>
                <h3 className="text-sm font-heading font-bold text-black">Mess Operations</h3>
                <p className="text-xs text-black/70 font-medium">Attendance & dining refunds</p>
              </div>
            </div>
            <p className="text-xs text-black/80 font-medium leading-relaxed">
              Attendance integrity checked against serving windows: Breakfast, Lunch, Snacks, Dinner.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onNavigate(role === 'STUDENT' ? '/student/mess' : '/mess')}
          >
            {role === 'STUDENT' ? 'View My Attendance & Refund →' : 'Launch Mess Operations →'}
          </Button>
        </div>

        <div className="p-5 bg-white border-2 border-black rounded-[4px] shadow-hard space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[4px] bg-surface-subtle text-black border-2 border-black flex items-center justify-center shrink-0">
                <Shirt className="w-4 h-4" strokeWidth={2} />
              </div>
              <div>
                <h3 className="text-sm font-heading font-bold text-black">Smart Laundry</h3>
                <p className="text-xs text-black/70 font-medium">Pessimistic row locking</p>
              </div>
            </div>
            <p className="text-xs text-black/80 font-medium leading-relaxed">
              45-minute washing cycles, automated event cleanup, and single-machine concurrent limits.
            </p>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={() => onNavigate(role === 'STUDENT' ? '/student/laundry' : '/laundry')}>
            Check Washing Machines →
          </Button>
        </div>
      </section>
    </div>
  );
};
