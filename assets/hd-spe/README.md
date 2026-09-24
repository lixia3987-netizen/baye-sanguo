# HD SPE optional art

This folder is a hook for later replacement frames. The current HD path
**does not invent VFX**: it blits the engine-composited LCD SPE each
`GamShowFrame` / `lcdFlushBuffer` tick.

## Naming

Optional PNGs (not required this run):

- `opening-3.png` — `MAIN_SPE` (resource id 3)
- `skill-<id>.png` — 1-based skill resource id (`谍报` = 30, `践踏` = 1)
- `spe-<resid>.png` — raw lib resource id (`QIBING_SPE` = 19, …)

If a file is missing, the overlay keeps using the scaled engine bitmap.
Do not add decorative animations that are not driven by `PlcMovie`.
