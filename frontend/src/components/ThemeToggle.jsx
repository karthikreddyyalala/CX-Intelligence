import React from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle({ isDark, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="relative w-14 h-7 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-transparent"
      style={{ background: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(234,179,8,0.2)', border: `1px solid ${isDark ? 'rgba(99,102,241,0.4)' : 'rgba(234,179,8,0.4)'}` }}
      aria-label="Toggle theme"
    >
      <span
        className="absolute top-0.5 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg"
        style={{
          left: isDark ? 'calc(100% - 26px)' : '2px',
          background: isDark ? '#6366f1' : '#f59e0b',
          boxShadow: isDark ? '0 0 8px rgba(99,102,241,0.6)' : '0 0 8px rgba(245,158,11,0.6)',
        }}
      >
        {isDark ? <Moon size={12} color="white" /> : <Sun size={12} color="white" />}
      </span>
    </button>
  );
}
