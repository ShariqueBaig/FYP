# presentation/ - FYP defense deck (20 min)

`node build_deck.js` (with `NODE_PATH=$PWD/node_modules`; `npm install` once) writes `Kenna_FYP_Defense.pptx`. It is a normal editable PowerPoint file (theme, layouts, native charts, speaker notes with timings).

* **Logos:** put `iba.png` and `isecom.png` in `Kenna/presentation/assets/logos/` and rebuild; until then the slides show dashed placeholders.
* **Numbers:** charts read `../results/published/<experiment>/report.csv` when that experiment has been published; otherwise a value tagged ILLUSTRATIVE is drawn and an amber tag shows on the slide. Rebuild after publishing the re-run.
* **To fill by hand:** supervisor name, date, the three ISECOM lines on slide 4.
