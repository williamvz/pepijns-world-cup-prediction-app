import React from 'react'

const AVATARS = {
  ball1:      { emoji: '⚽', bg: 'bg-pitch-700' },
  ball2:      { emoji: '⚽', bg: 'bg-pitch-600' },
  trophy:     { emoji: '🏆', bg: 'bg-yellow-700' },
  flag_nl:    { emoji: '🇳🇱', bg: 'bg-red-700' },
  flag_de:    { emoji: '🇩🇪', bg: 'bg-gray-700' },
  flag_fr:    { emoji: '🇫🇷', bg: 'bg-blue-800' },
  flag_es:    { emoji: '🇪🇸', bg: 'bg-red-800' },
  flag_pt:    { emoji: '🇵🇹', bg: 'bg-green-800' },
  flag_ar:    { emoji: '🇦🇷', bg: 'bg-sky-700' },
  flag_br:    { emoji: '🇧🇷', bg: 'bg-yellow-800' },
  flag_en:    { emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', bg: 'bg-slate-700' },
  captain:    { emoji: '🦁', bg: 'bg-amber-700' },
  goalkeeper: { emoji: '🧤', bg: 'bg-orange-700' },
  referee:    { emoji: '🟨', bg: 'bg-zinc-700' },
}

const SIZES = {
  sm: 'w-8 h-8 text-base',
  md: 'w-12 h-12 text-2xl',
  lg: 'w-16 h-16 text-3xl',
  xl: 'w-24 h-24 text-5xl',
}

export default function Avatar({ avatar = 'ball1', size = 'md', className = '' }) {
  const config = AVATARS[avatar] || AVATARS.ball1
  const sizeClass = SIZES[size] || SIZES.md

  return (
    <div
      className={`${sizeClass} ${config.bg} rounded-full flex items-center justify-center flex-shrink-0 ${className}`}
      role="img"
      aria-label={avatar}
    >
      <span className="leading-none select-none">{config.emoji}</span>
    </div>
  )
}

export { AVATARS }
