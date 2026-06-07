import React from 'react';

const BASE_URL = import.meta.env.BASE_URL || '/coreyportal/';

export default function ElenaLogo({ size = 20, className = '' }) {
  return (
    <img
      src={`${BASE_URL}elena-icon.svg`}
      alt="Elena"
      className={`object-contain ${className}`}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
    />
  );
}
