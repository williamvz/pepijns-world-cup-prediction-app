import React from 'react'

export default function LoadingSpinner({ text = 'Laden...' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-pitch-900">
      <div className="text-6xl animate-bounce-ball select-none mb-4">⚽</div>
      <p className="text-white/60 font-heading text-lg">{text}</p>
    </div>
  )
}
