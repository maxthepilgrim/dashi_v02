# FAQ - Life Dashboard v9.4

Fuer die vollstaendige Funktionsuebersicht siehe `DOKUMENTATION.md`.

## 1) Wo werden meine Daten gespeichert?

Alle Kerninhalte werden lokal im Browser (`localStorage`) gespeichert.  
Es gibt standardmaessig keine serverseitige Pflicht-Synchronisation.

## 2) Wie mache ich ein Backup?

`Settings -> Data Management -> Download Backup` erzeugt eine JSON-Datei mit den wichtigsten Daten.

## 3) Wie spiele ich ein Backup zurueck?

`Settings -> Data Management -> Restore Backup` waehlen, JSON-Datei importieren.  
Nach erfolgreichem Import wird die Seite neu geladen.

## 4) Was macht "Reset Board"?

Es leert die lokalen Daten und setzt auf Default-Werte zurueck.  
Vorher unbedingt Backup machen.

## 5) Ich sehe Widgets nicht. Sind Daten weg?

Meist nicht. Pruefe:

- bist du im richtigen Modus (`personal/business/vision/ritual/feed/library`)?
- ist das Widget in `Settings -> Widget Assignment` auf `hidden` oder falschen Modus gesetzt?
- steht der Density-Modus auf `minimal` (blendet vieles aus)?

## 6) Wie wechsle ich schnell den Modus?

- oben ueber die Modus-Buttons
- Taste `M`
- URL mit `?mode=feed` (oder anderem Modus), nur wenn `Allow URL mode override` aktiv ist

## 7) Wie funktioniert die Command Palette?

Mit `Cmd/Ctrl + K` oeffnen, tippen, `Enter` ausfuehren, `Esc` schliessen.

## 8) Was bedeutet Density `minimal`, `adaptive`, `full`?

- `minimal`: zeigt nur priorisierte und kritische Widgets
- `adaptive`: zeigt alles, klappt weniger relevante Bereiche ein
- `full`: zeigt alles vollstaendig

Seit Global Settings V1 wird Density pro Modus getrennt gespeichert.

## 9) Warum kann ich in Vision nur 3 Weekly Commitments setzen?

Das ist bewusst auf maximal 3 begrenzt, um Fokus und Ausfuehrbarkeit zu sichern.

## 10) Warum zeigt Vision "No recommended action yet"?

Typische Gruende:

- keine Milestones vorhanden
- keine offenen Weekly Commitments
- noch kein Compute-Lauf nach neuen Eingaben

Nutze `Refresh Signals` oder erstelle Milestones mit `Next Action`.

## 11) Was speichert Vision genau?

- Zustand (`visionModeState`)
- Snapshots der Compute-Ergebnisse (rolling)
- Decision Log (rolling)
- Telemetrie zum letzten Compute

## 12) Warum steht im UI teils Spotify, aber es kommen iTunes Ergebnisse?

Der aktuelle Music-Client nutzt iTunes/Apple Music Endpunkte.  
Der Name `SpotifyClient` ist im Code historisch geblieben.

## 13) Wie verknuepfe ich den Listening Room?

Moeglich sind:

- Apple Music Embed URL
- Apple Music ID + Type (`album/playlist/song`) + Storefront
- Suche und Uebernahme aus iTunes Resultaten

## 14) Was macht der Shuffle-Button im Ritual Vinyl?

Er sucht iTunes-Alben zu Zufalls-Queries und setzt ein zufaelliges Ergebnis als aktives Vinyl.

## 15) Warum aendern sich Vinyl-Daten manchmal automatisch?

Der Listening Room hat Auto-Shuffle im Intervall und schreibt gefundene Alben zurueck (wenn nicht im Edit-Modus).

## 16) Wie funktioniert der Walk Log?

Flow:

- `Start Walk`
- optional `Pause/Resume`, Typ wechseln, Quick Note
- `End Walk`
- Reflection + Metadaten
- `Save Walk` oder `Discard`

Weekly Insights werden aus den gespeicherten Walks berechnet.

## 17) Warum sind Daily-Rhythm-Haekchen am naechsten Tag weg?

Das ist gewollt: Beim Tageswechsel wird archiviert und der Daily Rhythm zurueckgesetzt.

## 18) Wie importiere ich CSV in der Library?

`Library -> Settings -> Import CSV`.  
Header duerfen variieren (z. B. `Title/Album`, `Artist/Creator`, `Year/Released`, `Tags`, `Cover URL`).

## 19) Kann ich Library-Eintraege bearbeiten?

Ja. Karte anklicken (oder per Tastatur fokus + Enter) oeffnet Item-Modal mit Edit, Suche, Artwork, Delete.

## 20) Welche Visualizer-Modi gibt es?

- `normal`: Legacy-Mixer mit Atmosphaeren-Reglern
- `pro`: Visual Synth mit Modulen, LFO, Sequencer, Presets

Umschalten ueber Settings oder den Dock-Button `Visualizer`.

## 21) Welche Shortcuts gelten im Pro Visual Synth?

Nur wenn das Synth-Overlay aktiv ist:

- `Space` Play/Pause
- `R` Randomize
- `0` Reset
- `Esc` Schliessen

## 22) Kann ich das Dashboard als Bild exportieren?

Ja, in `Settings -> Data Management -> Export Dashboard PNG`.

## 23) Kann ich Journal-Eintraege loeschen?

Ja:

- im Feed-Modus (`?mode=feed`, bei Bedarf mit Source-Filter `journal`)
- legacy: `journal.html` leitet automatisch auf `index.html?mode=feed&source=journal` um
- oder im Journal-Modal im Dashboard

## 24) Ich habe Browserdaten geloescht. Kann ich wiederherstellen?

Nur mit vorherigem Backup-JSON.  
Ohne Backup sind lokal geloeschte Daten nicht rekonstruierbar.

## 25) Gibt es Multi-Device Sync?

Im aktuellen Stand nicht als Kernfunktion.  
Empfohlener Workflow ist regelmaessiger Backup-Export und manueller Import.

## 26) Welche neuen Global Settings sind dazugekommen?

- Startup Policy (`remember-last` oder `fixed-default`)
- Density pro Modus
- Date & Time (`weekStartsOn`, `dateStyle`, `hourCycle`)
- Accessibility (`reducedMotion`, `introAnimation`)

## 27) Warum startet die App ploetzlich in einem anderen Modus?

Pruefe `Settings -> Startup`:

- `remember-last` nutzt den zuletzt aktiven Modus
- `fixed-default` ignoriert den letzten Modus und nimmt den fixen Zielmodus
- URL-Override kann den Startmodus bei `?mode=...` ueberschreiben

## 28) Wer hat Vorrang beim Start: URL oder Startup-Policy?

Reihenfolge:

- gueltiger URL-Mode (nur wenn `Allow URL mode override` aktiv)
- sonst Startup-Policy (`remember-last` oder `fixed-default`)

## 29) Was passiert bei alten Backups ohne `lifeos-settings-v1`?

Sie werden weiterhin akzeptiert.  
Beim Laden wird die neue Settings-Struktur aus Legacy-Werten migriert.

## 30) Wie deaktiviere ich Intro-Animationen und starke Bewegung?

`Settings -> Accessibility`:

- `Reduced Motion = on` reduziert/stoppt nicht essentielle Animationen
- `Intro Animation = disabled` startet ohne Intro-Sequenz
