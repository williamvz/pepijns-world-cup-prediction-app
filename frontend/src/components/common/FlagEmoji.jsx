import React from 'react'

export default function FlagEmoji({ emoji, name, size = 'text-2xl', className = '' }) {
  return (
    <span
      className={`${size} ${className} leading-none select-none`}
      title={name}
      role="img"
      aria-label={name}
    >
      {emoji}
    </span>
  )
}
