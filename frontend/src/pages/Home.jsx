import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import Avatar from '../components/common/Avatar'
import CountdownTimer from '../components/common/CountdownTimer'
import PredictModal from '../components/predictions/PredictModal'

function StatCard({ label, value, icon }) {
  return (
    <div className="card p-4 flex flex-col items-center text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="font-heading font-black text-2xl text-gold-400">{value ?? '—'}</div>
      <div className="text-white/50 text-xs font-heading mt-0.5">{label}</div>
    </div>
  )
}

export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [upcoming, setUpcoming] = useState([])
  const [summary, setSummary] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [notifications, setNotifications] = useState([])
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(true)
  const [predictModal, setPredictModal] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      const [upcomingData, summaryData, lbData, notifData, predData] = await Promise.allSettled([
        api.getUpcoming(),
        api.getPredictionSummary(),
        api.getLeaderboard(),
        api.getNotifications(),
        api.getPredictions(),
      ])

      if (upcomingData.status === 'fulfilled') {
        const u = upcomingData.value
        setUpcoming(u.matches || u || [])
      }
      if (summaryData.status === 'fulfilled') {
        setSummary(summaryData.value)
      }
      if (lbData.status === 'fulfilled') {
        const lb = lbData.value
        setLeaderboard((lb.leaderboard || lb || []).slice(0, 3))
      }
      if (notifData.status === 'fulfilled') {
        const n = notifData.value
        setNotifications((n.notifications || n || []).filter((x) => !x.read).slice(0, 3))
      }
      if (predData.status === 'fulfilled') {
        const p = predData.value
        setPredictions(p.predictions || p || [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function getPredictionForMatch(matchId) {
    return predictions.find((p) => p.match_id === matchId || p.match?.id === matchId)
  }

  // Matches without predictions sorted by urgency
  const unpredicted = upcoming
    .filter((m) => {
      const pred = getPredictionForMatch(m.id)
      const locked = m.locked || m.status === 'locked' || m.status === 'finished'
      return !pred && !locked
    })
    .sort((a, b) => new Date(a.match_datetime) - new Date(b.match_datetime))

  // Recent finished matches with results
  const recentFinished = predictions
    .filter((p) => p.match?.status === 'finished' || p.status === 'finished')
    .slice(0, 4)

  const totalPoints = summary?.total_points ?? user?.total_points ?? 0
  const exactCount = summary?.exact_count ?? 0
  const winnerCount = summary?.winner_count ?? 0

  const medals = ['🥇', '🥈', '🥉']

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-5xl animate-bounce-ball">⚽</div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
      {/* Welcome header */}
      <div className="flex items-center gap-4">
        <Avatar avatar={user?.avatar} size="lg" />
        <div>
          <h1 className="font-heading font-black text-2xl text-white">
            Hey {user?.username}! 👋
          </h1>
          <p className="text-white/50 text-sm">Welkom bij WK Pool 2026</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Totaal punten" value={totalPoints} icon="⭐" />
        <StatCard label="Exact goed" value={exactCount} icon="🎯" />
        <StatCard label="Winnaar goed" value={winnerCount} icon="✅" />
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div key={n.id} className="glass rounded-xl p-3 flex items-start gap-3 animate-slide-up">
              <span className="text-xl mt-0.5">{n.icon || '🔔'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-heading font-bold text-white">{n.title}</p>
                <p className="text-xs text-white/50 truncate">{n.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Next match countdown */}
      {upcoming.length > 0 && (
        <div className="card p-4">
          <h2 className="font-heading font-bold text-white/70 text-sm mb-3 uppercase tracking-wide">
            Volgende wedstrijd
          </h2>
          {(() => {
            const nextMatch = upcoming[0]
            const pred = getPredictionForMatch(nextMatch.id)
            const matchDate = new Date(nextMatch.match_datetime)
            return (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{nextMatch.home_flag || ''}</span>
                    <span className="font-heading font-bold text-white">{nextMatch.home_team}</span>
                  </div>
                  <div className="text-center">
                    <div className="text-white/40 font-heading font-bold">VS</div>
                    <CountdownTimer targetDate={nextMatch.match_datetime} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-bold text-white">{nextMatch.away_team}</span>
                    <span className="text-2xl">{nextMatch.away_flag || ''}</span>
                  </div>
                </div>
                <div className="text-center text-white/40 text-xs mb-3">
                  {format(matchDate, "EEEE d MMMM 'om' HH:mm", { locale: nl })}
                  {nextMatch.venue ? ` · ${nextMatch.venue}` : ''}
                </div>
                {pred ? (
                  <div className="glass rounded-xl p-3 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-white/50 text-sm font-heading">Jouw voorspelling: </span>
                      <span className="font-heading font-bold text-gold-400">
                        {pred.predicted_home} - {pred.predicted_away}
                      </span>
                    </div>
                    {!nextMatch.locked && nextMatch.status !== 'finished' && (
                      <button
                        className="btn-secondary text-xs py-1.5 px-3 flex-shrink-0"
                        onClick={() => setPredictModal(nextMatch)}
                      >
                        ✏️ Aanpassen
                      </button>
                    )}
                  </div>
                ) : !nextMatch.locked && nextMatch.status !== 'finished' ? (
                  <button
                    className="btn-primary w-full"
                    onClick={() => setPredictModal(nextMatch)}
                  >
                    ⚽ Voorspel nu!
                  </button>
                ) : (
                  <div className="text-center text-white/30 text-sm font-heading">🔒 Voorspelling gesloten</div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* Unpredicted matches */}
      {unpredicted.length > 0 && (
        <div>
          <h2 className="font-heading font-bold text-white mb-3 flex items-center gap-2">
            <span className="text-yellow-400">⚠️</span>
            Nog in te vullen
            <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ml-1">
              {unpredicted.length}
            </span>
          </h2>
          <div className="space-y-2">
            {unpredicted.map((m) => {
              const matchDate = new Date(m.match_datetime)
              const diff = matchDate - new Date()
              const isUrgent = diff < 24 * 3600 * 1000 && diff > 0
              const isVeryUrgent = diff < 3600 * 1000 && diff > 0

              return (
                <div
                  key={m.id}
                  className={`card p-3 flex items-center gap-3 ${
                    isVeryUrgent ? 'border-red-500/40 bg-red-500/5' : isUrgent ? 'border-orange-500/40 bg-orange-500/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xl">{m.home_flag || ''}</span>
                    <span className="text-white/70 font-heading text-xs font-bold">VS</span>
                    <span className="text-xl">{m.away_flag || ''}</span>
                    <span className="text-white text-xs font-heading font-bold truncate">
                      {m.home_team} – {m.away_team}
                    </span>
                  </div>
                  <CountdownTimer targetDate={m.match_datetime} />
                  <button
                    className="btn-primary text-xs py-1.5 px-3 flex-shrink-0"
                    onClick={() => setPredictModal(m)}
                  >
                    Voorspel
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent results */}
      {recentFinished.length > 0 && (
        <div>
          <h2 className="font-heading font-bold text-white mb-3">Laatste uitslagen</h2>
          <div className="space-y-2">
            {recentFinished.map((pred) => {
              const m = pred.match || {}
              const pts = pred.points
              let ptClass = 'bg-gray-600'
              if (pts >= 5) ptClass = 'bg-green-600'
              else if (pts >= 3) ptClass = 'bg-teal-600'
              else if (pts >= 2) ptClass = 'bg-blue-600'

              return (
                <div key={pred.id} className="card p-3 flex items-center gap-3">
                  <div className="flex-1 text-sm font-heading font-bold text-white">
                    {m.home_team} {m.home_score} - {m.away_score} {m.away_team}
                  </div>
                  <div className="text-white/40 text-xs font-heading">
                    {pred.predicted_home} - {pred.predicted_away}
                  </div>
                  <span className={`text-xs font-heading font-bold px-2 py-0.5 rounded-full text-white ${ptClass}`}>
                    +{pts ?? 0} pt
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Mini leaderboard */}
      {leaderboard.length > 0 && (
        <div>
          <h2 className="font-heading font-bold text-white mb-3 flex items-center justify-between">
            <span>Ranglijst top 3</span>
            <button
              className="text-gold-400 text-sm font-heading hover:underline"
              onClick={() => navigate('/ranglijst')}
            >
              Alles zien →
            </button>
          </h2>
          <div className="space-y-2">
            {leaderboard.map((entry, i) => {
              const isMe = entry.user_id === user?.id || entry.id === user?.id
              return (
                <div
                  key={entry.user_id || entry.id}
                  className={`card p-3 flex items-center gap-3 ${isMe ? 'border-gold-500/30 bg-gold-500/10' : ''}`}
                >
                  <span className="text-xl w-8 text-center">{medals[i]}</span>
                  <Avatar avatar={entry.avatar} size="sm" />
                  <span className={`font-heading font-bold text-sm flex-1 ${isMe ? 'text-gold-400' : 'text-white'}`}>
                    {entry.username}
                  </span>
                  <span className="font-heading font-black text-gold-400">
                    {entry.total_points ?? entry.points ?? 0} pt
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Spacer for bottom nav */}
      <div className="h-4" />

      {/* Predict modal */}
      {predictModal && (
        <PredictModal
          match={predictModal}
          existingPrediction={getPredictionForMatch(predictModal.id)}
          onSave={() => fetchData()}
          onClose={() => setPredictModal(null)}
        />
      )}
    </div>
  )
}
