import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import StudentWorkspace from './pages/StudentWorkspace';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/workspace/:problemId" element={<StudentWorkspace />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
