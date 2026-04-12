export const USD_INR_RATE = 83.5;

export const usdToInr = (usd) => usd * USD_INR_RATE;

export const formatINR = (usdAmount, options = {}) => {
  if (usdAmount === null || usdAmount === undefined) return "₹—";
  const inr = usdAmount * USD_INR_RATE;
  
  if (options.compact) {
    if (inr >= 10000000) return `₹${(inr / 10000000).toFixed(2)}Cr`;
    if (inr >= 100000) return `₹${(inr / 100000).toFixed(2)}L`;
    if (inr >= 1000) return `₹${(inr / 1000).toFixed(1)}K`;
  }
  
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(inr);
};

export const formatINRCompact = (usdAmount) => formatINR(usdAmount, { compact: true });

export const formatINRRate = (usdPerHour) => {
  const inrPerHour = usdPerHour * USD_INR_RATE;
  return `${formatINR(usdPerHour)}/hr`;
};
