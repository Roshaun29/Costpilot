import { useEffect, useRef, useState } from 'react';

export function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(target);
  const prevRef = useRef(target);
  
  useEffect(() => {
    const start = prevRef.current;
    const diff = target - start;
    if (Math.abs(diff) < 0.001) return;
    
    const startTime = performance.now();
    
    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + diff * eased;
      setValue(current);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        prevRef.current = target;
      }
    };
    
    requestAnimationFrame(animate);
  }, [target, duration]);
  
  return value;
}
