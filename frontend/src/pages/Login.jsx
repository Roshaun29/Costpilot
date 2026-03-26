import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, CheckCircle, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

import { login } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import Button from '../components/ui/Button';

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore(state => state.setAuth);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await login(email, password);
      setAuth(res.data.data.token, res.data.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
      toast.error('Authentication rejected');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0A0A0B]">
      <div className="hidden lg:flex w-1/2 bg-[#0D0D10] border-r border-white/5 p-16 flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#B6FF4A] opacity-[0.03] rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        
        <div>
          <div className="flex items-center gap-2 text-[#B6FF4A] mb-16">
            <Zap size={32} fill="currentColor" />
            <span className="font-display font-bold text-2xl tracking-wide">CostPilot</span>
          </div>
          
          <h1 className="text-5xl font-display font-bold text-white mb-6 leading-tight max-w-lg">Intelligent cloud <br/>cost monitoring.</h1>
          
          <div className="space-y-6 mt-12">
            {[
              'Real-time simulation across AWS, Azure, GCP',
              'Isolation Forest & Z-Score anomaly detection',
              'Multi-channel dispatch with instant SMS alerts'
            ].map(feature => (
              <div key={feature} className="flex items-center gap-3">
                <CheckCircle size={20} className="text-[#B6FF4A] shrink-0" />
                <span className="text-[#8A8A9A] text-lg">{feature}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="text-[#8A8A9A] text-sm font-mono tracking-wider">© 2026 CostPilot Systems Ltd.</div>
      </div>
      
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-display font-bold text-white mb-2">Welcome back</h2>
            <p className="text-[#8A8A9A]">Enter your credentials to access your dashboard.</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-[#8A8A9A] mb-2 uppercase tracking-wider">Email address</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-[#111114] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#B6FF4A]/50 transition-colors"
                placeholder="you@company.com"
              />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-bold text-[#8A8A9A] uppercase tracking-wider">Password</label>
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-[#111114] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#B6FF4A]/50 transition-colors font-mono tracking-widest"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8A8A9A] hover:text-white transition-colors">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <input type="checkbox" id="remember" className="rounded accent-[#B6FF4A] w-4 h-4 cursor-pointer" />
              <label htmlFor="remember" className="text-sm text-[#8A8A9A] cursor-pointer">Remember me for 30 days</label>
            </div>
            
            {error && <div className="p-3 bg-[#FF4A6A]/10 border border-[#FF4A6A]/20 rounded-lg text-[#FF4A6A] text-sm font-medium">{error}</div>}
            
            <Button type="submit" className="w-full justify-center py-3.5 text-base" size="lg" loading={loading}>Sign In</Button>
          </form>
          
          <div className="text-center">
            <Link to="/register" className="text-sm font-bold text-[#8A8A9A] hover:text-white transition-colors">
              Don't have an account? <span className="text-[#B6FF4A]">Get started &rarr;</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
