# Cờ Vua Bé

Offline iPad PWA that teaches chess basics to a 4-year-old, in Vietnamese with voice.

**Curriculum (11 worlds, 25 lessons):** board (find star, light/dark squares) → meet the 6 pieces + quiz →
Rook → Bishop → Queen → King → Knight → Pawn (each: explore, collect stars, capture) →
"who can capture?" → protect the King (check / escape) → Pawn war vs a gentle computer.

**Design:** one piece at a time on 5×5 mini boards; legal-move dots always shown; voice prompts
(`speechSynthesis` vi-VN); no fail states (wrong tap → hint, unsafe king move → undo with red danger squares,
stuck → auto-reset); 3 stars per finished lesson, medal per world; parent gate (⚙️) for unlock-all / reset / voice.

**Run:** `python3 -m http.server 8793` → http://localhost:8793. No build, no deps.
Puzzles are authored as strings in `app.js` (`UPPER` = bé's piece, `lower` = black, `*` star, `#` tree).
Ship an update: bump `CACHE` in `sw.js`.
