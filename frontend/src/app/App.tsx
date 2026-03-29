import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { RegisterPage } from '../features/auth/pages/RegisterPage';
import { HomePage } from '../features/home/pages/HomePage';
import { SocialHubPage } from '../features/social/pages/SocialHubPage';
import { StockDetailPage } from '../features/stocks/pages/StockDetailPage';
import { GroupDetailPage } from '../features/groups/pages/GroupDetailPage';
import { AdminDashboardPage } from '../features/admin/pages/AdminDashboardPage';
import { ProtectedRoute } from '../routes/ProtectedRoute';
import { MainLayout } from '../shared/layout/MainLayout';

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: 'stocks/:symbol', element: <StockDetailPage /> },
          { path: 'social', element: <SocialHubPage /> },
          { path: 'groups/:groupId', element: <GroupDetailPage /> },
        ],
      },
      {
        element: <ProtectedRoute requireSuperuser />,
        children: [
          { path: 'admin', element: <AdminDashboardPage /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}
