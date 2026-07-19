import React from 'react'

export default function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-pitch-800 border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-4 animate-slide-up">
        <p className="font-heading font-bold text-white mb-6 text-center">{message}</p>
        <div className="flex gap-3">
          <button className="btn-secondary flex-1" onClick={onCancel}>Annuleren</button>
          <button className="btn-danger flex-1" onClick={onConfirm}>Bevestigen</button>
        </div>
      </div>
    </div>
  )
}
