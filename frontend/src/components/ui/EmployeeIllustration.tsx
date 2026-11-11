import React from 'react';

interface EmployeeIllustrationProps {
  className?: string;
  size?: number;
}

export const EmployeeIllustration: React.FC<EmployeeIllustrationProps> = ({ 
  className = "w-28 h-28 sm:w-32 sm:h-32",
}) => {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      {/* Background Soft Ambient Circle */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-100 via-blue-50 to-indigo-100/80 border border-blue-200/50 shadow-inner" />
      
      {/* Friendly Employee Avatar Illustration SVG */}
      <svg 
        viewBox="0 0 160 160" 
        className="relative w-full h-full drop-shadow-sm select-none"
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Soft Background Accent Glow */}
        <circle cx="80" cy="80" r="70" fill="#E2EDFD" />
        <circle cx="80" cy="80" r="58" fill="#D3E4FD" />

        {/* Torso / Blue Polo Shirt */}
        <path 
          d="M32 152 C32 118 48 108 80 108 C112 108 128 118 128 152 Z" 
          fill="#2563EB" 
        />
        {/* Shirt Collar / Details */}
        <path d="M68 108 L80 126 L92 108 Z" fill="#1D4ED8" />
        <path d="M60 108 L72 124 L66 128 L54 112 Z" fill="#3B82F6" />
        <path d="M100 108 L88 124 L94 128 L106 112 Z" fill="#3B82F6" />
        
        {/* Lanyard Strap */}
        <path d="M72 118 L76 142 L80 142 L76 118 Z" fill="#93C5FD" />
        <path d="M88 118 L84 142 L80 142 L84 118 Z" fill="#93C5FD" />
        {/* White ID Card Badge */}
        <rect x="73" y="136" width="14" height="18" rx="2" fill="#FFFFFF" stroke="#93C5FD" strokeWidth="1" />
        <rect x="76" y="140" width="8" height="2" rx="1" fill="#2563EB" />
        <circle cx="80" cy="146" r="2" fill="#3B82F6" />
        <rect x="76" y="150" width="8" height="1.5" rx="0.5" fill="#94A3B8" />

        {/* Neck */}
        <path d="M72 96 C72 106 88 106 88 96 L88 90 L72 90 Z" fill="#FBCFE8" />
        <path d="M72 90 H88 V100 C88 106 72 106 72 100 Z" fill="#FDBA74" />

        {/* Head / Face */}
        <path 
          d="M54 64 C54 44 64 36 80 36 C96 36 106 44 106 64 C106 84 96 94 80 94 C64 94 54 84 54 64 Z" 
          fill="#FED7AA" 
        />

        {/* Ears */}
        <circle cx="53" cy="66" r="6" fill="#FDBA74" />
        <circle cx="107" cy="66" r="6" fill="#FDBA74" />

        {/* Modern Dark Hair Style */}
        <path 
          d="M52 58 C50 42 62 26 80 26 C96 26 108 34 108 50 C108 54 106 58 104 62 C101 52 94 48 88 48 C80 48 76 52 70 48 C64 44 58 48 54 56 Z" 
          fill="#1E293B" 
        />
        {/* Hair Strands / Volume */}
        <path d="M50 50 C54 36 68 28 82 28 C92 28 104 33 107 44 C102 38 92 34 82 34 C70 34 58 40 50 50 Z" fill="#0F172A" />

        {/* Friendly Eyes */}
        <circle cx="68" cy="62" r="3.2" fill="#0F172A" />
        <circle cx="92" cy="62" r="3.2" fill="#0F172A" />
        <circle cx="69" cy="61" r="1" fill="#FFFFFF" />
        <circle cx="93" cy="61" r="1" fill="#FFFFFF" />

        {/* Eyebrows */}
        <path d="M64 56 C67 54 72 55 74 57" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
        <path d="M96 56 C93 54 88 55 86 57" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />

        {/* Smiling Mouth */}
        <path d="M72 74 C75 80 85 80 88 74" stroke="#DC2626" strokeWidth="2.2" strokeLinecap="round" />
        {/* Cheerful Blush */}
        <ellipse cx="63" cy="70" rx="3.5" ry="2" fill="#FCA5A5" opacity="0.6" />
        <ellipse cx="97" cy="70" rx="3.5" ry="2" fill="#FCA5A5" opacity="0.6" />

        {/* Raised Right Hand with Thumbs Up 👍 */}
        <g transform="translate(118, 92)">
          {/* Forearm / Sleeve */}
          <path d="M-6 42 C-4 28 6 18 14 16 L20 28 C16 34 8 44 0 52 Z" fill="#2563EB" />
          {/* Fist / Palm */}
          <circle cx="16" cy="18" r="8" fill="#FED7AA" />
          {/* Thumb Up */}
          <path 
            d="M14 16 C14 10 16 2 20 2 C23 2 24 5 23 10 L21 16 Z" 
            fill="#FDBA74" 
            stroke="#FED7AA" 
            strokeWidth="2" 
          />
          {/* Knuckles */}
          <path d="M12 16 C15 14 19 16 21 18" stroke="#F97316" strokeWidth="1" strokeLinecap="round" />
          <path d="M10 20 C13 18 17 20 19 22" stroke="#F97316" strokeWidth="1" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
};

