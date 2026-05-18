import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Layout from '@/components/Layout';

const Onboarding = lazy(() => import('@/pages/Onboarding'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Search = lazy(() => import('@/pages/Search'));
const Settings = lazy(() => import('@/pages/Settings'));

function PageFallback() {
  return (
    <div className="flex-1 flex items-center justify-center" style={{ background: '#07090f' }}>
      <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
    </div>
  );
}

function AppRouter() {
  const { data: magazines, isLoading } = useQuery({
    queryKey: ['magazines'],
    queryFn: api.magazines.list,
  });

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: '#07090f' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <p className="text-slate-400 text-sm">Starte Pick·n·Light…</p>
        </div>
      </div>
    );
  }

  const hasNoMagazines = !magazines || magazines.length === 0;

  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route
            path="/*"
            element={
              hasNoMagazines ? (
                <Navigate to="/onboarding" replace />
              ) : (
                <Layout>
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/search" element={<Search />} />
                    <Route path="/settings" element={<Settings />} />
                  </Routes>
                </Layout>
              )
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default AppRouter;
