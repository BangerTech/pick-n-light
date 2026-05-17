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
| `led_gap` | INT | Inaktive LEDs zwischen Fächern (Standard: 0) |
| `row_padding` | INT | LEDs an BEIDEN Enden jeder physischen Reihe überspringen (Standard: 0). Beispiel: `row_padding=1, cols=4, leds=4` → `[1 skip][4][4][4][4][1 skip]` = 18 LEDs/Reihe |
| `led_skip_first` | INT | Globaler Offset vor der ersten Reihe – tote LEDs am Strip-Anfang (Standard: 0) |
| `serpentine` | BOOL | LED-Strip läuft Zickzack: gerade Reihen →, ungerade Reihen ← |
| `strip_origin` | TEXT | Ecke wo LED 0 liegt: `top-left` / `top-right` / `bottom-left` / `bottom-right` |
| `large_row_leds` | INT | Override LED-Anzahl für das große untere Fach (0 = wie normale Reihe) |
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

### Tags
```
GET    /api/tags                        Alle einzigartigen Tags aus allen Teilen (global)
```

Tags werden nicht separat gespeichert – sie werden aus den `tags`-Arrays aller `parts` aggregiert und alphabetisch sortiert zurückgegeben. Das Frontend nutzt diesen Endpunkt für die Autocomplete-Vorschläge im Teile-Formular.

### Magazines
```
GET    /api/magazines                   Alle Magazine
POST   /api/magazines                   Magazin erstellen (Slots werden auto-berechnet)
GET    /api/magazines/:id               Magazin mit Slots + Parts
PUT    /api/magazines/:id               Magazin aktualisieren (LED-Params → Slots werden neu berechnet)
DELETE /api/magazines/:id               Magazin löschen
POST   /api/magazines/:id/duplicate     Magazin duplizieren (ohne Parts)
```

**POST/PUT Body-Parameter (magazines):**
| Feld | Typ | Beschreibung |
|---|---|---|
| `name` | string | Magazin-Name |
| `rows` | int | Anzahl Reihen |
| `columns` | int | Anzahl Spalten |
| `ledsPerSlot` | int | LEDs pro Fach |
| `ledGap` | int | Abstand-LEDs zwischen Fächern |
| `rowPadding` | int | Skip-LEDs an beiden Reihen-Enden |
| `ledSkipFirst` | int | Globaler Strip-Offset am Anfang |
| `serpentine` | bool | Zickzack-Verlegung |
| `stripOrigin` | string | `top-left` / `top-right` / `bottom-left` / `bottom-right` |
| `bottomRowLarge` | bool | Unterste Reihe = Großfach |
| `largeRowLeds` | int | Override LED-Anzahl Großfach (0 = auto) |

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
GET    /api/wled/status                         MQTT-Status
GET    /api/wled/devices                        Alle WLED-Geräte
POST   /api/wled/devices                        Gerät hinzufügen
PUT    /api/wled/devices/:id                    Gerät bearbeiten
DELETE /api/wled/devices/:id                    Gerät löschen
POST   /api/wled/devices/:id/test               LED-Test (flash / sequence)
POST   /api/wled/devices/:id/light-range        LED-Bereich leuchten
POST   /api/wled/devices/:id/all-off            Alle LEDs aus
```

**POST /api/wled/devices/:id/test Body:**
```json
{ "mode": "flash|sequence", "delayMs": 600, "totalLedsOverride": 162, "slotOverrides": [...] }
```
`totalLedsOverride` und `slotOverrides` erlauben das Frontend, aktuelle (noch nicht gespeicherte)
Konfigurationswerte zu übermitteln, sodass der Test immer den aktuellen UI-Stand reflektiert.

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

WLED lauscht nativ auf `{mqtt_topic}/api`. Payload ist der WLED JSON State.

**Wichtig:** Für alle "voller Strip"-Befehle wird `stop: 9999` als Sentinel verwendet.
WLED clippt diesen Wert automatisch auf seine konfigurierte Strip-Länge (`info.leds.count`).
Das macht den Code unabhängig von der exakten LED-Anzahl für Hintergrund-Segmente.

**Slot aufleuchten (zwei Segmente):**
```json
{
  "on": true, "bri": 255,
  "seg": [
    {"id": 0, "start": 0, "stop": 9999, "col": [[0,0,0],[0,0,0],[0,0,0]], "fx": 0, "on": true},
    {"id": 1, "start": 5, "stop": 9,    "col": [[255,165,0],[0,0,0],[0,0,0]], "fx": 0, "on": true}
  ]
}
```

**Alle LEDs ein (flash):**
```json
{"on": true, "bri": 255, "seg": [{"id": 0, "start": 0, "stop": 9999, "col": [[0,200,255],[0,0,0],[0,0,0]], "fx": 0, "on": true}, {"id": 1, "start": 0, "stop": 0}]}
```

**Alles aus:**
```json
{"on": false}
```

**Alle rot blinken (nicht gefunden):**
```json
{"on": true, "bri": 255, "seg": [{"id": 0, "start": 0, "stop": 9999, "col": [[255,0,0],[0,0,0],[0,0,0]], "fx": 1, "ix": 220, "on": true}, {"id": 1, "start": 0, "stop": 0}]}
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

## LED-Berechnung

```
Reihe = [row_padding] [slot×leds_per_slot + (cols-1)×led_gap] [row_padding]
Gesamt = led_skip_first + (rows-1) × ledsPerRow + largeRowTotal
```

Beispiel (9 Reihen, 4 Spalten, ledsPerSlot=4, rowPadding=1, ledGap=0):
```
ledsPerRow = 1 + 4×4 + 0 + 1 = 18
total      = 0 + 8×18 + 18 = 162
```

## Migrations

| Migration | Inhalt |
|---|---|
| `001_initial` | Erstellt: magazines, slots, parts, wled_devices, settings |
| `002_add_led_gap` | `led_gap` Spalte in magazines |
| `003_add_serpentine` | `serpentine` Spalte in magazines |
| `004_add_strip_origin` | `strip_origin` Spalte in magazines |
| `005_skip_first_and_large_row` | `led_skip_first`, `large_row_leds` Spalten in magazines |
| `006_add_row_padding` | `row_padding` Spalte in magazines |

## Changelog

- **2026-05-17** – Initiales Setup, vollständige Implementierung
- **2026-05-17** – LED-Konfig erweitert: ledGap, serpentine, stripOrigin, ledSkipFirst, largeRowLeds, rowPadding
- **2026-05-17** – FULL_STRIP Sentinel (stop: 9999) für robuste WLED-Segment-Kontrolle
- **2026-05-17** – Onboarding: totalLedsOverride für Live-Tests vor dem Speichern
- **2026-05-17** – Globale Tags: `GET /api/tags` aggregiert alle eindeutigen Tags; Tag-Autocomplete im Teile-Formular
- **2026-05-17** – Wandansicht (Wall View): Dashboard zeigt alle Magazine nebeneinander (1/2/3 Spalten, persistent im LocalStorage)
- **2026-05-17** – Magazin-Grid: verbesserte SlotCell-Optik (Reihe·Spalte-Badge, Tag-Dots, Akzentlinie), `compact`-Modus für Wandansicht
- **2026-05-17** – Responsive Design: Bottom-Navigation auf Mobilgeräten (< sm), bottom-sheet-Modal, safe-area-Unterstützung
