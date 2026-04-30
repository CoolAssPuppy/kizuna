# Background images

Drop two files into this directory:

- `day.jpg` — used between 07:00 and 16:00 local time
- `night.jpg` — used between 16:00 and 06:59 local time

Recommended: 2400 × 1600 (or larger), JPEG quality 85, ~250 KB target. The
image renders behind the logged-out home screen, so anything Banff,
mountains, or aspirational works.

The day/night switch lives in `src/features/welcome/timeOfDay.ts`. While
these files are missing, the logged-out screen falls back to a CSS
gradient so the layout still renders cleanly.
