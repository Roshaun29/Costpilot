import { useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { useSimulationStore } from '../../store/simulationStore';
import Modal from './Modal';
import Button from './Button';

export default function SimulationToggle() {
  const { isRunning, tickCount, toggle } = useSimulationStore();
  const [showModal, setShowModal] = useState(false);
  
  const handleAction = () => {
    if (isRunning) {
      setShowModal(true);
    } else {
      toggle();
    }
  };

  const confirmStop = () => {
    toggle();
    setShowModal(false);
  };
  
  return (
    <>
      <div className={`flex items-center h-10 px-4 rounded-full border transition-colors ${isRunning ? 'bg-brand/10 border-brand/30' : 'bg-white/5 border-white/10'}`}>
        <div className="flex items-center gap-3 pr-4 border-r border-white/10 mr-4">
          <div className="relative flex items-center justify-center w-2.5 h-2.5">
            {isRunning && (
              <span className="absolute inline-flex w-full h-full rounded-full opacity-75 animate-ping bg-brand"></span>
            )}
            <span className={`relative inline-flex w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-brand shadow-[0_0_8px_#B6FF4A]' : 'bg-gray-500'}`}></span>
          </div>
          <div className="flex flex-col justify-center">
            <span className={`text-xs font-bold ${isRunning ? 'text-brand' : 'text-text-secondary'}`}>
              {isRunning ? 'Simulation Active' : 'Simulation Paused'}
            </span>
            {isRunning && (
              <span className="text-[10px] text-text-secondary font-mono leading-none mt-0.5">Tick #{tickCount}</span>
            )}
          </div>
        </div>
        
        <button 
          onClick={handleAction}
          className={`flex items-center justify-center w-7 h-7 rounded-full transition-colors ${isRunning ? 'hover:bg-brand/20 text-brand' : 'hover:bg-white/10 text-white'}`}
          title={isRunning ? "Pause Simulation" : "Start Simulation"}
        >
          {isRunning ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
        </button>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Stop Simulation"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="danger" onClick={confirmStop}>Stop Engine</Button>
          </>
        }
      >
        <p className="text-text-secondary">Are you sure you want to pause the simulation engine? No background data will be generated until it is resumed.</p>
      </Modal>
    </>
  );
}
