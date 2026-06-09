import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { Room } from './pages/Room';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/room/:roomId" element={<Room />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
