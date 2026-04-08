import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import StudentWorkspace from './pages/StudentWorkspace';
import AdminDashboard from './pages/AdminDashboard';
import { ProblemsProvider } from './context/ProblemsContext';
import { isAdminAuthenticated } from './lib/adminAuth';

function ProtectedAdminRoute() {
  if (!isAdminAuthenticated()) {
    return <Navigate to="/" replace />;
  }
  return <AdminDashboard />;
}

function App() {
  return (
    <ProblemsProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/workspace/:problemId" element={<StudentWorkspace />} />
          <Route path="/admin" element={<ProtectedAdminRoute />} />
        </Routes>
      </BrowserRouter>
    </ProblemsProvider>
  );
}

export default App;
