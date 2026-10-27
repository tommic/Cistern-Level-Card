# Changelog

## 1.7.0
- Liegende Rundtanks: `tank_type: horizontal_cylinder` rechnet nach der Kreissegment-Formel und zeigt den Tank liegend
- Beliebige Tankformen über `volume_curve` (Messpunkte cm → Liter)
- Prozent, Liter, Skala und Verbrauch beziehen sich auf das Volumen

## 1.6.0
- Skala (25/50/75 %) am Tank, abschaltbar mit `show_scale`
- Größe des Tanks einstellbar (`tank_height`, `tank_width` in px)
- Warnstufe: `low_level_percent` und `low_level_color` färben Wasser und Prozentanzeige und blenden "Füllstand niedrig" ein

## 1.5.3
- Editor: Einstellung für den Verbrauchs-Rückblick verständlicher beschriftet, mit Hinweistext

## 1.5.2
- Verbrauch und Reichweite: Messrauschen des Sensors wird nicht mehr als Verbrauch gezählt (Stundenwerte per Median, Schwelle für Abnahmen)

## 1.5.1
- Wellenfarbe wird automatisch aus der Wasserfarbe abgeleitet, solange keine eigene gesetzt ist (vorher blieb sie blau)

## 1.5.0
- Verbrauch (pro Tag), Reichweite in Tagen und Min/Max aus dem Verlauf der Entität
- Neue Optionen `show_history` und `history_hours`

## 1.4.0
- Sprache und Zahlenformat folgen den Home-Assistant-Einstellungen (Deutsch und Englisch)

## 1.3.0
- Visueller Editor um alle Optionen erweitert (Nachkommastellen, Einheit, Wellenfarbe, Anzeige-Schalter)
- Editor schreibt keine leeren Werte mehr in die Konfiguration

## 1.2.0
- Klick auf die Karte öffnet den Verlauf der Entität (More-Info-Dialog)

## 1.1.1
- Wellen bleiben auch bei 100 % Füllstand sichtbar und enden am oberen Rand

## 1.1.0
- Füllstand mit animierter Wellenoberfläche (zwei SVG-Sinuswellen)

## 1.0.0
- Erste Version
