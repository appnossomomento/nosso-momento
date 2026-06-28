'use client';

import type { CSSProperties, SelectHTMLAttributes } from 'react';

const darkSelectStyle: CSSProperties = {
  borderRadius: 12,
  padding: '14px 16px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: '#000',
  width: '100%',
  color: 'white',
};

interface DarkSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  placeholder?: string;
}

export default function DarkSelect({ placeholder, value, children, style, ...rest }: DarkSelectProps) {
  const hasValue = value !== undefined && value !== '';
  return (
    <select
      value={value}
      style={{
        ...darkSelectStyle,
        color: hasValue ? 'white' : 'rgba(255,255,255,0.5)',
        ...style,
      }}
      {...rest}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {children}
    </select>
  );
}
