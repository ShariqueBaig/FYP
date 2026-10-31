# report/ - M1 report (software track), in the format of the FYP booklet

`bash report/build.sh` regenerates `Kenna_FYP_M1_Report.pdf` (needs a LaTeX install with pdflatex). Every result table is produced by `build_tables.py` from `results/published/`; an experiment that is not published yet shows as a PENDING box. Rebuild after publishing, then re-read the sentences next to each table.

`main.tex` follows the booklet: title page per its example, contents, numbered sections, milestone mapping, an "AI Tools Used" chapter. The AI-use percentages and the team-contribution table are left for the team to fill.
