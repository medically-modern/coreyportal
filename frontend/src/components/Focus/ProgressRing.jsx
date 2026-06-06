import React, { useEffect, useState } from 'react';

export default function ProgressRing({ handled, total, size = 64, strokeWidth = 5 }) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? handled / total : 0;

  // Animate on change
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedProgress(progress), 50);
    return () => clearTimeout(timer);
  }, [progress]);

  const offset = circumference - animatedProgress * circumference;
  const percentage = Math.round(progress * 100);

  // Color based on progress
  const getColor = () => {
    if (progress >= 1) return '#22c55e'; // good
    if (progress >= 0.6) return '#3b82f6'; // brand
    if (progress >= 0.3) return '#f59e0b'; // warn
    return '#64748b'; // neutral
  };

  return (
    <div className="relative inline-flex items-center justify-center" title={`${handled} of ${total} handled`}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-surface-200/10"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-bold" style={{ color: getColor() }}>
          {progress >= 1 ? '✓' : `${handled}`}
        </span>
        {total > 0 && progress < 1 && (
          <span className="text-[9px] text-surface-200/30">/{total}</span>
        )}
      </div>
    </div>
  );
}
