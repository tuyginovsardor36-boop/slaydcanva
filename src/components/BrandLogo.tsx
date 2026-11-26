import React from 'react';

interface BrandLogoProps {
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ className = 'w-8 h-8' }) => {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="scRedRibbon" x1="12" y1="8" x2="46" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#EF4444" />
          <stop offset="48%" stopColor="#DC2626" />
          <stop offset="100%" stopColor="#991B1B" />
        </linearGradient>
        <linearGradient id="scDarkLayer" x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3F3F46" />
          <stop offset="100%" stopColor="#18181B" />
        </linearGradient>
      </defs>

      {/* Back red & dark stacked slide cards */}
      <rect x="20" y="13" width="32" height="24" rx="6" transform="rotate(-6 20 13)" fill="#DC2626" />
      <rect x="17" y="16" width="35" height="26" rx="6" transform="rotate(-2 17 16)" fill="url(#scDarkLayer)" stroke="#52525B" strokeWidth="0.8" />

      {/* Lower-left dark S-tail */}
      <path
        d="M19 36 C12 43, 12 52, 20 53 C28 54, 37 46, 40 41 L30 34 Z"
        fill="url(#scDarkLayer)"
        stroke="#52525B"
        strokeWidth="0.7"
      />

      {/* Crisp white slide card with red play triangle and 3 bars */}
      <rect x="22" y="19" width="29" height="22" rx="5.5" fill="#FFFFFF" />
      <path d="M28.5 25.5 L35.5 30 L28.5 34.5 Z" fill="#DC2626" />
      <rect x="38" y="25.5" width="9.5" height="2.2" rx="1.1" fill="#18181B" />
      <rect x="38" y="29" width="8" height="2.2" rx="1.1" fill="#18181B" />
      <rect x="38" y="32.5" width="5.8" height="2.2" rx="1.1" fill="#18181B" />

      {/* Bold crimson 3D S-ribbon wrapping around */}
      <path
        d="M42 11 C25 8, 12 15, 13 24 C14 31, 25 35, 31 41 C35 45, 34 51, 22 53 C34 55, 42 49, 41 41 C40 33, 27 29, 23 23 C20 18, 28 13, 42 11 Z"
        fill="url(#scRedRibbon)"
      />
    </svg>
  );
};
