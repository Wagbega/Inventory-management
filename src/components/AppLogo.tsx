import React from 'react';

interface AppLogoProps {
  className?: string;
  size?: number | string;
  customLogoUrl?: string;
  alt?: string;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  className = 'w-5 h-5',
  customLogoUrl,
  alt = 'Inventory Logo',
}) => {
  if (customLogoUrl && customLogoUrl.trim() !== '') {
    return (
      <img
        src={customLogoUrl}
        alt={alt}
        className={`${className} object-contain rounded shrink-0`}
        referrerPolicy="no-referrer"
      />
    );
  }

  // Modern, high-precision custom vector SVG logo for Inventory & POS Management
  return (
    <div
      className={`${className} rounded-md bg-gradient-to-br from-blue-600 to-indigo-700 dark:from-blue-500 dark:to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0 overflow-hidden relative`}
      title={alt}
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-[78%] h-[78%]"
      >
        <path
          d="M16 3L4 9.5L16 16L28 9.5L16 3Z"
          fill="currentColor"
          fillOpacity="0.95"
        />
        <path
          d="M4 11.5V21.5L15 28V18L4 11.5Z"
          fill="currentColor"
          fillOpacity="0.75"
        />
        <path
          d="M28 11.5L17 18V28L28 21.5V11.5Z"
          fill="currentColor"
          fillOpacity="0.88"
        />
        <path
          d="M16 16.5L16 27.5"
          stroke="white"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeOpacity="0.5"
        />
        <circle cx="16" cy="16" r="2.2" fill="#38bdf8" />
      </svg>
    </div>
  );
};
