import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, RefreshCw, Cloud } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import { SkeletonCard } from '../components/ui/Skeleton';

import { getAccounts, createAccount, deleteAccount, syncAccount } from '../api/accounts';
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
  const [addLoading, setAddLoading] = useState(false);
  const [newAcc, setNewAcc] = useState({ provider: '', account_name: '', region: 'us-east-1', monthly_budget: 5000 });

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

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newAcc.provider) return toast.error('Please select a provider');
    if (!newAcc.account_name) return toast.error('Account name required');

    setAddLoading(true);
    try {
      const payload = { ...newAcc, monthly_budget: Number(newAcc.monthly_budget) };
      await createAccount(payload);
      toast.success('Account added. Generating 90 days of historical data...');
      setShowAddModal(false);
      setNewAcc({ provider: '', account_name: '', region: 'us-east-1', monthly_budget: 5000 });
      await fetchAccounts();
      fetchStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add account');
    } finally {
      setAddLoading(false);
    }
  };

  const confirmDelete = async () => {
    setDeleteLoading(true);
    try {
      await deleteAccount(accountToDelete.id);
      toast.success('Account permanently deleted');
      setAccounts(accounts.filter(a => a.id !== accountToDelete.id));
      setShowDeleteModal(false);
      fetchStatus();
    } catch (err) {
      toast.error('Failed to delete account');
    } finally {
      setDeleteLoading(false);
      setAccountToDelete(null);
    }
  };

  const handleSync = async (id) => {
    setSyncingAccounts(prev => new Set(prev).add(id));
    // Optimistic UI update
    setAccounts(accounts.map(a => a.id === id ? { ...a, sync_status: 'syncing' } : a));
    try {
      const res = await syncAccount(id);
      toast.success(`Synced: ${res.data.data.new_data_points} records generated`);
      await fetchAccounts();
    } catch (err) {
      toast.error('Sync failed');
      await fetchAccounts();
    } finally {
      setSyncingAccounts(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const providers = [
    { id: 'aws', name: 'AWS', regions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'] },
    { id: 'azure', name: 'Azure', regions: ['eastus', 'westus2', 'westeurope', 'southeastasia'] },
    { id: 'gcp', name: 'GCP', regions: ['us-central1', 'us-east4', 'europe-west1', 'asia-northeast1'] }
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-medium text-white mb-1">Cloud Accounts</h1>
          <p className="text-text-secondary text-sm">Manage simulated connections and budgets.</p>
        </div>
        <Button icon={Plus} onClick={() => setShowAddModal(true)}>Add Account</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(3).fill(0).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 border border-dashed border-white/10 rounded-3xl bg-white/[0.01]">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
            <Cloud size={40} className="text-text-secondary" />
          </div>
          <h2 className="text-xl font-display font-medium text-white mb-2">No accounts connected</h2>
          <p className="text-text-secondary mb-6 text-center max-w-md">Add your first cloud account to instruct the Simulation Engine to begin monitoring workloads.</p>
          <Button variant="secondary" onClick={() => setShowAddModal(true)}>Connect Provider</Button>
        </div>
      ) : (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map(acc => {
            const utilization = 0; // Since cost calculation per actual month requires separate fetch, rendering placeholder or mapping directly. We'll use 0 for generic structure since budget is just field.
            const isSyncing = syncingAccounts.has(acc.id) || acc.sync_status === 'syncing';
            
            return (
              <motion.div key={acc.id} variants={itemVariants}>
                <Card className="h-full flex flex-col group hover:border-white/20 transition-colors relative overflow-hidden">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <Badge provider={acc.provider} className="uppercase mb-3 block w-max tracking-wide">{acc.provider}</Badge>
                      <h3 className="text-lg font-display font-medium text-white mb-1">{acc.account_name}</h3>
                      <p className="font-mono text-xs text-text-secondary font-medium tracking-wider">{acc.account_id_simulated}</p>
                    </div>
                    <Badge status={isSyncing ? 'syncing' : acc.sync_status} className="capitalize">
                      {isSyncing ? 'Syncing...' : acc.sync_status}
                    </Badge>
                  </div>

                  <div className="space-y-4 flex-1">
                    <div className="flex items-center justify-between text-sm border-t border-white/5 pt-4">
                      <span className="text-text-secondary">Region</span>
                      <span className="text-white font-medium">{acc.region}</span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary">Monthly Budget</span>
                        <span className="text-white font-mono">${acc.monthly_budget.toLocaleString()}</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full bg-brand w-[25%] opacity-50`} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-8 pt-4 border-t border-white/5">
                    <span className="text-xs text-text-secondary">
                      {acc.last_synced_at ? `Synced ${formatDistanceToNow(new Date(acc.last_synced_at), { addSuffix: true })}` : 'Never synced'}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        icon={RefreshCw} 
                        onClick={() => handleSync(acc.id)} 
                        loading={isSyncing}
                        className={isSyncing ? 'animate-pulse' : ''}
                      >
                         Sync
                      </Button>
                      <button 
                        onClick={() => { setAccountToDelete(acc); setShowDeleteModal(true); }}
                        className="p-2 text-text-secondary hover:text-accent-red hover:bg-accent-red/10 rounded-xl transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Delete Account"
                      >
                        <Trash2 size={16} />
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
        onClose={() => !addLoading && setShowAddModal(false)} 
        title="Simulate New Cloud Account"
      >
        <form id="addAccountForm" onSubmit={handleAddSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-3">Cloud Provider</label>
            <div className="grid grid-cols-3 gap-4">
              {providers.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setNewAcc(prev => ({ ...prev, provider: p.id, region: p.regions[0] }));
                  }}
                  className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${newAcc.provider === p.id ? 'bg-brand/10 border-brand text-brand shadow-[0_0_15px_rgba(182,255,74,0.15)] ring-1 ring-brand' : 'bg-surface border-white/10 text-text-secondary hover:bg-white/5 hover:text-white'}`}
                >
                  <Cloud size={24} />
                  <span className="font-bold text-sm tracking-wide">{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Account Alias</label>
              <input 
                type="text" 
                required
                value={newAcc.account_name}
                onChange={e => setNewAcc({ ...newAcc, account_name: e.target.value })}
                className="w-full bg-surface border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/50 transition-all font-medium"
                placeholder="e.g. Production Data Lake"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Deployment Region</label>
                <select 
                  value={newAcc.region}
                  onChange={e => setNewAcc({ ...newAcc, region: e.target.value })}
                  disabled={!newAcc.provider}
                  className="w-full bg-surface border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-brand/50 disabled:opacity-50 transition-all cursor-pointer font-medium"
                >
                  {!newAcc.provider && <option value="">Select provider first</option>}
                  {newAcc.provider && providers.find(p => p.id === newAcc.provider)?.regions.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Monthly Budget</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary font-mono font-medium">$</span>
                  <input 
                    type="number" 
                    min="100"
                    step="100"
                    required
                    value={newAcc.monthly_budget}
                    onChange={e => setNewAcc({ ...newAcc, monthly_budget: e.target.value })}
                    className="w-full bg-surface border border-white/10 rounded-xl pl-8 pr-4 py-2.5 text-white focus:outline-none focus:border-brand/50 transition-all font-mono font-medium"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="pt-2 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowAddModal(false)} disabled={addLoading}>Cancel</Button>
            <Button type="submit" loading={addLoading}>Deploy Simulation</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Account"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowDeleteModal(false)} disabled={deleteLoading}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleteLoading}>Confirm Delete</Button>
          </>
        }
      >
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-accent-red/10 text-accent-red rounded-full flex items-center justify-center mb-6">
            <Trash2 size={32} />
          </div>
          <p className="text-white text-lg font-medium mb-2">Delete {accountToDelete?.account_name}?</p>
          <p className="text-text-secondary">This action cannot be undone. All simulated history, configuration metrics, and anomaly data will be permanently wiped.</p>
        </div>
      </Modal>
    </div>
  );
}
