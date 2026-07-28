/**
 * TOTEM EAGLE MARK
 * Eagle head logo for favicon, header, and icons
 */
import React from 'react';

interface TotemEagleMarkProps {
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function TotemEagleMark({ 
  size = 32, 
  color = 'currentColor',
  className, 
  style 
}: TotemEagleMarkProps) {
  const aspectRatio = 371.63 / 457.87;
  
  return (
    <svg 
      width={size} 
      height={size * aspectRatio} 
      viewBox="0 0 457.87 371.63" 
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <polygon points="190.53 120.24 257.3 120.24 257.3 95.26 185.92 95.26 190.53 120.24"/>
      <path d="M367.02,79.23h-30.73c-8.64-29.41-35.86-50.95-68.03-50.95h-132.71c-65.93,0-119.57,53.64-119.57,119.57v195.5h361.31l-87.98-119.58,13.45-32.96h98.43l40.7,25.63v-62.34c0-41.28-33.59-74.87-74.87-74.87ZM327.86,318.35h-178.85v-85.4h-25v85.4H40.98v-170.5c0-52.15,42.42-94.57,94.57-94.57h132.71c24.54,0,44.64,19.35,45.85,43.59l-53.24,130.42,66.99,91.05ZM416.89,171.15l-8.48-5.34h-95.44l25.14-61.58h28.91c27.5,0,49.87,22.37,49.87,49.87v17.05Z"/>
    </svg>
  );
}

export default TotemEagleMark;
