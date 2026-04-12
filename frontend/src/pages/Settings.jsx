import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Save, AlertTriangle, Play, Settings as SettingsIcon,
  Bell as BellIcon, User as UserIcon, RefreshCw, Smartphone,
  Check, X, CheckCircle, Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';

const PWD_STRENGTH_LABEL = ['Weak', 'Fair', 'Good', 'Strong'];
const PWD_STRENGTH_COLORS = ['bg-accent-red', 'bg-orange-500', 'bg-yellow-500', 'bg-brand'];

// E.164 validation
const validatePhone = (val) => {
  const e164 = /^\+[1-9]\d{7,14}$/;
  if (!val) return 'Phone number is required for SMS alerts';
  if (!val.startsWith('+')) return 'Must start with + and country code (e.g. +14155552671)';
  if (!e164.test(val)) return 'Invalid format. Use E.164: +[country code][number]';
  return null;
};

export default function Settings() {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuthStore();
  const sim = useSimulationStore();

  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);

  // Profile
  const [name, setName] = useState(user?.full_name || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Password
  const [pwd, setPwd] = useState({ current: '', new: '', confirm: '' });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSaved, setPwdSaved] = useState(false);

  // Notifications
  const [phone, setPhone] = useState('');
  const [phoneBlurred, setPhoneBlurred] = useState(false);
  const [phoneError, setPhoneError] = useState(null);
  const [prefs, setPrefs] = useState({ email: true, sms: false, in_app: true });
  const [threshold, setThreshold] = useState(25);
  const [notifLoading, setNotifLoading] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(false);
  const [thresholdSaved, setThresholdSaved] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const thresholdTimerRef = useRef(null);

  // Simulation
  const [accounts, setAccounts] = useState([]);
  const [injectForm, setInjectForm] = useState({ account_id: '', service: 'EC2', anomaly_type: 'spike' });
  const [injectLoading, setInjectLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [setRes, accRes] = await Promise.all([getSettings(), getAccounts()]);
      const data = setRes.data.data;
      setPhone(data.phone_number || '');
      setPrefs(data.notification_prefs || { email: true, sms: false, in_app: true });
      setThreshold(data.alert_threshold_percent || 25);

      const accs = accRes.data.data;
      setAccounts(accs);
      if (accs.length > 0) {
        setInjectForm(prev => ({ ...prev, account_id: accs[0].id }));
      }
    } catch (err) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  // --- PROFILE ---
  const handleProfileSave = async () => {
    if (profileLoading) return;
    if (!name.trim()) return toast.error('Name cannot be empty');
    setProfileLoading(true);
    try {
      await api.put('/api/auth/me', { full_name: name.trim() });
      updateUser({ full_name: name.trim() });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setProfileLoading(false);
    }
  };

  // --- PASSWORD ---
  const calculatePwdStrength = (p) => {
    if (!p) return 0;
    let score = 0;
    if (p.length > 7) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/\d/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  };

  const handlePasswordSave = async () => {
    setPwdError('');
    if (!pwd.current) return setPwdError('Current password required');
    if (pwd.new.length < 8) return setPwdError('New password must be 8+ characters');
    if (calculatePwdStrength(pwd.new) < 2) return setPwdError('Password too weak. Mix uppercase, numbers, symbols.');
    if (pwd.new !== pwd.confirm) return setPwdError('Passwords do not match');

    if (pwdLoading) return;
    setPwdLoading(true);
    try {
      await updatePassword({ current_password: pwd.current, new_password: pwd.new });
      setPwdSaved(true);
      setPwd({ current: '', new: '', confirm: '' });
      setTimeout(() => setPwdSaved(false), 2500);
    } catch (err) {
      setPwdError(err.response?.data?.message || 'Update failed');
    } finally {
      setPwdLoading(false);
    }
  };

  // --- PHONE ---
  const handlePhoneChange = (val) => {
    setPhone(val);
    setPhoneSaved(false);
    if (phoneBlurred || val.length > 5) {
      setPhoneError(validatePhone(val));
    }
  };

  const handlePhoneSave = async () => {
    const err = validatePhone(phone);
    setPhoneError(err);
    if (err) return;
    if (notifLoading) return;
    setNotifLoading(true);
    try {
      await updateSettings({ phone_number: phone });
      updateUser({ phone_number: phone });
      setPhoneSaved(true);
      setTimeout(() => setPhoneSaved(false), 2500);
    } catch (err) {
      setPhoneError(err.response?.data?.message || 'Update failed');
    } finally {
      setNotifLoading(false);
    }
  };

  // --- CHANNEL TOGGLES (individual immediate save) ---
  const handleTogglePref = async (key) => {
    const newPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(newPrefs);
    try {
      await updateSettings({ notification_prefs: newPrefs });
    } catch (err) {
      // Revert on failure
      setPrefs(prefs);
      toast.error('Failed to save preference');
    }
  };

  // --- THRESHOLD (debounced 500ms) ---
  const handleThresholdChange = (val) => {
    setThreshold(Number(val));
    setThresholdSaved(false);
    if (thresholdTimerRef.current) clearTimeout(thresholdTimerRef.current);
    thresholdTimerRef.current = setTimeout(async () => {
      try {
        await updateSettings({ alert_threshold_percent: Number(val) });
        setThresholdSaved(true);
        setTimeout(() => setThresholdSaved(false), 1500);
      } catch (err) {
        toast.error('Failed to save threshold');
      }
    }, 500);
  };

  // --- TEST ALERT ---
  const handleTestAlert = async () => {
    if (testLoading) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await sendTestAlert();
      const { channels_tested, results } = res.data.data;
      setTestResult({ channels_tested, results });
      const smsOk = results.sms === 'sent';
      const emailOk = results.email === 'simulated';
      const inAppOk = results.in_app === 'success';
      toast.success(`Test dispatched: ${channels_tested.join(', ')}`);
    } catch (err) {
      toast.error('Test dispatch failed');
      setTestResult({ error: err.response?.data?.message || 'Unknown error' });
    } finally {
      setTestLoading(false);
    }
  };

  // --- INJECT ANOMALY ---
  const handleInject = async () => {
    if (!injectForm.account_id) return toast.error('Select an account');
    setInjectLoading(true);
    try {
      const res = await injectAnomaly(injectForm);
      const anoms = res.data.data.injected_anomalies || [];
      if (anoms.length > 0) {
        const a = anoms[0];
        toast.success(
          `Anomaly injected! ${a.service}: ${formatINR(a.actual_cost)} actual (+${Number(a.deviation_percent).toFixed(0)}%)`,
          { duration: 5000 }
        );
      } else {
        toast.success('Anomaly injected. Detection running...');
      }
      setTimeout(() => sim.fetchStatus(), 2000);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Injection failed');
    } finally {
      setInjectLoading(false);
    }
  };

  // --- RESET ALL DATA ---
  const handleResetConfirm = async () => {
    if (resetConfirmText !== 'RESET') return;
    setResetLoading(true);
    try {
      await api.delete('/api/simulation/reset-all');
      toast.success('All data wiped. Reloading...');
      setShowResetModal(false);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.success('Dataset Formatted System-wide');
      setShowResetModal(false);
      setTimeout(() => window.location.reload(), 1500);
    } finally {
      setResetLoading(false);
      setResetConfirmText('');
    }
  };

  const tabs = [
    { id: 'profile', icon: UserIcon, label: 'Profile' },
    { id: 'notifications', icon: BellIcon, label: 'Notifications' },
    { id: 'simulation', icon: RefreshCw, label: 'Simulation Engine' },
  ];

  const pwdStrength = calculatePwdStrength(pwd.new);

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
        <Card className="p-16 flex justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
        </Card>
      ) : activeTab === 'profile' ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Personal Info */}
          <Card>
            <h2 className="text-lg font-display font-medium mb-6 border-b border-white/10 pb-4">Personal Information</h2>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-bold text-text-secondary mb-2">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-brand/50 focus:outline-none font-medium transition-colors"
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
              <div className="pt-2 flex items-center gap-3">
                <Button onClick={handleProfileSave} loading={profileLoading} icon={Save}>Save Changes</Button>
                <AnimatePresence>
                  {profileSaved && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-brand text-sm flex items-center gap-1 font-medium"
                    >
                      <CheckCircle size={16} /> Saved!
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </Card>

          {/* Security */}
          <Card>
            <h2 className="text-lg font-display font-medium mb-6 border-b border-white/10 pb-4">Security</h2>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-bold text-text-secondary mb-2">Current Password</label>
                <input
                  type="password"
                  value={pwd.current}
                  onChange={e => setPwd({ ...pwd, current: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-brand/50 focus:outline-none font-mono transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-text-secondary mb-2">New Password</label>
                <input
                  type="password"
                  value={pwd.new}
                  onChange={e => setPwd({ ...pwd, new: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-brand/50 focus:outline-none font-mono transition-colors"
                />
                {pwd.new && (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${pwdStrength >= i ? PWD_STRENGTH_COLORS[i - 1] : 'bg-white/10'}`} />
                      ))}
                    </div>
                    <p className="text-xs mt-1 text-text-secondary">
                      Strength: <span className={pwdStrength >= 3 ? 'text-brand' : pwdStrength >= 2 ? 'text-yellow-400' : 'text-accent-red'}>
                        {PWD_STRENGTH_LABEL[pwdStrength - 1] || 'Very Weak'}
                      </span>
                    </p>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-bold text-text-secondary mb-2">Confirm New Password</label>
                <input
                  type="password"
                  value={pwd.confirm}
                  onChange={e => setPwd({ ...pwd, confirm: e.target.value })}
                  className={`w-full bg-black/40 border rounded-xl px-4 py-2 text-white focus:outline-none font-mono transition-colors ${
                    pwd.confirm && pwd.confirm !== pwd.new ? 'border-accent-red/60 focus:border-accent-red' : 'border-white/10 focus:border-brand/50'
                  }`}
                />
                {pwd.confirm && pwd.confirm !== pwd.new && (
                  <p className="text-xs text-accent-red mt-1">Passwords do not match</p>
                )}
              </div>
              {pwdError && (
                <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-xl px-4 py-2">{pwdError}</p>
              )}
              <div className="pt-2 flex items-center gap-3">
                <Button
                  onClick={handlePasswordSave}
                  loading={pwdLoading}
                  disabled={!pwd.new || !pwd.current || pwd.new !== pwd.confirm || pwdLoading}
                >
                  Update Password
                </Button>
                <AnimatePresence>
                  {pwdSaved && (
                    <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                      className="text-brand text-sm flex items-center gap-1 font-medium"
                    >
                      <CheckCircle size={16} /> Password updated!
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </Card>
        </motion.div>

      ) : activeTab === 'notifications' ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Phone Number */}
          <Card>
            <h2 className="text-lg font-display font-medium mb-6 border-b border-white/10 pb-4">Verification Layer</h2>
            <div className="max-w-md space-y-2">
              <label className="block text-sm font-bold text-text-secondary mb-2 flex items-center gap-2">
                <Smartphone size={16} /> Registered Phone
              </label>
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => handlePhoneChange(e.target.value)}
                    onBlur={() => { setPhoneBlurred(true); setPhoneError(validatePhone(phone)); }}
                    placeholder="+14155552671"
                    className={`w-full bg-black/40 border rounded-xl px-4 py-2 text-white placeholder:text-white/20 focus:outline-none font-mono transition-colors ${
                      phoneError ? 'border-accent-red/60 focus:border-accent-red' : phone && !phoneError ? 'border-brand/50' : 'border-white/10 focus:border-brand/50'
                    }`}
                  />
                  {phone && !phoneError && (
                    <CheckCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand" />
                  )}
                </div>
                <Button
                  variant="secondary"
                  onClick={handlePhoneSave}
                  loading={notifLoading}
                  disabled={!!phoneError || !phone}
                >
                  Save
                </Button>
              </div>
              {phoneError && (
                <p className="text-xs text-accent-red">{phoneError}</p>
              )}
              {!phoneError && !phone && (
                <p className="text-[11px] text-text-secondary">Format: +14155552671 (US) or +447911123456 (UK)</p>
              )}
              <AnimatePresence>
                {phoneSaved && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-xs text-brand flex items-center gap-1"
                  >
                    <CheckCircle size={12} /> Phone number saved!
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </Card>

          {/* Channel Toggles */}
          <Card>
            <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-6">
              <h2 className="text-lg font-display font-medium">Alert Routing Policies</h2>
              <p className="text-xs text-text-secondary">Toggles save immediately</p>
            </div>
            <div className="space-y-4">
              {[
                { id: 'in_app', name: 'In-App Alerts', desc: 'Show alerts in the Topbar Bell in real-time.' },
                { id: 'email', name: 'Email Delivery', desc: 'Receive rich anomaly summaries at your registered email.' },
                { id: 'sms', name: 'SMS Overrides', desc: 'Trigger text notifications via Twilio. Requires phone number.' }
              ].map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleTogglePref(c.id)}
                  className={`w-full p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-colors text-left ${prefs[c.id] ? 'bg-brand/5 border-brand/30' : 'bg-surface-raised border-white/10 hover:border-white/20'}`}
                >
                  <div>
                    <h3 className={`font-bold text-sm ${prefs[c.id] ? 'text-white' : 'text-text-secondary'}`}>{c.name}</h3>
                    <p className="text-xs text-text-secondary mt-0.5">{c.desc}</p>
                  </div>
                  <div className={`relative w-10 h-6 rounded-full flex items-center p-1 transition-colors shrink-0 ml-4 ${prefs[c.id] ? 'bg-brand' : 'bg-white/10'}`}>
                    <div className={`w-4 h-4 bg-black rounded-full shadow-md transform transition-transform ${prefs[c.id] ? 'translate-x-4' : ''}`} />
                  </div>
                </button>
              ))}
            </div>

            {/* Threshold Slider */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <div className="flex items-center justify-between mb-4">
                <label className="font-bold text-sm">
                  Sensitivity Threshold: <span className="text-brand font-mono ml-1">{threshold}%</span>
                </label>
                <AnimatePresence>
                  {thresholdSaved && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="text-xs text-brand flex items-center gap-1"
                    >
                      <Check size={12} /> Auto-saved
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <input
                type="range"
                min="5" max="100" step="5"
                value={threshold}
                onChange={e => handleThresholdChange(e.target.value)}
                className="w-full accent-brand"
              />
              <p className="text-xs text-text-secondary mt-2 font-mono">
                Alerts fire when deviation surpasses +{threshold}% above statistical rolling baseline.
              </p>
            </div>
          </Card>

          {/* Test Alert */}
          <Card className="bg-[#18181D]">
            <h2 className="text-lg font-display font-medium mb-2">Diagnostics Engine</h2>
            <p className="text-sm text-text-secondary mb-6 w-2/3">
              Dry-run full alert dispatch across all configured channels with a synthetic anomaly.
            </p>
            <Button icon={Play} onClick={handleTestAlert} loading={testLoading} variant="primary">
              Execute Diagnostic Pipeline
            </Button>
            <AnimatePresence>
              {testResult && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 p-4 bg-black/30 border border-white/10 rounded-xl text-sm space-y-2"
                >
                  {testResult.error ? (
                    <p className="text-accent-red flex items-center gap-2"><X size={14} /> {testResult.error}</p>
                  ) : (
                    Object.entries(testResult.results).map(([ch, val]) => (
                      <p key={ch} className="flex items-center gap-2 text-text-secondary">
                        {val === 'success' || val === 'sent' || val === 'simulated' ? (
                          <Check size={14} className="text-brand" />
                        ) : (
                          <X size={14} className="text-accent-red" />
                        )}
                        <span className="capitalize font-medium text-white">{ch.replace('_', '-')}</span>: {val}
                      </p>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>

      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Simulation Status */}
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

          {/* Inject Anomaly */}
          <Card>
            <h2 className="text-lg font-display font-medium mb-6 flex items-center gap-2">Inject ML Subversion</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-text-secondary mb-2">Target Account</label>
                  <select
                    value={injectForm.account_id}
                    onChange={e => setInjectForm({ ...injectForm, account_id: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-brand/50 focus:outline-none custom-date-input"
                  >
                    <option value="" disabled>Select Target</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-text-secondary mb-2">Target Service Node</label>
                  <select
                    value={injectForm.service}
                    onChange={e => setInjectForm({ ...injectForm, service: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-brand/50 focus:outline-none custom-date-input"
                  >
                    <option value="EC2">AWS EC2</option>
                    <option value="RDS">AWS RDS</option>
                    <option value="S3">AWS S3</option>
                    <option value="Lambda">AWS Lambda</option>
                    <option value="Virtual Machines">Azure VM</option>
                    <option value="Compute Engine">GCP Compute</option>
                    <option value="Blob Storage">Azure Blob</option>
                    <option value="BigQuery">GCP BigQuery</option>
                  </select>
                </div>
              </div>
              <div className="space-y-3">
                <label className="block text-sm font-bold text-text-secondary mb-1">Attack Vector</label>
                {['spike', 'drift', 'drop'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setInjectForm({ ...injectForm, anomaly_type: t })}
                    className={`w-full p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors text-left ${injectForm.anomaly_type === t ? 'bg-accent-red/10 border-accent-red text-white' : 'bg-surface border-white/10 text-text-secondary hover:bg-white/5'}`}
                  >
                    <input type="radio" checked={injectForm.anomaly_type === t} readOnly className="accent-accent-red shrink-0" />
                    <div>
                      <p className="font-bold text-sm capitalize">{t}</p>
                      <p className="text-[10px] uppercase tracking-wider">
                        {t === 'spike' ? 'Instant 300%+ vertical trajectory' : t === 'drift' ? 'Sequential +30% bleeding bounds' : 'Instant structural reduction'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-white/10 text-right">
              <Button variant="danger" onClick={handleInject} loading={injectLoading}>Deploy Anomaly</Button>
            </div>
          </Card>

          {/* Destructive Reset */}
          <Card className="bg-[#FF4A6A]/5 border-accent-red/20">
            <h2 className="text-lg font-display text-accent-red font-medium mb-2">Destructive Sector</h2>
            <p className="text-sm text-white/50 mb-6 w-2/3">
              Purge all datasets entirely, formatting analytical layers globally representing blank origin.
            </p>
            <Button variant="danger" onClick={() => { setShowResetModal(true); setResetConfirmText(''); }}>
              Execute Wipe
            </Button>
          </Card>
        </motion.div>
      )}

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => !resetLoading && setShowResetModal(false)}
        title="Format Origin"
        loading={resetLoading}
      >
        <div className="space-y-4">
          <p className="text-text-secondary">
            This strictly drops the full CostData and Anomalies cluster. Action translates into hard unrecoverable zero-state.
          </p>
          <div>
            <label className="block text-sm font-bold text-accent-red mb-2">
              Type <span className="font-mono bg-accent-red/10 px-2 py-0.5 rounded">RESET</span> to confirm
            </label>
            <input
              type="text"
              value={resetConfirmText}
              onChange={e => setResetConfirmText(e.target.value)}
              placeholder="RESET"
              className="w-full bg-black/40 border border-accent-red/30 rounded-xl px-4 py-2 text-white focus:border-accent-red/60 focus:outline-none font-mono"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowResetModal(false)} disabled={resetLoading}>Cancel</Button>
            <Button
              variant="danger"
              onClick={handleResetConfirm}
              loading={resetLoading}
              disabled={resetConfirmText !== 'RESET' || resetLoading}
            >
              Confirm Execution
            </Button>
          </div>
        </div>
      </Modal>

      <style dangerouslySetInnerHTML={{ __html: `.custom-date-input::-webkit-calendar-picker-indicator { filter: invert(1); opacity: 0.5; cursor: pointer; }` }} />
    </div>
  );
}
