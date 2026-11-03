import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { ToastProvider } from './components/ui/Toast.js';
import { AppShell } from './components/layout/AppShell.js';
import { Button } from './components/ui/Button.js';
import { LoginPage } from './pages/LoginPage.js';
import { ChangePasswordPage } from './pages/ChangePasswordPage.js';
import { NotificationsPage } from './pages/NotificationsPage.js';
import { RoleDashboard } from './components/dashboard/RoleDashboard.js';
import { MessManagerCounter } from './components/mess/MessManagerCounter.js';
import { StudentAttendanceStrip } from './components/mess/StudentAttendanceStrip.js';
import { ManagerRefundConsole } from './components/mess/ManagerRefundConsole.js';
import { MessConfigScreen } from './components/mess/MessConfigScreen.js';
import { ApplicantStatus } from './components/ApplicantStatus.js';
import { StudentProfileApply } from './components/StudentProfileApply.js';
import { VerificationQueue } from './components/VerificationQueue.js';
import { PublicPool } from './components/PublicPool.js';
import { HostelOfficeConsole } from './components/HostelOfficeConsole.js';
import { RoomOccupancyBoard } from './components/RoomOccupancyBoard.js';
import { StudentDirectory } from './components/StudentDirectory.js';
import { NoticeHub } from './components/NoticeHub.js';
import { WaterQuality } from './components/WaterQuality.js';
import { MaintenanceSchedule } from './components/MaintenanceSchedule.js';
import { ComplaintForm } from './components/ComplaintForm.js';
import { ComplaintInbox } from './components/ComplaintInbox.js';
import { LaundryStatus } from './components/LaundryStatus.js';
import { AdminPrivilegeProof } from './components/AdminPrivilegeProof.js';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { user, isLoading, csrfToken } = useAuth();
  const [currentPath, setCurrentPath] = useState(() => {
    return typeof window !== 'undefined' ? window.location.pathname : '/';
  });

  // Listen to popstate (back/forward browser buttons)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
    setCurrentPath(path);
    window.scrollTo(0, 0);
  };

  // 1. Initial auth loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-navy-sidebar text-white flex items-center justify-center font-serif font-bold text-base">
            HC
          </div>
          <div className="flex items-center gap-2 text-ink-secondary text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-primary" strokeWidth={1.75} />
            <span>Initializing HostelConnect session...</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated: Force Login Page
  if (!user) {
    return (
      <LoginPage
        onSuccess={() => {
          navigateTo(currentPath === '/login' ? '/' : currentPath);
        }}
      />
    );
  }

  // 3. Authenticated but forced password change is required
  if (user.mustChangePassword) {
    return (
      <ChangePasswordPage
        onSuccess={() => {
          navigateTo('/');
        }}
      />
    );
  }

  // 4. Authenticated main router wrapped in AppShell
  const renderContent = () => {
    switch (currentPath) {
      case '/notifications':
        return <NotificationsPage onNavigate={navigateTo} />;
      case '/change-password':
        return <ChangePasswordPage onSuccess={() => navigateTo('/')} />;

      // Applications & Allotment
      case '/student/apply':
      case '/apply':
        return <StudentProfileApply currentStudentRollNo={user?.student?.roll_no} />;
      case '/student/allotment':
      case '/allotment':
        return <ApplicantStatus />;
      case '/office/applications':
      case '/admin/applications':
      case '/verify':
        return <VerificationQueue />;
      case '/office/ranking':
      case '/pool':
      case '/transparency':
        return <PublicPool userRole={user.role} />;
      case '/office/allotment-run':
      case '/admin/allotment-cycles':
        return <HostelOfficeConsole />;
      case '/office/rooms':
      case '/admin/rooms':
      case '/warden/rooms':
      case '/caretaker/rooms':
      case '/rooms':
        return <RoomOccupancyBoard />;
      case '/office/residents':
      case '/admin/residents':
      case '/warden/residents':
      case '/residents':
        return <StudentDirectory />;

      // Complaints & Grievances
      case '/student/complaints':
        return <ComplaintForm csrfToken={csrfToken || ''} />;
      case '/chief-warden/complaints':
      case '/warden/complaints':
      case '/complaints':
      case '/admin/complaints':
        return <ComplaintInbox csrfToken={csrfToken || ''} />;

      // Facilities & Notices
      case '/student/notices':
      case '/notices':
      case '/admin/notices':
      case '/office/notices':
      case '/chief-warden/notices':
      case '/warden/notices':
        return <NoticeHub userRole={user.role} csrfToken={csrfToken || ''} />;
      case '/water-quality':
      case '/admin/water-quality':
      case '/chief-warden/water-quality':
        return <WaterQuality userRole={user.role} csrfToken={csrfToken || ''} />;
      case '/maintenance':
      case '/admin/maintenance':
      case '/warden/maintenance':
      case '/caretaker/maintenance':
        return <MaintenanceSchedule userRole={user.role} csrfToken={csrfToken || ''} />;

      // Smart Laundry
      case '/student/laundry':
      case '/caretaker/laundry':
      case '/laundry':
        return <LaundryStatus userRole={user.role} csrfToken={csrfToken || ''} />;

      // Institutional Mess & Dining
      case '/mess':
      case '/mess/attendance':
      case '/mess/counter':
      case '/warden/mess':
        return <MessManagerCounter />;
      case '/mess/refunds':
        return <ManagerRefundConsole />;
      case '/mess/config':
        return <MessConfigScreen />;
      case '/student/mess':
      case '/student/refunds':
        return <StudentAttendanceStrip />;

      // Admin Tools
      case '/admin/privilege-proof':
        return <AdminPrivilegeProof />;

      // Dashboards & Home
      case '/':
      case '/dashboard':
      case '/home':
      case '/student':
      case '/warden':
      case '/office':
      case '/chief-warden':
      case '/caretaker':
      case '/admin':
        if (user?.role === 'MESS_MANAGER') {
          return <MessManagerCounter />;
        }
        return <RoleDashboard onNavigate={navigateTo} />;

      default:
        return (
          <div className="py-20 flex flex-col items-center justify-center text-center px-4">
            <div className="w-14 h-14 rounded-full bg-surface-subtle border border-border flex items-center justify-center text-ink-muted mb-4 font-mono font-bold text-lg">
              404
            </div>
            <h1 className="text-xl font-bold font-serif text-ink-primary mb-1">Page Not Found</h1>
            <p className="text-xs text-ink-muted mb-6 max-w-sm">
              The requested path <code className="px-1.5 py-0.5 rounded bg-surface-subtle border border-border font-mono text-[11px] text-ink-primary">{currentPath}</code> does not exist or has been removed.
            </p>
            <Button variant="primary" size="sm" onClick={() => navigateTo('/')}>
              Return to Dashboard
            </Button>
          </div>
        );
    }
  };

  return (
    <AppShell currentPath={currentPath} onNavigate={navigateTo}>
      {renderContent()}
    </AppShell>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
