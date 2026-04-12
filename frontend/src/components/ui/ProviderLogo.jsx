import React from 'react';

const logos = {
  aws: ({ width, height }) => (
    <svg viewBox="0 0 100 60" width={width} height={height}>
      <text x="50" y="32" textAnchor="middle" fontSize="28" fontWeight="900"
            fontFamily="Amazon Ember,Arial,sans-serif" fill="#FF9900">aws</text>
      <path d="M 20 42 Q 50 54 80 42" stroke="#FF9900" strokeWidth="3.5"
            fill="none" strokeLinecap="round"/>
      <polygon points="16,38 22,44 20,34" fill="#FF9900"/>
      <polygon points="84,38 78,44 80,34" fill="#FF9900"/>
    </svg>
  ),
  azure: ({ width, height }) => (
    <svg viewBox="0 0 100 60" width={width} height={height}>
      <polygon points="20,50 50,10 65,35" fill="#0078D4"/>
      <polygon points="65,35 80,50 20,50" fill="#50B0F0"/>
      <polygon points="50,10 80,50 65,35" fill="#0063B1"/>
      <text x="52" y="58" textAnchor="start" fontSize="10" fill="#0078D4"
            fontFamily="Segoe UI,Arial,sans-serif" fontWeight="600">Azure</text>
    </svg>
  ),
  gcp: ({ width, height }) => (
    <svg viewBox="0 0 100 60" width={width} height={height}>
      <path d="M 30 40 Q 25 28 35 22 Q 40 10 55 14 Q 68 8 72 22 Q 82 24 80 36 Q 82 46 70 46 L 35 46 Q 26 46 30 40 Z"
            fill="#4285F4"/>
      <circle cx="38" cy="50" r="4" fill="#EA4335"/>
      <circle cx="50" cy="50" r="4" fill="#FBBC04"/>
      <circle cx="62" cy="50" r="4" fill="#34A853"/>
    </svg>
  )
};

const ProviderLogo = ({ provider, width = 60, height = 36, variant = "color" }) => {
  const Logo = logos[provider.toLowerCase()] || logos.aws;
  return <div className="provider-logo-wrapper"><Logo width={width} height={height} /></div>;
};

export default ProviderLogo;
