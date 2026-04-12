import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, RefreshCw, Cloud, Shield, Play, Lock, ChevronRight, ArrowLeft, Globe, Flag } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import ProviderLogo from '../components/ui/ProviderLogo';
import { formatINR, usdToInr } from '../utils/currency';

import { getAccounts, createAccount, deleteAccount, syncAccount, connectRealAccount } from '../api/accounts';
import { useSimulationStore } from '../store/simulationStore';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.3 } }
};

export default function CloudAccounts() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [addStep, setAddStep] = useState(1); // 1: Provider, 2: Mode, 3: Form
  const [connectMode, setConnectMode] = useState(null); // 'real' | 'demo'
  const [addLoading, setAddLoading] = useState(false);
  const [newAcc, setNewAcc] = useState({ 
    provider: '', 
    account_name: '', 
    region: 'us-east-1', 
    monthly_budget: 5000,
    credentials: {} 
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [syncingAccounts, setSyncingAccounts] = useState(new Set());
  const fetchStatus = useSimulationStore(state => state.fetchStatus);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await getAccounts();
      setAccounts(res.data.data);
    } catch (err) {
      toast.error('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setShowAddModal(false);
    setAddStep(1);
    setConnectMode(null);
    setAddLoading(false);
    setNewAcc({ provider: '', account_name: '', region: 'us-east-1', monthly_budget: 5000, credentials: {} });
  };

  const handleSync = async (id) => {
    if (syncingAccounts.has(id)) return;
    setSyncingAccounts(prev => new Set(prev).add(id));
    try {
      const res = await syncAccount(id);
      toast.success(`Sync Complete: ${res.data.data.new_data_points} vectors processed.`);
      fetchAccounts();
    } catch (err) {
      toast.error('Sync failed. Telemetry offline.');
    } finally {
      setSyncingAccounts(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const confirmDelete = async () => {
    if (!accountToDelete || deleteLoading) return;
    setDeleteLoading(true);
    try {
      await deleteAccount(accountToDelete.id || accountToDelete._id);
      toast.success('Account metadata and records purged.');
      setShowDeleteModal(false);
      fetchAccounts();
      fetchStatus();
    } catch (err) {
      toast.error('Purge failed. Resource locked.');
    } finally {
      setDeleteLoading(false);
      setAccountToDelete(null);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (addLoading) return;
    setAddLoading(true);
    try {
      const payload = { 
        provider: newAcc.provider,
        account_name: newAcc.account_name,
        region: newAcc.region,
        monthly_budget: Number(newAcc.monthly_budget)
      };

      if (connectMode === 'real') {
        await connectRealAccount({ ...payload, credentials: newAcc.credentials });
        toast.success(`Successfully connected to real ${newAcc.provider.toUpperCase()} account!`);
      } else {
        await createAccount(payload);
        toast.success('Simulation deployed. Generating historical data...');
      }
      
      resetModal();
      await fetchAccounts();
      fetchStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Connection failed. Please check credentials.');
    } finally {
      setAddLoading(false);
    }
  };

  const providers = [
    { id: 'aws', name: 'AWS', flag: '🇺🇸', regions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1', 'ap-south-1'] },
    { id: 'azure', name: 'Azure', flag: '🇪🇺', regions: ['eastus', 'westus2', 'westeurope', 'southeastasia'] },
    { id: 'gcp', name: 'GCP', flag: '🌍', regions: ['us-central1', 'us-east4', 'europe-west1', 'asia-northeast1'] }
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-medium text-white mb-1">Cloud Accounts</h1>
          <p className="text-text-secondary text-sm">Real-time sync and cost simulation control center.</p>
        </div>
        <Button icon={Plus} onClick={() => setShowAddModal(true)}>Add Account</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(3).fill(0).map((_, i) => <div key={i} className="h-[280px] shimmer rounded-3xl" />)}
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 border border-dashed border-white/10 rounded-3xl bg-white/[0.01]">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
            <Cloud size={40} className="text-text-secondary" />
          </div>
          <h2 className="text-xl font-display font-medium text-white mb-2">No accounts connected</h2>
          <p className="text-text-secondary mb-6 text-center max-w-md">Connect a real account or start a simulation to monitor workloads.</p>
          <Button variant="secondary" onClick={() => setShowAddModal(true)}>Connect Provider</Button>
        </div>
      ) : (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map(acc => {
            const isSyncing = syncingAccounts.has(acc.id) || acc.sync_status === 'syncing';
            
            return (
              <motion.div key={acc.id} variants={itemVariants}>
                <Card className="h-full flex flex-col group hover:border-brand/40 transition-all relative overflow-hidden">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <ProviderLogo provider={acc.provider} width={40} height={24} />
                        <span className="text-[10px] font-bold tracking-tighter text-text-muted uppercase">{acc.provider}</span>
                      </div>
                      <h3 className="text-lg font-display font-bold text-white mb-1">{acc.account_name}</h3>
                      <p className="font-mono text-[10px] text-text-muted font-medium tracking-widest">{acc.account_id_simulated || 'ID: UNKNOWN'}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge status={isSyncing ? 'syncing' : acc.sync_status}>
                        {isSyncing ? 'Syncing...' : (acc.sync_status === 'synced' ? 'Synced' : 'Error')}
                      </Badge>
                      <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${acc.is_real ? 'bg-accent-cyan/10 text-accent-cyan ring-1 ring-accent-cyan/20' : 'bg-brand/10 text-brand ring-1 ring-brand/20'}`}>
                        {acc.is_real ? 'REAL' : 'DEMO'}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 flex-1">
                    <div className="flex items-center justify-between text-xs border-t border-white/5 pt-4">
                      <span className="text-text-secondary flex items-center gap-1"><Globe size={12}/> Region</span>
                      <span className="text-white font-bold">{acc.region}</span>
                    </div>
                    
                    <div className="space-y-2">
                       <div className="flex justify-between text-xs">
                        <span className="text-text-secondary">Monthly Budget</span>
                        <span className="text-white font-mono font-bold">{formatINR(acc.monthly_budget)}</span>
                      </div>
                      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full bg-brand w-[30%] opacity-50`} />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 pt-2">
                      {['EC2', 'RDS', 'S3', 'Lambda'].map(s => (
                        <span key={s} className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] text-text-muted border border-white/5">{s}</span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-8 pt-4 border-t border-white/5">
                    <span className="text-[10px] text-text-muted font-mono uppercase tracking-tighter">
                      {acc.last_synced_at ? `Update: ${formatDistanceToNow(new Date(acc.last_synced_at), { addSuffix: true })}` : 'OFFLINE'}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        icon={RefreshCw} 
                        onClick={() => handleSync(acc.id)} 
                        loading={isSyncing}
                        className="text-[10px]"
                      >
                         Sync
                      </Button>
                      <button 
                        onClick={() => { setAccountToDelete(acc); setShowDeleteModal(true); }}
                        className="p-1.5 text-text-muted hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <Modal 
        isOpen={showAddModal} 
        onClose={() => !addLoading && resetModal()} 
        title={addStep === 1 ? "Connect Cloud Provider" : addStep === 2 ? "Select Connection Mode" : `Configure ${newAcc.provider.toUpperCase()} Integration`}
      >
        <div className="min-h-[420px] pt-2">
          {addStep === 1 && (
            <div className="space-y-6">
              <p className="text-sm text-text-secondary">Choose the infrastructure provider you wish to monitor.</p>
              <div className="grid grid-cols-1 gap-4">
                {providers.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                        setNewAcc(prev => ({ ...prev, provider: p.id, region: p.regions[0] }));
                        setAddStep(2);
                    }}
                    className="p-6 rounded-2xl border border-white/10 bg-surface flex items-center justify-between group hover:border-brand transition-all"
                  >
                    <div className="flex items-center gap-6">
                      <div className="p-3 bg-white/5 rounded-xl group-hover:bg-brand/10 transition-all">
                        <ProviderLogo provider={p.id} width={60} height={36} />
                      </div>
                      <div className="text-left">
                        <h4 className="font-bold text-white text-lg">{p.name}</h4>
                        <p className="text-xs text-text-secondary">AWS Cloud Monitoring Services</p>
                      </div>
                    </div>
                    <ChevronRight className="text-text-muted group-hover:text-brand" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {addStep === 2 && (
            <div className="space-y-6">
               <button onClick={() => setAddStep(1)} className="flex items-center gap-2 text-xs text-text-muted hover:text-brand mb-4">
                <ArrowLeft size={14} /> Back to providers
              </button>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => { setConnectMode('real'); setAddStep(3); }}
                  className="p-6 rounded-2xl border border-white/10 bg-surface flex flex-col items-center text-center gap-4 group hover:border-accent-cyan transition-all"
                >
                  <div className="w-14 h-14 bg-accent-cyan/10 text-accent-cyan rounded-full flex items-center justify-center">
                    <Shield size={28} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white mb-1">Connect Real Account</h4>
                    <p className="text-xs text-text-secondary leading-relaxed">Fetch live billing data from Cost Explorer API. Read-only permissions.</p>
                  </div>
                  <div className="mt-2 px-3 py-1 rounded bg-accent-cyan/20 text-accent-cyan text-[10px] font-black uppercase">Real Data</div>
                </button>

                <button
                   onClick={() => { setConnectMode('demo'); setAddStep(3); }}
                   className="p-6 rounded-2xl border border-white/10 bg-surface flex flex-col items-center text-center gap-4 group hover:border-brand transition-all"
                >
                  <div className="w-14 h-14 bg-brand/10 text-brand rounded-full flex items-center justify-center">
                    <Play size={28} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white mb-1">Demo Mode</h4>
                    <p className="text-xs text-text-secondary leading-relaxed">Generate realistic cost drift and spikes without real credentials.</p>
                  </div>
                  <div className="mt-2 px-3 py-1 rounded bg-brand/20 text-brand text-[10px] font-black uppercase">Simulated</div>
                </button>
              </div>
            </div>
          )}

          {addStep === 3 && (
            <form onSubmit={handleAddSubmit} className="space-y-6">
               <button type="button" onClick={() => setAddStep(2)} className="flex items-center gap-2 text-xs text-text-muted hover:text-brand mb-4">
                <ArrowLeft size={14} /> Back to connection mode
              </button>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">Integration Nickname</label>
                  <input 
                    type="text" 
                    required
                    value={newAcc.account_name}
                    onChange={e => setNewAcc({ ...newAcc, account_name: e.target.value })}
                    className="w-full"
                    placeholder="e.g. AWS Production Cluster"
                  />
                </div>

                {connectMode === 'real' ? (
                  <>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">Access Key ID</label>
                        <input 
                          type="text" 
                          required
                          onChange={e => setNewAcc({ ...newAcc, credentials: { ...newAcc.credentials, access_key: e.target.value }})}
                          placeholder="AKIA..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">Secret Access Key</label>
                        <input 
                          type="password" 
                          required
                          onChange={e => setNewAcc({ ...newAcc, credentials: { ...newAcc.credentials, secret_key: e.target.value }})}
                          placeholder="••••••••••••••••"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                     <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">Simulation Intensity</label>
                     <input type="range" className="w-full h-2 bg-white/5 rounded-lg appearance-none cursor-pointer accent-brand" />
                     <div className="flex justify-between text-[10px] text-text-muted mt-2 uppercase font-bold">
                        <span>Low Noise</span>
                        <span>Medium</span>
                        <span>High Drift</span>
                     </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-2">
                   <div>
                    <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">Region</label>
                    <select value={newAcc.region} onChange={e => setNewAcc({ ...newAcc, region: e.target.value })}>
                      {providers.find(p => p.id === newAcc.provider)?.regions.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">Monthly Budget (INR)</label>
                    <input 
                       type="number" 
                       value={newAcc.monthly_budget}
                       onChange={e => setNewAcc({ ...newAcc, monthly_budget: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6 flex justify-end gap-3">
                <Button variant="ghost" onClick={resetModal} disabled={addLoading}>Cancel</Button>
                <Button type="submit" loading={addLoading}>
                  {connectMode === 'real' ? 'Validate & Connect' : 'Deploy Simulation'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Cloud Account"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowDeleteModal(false)} disabled={deleteLoading}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleteLoading}>Wipe Data & Metadata</Button>
          </>
        }
      >
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-accent-red/10 text-accent-red rounded-full flex items-center justify-center mb-6">
            <Trash2 size={32} />
          </div>
          <p className="text-white text-lg font-medium mb-2">Delete {accountToDelete?.account_name}?</p>
          <p className="text-text-secondary text-sm leading-relaxed">This will permanently purge all historical costs, anomalies, and configurations associated with this cloud provider resource.</p>
        </div>
      </Modal>
    </div>
  );
}
