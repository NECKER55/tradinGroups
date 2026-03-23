import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { RegisterPage } from '../features/auth/pages/RegisterPage';
import { HomePage } from '../features/home/pages/HomePage';
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
      // Workspace page removed per UX request; keep other routes here
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
