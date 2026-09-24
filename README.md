# Turan – Steppe und Sultanat

Ein rundenbasiertes Strategiespiel im Stil der *Total-War*-Kampagnenkarte über die Geschichte der Türken und Turkvölker vom 10. bis zum 13. Jahrhundert. Im Mittelpunkt stehen Zentralasien und der Nahe Osten, doch die Welt reicht vom Atlantik bis Korea: Europa, der Ferne Osten und Afrika liegen anfangs als *Terra incognita* im Nebel und werden erst nach und nach entdeckt. Das Spiel läuft komplett im Browser, auf Deutsch und Türkisch.

## Starten

Das Spiel besteht aus reinem HTML/JavaScript ohne Build-Schritt. Wegen der JavaScript-Module muss es über einen (beliebigen) Webserver geladen werden, ein Doppelklick auf `index.html` reicht nicht:

```bash
# im Projektordner
python3 -m http.server 8000
# dann im Browser öffnen: http://localhost:8000
```

Alternativ lässt sich das Repository direkt über **GitHub Pages** veröffentlichen (Einstellungen → Pages → Branch wählen). Dann ist das Spiel unter der Pages-Adresse spielbar, auch auf dem Handy.

## Inhalt

- **Kampagnenkarte** mit 245 historischen Provinzen vom Atlantik bis Korea und von Skandinavien bis zum Niger, gezeichnet im Stil einer alten Pergamentkarte (Küsten, Flüsse, Gebirge, Wüsten, Seidenstraße, Kaiserkanal, Transsahara-Routen). Die Provinzgrenzen werden beim Start aus echten Geodaten erzeugt.
- **Städte, Burgen und Kontrolle**: Neben ihrer Hauptstadt hat jede Provinz 2–4 weitere Orte – insgesamt 668 historische Städte, Marktflecken, Häfen, Burgen, Bergwerke, Klöster/Ribats, Karawansereien, Weidelager und Wallfahrtsorte, jeweils mit eigenem Symbol auf der Karte. Orte bringen eigene Erträge, lassen sich in drei Stufen ausbauen und werden einzeln belagert, gestürmt, gekauft, verkauft oder abgetreten. Die Eroberung der Hauptstadt bringt die Provinz, stark befestigte Orte halten sich aber als Enklaven. Vollständige Kontrolle einer Provinz bringt Einnahmen- und Ordnungsboni; geteilte Provinzen verlieren Einnahmen und Ordnung, belasten die Beziehungen und sind Kriegsgrund. Burgen versorgen Heere, erlauben zusätzliche Aushebungen und stützen belagerte Hauptstädte. Beim Frieden werden Enklaven nach dem Kriegsausgang verteilt, und in unruhigen Provinzen laufen Orte zu Aufständischen über. Dazu kommen Landstraßen und Dörfer auf der Karte, der Kartenmodus *Kontrolle* und das Ereignis *Stadtrechte*.
- **Vier Weltgegenden**: der Orient (Zentralasien, Iran, Anatolien, Levante, Arabien, Ägypten, Indien, Rus), das Abendland (Iberien, Frankreich, Britannien, Heiliges Römisches Reich, Italien, Skandinavien, Ostseeraum, Polen, Ungarn), der Ferne Osten (China, Mongolei, Mandschurei, Korea, Tibet, Hinterindien) und Afrika (Maghreb, Sahel, Nilländer, Abessinien).
- **Entdeckung der Welt**: Jedes Reich kennt anfangs nur seine Heimat und die Länder an seinen Grenzen. Der Rest liegt unter dem Nebel der *Terra incognita* und kann weder betreten noch diplomatisch erreicht werden. Neue Weltgegenden werden entdeckt durch gemeinsame Grenzen, Eroberung und Krieg, durch Handel, Bündnisse und Vasallen (Kunde von Mächten, die die Gegend schon kennen), durch Reisende und Ereignisse wie die Kreuzzüge sowie durch Forschung: *Gesandte ins Abendland*, *Gesandte an den Kaiserhof*, *Karawanen durch die Sahara*, *Pilger ins Morgenland* und die *Weltkarte des al-Idrisi*. Manche Erfindungen setzen Kontakt mit ihrem Ursprungsland voraus: Schießpulver, Kompass und Blockdruck aus China, Dreifelderwirtschaft und Langbogen aus Europa.
- **Drei Startszenarien**: 1000 (*Das Erbe der Samaniden*), 1071 (*Malazgirt*) und 1200 (*Vor dem Sturm*). Eine Runde entspricht einer Jahreszeit, die Kampagne endet 1300.
- **Spielbare Großmächte**: Große Seldschuken, Karachaniden, Ghaznawiden, Choresm-Schahs, Kiptschaken, Petschenegen, Oghusen, Wolgabulgaren, Uiguren, Rum-Seldschuken, Mamluken, Sultanat Delhi und weitere Turkstaaten, dazu Byzanz, Abbasiden, Fatimiden, Buyiden, Georgien, Armenien, Kiewer Rus, Ghuriden, Kara-Kitai, Mongolen, Kreuzfahrer und Ayyubiden. Neu im Abendland: Heiliges Römisches Reich, Frankreich, England, Kastilien-León, Kalifat von Córdoba, Venedig und Ungarn. Im Fernen Osten: Song, Liao (Kitan), Jin (Dschurdschen) und Westliche Xia (Tanguten). In Afrika: Almoraviden, Almohaden, Mali und Abessinien.
- **Kleinmächte (nicht spielbar)**: über 100 computergesteuerte Königreiche, Emirate, Stammesverbände und Fürstentümer, darunter Kakuyiden, Hasanwaihiden, Marwaniden, Uqailiden, Emirat Derbent, Artsruni, Kimek, Baschkiren, Naimanen, Banu Ammar, Turkmenische Beys, Beduinen und die Scherifen von Mekka, dazu im Westen Papst, Normannen, Dänen, Polen, Taifa-Königreiche, Genua und der Lombardische Bund, im Osten Goryeo, Dali, Tibet, Keraiten, Tataren, Khmer, Pagan und Đại Việt, in Afrika Ziriden, Banu Hilal, Ghana, Songhai, Kanem und Ife sowie in Indien Chola, Pala und Chalukya. Mit ihnen sind Handel, Bündnisse, Heiraten, Geschenke, Tributforderungen, Unterwerfung und Krieg möglich, und sie fordern auch selbst Tribut.
- **Nomaden und Sesshafte**: drei Herrschaftsformen (nomadisches Khanat, Sultanat/Iqta-Staat, sesshaftes Reich) mit eigener Wirtschaft aus Herden, Steuern und Handel. Der Übergang zwischen ihnen ist möglich.
- **Wirtschaft und Handel**: 32 Handelsgüter (darunter Porzellan, Tee, Wolle, Bernstein und Elfenbein), 35 Handelsrouten mit der Seidenstraße, der Maritimen Seidenstraße, dem Kaiserkanal, der Transsahara-Goldroute und den Champagnermessen, Karawansereien, Handelsabkommen, Tribute und Plünderungen.
- **Religion und Kultur**: 15 Religionen und 30 Kulturen. Bekehrung, Türkisierung von Weideland, Religionspolitik und ein Kalif, der Sultanstitel verleiht.
- **Dynastie und Diplomatie**: Herrscher mit Eigenschaften, Erbfolge nach Seniorat, Primogenitur oder Kurultai, Thronstreit, Atabegs und Wesire. Dazu Krieg, Frieden mit Bedingungen, Bündnisse, Vasallen und Heiratsbündnisse.
- **Forschungsbaum** mit 46 Technologien in vier Zweigen (Kriegskunst, Verwaltung, Wirtschaft, Kultur und Wissenschaft).
- **Schlachten mit Taktikwahl**: vorgetäuschte Flucht, Umzingelung, Pfeilhagel, Verteidigung, Hinterhalt, Frontalangriff oder Rückzug. Gelände, Jahreszeit, Truppenmischung und Feldherr zählen. Belagerungen, Sturmangriffe und Raubzüge.
- **Historische Ereignisse**: Aufstieg der Seldschuken, Kreuzzüge, Nizariten, Kara-Kitai, Zengiden, Saladin, Sultanat Delhi, Mongolensturm (Dschingis Khan erhebt sich am Onon und wendet sich gegen China und den Westen), Mamluken, Aufstand der Dschurdschen und Fall Kaifengs, Banu Hilal, Almoraviden, Almohaden und Sundiata Keita. Dazu Zufallsereignisse mit Entscheidungen, etwa Turkmenen, Gelehrte wie Ibn Sina oder Mahmud al-Kaschgari, Seuchen oder das Viehsterben (Dschut).
- **Regionale Besonderheiten**: Jede der 245 Provinzen hat 1–4 wirtschaftliche, kulturelle oder militärische Eigenheiten, insgesamt 51 Arten. Beispiele sind die Himmlischen Pferde Ferganas, Damaszener Stahl, die Kornkammer Ägyptens, Gebirgspässe, Sufi-Konvente, Ghulam-Märkte und das Adlernest Alamut. Neu sind etwa Porzellanöfen, Teegärten, Bernsteinküste, Land der Burgen, das Kaiserliche Arsenal von Kaifeng und das heilige Ötüken der alten Türken. Dazu kommen regionale Truppen: Fergana-Panzerreiter, Gazi-Grenzkrieger, Sistan-Bogenschützen, Kiptschakische Garde und Fidais sowie Kulturtruppen wie Huskarle, Langbogenschützen, Almogávares, Dschinete-Reiter, Nu-Armbrustschützen, Feuerlanzen, Eiserne Pagode, Eisenhabichte, Murabitun, Mande-Panzerreiter und abessinische Hochlandkrieger.
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
