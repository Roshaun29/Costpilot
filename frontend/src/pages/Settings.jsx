import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Save, AlertTriangle, Play, Settings as SettingsIcon, Bell as BellIcon, User as UserIcon, RefreshCw, Smartphone } from 'lucide-react';

import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import SimulationToggle from '../components/ui/SimulationToggle';
import Modal from '../components/ui/Modal';

import { useAuthStore } from '../store/authStore';
import { useSimulationStore } from '../store/simulationStore';
import { getSettings, updateSettings, updatePassword, sendTestAlert } from '../api/settings';
import { injectAnomaly } from '../api/simulation';
import { getAccounts } from '../api/accounts';
import api from '../api/axios'; // direct for fallback delete
import { useNavigate } from 'react-router-dom';

const PWD_STRENGTH = ['bg-accent-red', 'bg-orange-500', 'bg-yellow-500', 'bg-brand'];

export default function Settings() {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuthStore();
  const sim = useSimulationStore();
  
  const [activeTab, setActiveTab] = useState('profile'); // profile, notifications, simulation
  const [loading, setLoading] = useState(true);
  
  // Profile
  const [name, setName] = useState(user?.full_name || '');
  const [profileLoading, setProfileLoading] = useState(false);
  
  // Pass
  const [pwd, setPwd] = useState({ current: '', new: '', confirm: '' });
  const [pwdLoading, setPwdLoading] = useState(false);
  
  // Notifications
  const [phone, setPhone] = useState(user?.phone_number || '');
  const [prefs, setPrefs] = useState({ email: true, sms: false, in_app: true });
  const [threshold, setThreshold] = useState(25);
  const [notifLoading, setNotifLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  // Simulation
  const [accounts, setAccounts] = useState([]);
  const [injectForm, setInjectForm] = useState({ account_id: '', service: 'EC2', anomaly_type: 'spike' });
  const [injectLoading, setInjectLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [setRes, accRes] = await Promise.all([
        getSettings(),
        getAccounts()
      ]);
      const data = setRes.data.data;
      setPhone(data.phone_number || '');
      setPrefs(data.notification_prefs || { email: true, sms: false, in_app: true });
      setThreshold(data.alert_threshold_percent || 25);
      
      setAccounts(accRes.data.data);
      if (accRes.data.data.length > 0) {
        setInjectForm(prev => ({ ...prev, account_id: accRes.data.data[0].id }));
      }
    } catch (err) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSave = async () => {
    setProfileLoading(true);
    try {
      await api.put('/api/auth/me', { full_name: name });
      updateUser({ full_name: name });
      toast.success('Profile updated');
    } catch (err) {
      toast.error('Update failed');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSave = async () => {
    if (pwd.new !== pwd.confirm) return toast.error('Passwords do not match');
    setPwdLoading(true);
    try {
      await updatePassword({ current_password: pwd.current, new_password: pwd.new });
      toast.success('Password updated');
      setPwd({ current: '', new: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setPwdLoading(false);
    }
  };

  const handlePhoneSave = async () => {
    if (phone && !/^\+[1-9]\d{1,14}$/.test(phone)) {
      return toast.error('E.164 format required (e.g., +1234567890)');
    }
    setNotifLoading(true);
    try {
      await updateSettings({ phone_number: phone || null });
      updateUser({ phone_number: phone || null });
      toast.success('Phone updated');
    } catch (err) {
      toast.error('Update failed');
    } finally {
      setNotifLoading(false);
    }
  };

  const handlePrefsSave = async () => {
    try {
      await updateSettings({ notification_prefs: prefs, alert_threshold_percent: threshold });
      toast.success('Preferences saved');
    } catch (err) {
      toast.error('Failed to save preferences');
    }
  };

  const handleTestAlert = async () => {
    setTestLoading(true);
    try {
      const res = await sendTestAlert();
      const tested = res.data.data.channels_tested;
      if (tested.includes('sms') || tested.includes('email')) {
        toast.success(`✓ Test alert sent! Checked: ${tested.join(', ')}`);
      } else {
        toast('⚠ Test alert sent to in-app only. Configure SMS/email first.', { icon: '⚠' });
      }
    } catch (err) {
      toast.error('Test dispatch failed');
    } finally {
      setTestLoading(false);
    }
  };

  const handleInject = async () => {
    if (!injectForm.account_id) return toast.error('Select an account');
    setInjectLoading(true);
    try {
      await injectAnomaly(injectForm);
      toast.success('Anomaly injected. Detection running...');
      setTimeout(() => sim.fetchStatus(), 2000); // Wait for background
    } catch (err) {
      toast.error('Injection failed');
    } finally {
      setInjectLoading(false);
    }
  };

  const calculatePwdStrength = (p) => {
    if (!p) return 0;
    let score = 0;
    if (p.length > 7) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/\d/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  };

  const tabs = [
    { id: 'profile', icon: UserIcon, label: 'Profile' },
    { id: 'notifications', icon: BellIcon, label: 'Notifications' },
    { id: 'simulation', icon: RefreshCw, label: 'Simulation Engine' },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-medium text-white mb-1">Configuration</h1>
          <p className="text-text-secondary text-sm">Control preferences and operational boundaries.</p>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-white/10 pb-px overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${activeTab === t.id ? 'border-brand text-brand' : 'border-transparent text-text-secondary hover:text-white'}`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="p-16 flex justify-center"><div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin"></div></Card>
      ) : activeTab === 'profile' ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <Card>
            <h2 className="text-lg font-display font-medium mb-6 flex items-center gap-2 border-b border-white/10 pb-4">Personal Information</h2>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-bold text-text-secondary mb-2">Full Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-brand/50 font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-text-secondary mb-2">Email Address</label>
                <input 
                  type="email" 
                  value={user?.email}
                  disabled
                  className="w-full bg-white/5 border border-transparent rounded-xl px-4 py-2 text-text-secondary cursor-not-allowed opacity-50 font-medium"
                />
              </div>
              <div className="pt-2">
                <Button onClick={handleProfileSave} loading={profileLoading}>Save Changes</Button>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-display font-medium mb-6 flex items-center gap-2 border-b border-white/10 pb-4">Security</h2>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-bold text-text-secondary mb-2">Current Password</label>
                <input 
                  type="password" 
                  value={pwd.current}
                  onChange={e => setPwd({...pwd, current: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-brand/50 font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-text-secondary mb-2">New Password</label>
                <input 
                  type="password" 
                  value={pwd.new}
                  onChange={e => setPwd({...pwd, new: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-brand/50 font-mono"
                />
                <div className="flex gap-1 mt-2">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full ${calculatePwdStrength(pwd.new) >= i ? PWD_STRENGTH[i-1] : 'bg-white/10'}`} />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-text-secondary mb-2">Confirm New Password</label>
                <input 
                  type="password" 
                  value={pwd.confirm}
                  onChange={e => setPwd({...pwd, confirm: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-brand/50 font-mono"
                />
              </div>
              <div className="pt-2">
                <Button onClick={handlePasswordSave} loading={pwdLoading} disabled={!pwd.new || pwd.new !== pwd.confirm}>Update Password</Button>
              </div>
            </div>
          </Card>
        </motion.div>
      ) : activeTab === 'notifications' ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <Card>
            <h2 className="text-lg font-display font-medium mb-6 flex items-center gap-2 border-b border-white/10 pb-4">Verification Layer</h2>
            <div className="max-w-md space-y-4">
              <label className="block text-sm font-bold text-text-secondary mb-2 flex items-center gap-2"><Smartphone size={16}/> Registered Phone</label>
              <div className="flex gap-4">
                <input 
                  type="tel" 
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+1234567890"
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-brand/50 font-mono"
                />
                <Button variant="secondary" onClick={handlePhoneSave} loading={notifLoading}>Save</Button>
              </div>
              <p className="text-[11px] text-text-secondary tracking-wider uppercase">Required for SMS routing. E.164 formats strictly enforced.</p>
            </div>
          </Card>

          <Card>
            <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-6">
              <h2 className="text-lg font-display font-medium flex items-center gap-2">Alert Routing Policies</h2>
              <Button size="sm" onClick={handlePrefsSave}>Save Routes</Button>
            </div>
            
            <div className="space-y-4">
              {[
                { id: 'in_app', name: 'In-App Alerts', desc: 'Show alerts dynamically targeting the Topbar Bell.' },
                { id: 'email', name: 'Email Delivery', desc: 'Receive rich anomaly summaries dropping to registered email.' },
                { id: 'sms', name: 'SMS Overrides', desc: 'Trigger text notifications. Fails safely if unverified.' }
              ].map(c => (
                <div key={c.id} className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${prefs[c.id] ? 'bg-brand/5 border-brand/30' : 'bg-surface-raised border-white/10 hover:border-white/20'}`} onClick={() => setPrefs({...prefs, [c.id]: !prefs[c.id]})}>
                  <div>
                    <h3 className={`font-bold text-sm ${prefs[c.id] ? 'text-white' : 'text-text-secondary'}`}>{c.name}</h3>
                    <p className="text-xs text-text-secondary mt-1">{c.desc}</p>
                  </div>
                  <div className={`w-10 h-6 rounded-full flex items-center p-1 transition-colors ${prefs[c.id] ? 'bg-brand' : 'bg-white/10'}`}>
                    <div className={`w-4 h-4 bg-black rounded-full shadow-md transform transition-transform ${prefs[c.id] ? 'translate-x-4' : ''}`}></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-white/10">
              <label className="block font-bold text-sm mb-4">Sensitivity Threshold: <span className="text-brand font-mono ml-2">{threshold}%</span></label>
              <input 
                type="range" 
                min="5" max="100" step="5"
                value={threshold}
                onChange={e => setThreshold(Number(e.target.value))}
                className="w-full accent-brand"
              />
              <p className="text-xs text-text-secondary mt-2 font-mono">Alerts fire distinctly when measured deviation surpasses +{threshold}% statistical rolling baseline.</p>
            </div>
          </Card>
          
          <Card className="bg-[#18181D]">
            <h2 className="text-lg font-display font-medium mb-2 flex items-center gap-2">Diagnostics Engine</h2>
            <p className="text-sm text-text-secondary mb-6 line-clamp-2 w-2/3">Dry-run full architectural routes simulating an Isolation Forest positive hit against user configured nodes.</p>
            <Button icon={Play} onClick={handleTestAlert} loading={testLoading} variant="primary">Execute Diagnostic Pipeline</Button>
          </Card>

        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <Card>
            <h2 className="text-lg font-display font-medium mb-6">Simulation Status</h2>
            <div className="flex flex-col md:flex-row items-center gap-8 bg-black/40 p-6 rounded-xl border border-white/5">
              <div className="transform scale-125 origin-left">
                <SimulationToggle />
              </div>
              <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                <div>
                  <p className="text-xs text-text-secondary tracking-widest uppercase mb-1">State Marker</p>
                  <p className="text-sm font-mono font-bold text-white">{sim.tickCount}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary tracking-widest uppercase mb-1">Engaged Nodes</p>
                  <p className="text-sm font-mono font-bold text-white">{sim.accountsMonitored}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary tracking-widest uppercase mb-1">Last Sync</p>
                  <p className="text-[11px] font-mono font-bold text-brand h-5 flex items-end">
                    {sim.lastTickAt ? formatDistanceToNow(new Date(sim.lastTickAt), { addSuffix: true }).toUpperCase() : 'PENDING'}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-display font-medium mb-6 flex items-center gap-2">Inject ML Subversion</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-text-secondary mb-2">Target Account</label>
                  <select value={injectForm.account_id} onChange={e=>setInjectForm({...injectForm, account_id: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-brand/50 custom-date-input">
                    <option value="" disabled>Select Target</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-text-secondary mb-2">Target Service Node</label>
                  <select value={injectForm.service} onChange={e=>setInjectForm({...injectForm, service: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-brand/50 custom-date-input">
                    <option value="EC2">AWS EC2</option>
                    <option value="RDS">AWS RDS</option>
                    <option value="Virtual Machines">Azure VM</option>
                    <option value="Compute Engine">GCP Compute</option>
                    <option value="Blob Storage">Azure Blob</option>
                    <option value="S3">AWS S3</option>
                  </select>
                </div>
              </div>
              <div className="space-y-3">
                <label className="block text-sm font-bold text-text-secondary mb-1">Attack Vector</label>
                {['spike', 'drift', 'drop'].map(t => (
                  <div key={t} className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors ${injectForm.anomaly_type === t ? 'bg-accent-red/10 border-accent-red text-white' : 'bg-surface border-white/10 text-text-secondary hover:bg-white/5'}`} onClick={() => setInjectForm({...injectForm, anomaly_type: t})}>
                    <input type="radio" checked={injectForm.anomaly_type === t} readOnly className="accent-accent-red" />
                    <div>
                      <p className="font-bold text-sm capitalize">{t}</p>
                      <p className="text-[10px] uppercase tracking-wider">{t === 'spike' ? 'Instant 300%+ vertical trajectory' : t === 'drift' ? 'Sequential +30% bleeding bounds' : 'Instant structural reduction'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-white/10 text-right">
              <Button variant="danger" onClick={handleInject} loading={injectLoading}>Deploy Anomaly</Button>
            </div>
          </Card>
          
          <Card className="bg-[#FF4A6A]/5 border-accent-red/20">
            <h2 className="text-lg font-display text-accent-red font-medium mb-2">Destructive Sector</h2>
            <p className="text-sm text-white/50 mb-6 w-2/3">Purge all datasets entirely formatting analytical layers globally representing blank origin.</p>
            <Button variant="danger" onClick={() => setShowResetModal(true)}>Execute Wipe</Button>
          </Card>
        </motion.div>
      )}

      <Modal isOpen={showResetModal} onClose={() => setShowResetModal(false)} title="Format Origin">
        <p className="text-text-secondary mb-8">This strictly drops the full CostData and Anomalies cluster. Action translates into hard unrecoverable zero-state.</p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setShowResetModal(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => {
            // Fake request acting as visual
            toast.success("Dataset Formatted System-wide");
            setShowResetModal(false);
            window.location.reload();
          }}>Confirm Execution</Button>
        </div>
      </Modal>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-date-input::-webkit-calendar-picker-indicator { filter: invert(1); opacity: 0.5; cursor: pointer; }
      `}} />
    </div>
  );
}
