import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Role } from '../db.js';

export const navRouter = Router();

export interface NavItem {
  key: string;
  label: string;
  path: string;
  icon: string;
  badge?: string | number;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

const ROLE_NAV_GROUPS: Record<Role, NavGroup[]> = {
  ADMIN: [
    {
      title: 'System & Foundation',
      items: [
        { key: 'dashboard', label: 'Admin Overview', path: '/admin', icon: 'LayoutDashboard' },
        { key: 'health', label: 'System Health', path: '/admin/health', icon: 'Activity' },
        { key: 'audit', label: 'Audit Trail', path: '/admin/audit', icon: 'FileSpreadsheet' },
      ],
    },
    {
      title: 'Allotment Engine',
      items: [
        { key: 'cycles', label: 'Allotment Cycles', path: '/admin/allotment-cycles', icon: 'RefreshCw' },
        { key: 'rooms', label: 'Rooms & Inventory', path: '/admin/rooms', icon: 'Building' },
        { key: 'allotments', label: 'Bed Allocations', path: '/admin/allotments', icon: 'BedDouble' },
      ],
    },
    {
      title: 'Directory & Accounts',
      items: [
        { key: 'residents', label: 'Residents Directory', path: '/admin/residents', icon: 'Users' },
        { key: 'staff', label: 'Staff Accounts', path: '/admin/staff', icon: 'UserCheck' },
      ],
    },
    {
      title: 'Facilities',
      items: [
        { key: 'water', label: 'Water Quality', path: '/admin/water-quality', icon: 'Droplets' },
        { key: 'maintenance', label: 'Maintenance Logs', path: '/admin/maintenance', icon: 'Wrench' },
        { key: 'notices', label: 'Notices & Circulars', path: '/admin/notices', icon: 'Bell' },
      ],
    },
  ],
  HOSTEL_OFFICE: [
    {
      title: 'Allotment Management',
      items: [
        { key: 'overview', label: 'Office Dashboard', path: '/office', icon: 'LayoutDashboard' },
        { key: 'applications', label: 'Applications', path: '/office/applications', icon: 'FileText' },
        { key: 'ranking', label: 'Merit Ranking', path: '/office/ranking', icon: 'Award' },
        { key: 'allotment-run', label: 'Execute Allotment', path: '/office/allotment-run', icon: 'PlayCircle' },
        { key: 'rooms', label: 'Room Allocations', path: '/office/rooms', icon: 'Building' },
      ],
    },
    {
      title: 'Records & Notices',
      items: [
        { key: 'residents', label: 'Resident Directory', path: '/office/residents', icon: 'Users' },
        { key: 'notices', label: 'Official Notices', path: '/office/notices', icon: 'Bell' },
      ],
    },
  ],
  CHIEF_WARDEN: [
    {
      title: 'Executive Oversight',
      items: [
        { key: 'overview', label: 'Chief Overview', path: '/chief-warden', icon: 'LayoutDashboard' },
        { key: 'allotments', label: 'Allotment Review', path: '/chief-warden/allotments', icon: 'CheckSquare' },
        { key: 'occupancy', label: 'Hostel Occupancy', path: '/chief-warden/occupancy', icon: 'Building' },
      ],
    },
    {
      title: 'Welfare & Discipline',
      items: [
        { key: 'complaints', label: 'Complaints Hub', path: '/chief-warden/complaints', icon: 'AlertTriangle' },
        { key: 'water-quality', label: 'Water Quality Reports', path: '/chief-warden/water-quality', icon: 'Droplets' },
        { key: 'notices', label: 'Hostel Circulars', path: '/chief-warden/notices', icon: 'Bell' },
      ],
    },
  ],
  WARDEN: [
    {
      title: 'Hostel Operations',
      items: [
        { key: 'dashboard', label: 'Warden Dashboard', path: '/warden', icon: 'LayoutDashboard' },
        { key: 'rooms', label: 'Room Inventory', path: '/warden/rooms', icon: 'Building' },
        { key: 'residents', label: 'Residents Roster', path: '/warden/residents', icon: 'Users' },
      ],
    },
    {
      title: 'Student Services',
      items: [
        { key: 'complaints', label: 'Grievances & Actions', path: '/warden/complaints', icon: 'AlertTriangle' },
        { key: 'mess', label: 'Mess Attendance', path: '/warden/mess', icon: 'Utensils' },
        { key: 'maintenance', label: 'Maintenance Requests', path: '/warden/maintenance', icon: 'Wrench' },
        { key: 'notices', label: 'Hostel Notices', path: '/warden/notices', icon: 'Bell' },
      ],
    },
  ],
  MESS_MANAGER: [
    {
      title: 'Dining Service',
      items: [
        { key: 'overview', label: 'Mess Counter & QR', path: '/mess', icon: 'QrCode' },
        { key: 'attendance', label: 'Attendance Scanner', path: '/mess/attendance', icon: 'QrCode' },
        { key: 'menus', label: 'Weekly Timetable', path: '/mess/menus', icon: 'Calendar' },
      ],
    },
    {
      title: 'Financial Ledger',
      items: [
        { key: 'refunds', label: 'Refund Console', path: '/mess/refunds', icon: 'Receipt' },
        { key: 'config', label: 'Mess Configuration', path: '/mess/config', icon: 'Wrench' },
        { key: 'maintenance', label: 'Kitchen Maintenance', path: '/mess/maintenance', icon: 'Wrench' },
      ],
    },
  ],
  CARETAKER: [
    {
      title: 'Hostel Facilities',
      items: [
        { key: 'overview', label: 'Caretaker Overview', path: '/caretaker', icon: 'LayoutDashboard' },
        { key: 'rooms', label: 'Room Inspections', path: '/caretaker/rooms', icon: 'Key' },
        { key: 'laundry', label: 'Smart Laundry', path: '/caretaker/laundry', icon: 'Shirt' },
        { key: 'maintenance', label: 'Maintenance Log', path: '/caretaker/maintenance', icon: 'Wrench' },
      ],
    },
  ],
  STUDENT: [
    {
      title: 'My Residence',
      items: [
        { key: 'dashboard', label: 'Resident Home', path: '/student', icon: 'LayoutDashboard' },
        { key: 'allotment', label: 'My Room & Allotment', path: '/student/allotment', icon: 'Home' },
      ],
    },
    {
      title: 'Hostel Services',
      items: [
        { key: 'mess', label: 'Mess Attendance', path: '/student/mess', icon: 'Utensils' },
        { key: 'refunds', label: 'Mess Refund Ledger', path: '/student/refunds', icon: 'Receipt' },
        { key: 'laundry', label: 'Smart Laundry', path: '/student/laundry', icon: 'Shirt' },
      ],
    },
    {
      title: 'Support & Updates',
      items: [
        { key: 'complaints', label: 'Confidential Complaints', path: '/student/complaints', icon: 'ShieldAlert' },
        { key: 'notices', label: 'Notices & Water Quality', path: '/student/notices', icon: 'Bell' },
      ],
    },
  ],
};

/**
 * GET /api/nav
 * Returns role-aware navigation groups for the authenticated session.
 */
navRouter.get('/', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.user!.role as Role;
    const groups = ROLE_NAV_GROUPS[role] || [];
    return res.status(200).json({ role, groups });
  } catch (err) {
    next(err);
  }
});
