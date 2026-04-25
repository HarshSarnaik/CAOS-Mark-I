import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectPage from './pages/ProtectPage';
import RadarPage from './pages/RadarPage';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-16">
        <Routes>
          <Route path="/"      element={<ProtectPage />} />
          <Route path="/radar" element={<RadarPage />} />
        </Routes>
      </main>
    </div>
  );
}
