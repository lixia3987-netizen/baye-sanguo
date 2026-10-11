# Generated overworld art

Generated on 2026-10-08 with the Codex built-in `image_gen.imagegen` tool through the imagegen skill. Each asset used one separate new-image call with `transparent_background: true`. No CLI, external image input, image edit, crop, resize, alpha cleanup or other post-processing was used. The selected generated PNGs were copied byte-for-byte into this directory; existing assets were not replaced.

The visual direction was a written description of the existing muted topographic watercolor map. These are decorative map sprites, not measured terrain, surveyed geography, native tile data or ownership indicators. Placement, footprint and final in-game readability belong to the renderer and layer metadata.

The built-in tool did not expose a model ID, seed, detailed generation parameters or a separate license document. This record documents their generated provenance; it does not relicense the existing Wikimedia base map or river overlay. Their existing CC BY-SA attribution remains in `reference/LICENSE.txt`.

## Validation

All three files were opened from their workspace paths with `view_image`. PNG header/inflate inspection and an independent Pillow read both confirmed 1254 × 1254, 8-bit RGBA PNGs with real alpha values spanning 0–255. Their hashes match the unmodified built-in outputs. The black area in the image preview represents transparency; no black backdrop was painted into these assets.

Most artwork pixels have alpha 251–253, so the small count at exactly 255 does not mean the subject is invisible. Median positive alpha is 253 for each asset. The raw generation also includes a few alpha-1 pixels on the canvas perimeter and faint colored edge fringe visible against black. Those pixels were retained as requested. Alpha bounding boxes below use exclusive right/bottom coordinates; the alpha > 16 bounds describe the meaningful cutout separately from that near-transparent noise. No 56 px or 60–120 px acceptance is claimed by the full-resolution inspection alone.

| Asset | Bytes | Fully transparent pixels | Partial alpha pixels | Alpha 255 pixels | Alpha > 16 bounds | Perimeter alpha > 0 pixels |
|---|---:|---:|---:|---:|---|---:|
| `terrain/mountain-cluster-v1.png` | 911013 | 1255503 | 316961 | 52 | `[29, 396, 1224, 859]` | 5 |
| `terrain/forest-cluster-v1.png` | 1540805 | 1025885 | 546579 | 52 | `[39, 263, 1226, 978]` | 18 |
| `cities/fortified-city-v1.png` | 972200 | 1215483 | 356855 | 178 | `[130, 383, 1132, 986]` | 7 |

The maximum perimeter alpha is 1 for all three images. Each subject remains wholly within the alpha > 16 bounds, with transparent padding around it.

## terrain/mountain-cluster-v1.png

SHA-256: `05cc208ef6c6fee6c95551ddf2f9ed1bf43b5cf0ab7ce7c368de0f2085e1ec46`

Built-in original: `C:\Users\75112\.codex\generated_images\01a116ec-1a89-7021-bcba-ea589a792a30\exec-2bd1b04e-71db-4ee2-843f-39097eccf62a.png`

Inspection: Low, wide overlapping ridges with warm gray/ochre rock and sage shading. All peaks and bases are visible. No trees, water, buildings, text or flags.

Exact prompt sent:

```text
Use case: stylized-concept.
Asset type: a single standalone transparent PNG mountain-cluster sprite for a historical Chinese strategy world map, drawn at 60–120 screen pixels in play.
Primary request: one compact, low mountain cluster with three to five overlapping ridges and clearly separated peaks, in a soft traditional Chinese ink and hand-painted watercolor map style. A complete cutout, viewed slightly from above in a restrained three-quarter perspective.
Style and palette: warm limestone gray, muted earth ochre, soft gray-green hints, delicate warm ink contours and quiet watercolor washes. Match the calm natural terrain colors of a muted topographic watercolor map. Broad readable ridge shapes with a little natural texture; prioritize a clean silhouette and readability at small size.
Composition: only one self-contained mountain cluster centered on a square canvas, with generous transparent padding around every edge. Full ridge bases and every peak visible, nothing clipped. Low and wide rather than a towering vertical mountain.
Backdrop: genuinely transparent alpha outside the mountain forms; no solid background, paper sheet, landscape, rectangular color wash, ground plate or painted backdrop.
Constraints: mountain forms only. No forest, trees, rivers, lakes, buildings, people, flags, text, lettering, border, logo or watermark. No photorealistic rendering, glossy 3D plastic, dramatic fog, detached cast shadow or high-contrast black silhouette. Do not include a checkerboard pattern as artwork.
```

## terrain/forest-cluster-v1.png

SHA-256: `978ce9bcd48053ca77da87ffaa92efd6ec06ed626aa3f2ee9e95585a6f52d85f`

Built-in original: `C:\Users\75112\.codex\generated_images\01a116ec-1a89-7021-bcba-ea589a792a30\exec-b2007302-c3c5-4cd5-81f0-a412bcb10464.png`

Inspection: Olive/sage broadleaf canopies and short brown trunks form one irregular grove. No painted ground, mountains, water, buildings, text or flags.

Exact prompt sent:

```text
Use case: stylized-concept.
Asset type: a single standalone transparent PNG forest-cluster sprite for a historical Chinese strategy world map, drawn at roughly 60–120 screen pixels in play.
Primary request: one compact irregular forest cluster with about ten trees, a readable mix of sparse and dense overlapping rounded broadleaf canopies and a few discreet trunks, in a soft traditional Chinese ink and hand-painted watercolor map style. A complete cutout viewed slightly from above in restrained three-quarter perspective.
Style and palette: muted olive and sage greens, gentle moss-green shadows, subtle warm brown trunks, delicate warm ink contours and quiet watercolor washes. Match the calm natural terrain colors of a muted topographic watercolor map. Broad simple canopy shapes with a little natural brush texture; prioritize silhouette and readability at small size.
Composition: only one self-contained low, wide grove centered on a square canvas, with generous transparent padding on every side. Vary canopy heights and gaps naturally, with a clearly complete outer silhouette and nothing clipped.
Backdrop: genuinely transparent alpha outside the trees; no solid background, paper sheet, landscape, rectangular color wash, grassy ground patch, earth mound, ground plate, backdrop or detached cast shadow.
Constraints: forest trees only. No mountains, water, rivers, rocks, buildings, people, animals, flags, text, lettering, border, logo or watermark. No bright saturated fantasy colors, photorealistic rendering, glossy 3D plastic or high-contrast black silhouette. Do not include a checkerboard pattern as artwork.
```

## cities/fortified-city-v1.png

SHA-256: `c5ad664a4be45b0aa955d05bbd75948b03d1c2386ba5435d1da76ea40c99c4db`

Built-in original: `C:\Users\75112\.codex\generated_images\01a116ec-1a89-7021-bcba-ea589a792a30\exec-615c0962-fed7-48bd-8f68-25b257feff8d.png`

Inspection: Compact central Chinese gatehouse, short wall sections and gray tiled roofs. Complete structure without banners, faction marks, people or lettering.

Exact prompt sent:

```text
Use case: historical-scene.
Asset type: a single standalone transparent PNG fortified-city marker for a historical Chinese Three Kingdoms strategy world map, displayed at just 56 screen pixels.
Primary request: one small compact late Eastern Han / Three Kingdoms Chinese fortified town: a clearly readable central city gate and gatehouse, two short adjoining defensive wall sections, and a few dark gray tiled roof forms just behind the wall. A complete cutout viewed slightly from above in restrained three-quarter perspective.
Style and palette: soft traditional Chinese ink and hand-painted watercolor map art, warm neutral stone and rammed-earth beige-gray walls, weathered charcoal-gray ceramic roofs, subtle warm brown wood, delicate warm ink contours and quiet watercolor washes. Match the calm muted natural colors of a topographic watercolor strategy map.
Composition: one self-contained compact city-marker icon centered on a square canvas with transparent padding on every edge. Gate opening, low walls and layered tiled roof silhouette must remain recognizable at 56 pixels; keep broad simple shapes and restrained fine detail. Every roof, wall end and base visible, nothing clipped. Low fortress gatehouse rather than a tall temple or pagoda.
Backdrop: genuinely transparent alpha outside the structure; no solid background, paper sheet, rectangular landscape, ground plate, grassy tile, terrain mound, sky or detached cast shadow.
Constraints: only the gate, short walls and small roof forms. No flags, banners, pennants, coats of arms, emblems, faction color patches, labels, text, lettering, people, armies, animals, trees, mountains, water, border, logo or watermark. No red decorative signs, Japanese castle architecture, fantasy towers, photorealism or glossy 3D plastic. Do not include a checkerboard pattern as artwork.
```
