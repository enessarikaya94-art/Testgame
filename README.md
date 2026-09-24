# Turan – Steppe und Sultanat

Ein rundenbasiertes Strategiespiel im Stil der *Total-War*-Kampagnenkarte über die Geschichte der Türken und Turkvölker in Zentralasien und im Nahen Osten vom 10. bis zum 13. Jahrhundert. Das Spiel läuft komplett im Browser, auf Deutsch und Türkisch.

## Starten

Das Spiel besteht aus reinem HTML/JavaScript ohne Build-Schritt. Wegen der JavaScript-Module muss es über einen (beliebigen) Webserver geladen werden, ein Doppelklick auf `index.html` reicht nicht:

```bash
# im Projektordner
python3 -m http.server 8000
# dann im Browser öffnen: http://localhost:8000
```

Alternativ lässt sich das Repository direkt über **GitHub Pages** veröffentlichen (Einstellungen → Pages → Branch wählen). Dann ist das Spiel unter der Pages-Adresse spielbar, auch auf dem Handy.

## Inhalt

- **Kampagnenkarte** mit 115 historischen Provinzen vom Balkan bis Bengalen und von der Wolga bis zum Jemen, gezeichnet im Stil einer alten Pergamentkarte (Küsten, Flüsse, Gebirge, Wüsten, Seidenstraße). Die Provinzgrenzen werden beim Start aus echten Geodaten erzeugt.
- **Drei Startszenarien**: 1000 (*Das Erbe der Samaniden*), 1071 (*Malazgirt*) und 1200 (*Vor dem Sturm*). Eine Runde entspricht einer Jahreszeit, die Kampagne endet 1300.
- **Spielbare Großmächte**: Große Seldschuken, Karachaniden, Ghaznawiden, Choresm-Schahs, Kiptschaken, Petschenegen, Oghusen, Wolgabulgaren, Uiguren, Rum-Seldschuken, Mamluken, Sultanat Delhi und weitere Turkstaaten, dazu Byzanz, Abbasiden, Fatimiden, Buyiden, Georgien, Armenien, Kiewer Rus, Ghuriden, Kara-Kitai, Mongolen, Kreuzfahrer und Ayyubiden.
- **Kleinmächte (nicht spielbar)**: rund 35 computergesteuerte Emirate, Stammesverbände und Fürstentümer, darunter Kakuyiden, Hasanwaihiden, Marwaniden, Uqailiden, Emirat Derbent, Artsruni, Kimek, Baschkiren, Naimanen, Banu Ammar, Turkmenische Beys, Beduinen und die Scherifen von Mekka. Mit ihnen sind Handel, Bündnisse, Heiraten, Geschenke, Tributforderungen, Unterwerfung und Krieg möglich, und sie fordern auch selbst Tribut.
- **Nomaden und Sesshafte**: drei Herrschaftsformen (nomadisches Khanat, Sultanat/Iqta-Staat, sesshaftes Reich) mit eigener Wirtschaft aus Herden, Steuern und Handel. Der Übergang zwischen ihnen ist möglich.
- **Wirtschaft und Handel**: Handelsgüter, 17 Handelsrouten mit der Seidenstraße, Karawansereien, Handelsabkommen, Tribute und Plünderungen.
- **Religion und Kultur**: 14 Religionen und 13 Kulturen. Bekehrung, Türkisierung von Weideland, Religionspolitik und ein Kalif, der Sultanstitel verleiht.
- **Dynastie und Diplomatie**: Herrscher mit Eigenschaften, Erbfolge nach Seniorat, Primogenitur oder Kurultai, Thronstreit, Atabegs und Wesire. Dazu Krieg, Frieden mit Bedingungen, Bündnisse, Vasallen und Heiratsbündnisse.
- **Forschungsbaum** mit 36 Technologien in vier Zweigen (Kriegskunst, Verwaltung, Wirtschaft, Kultur und Wissenschaft).
- **Schlachten mit Taktikwahl**: vorgetäuschte Flucht, Umzingelung, Pfeilhagel, Verteidigung, Hinterhalt, Frontalangriff oder Rückzug. Gelände, Jahreszeit, Truppenmischung und Feldherr zählen. Belagerungen, Sturmangriffe und Raubzüge.
- **Historische Ereignisse**: Aufstieg der Seldschuken, Kreuzzüge, Nizariten, Kara-Kitai, Zengiden, Saladin, Sultanat Delhi, Mongolensturm, Mamluken. Dazu Zufallsereignisse mit Entscheidungen, etwa Turkmenen, Gelehrte wie Ibn Sina oder Mahmud al-Kaschgari, Seuchen oder das Viehsterben (Dschut).
- **Regionale Besonderheiten**: Jede der 115 Provinzen hat 1–4 wirtschaftliche, kulturelle oder militärische Eigenheiten, insgesamt 40 Arten. Beispiele sind die Himmlischen Pferde Ferganas, Damaszener Stahl, die Kornkammer Ägyptens, Gebirgspässe, Sufi-Konvente, Ghulam-Märkte und das Adlernest Alamut. Dazu kommen regionale Truppen: Fergana-Panzerreiter, Gazi-Grenzkrieger, Sistan-Bogenschützen, Kiptschakische Garde und Fidais.
- **Provinzschwerpunkte**: Steuern, Handel, Landwirtschaft, Heerlager oder Glaubenszentrum.
- **Märkte und Ressourcen**: schwankende Warenpreise, Monopole, strategische Ressourcen (Eisen, Bauholz, Naphtha) als Voraussetzung für schwere Truppen, Zugang über Handelsabkommen, Futterbedarf der Reiterei, Kredite bei Kaufleuten.
- **Feldzüge**: Heere per Ziehen verschieben, Routen über mehrere Etappen, Haltungen (Gewaltmarsch, Abfangen, Verschanzen), Abfangen von Feindheeren in Nachbarprovinzen, Marschspuren feindlicher Heere, Durchmärsche durch Feindesland.
- **Erweiterte Diplomatie**: aufgeschlüsselte Haltung, Durchzugsrechte, laufender Tribut und Subsidien, Friedensschlüsse mit jährlichen Zahlungen, Koalitionen gegen Eroberer, Zerfall übergroßer Reiche durch Atabegs und Emire.
- **Unerwartete Weltereignisse** (Häufigkeit wählbar: aus, normal, häufig): Seuchen wie Pest, Pocken und Fleckfieber breiten sich entlang der Handelswege aus. Dazu kommen plötzliche Steppenhorden, Hungersnöte und Heuschreckenplagen, Viehseuchen, Hochwasser, Großbrände, Morde durch Assassinen, überlaufende Feldherren, religiöse Unruhen, neu entdeckte Erzadern und Blütezeiten des Handels. Wann der Mongolensturm losbricht, ist ungewiss (irgendwann zwischen 1190 und 1225).
- **Computergegner**, die bauen, forschen, rekrutieren, Kriege führen und Frieden schließen.
- **Speichern** im Browser (5 Plätze und automatischer Spielstand) sowie Export und Import als Datei.

## Steuerung

| Aktion | Maus / Tastatur | Touch |
| --- | --- | --- |
| Karte verschieben | Ziehen, Pfeiltasten, WASD | Wischen |
| Zoomen | Mausrad, `+` / `−` | Zwei Finger |
| Provinz oder Heer wählen | Linksklick | Tippen |
| Marschieren | Ziel anklicken, dann erneut klicken oder Rechtsklick | Ziel zweimal antippen |
| Runde beenden | `Enter` | Knopf „Runde beenden“ |
| Auswahl aufheben | `Esc` | × im Panel |

## Aufbau des Codes

```
index.html          Einstieg
css/style.css       Gestaltung
js/main.js          Menüs, Spielstart, Testmodus
js/i18n.js          Texte Deutsch/Türkisch
js/data/            Geodaten, Provinzen, Fraktionen, Szenarien, Einheiten, Gebäude, Technologien, Namen
js/map/             Kartengenerator (Raster, Grenzen, Nachbarschaften) und Darstellung
js/game/            Spiellogik: Zustand, Wirtschaft, Militär, Schlacht, Diplomatie, Figuren, Ereignisse, KI, Rundenablauf
js/ui/              Oberfläche: Panels, Dialoge, Spielstände
```

## Testmodus

`index.html?sim=400&scenario=s1071` lässt die KI 400 Runden (100 Jahre) allein spielen und legt das Ergebnis in `window.__sim` ab. Damit lassen sich Balance und Stabilität prüfen.
