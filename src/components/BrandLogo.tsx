import React from 'react';

export interface BrandLogoProps {
  /**
   * 'icon': Compact rounded emblem with official BV monogram & royal crest
   * 'horizontal': Official circular emblem + Typography + Tagline (header, sidebar brand header)
   * 'stacked': Large centered official circular emblem + Typography + Tagline (login screen, modal tops)
   * 'print': High-contrast official circular emblem (A4 printed vouchers and invoices)
   */
  variant?: 'icon' | 'horizontal' | 'stacked' | 'print';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  theme?: 'dark' | 'light';
  showTagline?: boolean;
}

export const BrandCrestImg: React.FC<{
  className?: string;
  isPrint?: boolean;
  style?: React.CSSProperties;
}> = ({
  className = 'w-10 h-10',
  isPrint = false,
  style,
}) => {
  return (
    <img
      src="/brand-logo.png"
      alt="Bandhan Vatika Royal Crest"
      width={56}
      height={56}
      style={{
        width: '56px',
        height: '56px',
        maxWidth: '56px',
        maxHeight: '56px',
        objectFit: 'contain',
        ...style,
      }}
      className={`rounded-full object-contain shrink-0 ${isPrint ? 'border border-[#C5A059]/40' : ''} ${className}`}
      loading="eager"
    />
  );
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  className = '',
  theme = 'light',
  showTagline = true,
}) => {
  const isDark = theme === 'dark';

  if (variant === 'icon') {
    const sizeClasses = {
      sm: 'w-7 h-7',
      md: 'w-10 h-10',
      lg: 'w-14 h-14',
      xl: 'w-20 h-20',
    }[size];

    return (
      <div className={`inline-flex items-center justify-center shrink-0 ${className}`}>
        <BrandCrestImg className={sizeClasses} />
      </div>
    );
  }

  if (variant === 'print') {
    return (
      <div className={`flex items-center space-x-3.5 ${className}`}>
        <BrandCrestImg className="w-14 h-14 shrink-0 shadow-xs" isPrint={true} />
        <div>
          <h1 className="font-brand font-black text-2xl tracking-wider text-[#14281D] leading-none uppercase">
            BANDHAN VATIKA
          </h1>
          {showTagline && (
            <p className="text-[10px] font-bold text-[#8B6B23] tracking-widest uppercase mt-1">
              Banquet Hall · Celebrations · Events
            </p>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'stacked') {
    const crestSize = {
      sm: 'w-14 h-14',
      md: 'w-20 h-20',
      lg: 'w-28 h-28',
      xl: 'w-36 h-36',
    }[size];

    const titleSize = {
      sm: 'text-xl',
      md: 'text-2xl sm:text-3xl',
      lg: 'text-3xl sm:text-4xl',
      xl: 'text-4xl sm:text-5xl',
    }[size];

    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        <BrandCrestImg
          className={`${crestSize} mb-3.5 filter drop-shadow-lg ring-2 ring-[#C5A059]/40 p-0.5 bg-black`}
        />
        <h1
          className={`font-black font-brand tracking-widest leading-tight ${titleSize} ${
            isDark ? 'text-[#F3E7C4]' : 'text-[#14281D]'
          }`}
        >
          BANDHAN VATIKA
        </h1>
        {showTagline && (
          <p
            className={`text-xs font-semibold tracking-[0.25em] uppercase mt-1 ${
              isDark ? 'text-[#C5A059]' : 'text-[#8B6B23]'
            }`}
          >
            Banquet Hall · Celebrations · Events
          </p>
        )}
      </div>
    );
  }

  // Default: 'horizontal'
  const crestSize = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  }[size];

  const titleSize = {
    sm: 'text-sm',
    md: 'text-base font-bold',
    lg: 'text-xl font-extrabold',
    xl: 'text-2xl font-black',
  }[size];

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <BrandCrestImg
        className={`${crestSize} shrink-0 filter drop-shadow-sm ring-1 ring-[#C5A059]/40 bg-black`}
      />
      <div className="flex flex-col min-w-0">
        <span
          className={`font-brand tracking-wider leading-tight truncate ${titleSize} ${
            isDark ? 'text-[#F3E7C4]' : 'text-[#14281D]'
          }`}
        >
          BANDHAN VATIKA
        </span>
        {showTagline && (
          <span
            className={`text-[9px] sm:text-[10px] tracking-widest uppercase font-medium truncate ${
              isDark ? 'text-[#B5A580]' : 'text-[#8B6B23]'
            }`}
          >
            Banquet Hall · Celebrations
          </span>
        )}
      </div>
    </div>
  );
};
