# ⚽ World Cup Pool 2026

A custom World Cup prediction pool app for Pepijn and friends during the FIFA World Cup 2026!

## 🚀 Quick Start (Docker)

### Requirements
- Docker + Docker Compose
- Internet access for image downloads

### Step 1: Clone or download the repo
```bash
cd /your/directory
git clone https://github.com/williamvz/pepijns-world-cup-prediction-app.git
cd pepijns-world-cup-prediction-app
```

### Step 2: Set the secrets
Create a `.env` file next to `docker-compose.yml`:
```bash
JWT_SECRET=<a long, random string>
ADMIN_PASSWORD=<the password for the first admin account>
```
The app refuses to start without `JWT_SECRET`. If you leave `ADMIN_PASSWORD`
unset, a random password is generated and printed once in the logs on first run.

### Step 3: Launch the app
```bash
docker-compose up -d
```

The app is then available at: **http://your-home-assistant-ip:3001**

### Step 4: Admin login
- Username: `william` (or your `ADMIN_USERNAME`)
- Password: the `ADMIN_PASSWORD` you set (or the random one from the logs)

⚠️ Change this password from the admin panel after your first login!

---

## 🏠 Home Assistant Integration

### Via NGINX Proxy Manager / Reverse Proxy
Add to your NGINX configuration:
```nginx
location /wkpool/ {
    proxy_pass http://localhost:3001/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
}
```

### As a Home Assistant Add-on iframe
Add to your `configuration.yaml`:
```yaml
panel_iframe:
  wkpool:
    title: World Cup Pool 2026
    icon: mdi:soccer
    url: http://homeassistant.local:3001
```

---

## 🛠️ Local Development

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env as needed
npm run seed    # Populate the database with World Cup 2026 data
npm run dev     # Start the backend on port 3001
```

### Frontend
```bash
cd frontend
npm install
npm run dev     # Start the frontend on port 5173 (proxied to the backend)
```

---

## 👤 Roles

| Role | Capabilities |
|------|--------------|
| **Admin** (William) | Enter results, unlock phases, manage users |
| **Player** | Submit predictions, view the leaderboard |

---

## 📊 Scoring System

| Prediction | Points |
|------------|--------|
| Exact score | 5 pts |
| Correct goal difference + winner | 3 pts |
| Correct winner (or draw) | 2 pts |
| Incorrect | 0 pts |

### Knockout Multipliers
- Group stage: × 1
- Round of 32: × 1.5
- Round of 16: × 1.75
- Quarterfinal: × 2
- Semifinal: × 2.5
- Third-place play-off: × 3
- Final: × 3

### Bonus Points
- Correctly predicting the World Champion: **10 points**
- Correctly predicting the top scorer: **5 points**

---

## 🔧 Administration

### Database Backup
```bash
docker cp wk-pool-2026:/app/data/wkpool.db ./backup-$(date +%Y%m%d).db
```

### Database Reset
```bash
docker-compose down
docker volume rm wkpool_data
docker-compose up -d
```

### View Logs
```bash
docker logs wk-pool-2026 -f
```

---

## 📁 Project Structure

```
├── backend/
│   ├── src/
│   │   ├── db/          # Database, migrations, seed data
│   │   ├── routes/      # API endpoints
│   │   ├── middleware/  # Auth and admin checks
│   │   └── services/    # Point calculation, achievements
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/       # Main pages
│   │   ├── components/  # Reusable components
│   │   ├── context/     # Auth context
│   │   └── services/    # API calls
│   └── package.json
├── docker-compose.yml
├── Dockerfile
└── README.md
```

---

## 🎯 Admin Guide

### Enter Match Results
1. Go to the **Admin** page (gear icon)
2. Click **Enter Results**
3. Find the match and enter the score
4. Click **Save** — points are calculated automatically!

### Unlock a New Phase (e.g. Round of 16)
1. Go to **Unlock Phases**
2. Click **Unlock** for the desired phase
3. All players receive an in-app notification

### Reset a User's Password
1. Go to **Manage Users**
2. Click the key icon
3. Enter the new password

---

Made with ❤️ for Pepijn & friends | World Cup 2026 🏆
