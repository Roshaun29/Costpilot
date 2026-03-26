import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, footer, size = "md" }) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const sizes = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-3xl",
    xl: "max-w-5xl"
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0 }}
              className={`bg-surface-raised border border-white/10 rounded-[20px] shadow-2xl w-full pointer-events-auto flex flex-col max-h-[90vh] ${sizes[size]}`}
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
                <h2 className="text-xl font-display font-medium text-text-primary">{title}</h2>
                <button 
                  onClick={onClose}
                  className="p-2 -mr-2 text-text-secondary hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto custom-scrollbar">
                {children}
              </div>
              {footer && (
                <div className="px-6 py-5 border-t border-white/5 flex items-center justify-end gap-3 bg-[#131317] rounded-b-[20px]">
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
