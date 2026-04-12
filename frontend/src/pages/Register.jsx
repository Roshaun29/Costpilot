import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, CheckCircle, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

import { register } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import Button from '../components/ui/Button';

const PWD_STRENGTH = ['bg-[#FF4A6A]', 'bg-[#FF9900]', 'bg-[#FFC107]', 'bg-[#B6FF4A]'];

export default function Register() {
  const navigate = useNavigate();
  const setAuth = useAuthStore(state => state.setAuth);
  
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const calculatePwdStrength = (p) => {
    if (!p) return 0;
    let score = 0;
    if (p.length > 7) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/\d/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      return setError('Passwords do not match');
    }
    
    if (loading) return;
    setLoading(true);
    setError('');
    
    try {
      const res = await register({ full_name: form.full_name, email: form.email, password: form.password });
      setAuth(res.data.data.token, res.data.data.user);
      toast.success('Registration successful. Welcome to CostPilot!');
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
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
        <div className="w-full max-w-md space-y-6">
          <div className="text-center lg:text-left mb-8">
            <h2 className="text-3xl font-display font-bold text-white mb-2">Create Account</h2>
            <p className="text-[#8A8A9A]">Build your intelligent multi-cloud dashboard.</p>
          </div>
          
          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-[#8A8A9A] mb-1 uppercase tracking-wider">Full Name</label>
              <input 
                type="text" required
                value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})}
                className="w-full bg-[#111114] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#B6FF4A]/50 transition-colors"
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-[#8A8A9A] mb-1 uppercase tracking-wider">Email address</label>
              <input 
                type="email" required
                value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                className="w-full bg-[#111114] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#B6FF4A]/50 transition-colors"
                placeholder="you@company.com"
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-[#8A8A9A] mb-1 uppercase tracking-wider">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} required
                  value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                  className="w-full bg-[#111114] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#B6FF4A]/50 transition-colors font-mono"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8A8A9A] hover:text-white transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="flex gap-1 mt-2">
                {[1,2,3,4].map(i => (
                  <div key={i} className={`h-1 flex-1 rounded-full ${calculatePwdStrength(form.password) >= i ? PWD_STRENGTH[i-1] : 'bg-[#111114] border border-white/5'}`} />
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-[#8A8A9A] mb-1 uppercase tracking-wider">Confirm Password</label>
              <input 
                type="password" required
                value={form.confirm} onChange={e => setForm({...form, confirm: e.target.value})}
                className="w-full bg-[#111114] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#B6FF4A]/50 transition-colors font-mono"
                placeholder="••••••••"
              />
            </div>
            
            {error && <div className="p-3 bg-[#FF4A6A]/10 border border-[#FF4A6A]/20 rounded-lg text-[#FF4A6A] text-sm font-medium">{error}</div>}
            
            <Button type="submit" className="w-full justify-center py-3 mt-2" size="lg" loading={loading}>Deploy Space</Button>
          </form>
          
          <div className="text-center pt-2">
            <Link to="/login" className="text-sm font-bold text-[#8A8A9A] hover:text-white transition-colors">
              Already have an account? <span className="text-[#B6FF4A]">Sign in &rarr;</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
