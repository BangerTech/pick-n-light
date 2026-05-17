# Pick·n·Light

LED-geführtes Teilemagazin-System mit moderner Web-UI, MQTT-Broker und WLED-Integration.

## Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS + Framer Motion
- **Backend:** Node.js + Express + TypeScript + Prisma ORM
- **Datenbank:** PostgreSQL 16
- **MQTT-Broker:** Eclipse Mosquitto 2 (eingebaut)
- **Reverse Proxy:** Nginx intern + Traefik extern
- **Port:** 7050 (extern), MQTT 1883/9001

## Setup

```bash
cp .env.example .env
# .env anpassen (POSTGRES_PASSWORD, etc.)
docker compose up -d
# Beim ersten Start: DB-Migration läuft automatisch
# Dann http://localhost:7050 öffnen → Onboarding-Wizard startet
```

## Umgebungsvariablen (.env)

| Variable | Default | Beschreibung |
|---|---|---|
| `POSTGRES_PASSWORD` | - | PostgreSQL Passwort (required) |
| `POSTGRES_DB` | `picknlight` | Datenbankname |
| `POSTGRES_USER` | `picknlight` | Datenbankbenutzer |
| `JWT_SECRET` | - | Secret für zukünftige Auth (optional) |
| `LED_AUTO_OFF_SECONDS` | `30` | LED-Auto-Ausschalten nach X Sekunden |

## Datenbankschema

### `magazines`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | INT PK | Auto-increment |
| `name` | VARCHAR | Magazin-Name |
| `rows` | INT | Anzahl Reihen |
| `columns` | INT | Anzahl Spalten |
| `leds_per_slot` | INT | LEDs pro Fach (Standard: 3) |
| `led_gap`       | INT | Inaktive LEDs zwischen Fächern als Abstand (Standard: 0) |
| `bottom_row_large` | BOOL | Unterste Reihe = ein großes Fach |
| `created_at` | TIMESTAMP | Erstellt |
| `updated_at` | TIMESTAMP | Geändert |

### `slots`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | INT PK | Auto-increment |
| `magazine_id` | INT FK | → magazines.id |
| `row` | INT | Reihe (0-basiert, 0 = oben) |
| `col` | INT | Spalte (0-basiert, 0 = links) |
| `led_start` | INT | Erster LED-Index auf dem Strip |
| `led_count` | INT | Anzahl LEDs in diesem Fach |
| `is_large` | BOOL | Großes Fach (untere Reihe) |

### `parts`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | INT PK | Auto-increment |
| `slot_id` | INT FK UNIQUE | → slots.id |
| `name` | VARCHAR | Artikel-Name (z.B. "M4x20 Senkkopf") |
| `description` | TEXT | Beschreibung |
| `quantity` | FLOAT | Aktuelle Menge |
| `unit` | VARCHAR | Einheit (Stk, g, m, ...) |
| `min_quantity` | FLOAT | Mindestmenge (Niedrigbestand-Warnung) |
| `tags` | TEXT[] | Such-Tags |
| `created_at` | TIMESTAMP | Erstellt |
| `updated_at` | TIMESTAMP | Geändert |

### `wled_devices`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | INT PK | Auto-increment |
| `magazine_id` | INT FK | → magazines.id |
| `name` | VARCHAR | Gerätename |
| `ip_address` | VARCHAR | IP-Adresse des WLED-Geräts |
| `mqtt_topic` | VARCHAR | MQTT-Topic (z.B. `wled/magazin1`) |
| `led_count` | INT | Gesamtanzahl LEDs auf dem Strip |
| `created_at` | TIMESTAMP | Erstellt |

### `settings`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | INT PK | Auto-increment |
| `key` | VARCHAR UNIQUE | Einstellungs-Schlüssel |
| `value` | TEXT | Wert |

**Standard-Settings:**
- `led_auto_off_seconds` = `30`
- `search_highlight_color` = `255,165,0` (RGB orange)
- `not_found_color` = `255,0,0` (RGB rot)
- `low_stock_color` = `255,100,0` (RGB orange-rot)

## API-Referenz

### Magazines
```
GET    /api/magazines                   Alle Magazine
POST   /api/magazines                   Magazin erstellen (Slots werden auto-berechnet)
GET    /api/magazines/:id               Magazin mit Slots + Parts
PUT    /api/magazines/:id               Magazin aktualisieren
DELETE /api/magazines/:id               Magazin löschen
POST   /api/magazines/:id/duplicate     Magazin duplizieren (ohne Parts)
```

### Parts
```
POST   /api/parts                       Teil anlegen
GET    /api/parts/:id                   Teil abrufen
PUT    /api/parts/:id                   Teil bearbeiten
DELETE /api/parts/:id                   Teil löschen
```

### Search
```
GET    /api/search?q=query              Suchen + WLED-LED triggern
POST   /api/search/highlight/:slotId    Slot manuell aufleuchten
DELETE /api/search/highlight            Alle LEDs ausschalten
```

### WLED Devices
```
GET    /api/wled/devices                Alle WLED-Geräte
POST   /api/wled/devices                Gerät hinzufügen
PUT    /api/wled/devices/:id            Gerät bearbeiten
DELETE /api/wled/devices/:id            Gerät löschen
POST   /api/wled/devices/:id/test       LED-Test (alle Fächer nacheinander)
```

### Voice Webhook (Alexa, Home Assistant, IFTTT)
```
POST   /api/voice/search
Body:  { "query": "M4x20 Schraube" }
```

### Settings
```
GET    /api/settings                    Alle Einstellungen
PUT    /api/settings                    Einstellungen speichern
```

## WLED MQTT Kommunikation

WLED lauscht nativ auf `{mqtt_topic}/api`. Payload ist der WLED JSON State:

**Slot aufleuchten (amber):**
```json
{"seg":[{"id":0,"start":5,"stop":8,"col":[[255,165,0],0,0],"on":true,"bri":255}]}
```

**Alles rot blinken (nicht gefunden):**
```json
{"v":true,"seg":[{"start":0,"stop":100,"col":[[255,0,0]],"fx":1,"ix":200,"on":true}]}
```

**LED ausschalten:**
```json
{"seg":[{"id":0,"start":5,"stop":8,"on":false}]}
```

## Voice Integration

### Alexa Custom Skill
Erstelle einen Custom Skill mit einem `SearchIntent` und `{query}` Slot.
Der Skill-Endpoint ruft auf: `POST https://your-domain.com/api/voice/search`

### Home Assistant
```yaml
rest_command:
  picknlight_search:
    url: "http://picknlight:7050/api/voice/search"
    method: POST
    content_type: "application/json"
    payload: '{"query": "{{ query }}"}'
```

## Migrations

### Migration 001 – Initial Schema (auto via Prisma)
Erstellt: magazines, slots, parts, wled_devices, settings

## Changelog

- **2026-05-17** – Initiales Setup, vollständige Implementierung
