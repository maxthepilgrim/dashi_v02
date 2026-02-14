# Life Dashboard v9.4 - Gesamtdokumentation

Stand: 2026-02-14  
Codebasis: `life-dashboard-v9.4` (UI zeigt aktuell "v9.4 Aurora")

Ergaenzend: Siehe `FAQ.md` fuer schnelle Antworten auf typische Fragen.

## 1) Ziel der Anwendung

Life Dashboard ist ein lokales, browserbasiertes "Life OS" mit mehreren Modi:

- `personal`: persoenliche Steuerung (Journal, Gewohnheiten, Ziele, Reflexion)
- `business`: Geschaeftsmetriken und Hebelprojekte
- `vision`: strategische Planung mit Compute-Engine
- `ritual`: langsamer Tagesabschluss (Listening Room, Walk Log, Dankbarkeit)
- `feed`: einheitlicher, filterbarer Verlauf ueber zentrale Ereignisquellen
- `library`: Medienarchiv mit Suche/Filter/Import

Die Anwendung arbeitet primar mit `localStorage` im Browser und benoetigt keinen Server fuer den Kernbetrieb.

## 2) Start, Navigation, Bedienlogik

### 2.1 Moduswechsel

Modi koennen auf drei Arten gewechselt werden:

- obere Mode-Leiste (Buttons `PERSONAL`, `BUSINESS`, `VISION`, `RITUAL`, `FEED`, `LIBRARY`)
- Taste `M` (zyklisches Durchschalten, ausser in aktiven Eingabefeldern)
- URL-Parameter `?mode=<modus>` beim Laden (z. B. `?mode=feed`, nur wenn in Settings erlaubt; optional `?source=journal`)

Startverhalten (Global Settings V1):

- `Startup Policy = remember-last`: startet mit dem zuletzt verwendeten Modus
- `Startup Policy = fixed-default`: startet immer mit dem ausgewaehlten Modus
- `Allow URL mode override`: erlaubt/sperrt `?mode=...` als Prioritaet beim Start

### 2.2 Command Palette

- Oeffnen mit `Cmd+K` (macOS) oder `Ctrl+K` (Windows/Linux)
- Aktionen werden gefiltert und mit `Enter` ausgefuehrt
- Schliessen mit `Esc` oder Klick ausserhalb

### 2.3 Widget-Layout

- Widgets sind per Drag-and-Drop verschiebbar (Drag Handle im Widgetkopf)
- Layout wird gespeichert
- Widgets koennen gepinnt werden (Pin-Button am Widget)
- Es gibt globale Sichtbarkeitsregeln pro Widget (Personal/Business/Both/Hidden)

### 2.4 Global Settings V1 (kanonisches Modell)

Die Einstellungen laufen seit V1 ueber einen zentralen Datensatz:

- Schluessel: `lifeos-settings-v1`
- Bereiche:
  - Profile (`name`, `avatar`)
  - Startup (`policy`, `fixedMode`, `allowUrlOverride`, `lastMode`)
  - Density pro Modus (`personal/business/vision/ritual/feed/library`)
  - Date & Time (`weekStartsOn`, `dateStyle`, `hourCycle`)
  - Accessibility (`reducedMotion`, `introAnimation`)
  - Visualizer (`normal` oder `pro`)
  - Widget Assignment (`both/personal/business/hidden`)

Legacy-Reads bleiben fuer eine Uebergangsphase aktiv, neue Writes gehen in den V1-Schluessel.

## 3) Datenhaltung, Autosave, Datenschutz

### 3.1 Speicherort

- Alle Kerninhalte liegen lokal im Browser-`localStorage`
- Kein verpflichtender Cloud-Account fuer den Regelbetrieb
- Globale UI-Praeferenzen liegen zentral in `lifeos-settings-v1`

### 3.2 Autosave-Verhalten (Auszug)

- Quick Journal: Speichern per `Enter` (ohne Shift)
- Ritual Journal/Gratitude/Vinyl-Felder: debounce-basiertes Autosave
- Vision-Planung: sofortige State-Updates + verzogerte Compute-Laeufe
- Walk Log: Speichern bei "Save Walk"
- Strike Team / diverse Eingaben: direkter oder kurzer verzogerter Save

### 3.3 Backup & Restore

Im Settings-Modal (`Global Settings > Data Management`):

- `Download Backup`: JSON-Export aller wichtigen Schluessel
- `Restore Backup`: JSON-Import, danach Reload
- `Reset Board`: leert lokale Daten (Reset auf Defaults)

Kompatibilitaet:

- Export enthaelt `lifeos-settings-v1`
- Import akzeptiert alte und neue Backup-Formate
- Bei alten Backups ohne `lifeos-settings-v1` wird beim naechsten Start migriert

### 3.4 Tageswechsel und Archiv

Bei Tageswechsel laeuft ein Midnight-Archiv:

- Tageszustand wird archiviert (Rhythmus, Journal, Ziele, Events, Vices, North Star, Quick Capture)
- Daily Rhythm Checkmarks werden zurueckgesetzt
- Vices Counter werden resettet
- Streak-Historie wird aktualisiert

## 4) Funktionsumfang nach Modus

### 4.1 Shared Dashboard (modusunabhaengig sichtbar je nach Regeln)

- Topbar mit Datum, Greeting, Season-Tag
- Focus Engine (Creative Compass)
- North Star
- System Health
- Active Worlds
- Strike Team
- Year Compass
- Calendar + Upcoming Events + Archive-Ansicht pro Tag

### 4.2 Personal Mode

Wesentliche Widgets:

- Quick Journal
- Activity Log
- People & Relationships
- Financial Overview (inkl. Income Pipeline)
- Current Status (Energy/Mood/Sleep/Note)
- Weekly Reflection
- Active Goals
- Daily Rhythm (inkl. 28-Tage-Streak Grid)
- Vault of Vices

Typische Aktionen:

- Journal schreiben
- Gewohnheiten abhaken
- Ziele/Fortschritt pflegen
- Tagesstatus loggen
- Events verwalten

### 4.3 Business Mode

Wesentliche Widgets:

- Financial Intelligence
- Revenue Engine
- Creative Output
- Projects & Leverage

Typische Aktionen:

- Kennzahlen updaten
- Pipeline/Invoices pflegen
- Biz-Projekte priorisieren

### 4.4 Vision Mode (Progressive Disclosure)

Layer:

- `Pulse`: kompakte Richtungsansicht + naechste Empfehlung
- `Signals`: Alignment/Drift/Risks/Explainability
- `Planning`: Direction, Themes, Milestones, Action Queue
- `History`: Decision Log + Drift History + Wocheninsights

Kernobjekte:

- North Star
- 1-Year / 5-Year Direction
- Themes
- Milestones (Titel, Datum, Typ, Next Action, Blocker, Completion)
- Weekly Commitments (maximal 3, nur offene Milestones)
- Decision Log (`YES/NO` inkl. Kontext/Typ/Energy/Note)

Compute-Mechanik:

- Aenderungen triggern Compute mit Debounce (ca. 850 ms)
- manueller Refresh moeglich
- Snapshots werden gespeichert (begrenzte Historie)
- Explainability + Action Queue werden aus dem Engine-Ergebnis gerendert

### 4.5 Ritual Mode

Widgets:

- Listening Room / Vinyl of the Week
- Ritual Journal
- Gratitude (3 Zeilen)
- Walk / Forest Log
- Slow Days Counter
- Gatherings

### Listening Room / Vinyl

Funktionen:

- Metadaten pflegen (Artist/Album/Year/Genre/Label/Notes)
- Apple Music Embed via URL oder Apple-ID-Teile
- Suche ueber iTunes/Apple Music API (im Code weiterhin ueber `SpotifyClient` Namespace)
- Shuffle-Funktion fuer zufaellige Alben
- Auto-Shuffle Intervall im Hintergrund (wenn nicht im Edit-Modus)
- Add-to-Library Uebernahme
- Overlay mit eingebettetem Player + Listening Note

### Walk Widget

Ablauf:

- Start -> Pause/Resume -> End -> Reflection/Metadaten -> Save oder Discard
- Walk-Typen inkl. Custom
- Weekly Insights (Walks, Minuten, Durchschnitt, haeufigster Typ)
- Log-Liste mit Eintraegen

### 4.6 Feed Mode

Funktionen:

- Vereinheitlichte Timeline fuer `journal`, `activity`, `walk`, `vision`-Entscheidungen, `library`-Neuzugaenge und `daily archive`
- Standard-Sortierung `Smart` (deterministische Ranking-Formel), alternativ `Recent` (rein chronologisch)
- Filterleiste mit Source-Chips, Zeitfenstern (`24h/7d/30d/all`) und Volltextsuche
- Quick Actions: `New Journal`, `Log Activity`, `Open Vision`, `Open Ritual`, `Open Library`
- Kartenaktionen: `Open Source`; `Delete` nur fuer loeschbare Quellen (`journal/activity/walk/library`)

Navigation:

- Journal-Verlaufspunkte im Dashboard und in der Command Palette oeffnen den Feed im Journal-Kontext
- `journal.html` bleibt als Legacy-URL erhalten und leitet auf `index.html?mode=feed&source=journal` um

### 4.7 Library Mode

Funktionen:

- Grid-Archiv fuer Medieneintraege
- Typen: `book`, `video`, `article`, `podcast`, `album`, `unknown`
- Suche (Titel/Creator/Tags), Filter (Type/Tag), Sortierung (Recent/Year/Title)
- Add Panel fuer neue Eintraege
- Item-Modal fuer Bearbeiten/Loeschen/Artwork
- iTunes/Apple-Music Albumsuche direkt im Item-Modal
- Library Settings:
  - Default Add Type
  - Tag Catalog
  - Hover Meta Only
  - CSV Import

CSV-Import:

- Mehrere Header-Varianten werden akzeptiert (`Title/Album/Record`, `Artist/Creator`, `Year/Released`, etc.)
- Importierte CSV-Eintraege werden aktuell als `album` typisiert

## 5) Visualizer und Atmosphaere

Es gibt zwei Visualizer-Modi:

- `normal` (Legacy Atmosphere Mixer)
- `pro` (Aurora Visual Synth)

Umschaltung:

- Command Dock Button `Visualizer`
- Auswahl auch in Global Settings (`Visualizer Mode`)

### 5.1 Normal Visualizer (Legacy)

Regler:

- Hue, Brightness, Saturation, Grain, Speed
- Temperature, Contrast, Calmness, Accent Hue
- Time Sync (zeitabhaengige Ableitung)
- Reset

### 5.2 Pro Visualizer (Visual Synth)

Bestandteile:

- Module Rack (Gradient Sky, Aurora Ribbon, Bloom+Glow, Blend Stack, Time+Motion)
- LFO Modulator
- Step Sequencer (BPM, Swing, Step Length, Lane Routing)
- Macro Bank (8 Makros)
- Pattern Save/Load
- Preset Bank (Factory + User)
- Import/Export Preset Bank als JSON
- Auto-Quality Option

Shortcuts im geoeffneten Pro-Synth:

- `Space`: Play/Pause Sequencer
- `R`: Randomize
- `0`: Reset
- `Esc`: Overlay schliessen

## 6) Weitere Querschnittsfunktionen

- `Zen Mode`: Fokus-Overlay + 25:00 Timer
- `Candle Mode`: ruhiger Fullscreen-Zustand mit Quotes + 10-Minuten-Timer
- Feed-Mode als kanonische Verlaufsebene (`?mode=feed`, optional `&source=journal`)
- `journal.html` als Kompatibilitaets-Redirect auf Feed-Mode
- Dashboard PNG Export (`html2canvas`)
- Density Menu:
  - `minimal`: nur priorisierte/critical Widgets
  - `adaptive`: alle sichtbar, weniger wichtige einklappen
  - `full`: volle Sicht
  - Persistenz ist pro Modus getrennt (`personal/business/vision/ritual/feed/library`)

## 7) Tastatur-Shortcuts (Cheat Sheet)

- `M`: Modus wechseln
- `Cmd/Ctrl + K`: Command Palette
- `Esc`: Modals/Overlays schliessen (kontextabhaengig)
- `Enter` im Quick Journal: Eintrag speichern
- `Shift + Enter` im Quick Journal: Zeilenumbruch
- Pro-Synth aktiv:
  - `Space`, `R`, `0`, `Esc`

## 8) Wichtige technische Hinweise

- Musiksuche laeuft derzeit ueber iTunes/Apple Music Endpunkte (kein echter Spotify OAuth-Flow im aktiven Client)
- Das System ist lokal-first: Browserdaten loeschen = Inhalte weg (falls kein Backup)
- Density wird dauerhaft und pro Modus in `lifeos-settings-v1` gespeichert
- Date/Time Rendering (Topbar + Kalender) folgt den Global-Settings-Praeferenzen
- Accessibility kann Intro-Animation deaktivieren und Motion global reduzieren
- Historischer Pfad `js/interactions.js` wird als Legacy behandelt und ist nicht Teil des aktiven Runtime-Flows
- Vision speichert Compute-Historie und Decision-Log begrenzt (Rolling Window)

## 9) Relevante Hauptdateien

- `index.html` - Gesamt-UI und Modus-Surfaces
- `app.js` - Hauptlogik, Rendering, Modals, Initialisierung
- `store.js` - Datenmodell und Persistenzschicht (`localStorage`)
- `mode.js` - Modusverwaltung
- `js/vision-mode.js` + `js/vision-engine.js` - Vision State/Compute/UI
- `feed-mode.js` - Feed Data Adapter, Ranking/Filter und Renderer
- `library-mode.js` - Library Storage + Renderer + CSV Import
- `walk-widget.js` - Walk Session UI + Timer + Logik
- `js/listeningRoomWidget.js` - Listening Room Overlay + Shuffle + Vinyl Sync
- `visual-synth.js` + `engine/*` - Pro Visualizer
- `js/ui-density-manager.js` - Adaptive/Minimal/Full Sichtlogik
