import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#0A0A0B] flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-[120px] font-display font-black text-white/5 leading-none select-none">404</h1>
      <h2 className="text-2xl font-display font-medium text-white mt-4 mb-4">Page not found</h2>
      <p className="text-[#8A8A9A] mb-8">The requested sector does not exist within the simulation boundary.</p>
      <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
    </div>
  );
}
