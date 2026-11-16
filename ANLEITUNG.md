# Weltenbummler v1.1 – Update

Neu in v1.1: Die ganze Welt ist jetzt echtes 3D (Gelände mit Höhen und Küsten, Wasser mit Brandung,
Berge, Bäume, Sehenswürdigkeiten, Flughäfen, Felder als Podeste), dazu detailliertere Figuren
(Gesicht, Frisur, Haarfarbe, Rucksack in Spielerfarbe), Partikel-Effekte und hübschere Minispiele.

## Einspielen
Nur das Weltenbummler-Repository ist betroffen – Tyjora bleibt, wie es ist.
1. Im GitHub-Repository `Weltenbummler` die Ordner `public` und `src` durch die aus diesem Paket ersetzen.
   Wichtig: `public/map.js` gibt es nicht mehr (bitte löschen), neu ist `public/world.js`.
2. Cloudflare stellt automatisch neu bereit. (Erstes Einrichten: siehe Anleitung aus v1.0 –
   Repository importieren, Domain `weltenbummler.tyjora.com` zuweisen.)

Lokale Vorschau ohne Internet: `public/index.html` doppelklicken → Solo-Modus gegen Bots.

## Dateien
- `public/index.html` – Seite & Aussehen (Tyjora-Stil)
- `public/gl.js` – die 3D-Welt: Gelände, Wasser, Felder, Wege, Bäume, Berge, Sehenswürdigkeiten, Figuren
- `public/world.js` – Höhen, Farben und Standorte, aus deiner Landkarte berechnet
- `public/game.js` – Oberfläche, Animationen, Verbindung, Minispiele
- `public/engine.js` – Spielregeln und Spielbrett (Stellschrauben oben unter `CFG`)
- `src/worker.js` – Spiel-Server (ein Raum pro Runde)

## Anpassen
- Sehenswürdigkeit verschieben: in `world.js` unter `"lm"` stehen Name, x, y (Pixel deiner Karte) und Grösse.
- Aussehen einer Sehenswürdigkeit: in `gl.js` unter `const LM = { … }`.
- Farben/Optionen der Figuren: in `gl.js` unter `LOOKS`; die Anzahl je Option zusätzlich in `engine.js` unter `LOOK_MAX`.
