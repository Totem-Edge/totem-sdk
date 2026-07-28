/**
 * TOTEM WORDMARK
 * "TOTEM" text logo as SVG for consistent rendering
 */
import React from 'react';

interface TotemWordmarkProps {
  width?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function TotemWordmark({ 
  width = 120, 
  color = 'currentColor',
  className, 
  style 
}: TotemWordmarkProps) {
  const aspectRatio = 197.23 / 391.18;
  
  return (
    <svg 
      width={width} 
      height={width * aspectRatio} 
      viewBox="0 0 391.18 197.23" 
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M55.48,177.8h-23.28V41.31H14.93v-21.88h57.81v21.88h-17.26v136.5Z"/>
      <path d="M144.41,152.11c0,17.13-6.56,25.69-19.67,25.69h-23.28c-12.85,0-19.27-8.56-19.27-25.69V45.32c0-17.26,6.42-25.89,19.27-25.89h23.28c13.11,0,19.67,8.63,19.67,25.89v106.79ZM116.3,156.12c3.34,0,5.02-2.47,5.02-7.43V48.73c0-4.95-1.68-7.43-5.02-7.43h-6.02c-3.48,0-5.22,2.48-5.22,7.43v99.96c0,4.95,1.74,7.43,5.22,7.43h6.02Z"/>
      <path d="M194.39,177.8h-23.28V41.31h-17.26v-21.88h57.81v21.88h-17.26v136.5Z"/>
      <path d="M271.27,177.8h-38.94c-6.16,0-9.23-3.08-9.23-9.23V28.66c0-6.15,3.08-9.23,9.23-9.23h38.94v21.88h-23.28c-1.34,0-2.01.74-2.01,2.21v43.56h25.29v21.08h-25.29v45.77c0,1.47.67,2.21,2.01,2.21h23.28v21.68Z"/>
      <path d="M376.25,177.8h-21.88V48.73c0-4.95-1.74-7.43-5.22-7.43h-8.03v136.5h-21.08V41.31h-11.84c-.94,0-1.41.47-1.41,1.41v135.09h-22.28V26.25c0-4.55,2.28-6.83,6.83-6.83h65.64c12.85,0,19.27,8.63,19.27,25.89v132.48Z"/>
    </svg>
  );
}

export default TotemWordmark;
