import { normalizeMatch, normalizeMatches } from '../utils/matchUtils.js'

const BASE = '/api'

// Notification display metadata by backend `type`.
const NOTIF_META = {
  result: { icon: '⚽', title: 'Uitslag' },
  achievement: { icon: '🏅', title: 'Prestatie ontgrendeld' },
  phase_unlock: { icon: '🔓', title: 'Nieuwe fase' },
  bonus_correct: { icon: '🎯', title: 'Bonus correct' },
  info: { icon: '🔔', title: 'Melding' },
}

function normalizeNotification(n) {
  const meta = NOTIF_META[n.type] || NOTIF_META.info
  return {
    ...n,
    read: !!n.is_read,
    icon: meta.icon,
    title: meta.title,
  }
}

function getToken() {
  return localStorage.getItem('wkpool_token')
}

function headers() {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json()
  if (!res.ok) {
    // A 401 while we were holding a token means the session is no longer valid
    // (expired, or an admin forced a re-login). Clear it and bounce to the login
    // screen instead of leaving the UI in a half-broken state. The login call
    // itself is excluded so wrong credentials still surface a normal error.
    if (res.status === 401 && getToken() && path !== '/auth/login') {
      localStorage.removeItem('wkpool_token')
      if (typeof window !== 'undefined') window.location.assign('/')
    }
    throw new Error(data.error || 'Er ging iets mis')
  }
  return data
}

export const api = {
  // Auth
  login: (username, password) => request('POST', '/auth/login', { username, password }),
  register: (data) => request('POST', '/auth/register', data),
  me: () => request('GET', '/auth/me'),
  updateMe: (data) => request('PUT', '/auth/me', data),

  // Matches — flatten nested phase→group→match structure into flat array
  getMatches: () =>
    request('GET', '/matches').then(d => {
      const flat = []
      for (const phase of d.matches || []) {
        for (const group of phase.groups || []) {
          for (const match of group.matches || []) {
            flat.push(normalizeMatch(match))
          }
        }
      }
      return { matches: flat }
    }),
  getUpcoming: () =>
    request('GET', '/matches/upcoming').then(d => ({
      ...d,
      matches: (d.matches || []).map(normalizeMatch),
    })),
  getMatch: (id) => request('GET', `/matches/${id}`).then(d => ({
    ...d,
    match: d.match ? normalizeMatch(d.match) : d.match,
  })),

  // Predictions — the API returns each prediction with flat match fields plus
  // nested home_team/away_team objects. Build a flat `match` object and a
  // `points` alias so every component reads a consistent shape.
  getPredictions: () =>
    request('GET', '/predictions').then(d => ({
      ...d,
      predictions: (d.predictions || []).map(p => ({
        ...p,
        points: p.points_earned,
        match: {
          id: p.match_id,
          status: p.status,
          match_datetime: p.match_datetime,
          match_date: p.match_datetime,
          home_score: p.home_score,
          away_score: p.away_score,
          group_name: p.group_name,
          venue: p.venue,
          home_team: p.home_team?.name ?? p.home_team_name,
          home_flag: p.home_team?.flag_emoji ?? p.home_team_flag ?? '',
          away_team: p.away_team?.name ?? p.away_team_name,
          away_flag: p.away_team?.flag_emoji ?? p.away_team_flag ?? '',
        },
      })),
    })),
  getPredictionForMatch: (matchId) => request('GET', `/predictions/match/${matchId}`),
  savePrediction: (matchId, predicted_home, predicted_away) =>
    request('POST', '/predictions', { match_id: matchId, predicted_home, predicted_away }),
  // Unwrap { summary: {...} } and expose the field names the UI uses.
  getPredictionSummary: () =>
    request('GET', '/predictions/summary').then(d => {
      const s = d.summary || d
      return {
        ...s,
        exact_count: s.exact_scores ?? s.exact_count ?? 0,
        winner_count: s.correct_winners ?? s.winner_count ?? 0,
      }
    }),

  // Leaderboard — add exact_count/winner_count aliases used by the table.
  getLeaderboard: () =>
    request('GET', '/leaderboard').then(d => ({
      ...d,
      leaderboard: (d.leaderboard || []).map(e => ({
        ...e,
        exact_count: e.exact_scores ?? e.exact_count ?? 0,
        winner_count: e.correct_winners ?? e.winner_count ?? 0,
      })),
    })),
  getDayStats: () =>
    request('GET', '/leaderboard/stats').then(d => ({
      ...d,
      best_today: d.best_predictor_today ?? d.best_today ?? null,
    })),

  // Achievements — expose `percentage` alias for unlock_percentage.
  getAchievements: () =>
    request('GET', '/achievements').then(d => ({
      ...d,
      achievements: (d.achievements || []).map(a => ({
        ...a,
        percentage: a.unlock_percentage ?? a.percentage,
      })),
    })),
  getMyAchievements: () => request('GET', '/achievements/mine'),

  // Bonus — add `points` alias for points_earned.
  getBonus: () =>
    request('GET', '/bonus').then(d => ({
      ...d,
      bonus_predictions: (d.bonus_predictions || []).map(b => ({
        ...b,
        points: b.points_earned,
      })),
    })),
  saveBonus: (type, predicted_value) => request('POST', '/bonus', { type, predicted_value }),

  // Notifications — add `read` (from is_read) plus a display title/icon by type.
  getNotifications: () =>
    request('GET', '/notifications').then(d => ({
      ...d,
      notifications: (d.notifications || []).map(normalizeNotification),
    })),
  markRead: (id) => request('PUT', `/notifications/${id}/read`),
  markAllRead: () => request('PUT', '/notifications/read-all'),

  // Users
  getUserProfile: (id) => request('GET', `/users/${id}/profile`),
  getUserPredictions: (id) => request('GET', `/users/${id}/predictions`),
  // Reshape the compare response into the flat rows the modal renders.
  compareUsers: (id1, id2) =>
    request('GET', `/users/compare/${id1}/${id2}`).then(d => ({
      ...d,
      comparisons: (d.matches || []).map(m => ({
        home_team: m.match?.home_team?.name ?? '',
        away_team: m.match?.away_team?.name ?? '',
        user1_pred: m.user1_prediction
          ? `${m.user1_prediction.home}-${m.user1_prediction.away}` : null,
        user2_pred: m.user2_prediction
          ? `${m.user2_prediction.home}-${m.user2_prediction.away}` : null,
        user1_pts: m.user1_prediction?.points ?? 0,
        user2_pts: m.user2_prediction?.points ?? 0,
      })),
    })),

  // Admin
  adminDashboard: () => request('GET', '/admin/dashboard'),
  adminUsers: () => request('GET', '/admin/users'),
  adminUpdateUser: (id, data) => request('PUT', `/admin/users/${id}`, data),
  adminDeleteUser: (id) => request('DELETE', `/admin/users/${id}`),
  adminForceLogoutUser: (id) => request('POST', `/admin/users/${id}/logout`),
  adminForceLogoutAll: () => request('POST', '/admin/logout-all'),
  adminPhases: () => request('GET', '/admin/phases'),
  adminUnlockPhase: (id) => request('PUT', `/admin/phases/${id}/unlock`),
  adminGenerateMatches: (id) => request('POST', `/admin/phases/${id}/generate`),
  adminSetResult: (matchId, home_score, away_score, winner_team_id = null) =>
    request('PUT', `/admin/matches/${matchId}`, { home_score, away_score, status: 'finished', winner_team_id }),
  adminUpdateMatch: (matchId, data) => request('PUT', `/admin/matches/${matchId}`, data),
  adminCreateUser: (data) => request('POST', '/admin/users', data),
}
