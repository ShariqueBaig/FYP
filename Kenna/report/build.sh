#!/usr/bin/env bash
# Rebuild the M1 report PDF; the figures are redrawn from the published results. Run after publishing new experiments.
set -e
cd "$(dirname "$0")"
python build_figures.py
pdflatex -interaction=nonstopmode -halt-on-error main.tex > main.build.log
pdflatex -interaction=nonstopmode -halt-on-error main.tex >> main.build.log
pdflatex -interaction=nonstopmode -halt-on-error main.tex >> main.build.log
cp main.pdf Kenna_FYP_M1_Report.pdf
echo "wrote report/Kenna_FYP_M1_Report.pdf"
