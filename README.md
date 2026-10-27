# Cistern Level Card

Eine Lovelace-Karte für Home Assistant, die den Füllstand einer Zisterne (oder
eines anderen Tanks) als Grafik mit sanft bewegter Wasseroberfläche darstellt.
Aus dem Füllstand in cm werden – anhand von maximaler Höhe und Volumen –
automatisch die verbleibenden Liter berechnet.

![Preview](preview.png)


## Voraussetzung

Ein Sensor in Home Assistant, der den Füllstand in **cm** liefert
(z. B. über ESPHome von deinem ESP32/ADS1115- oder Radar-Sensor).

## Installation über HACS

1. HACS → Frontend → oben rechts die drei Punkte → **Benutzerdefinierte Repositories**
2. Repository-URL eintragen, Kategorie **Dashboard**
3. "Cistern Level Card" installieren
4. Home Assistant neu laden (Browser-Cache ggf. leeren)

## Konfiguration

```yaml
type: custom:cistern-level-card
entity: sensor.zisterne_fuellstand_cm
name: Zisterne
max_height_cm: 200
min_height_cm: 0
max_volume_l: 6000
decimals: 0
water_color: "#1e88e5"
# water_color_light: "#4fa8f0"   # optional, sonst automatisch aus water_color
show_liters: true
show_percentage: true
tank_type: standing
show_scale: true
tank_height: 200
tank_width: 96
low_level_percent: 15
low_level_color: "#e53935"
icon: mdi:waves
```

| Option | Pflicht | Standard | Beschreibung |
|---|---|---|---|
| `entity` | ja | – | Sensor mit Füllstand in cm |
| `name` | nein | Entitätsname | Angezeigter Titel |
| `max_height_cm` | ja | 200 | Füllstand bei 100 % |
| `min_height_cm` | nein | 0 | Toter Raum / Sensor-Offset am Boden |
| `max_volume_l` | nein | – | Fassungsvermögen; ohne diese Angabe wird nur % angezeigt |
| `decimals` | nein | 0 | Nachkommastellen bei der Liter-Anzeige |
| `water_color` / `water_color_light` | nein | Blau / automatisch heller | Wasserfarbe; die Wellenfarbe wird aus `water_color` abgeleitet, wenn nicht gesetzt |
| `show_liters` / `show_percentage` | nein | true | Anzeige ein-/ausblenden |
| `tank_type` | nein | standing | `standing` oder `horizontal_cylinder` (liegender Rundtank) |
| `volume_curve` | nein | – | Liste von `[cm, Liter]`-Punkten für beliebige Tankformen |
| `show_scale` | nein | true | Skala (25/50/75 %) am Tank anzeigen |
| `tank_height` / `tank_width` | nein | 200 / 96 | Größe des Tanks in Pixel |
| `low_level_percent` | nein | – | Unterhalb dieses Füllstands (%) wird gewarnt: Wasser und Prozentanzeige in `low_level_color`, dazu der Text "Füllstand niedrig" |
| `low_level_color` | nein | #e53935 | Warnfarbe |
| `icon` | nein | mdi:waves | Kopfzeilen-Icon |

## Tankform und Liter-Berechnung

Standardmäßig rechnet die Karte **linear**: `Liter = (Füllstand / max_height_cm) × max_volume_l`.
Das passt bei stehenden zylindrischen oder quaderförmigen Tanks.

**Liegender Rundtank** (z. B. erdverlegte Zisterne): Hier ist der Zusammenhang zwischen Höhe und Volumen nicht linear.

```yaml
tank_type: horizontal_cylinder
max_height_cm: 150      # Innendurchmesser des Tanks
max_volume_l: 6000
```

Die Karte rechnet dann nach der Kreissegment-Formel und zeigt den Tank liegend (breiter als hoch,
Größe über `tank_width` / `tank_height` änderbar). Die Prozent- und Literangaben (und die Skala) beziehen
sich auf das **Volumen**, die Füllhöhe in der Grafik auf die Höhe.

**Beliebige Tankform** über eine Volumenkurve aus Messpunkten (Sensorwert in cm → Liter), z. B. aus einer Peiltabelle:

```yaml
volume_curve:
  - [0, 0]
  - [50, 300]
  - [100, 2000]
  - [200, 6000]
```

Zwischen den Punkten wird linear interpoliert, das Gesamtvolumen ist der letzte Punkt
(oder `max_volume_l`, falls gesetzt). Werte können auch als `{height_cm: 50, volume_l: 300}` angegeben werden.
`volume_curve` hat Vorrang vor `tank_type`.

## Ideen für die Weiterentwicklung

- Mini-Graph der letzten 7 Tage unterhalb des Tanks

## Versionen / Releases

HACS zeigt nur dann eine Versionsnummer statt eines Commit-Hashes, wenn es ein GitHub-Release gibt.
Das Release entsteht automatisch:

1. `CARD_VERSION` in `cistern-level-card.js` und `CHANGELOG.md` anpassen, per PR nach `main` mergen
2. Der Workflow `.github/workflows/release.yml` legt für die neue Version das Release `v<CARD_VERSION>` an
   (inklusive `cistern-level-card.js`). Existiert es schon, passiert nichts.

Manuell: unter **Actions → Release → Run workflow** starten (Tag optional) oder `git tag v1.5.2 && git push origin v1.5.2`.
