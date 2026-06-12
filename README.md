# ⚽ WK Pool 2026

Een eigen WK-pool app voor Pepijn en vriendjes tijdens het FIFA Wereldkampioenschap 2026!

## 🚀 Snel starten (Docker)

### Vereisten
- Docker + Docker Compose
- Internet voor het downloaden van de image

### Stap 1: Kloon of download de repo
```bash
cd /jouw/map
```

### Stap 2: Pas het wachtwoord aan
Open `docker-compose.yml` en verander `JWT_SECRET` naar een willekeurig, lang wachtwoord.

### Stap 3: Start de app
```bash
docker-compose up -d
```

De app is nu bereikbaar op: **http://jouw-home-assistant-ip:3001**

### Stap 4: Log in als admin
- Gebruikersnaam: `william`
- Wachtwoord: `admin123`

⚠️ Verander dit wachtwoord meteen na de eerste login!

---

## 🏠 Integratie met Home Assistant

### Via NGINX Proxy Manager / Reverse Proxy
Voeg toe aan je NGINX configuratie:
```nginx
location /wkpool/ {
    proxy_pass http://localhost:3001/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
}
```

### Als Home Assistant Add-on iframe
Voeg toe aan je `configuration.yaml`:
```yaml
panel_iframe:
  wkpool:
    title: WK Pool 2026
    icon: mdi:soccer
    url: http://homeassistant.local:3001
```

---

## 🛠️ Lokale ontwikkeling

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Pas .env aan
npm run seed    # Database vullen met WK 2026 data
npm run dev     # Start backend op poort 3001
```

### Frontend
```bash
cd frontend
npm install
npm run dev     # Start frontend op poort 5173 (proxied naar backend)
```

---

## 👤 Rollen

| Rol | Wat kan je doen |
|-----|----------------|
| **Admin** (William) | Uitslagen invoeren, fases ontgrendelen, gebruikers beheren |
| **Speler** | Voorspellingen invoeren, ranglijst bekijken |

---

## 📊 Puntensysteem

| Voorspelling | Punten |
|-------------|--------|
| Exacte score | 5 pts |
| Juist doelsaldo + winnaar | 3 pts |
| Juiste winnaar (of gelijkspel) | 2 pts |
| Fout | 0 pts |

### Knockout multipliers
- 1/16 Finale: × 1.5
- Kwartfinale: × 2
- Halve Finale: × 2.5
- Finale: × 3

### Bonuspunten
- Wereldkampioen voorspeld: **10 punten**
- Topscorer voorspeld: **5 punten**

---

## 🔧 Beheer

### Database backup
```bash
docker cp wk-pool-2026:/app/data/wkpool.db ./backup-$(date +%Y%m%d).db
```

### Database reset
```bash
docker-compose down
docker volume rm wkpool_data
docker-compose up -d
```

### Logs bekijken
```bash
docker logs wk-pool-2026 -f
```

---

## 📁 Projectstructuur

```
├── backend/
│   ├── src/
│   │   ├── db/          # Database, migraties, seed data
│   │   ├── routes/      # API endpoints
│   │   ├── middleware/  # Auth, admin checks
│   │   └── services/    # Puntberekening, achievements
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/       # Hoofdpagina's
│   │   ├── components/  # Herbruikbare componenten
│   │   ├── context/     # Auth context
│   │   └── services/    # API calls
│   └── package.json
├── docker-compose.yml
├── Dockerfile
└── README.md
```

---

## 🎯 Admin handleiding

### Uitslag invoeren
1. Ga naar de **Admin** pagina (tandwiel-icoon)
2. Klik op **Uitslagen invoeren**
3. Zoek de wedstrijd en vul de score in
4. Klik **Opslaan** — punten worden automatisch berekend!

### Nieuwe fase ontgrendelen (bijv. achtste finales)
1. Ga naar **Fases ontgrendelen**
2. Klik **Ontgrendel** bij de gewenste fase
3. Alle spelers krijgen een melding in de app

### Gebruiker wachtwoord resetten
1. Ga naar **Gebruikers beheren**
2. Klik op het sleutel-icoon
3. Voer het nieuwe wachtwoord in

---

Gemaakt met ❤️ voor Pepijn & vriendjes | WK 2026 🏆
