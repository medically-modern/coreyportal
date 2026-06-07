import React from 'react';

const BASE_URL = import.meta.env.BASE_URL || '/coreyportal/';

export default function ElenaLogo({ size = 20, className = '' }) {
  return (
    <img
      src={`${BASE_URL}elena-logo.svg`}
      alt="Elena"
      className={`rounded-md object-cover ${className}`}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
    />
  );
}
