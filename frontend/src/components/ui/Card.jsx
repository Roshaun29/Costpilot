import { motion } from 'framer-motion';

export default function Card({ children, className = '', variant = 'default', ...props }) {
  const variants = {
    default: "bg-surface border border-white/[0.07]",
    raised: "bg-surface-raised border border-white/[0.07] shadow-xl",
    glass: "glass shadow-2xl"
  };

  return (
    <div 
      className={`rounded-2xl p-6 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
