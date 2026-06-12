# ⚽ WK Pool 2026 — Installatie op Raspberry Pi 5 met Home Assistant OS

Je hebt: **Raspberry Pi 5** + **Home Assistant OS (HAOS, rpi5-64)**

De app draait als een **lokale Home Assistant Add-on** (poort 3001), en is via **Nginx Proxy Manager** bereikbaar op `wk.williamvanzweeden.nl` — net zoals je `n8n.williamvanzweeden.nl` hebt ingericht.

---

## Stap 1 — Samba Share add-on installeren

Dit geeft je toegang tot de Pi-bestanden via je thuisnetwerk.

1. Ga in HA naar **Instellingen → Add-ons → Add-on Store**
2. Zoek op **"Samba share"** en installeer
3. Ga naar de Samba add-on → **Configuratie**:
   ```yaml
   username: william
   password: kies-een-wachtwoord
   ```
4. Klik **Opslaan** → **Starten**

Verbind via Finder: **Ga → Verbind met server** → `smb://<pi-ip-adres>`

---

## Stap 2 — Frontend bouwen (op je Mac)

Zorg dat de frontend gebouwd is vóór je kopieert:

```bash
cd "/Users/william/Documents/Claude Code/Pepijn's WK Pool/frontend"
npm install
npm run build
# Dit schrijft de output naar backend/public/
```

---

## Stap 3 — Projectbestanden kopiëren naar de Pi

De structuur op de Pi moet zo worden:

```
addons/wkpool2026/
├── config.yaml          ← uit ha-addon/config.yaml
├── Dockerfile           ← uit ha-addon/Dockerfile
├── run.sh               ← uit ha-addon/run.sh
├── build.yaml           ← uit ha-addon/build.yaml
└── backend/
    ├── package.json
    ├── src/
    └── public/          ← gebouwde frontend (uit stap 2)
```

**Terminal op je Mac** (vervang `<pi-ip>` door het IP van je Pi):

```bash
cd "/Users/william/Documents/Claude Code/Pepijn's WK Pool"

# Verbind met Pi via Samba (als dat nog niet open is)
open smb://<pi-ip>

# Maak de add-on map aan en kopieer alles
mkdir -p /Volumes/addons/wkpool2026
cp ha-addon/config.yaml  /Volumes/addons/wkpool2026/
cp ha-addon/Dockerfile   /Volumes/addons/wkpool2026/
cp ha-addon/run.sh       /Volumes/addons/wkpool2026/
cp ha-addon/build.yaml   /Volumes/addons/wkpool2026/
cp -r backend/           /Volumes/addons/wkpool2026/backend/
```

Of sleep de bestanden handmatig via Finder.

---

## Stap 4 — Add-on installeren in Home Assistant

1. Ga naar **Instellingen → Add-ons → Add-on Store**
2. Klik op **⋮ (drie puntjes)** rechtsboven → **"Vernieuwen"**
3. Scroll naar beneden — je ziet nu **"Lokale add-ons"** met **WK Pool 2026**
4. Klik op **WK Pool 2026** → **Installeren**

   *(Eerste keer: 2-5 minuten — de Pi bouwt de Docker container)*

---

## Stap 5 — JWT Secret instellen

1. Ga naar de **WK Pool 2026** add-on → tab **Configuratie**
2. Zet `jwt_secret` op een eigen wachtwoord (minstens 20 tekens):
   ```yaml
   jwt_secret: "mijn-super-geheime-wk-pool-sleutel-2026"
   ```
3. Klik **Opslaan**

---

## Stap 6 — Starten en testen

1. Klik **Starten** op de WK Pool 2026 add-on
2. Check de **Logboeken** — je ziet:
   ```
   ⚽ WK Pool 2026 wordt gestart...
   ✅ Seed complete: Phases: 6, Teams: 48, Matches: 72
   🚀 Server start op poort 3001
   ```
3. Test lokaal: `http://<pi-ip>:3001`

---

## Stap 7 — Subdomain: wk.williamvanzweeden.nl

Je gebruikt al Nginx Proxy Manager voor `ha.` en `n8n.` — doe hetzelfde voor `wk.`:

### 7a — DNS-record aanmaken

Voeg bij je DNS-provider (dezelfde als voor `n8n.williamvanzweeden.nl`) een record toe:

| Type | Naam | Waarde                        |
|------|------|-------------------------------|
| A    | wk   | `<jouw publieke IP-adres>`    |

*(Of een CNAME naar hetzelfde doel als n8n/ha, afhankelijk van je DNS-setup)*

### 7b — Nginx Proxy Manager: nieuwe Proxy Host

1. Open Nginx Proxy Manager (waarschijnlijk op `http://<pi-ip>:81`)
2. **Hosts → Proxy Hosts → Add Proxy Host**
3. Vul in:

   | Veld | Waarde |
   |------|--------|
   | Domain Names | `wk.williamvanzweeden.nl` |
   | Scheme | `http` |
   | Forward Hostname/IP | `homeassistant.local` of `<pi-ip>` |
   | Forward Port | `3001` |
   | Websockets Support | ✅ aan |

4. Tab **SSL**:
   - SSL Certificate: **Request a new SSL Certificate**
   - Force SSL: ✅ aan
   - HTTP/2 Support: ✅ aan
   - Email voor Let's Encrypt: `jwvanzweeden@gmail.com`

5. Klik **Save**

Na ±30 seconden is `https://wk.williamvanzweeden.nl` live. ✅

---

## Stap 8 — App als icoon op je telefoon (PWA)

1. Open `https://wk.williamvanzweeden.nl` op je telefoon
2. **iPhone (Safari):** Deel-knop → "Zet op beginscherm"
   **Android (Chrome):** Menu → "Toevoegen aan beginscherm"
3. De app opent als een echte app — zonder adresbalk!

---

## 🔧 Beheer

### Add-on bijwerken (na code-aanpassingen)
```bash
# Op je Mac: herbouw frontend + kopieer naar Pi
npm run build --prefix frontend
cp -r backend/ /Volumes/addons/wkpool2026/backend/
```
Dan in HA: add-on → **⋮ → Opnieuw opbouwen**

### Database backup
Via **Terminal & SSH** add-on op de Pi:
```bash
cp /data/addon_local_wkpool2026/data/wkpool.db /share/backup-wkpool-$(date +%Y%m%d).db
```

### Logboeken bekijken
HA → Instellingen → Add-ons → WK Pool 2026 → **Logboeken**

---

## ❓ Hulp nodig?

**Add-on verschijnt niet in de store**
→ Add-on Store → ⋮ → "Vernieuwen"

**Build mislukt**
→ Logboeken checken. Meest voorkomend: `backend/public/` ontbreekt.
→ Oplossing: voer `npm run build` uit in de `frontend/` map op je Mac, daarna opnieuw kopiëren.

**Poort 3001 niet bereikbaar**
→ Add-on → Configuratie → controleer of de poort op 3001 staat.

**Subdomain geeft SSL-fout**
→ Wacht 1-2 minuten na aanmaken proxy host (Let's Encrypt certificate aanvraag).
→ Check of het DNS-record al propageert: `dig wk.williamvanzweeden.nl`
