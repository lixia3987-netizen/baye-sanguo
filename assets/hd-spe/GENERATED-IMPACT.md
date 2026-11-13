# Original impact13 / SPE38 generated sprites

Mode: built-in image_gen. Four separately generated RGBA PNG outputs were copied byte-for-byte; no offline crop, resize, alpha cleanup or re-encoding was performed.

The references were decoded from the original library and inspected before generation. Native logical rectangles remain 32×32, 32×32, 23×21 and 46×42. The generated source resolutions are recorded independently.

QA: PNG chunk CRCs and scanline filters were decoded independently; all original-output bytes match. All assets have a substantial alpha-zero background, opaque foreground, antialiasing, and inset visible geometry (alpha ≥16). Each output has faint boundary pixels with alpha 1/255; these are retained and recorded. The initial strict all-nonzero margin check failed and its source/receipt are preserved. This art QA does not establish actual-cast, device or full-game acceptance.

## Slot 0

Asset: `assets/hd-spe/impact-38/picture-0.png`; 1254×1254, 1883384 bytes, SHA256 `684cf0a1ead2b95dd672d99770178a1415d88deccd6bb7f7d1aadebc5f6988f2`. Logical 32×32, native mask1.

Original tool output: `C:/Users/75112/.codex/generated_images/01a116e2-c940-7931-9e13-0a495970c85f/exec-18ab1062-0a9e-4477-b818-edd5198057bd.png`.

Exact submitted prompt (including stored request text):

```text
Transform the reference pixel sprite into ONE original high resolution transparent historical game sprite for Three Kingdoms impact skill13, resource38/picture0. This is the moving attacker boat, not a whole battle scene.

Input1 is an exact16x decoding of the original32x32 masked slot against gray for readability: primary shape and pose reference. Input2 is the same native masked pixels on transparency: silhouette evidence. These references establish one small sail craft, its mast, pale curved rectangular sail, dark wooden hull and low water-contact details. Input3 is existing accepted game backdrop16, for restrained charcoal-green/antique bronze/pale ivory material style ONLY; do not copy its frame or background.

Preserve the native moving vessel facing RIGHT, sailing from left toward right. Same compact side view, same relative mast/sail/hull proportions and low waterline. Exactly one complete period wooden sail boat, weathered dark-brown timber hull, one slender mast and muted ivory sail, restrained bronze fasteners. Realistic hand-painted HD with clear readable forms at small game scale. Retain only compact water-contact/splash accents established by the native lower contour; no river surface or horizon. Do not turn this into a large multi-deck warship or add people, cannons, extra masts, named lord, modern boat or fantasy ornament.

Square canvas; full sail, mast top, prow, stern and all native low splash contour fit inside with modest3-5percent transparent margin. Entire background genuinely alpha0. No gray/white backing, checkerboard, shadow plane, border, frame, text, logo, UI, fire, impact cloud, extra vessel or sprite sheet. One sprite only. Repaint the pixel geometry into detailed HD materials; do not output pixel art. Return the complete original PNG with genuine transparency, no crop or external resizing.
```

- Native packed-mask diagnostic on gray, primary geometry: `F:/project/baye-sanguo/build/impact-skill-20261014/native-gray-references/picture-0-16x.png` (SHA256 `a2998dd47a683ef2680021338ad67f6ae4ca0227ec8b94f6337626883f0d24b7`)
- Native packed-mask transparent diagnostic, primary geometry: `F:/project/baye-sanguo/build/impact-skill-20261014/native-references/picture-0-16x.png` (SHA256 `61d04c31c9c84eaecfe119a919cc5d8a13004bbd5be57e66697ec9658eb192f1`)
- Existing BACKPIC16 HD backdrop, palette only: `F:/project/baye-sanguo/assets/hd-spe/attacks/backdrop-16/picture-0.png` (SHA256 `81ad53ac49c216f4972f64ec35d0bbe5b1c8c3892080a25109ac44d560e7e35f`)

## Slot 1

Asset: `assets/hd-spe/impact-38/picture-1.png`; 1254×1254, 1959022 bytes, SHA256 `71b750a245b56ea121509a280e3260db3b02456b103efb962bd390c77ca82260`. Logical 32×32, native mask1.

Original tool output: `C:/Users/75112/.codex/generated_images/01a116e2-c940-7931-9e13-0a495970c85f/exec-58caaedb-e713-41c2-a15f-e625801227b3.png`.

Exact submitted prompt (including stored request text):

```text
Transform the reference native sprite into ONE high resolution transparent historical Three Kingdoms game sprite, original impact skill13 resource38/picture1: the stationary LEFT-facing defender sail boat.

Input1 is the exact32x32 masked native slot against gray at16x, primary geometry and left-facing pose. Input2 is the same masked pixels on alpha, silhouette evidence. Input3 is the already generated picture0 moving boat: use its same wooden vessel design, pale ivory battened sail, weathered dark timber, bronze fittings and hand-painted material quality. Input4 is existing backdrop16 for charcoal-green/bronze/ivory palette only, never copy its border or background. Native picture1 geometry has priority over picture0 pose.

Exactly one complete small period sail craft facing LEFT, with the native reversed side-view hull, one slender mast, pale curved rectangular sail and low water-contact strokes. It is the defender on the RIGHT of the native movie, facing incoming motion from LEFT. Do not repeat the right-facing attacker. Keep the same compact boat class and scale as picture0, no redesign, no extra decks or masts. Restrained realistic hand-painted HD, clear shapes at small game size. Water-contact accents stay compact at the hull, no river plane or scenery.

Square canvas. Complete mast top, sail corners, bow, stern and compact splash contour inside modest3-5percent transparent margin. Genuinely alpha0 outside the sprite. No gray/white backing, checkerboard, floor/shadow plane, decorative border, text/logo/UI, fire/cloud, other boats, people, cannons, fantasy ornament or sprite sheet. One original complete transparent PNG; repaint native pixels into HD without cropping or external resizing.
```

- Native packed-mask diagnostic on gray, primary geometry: `F:/project/baye-sanguo/build/impact-skill-20261014/native-gray-references/picture-1-16x.png` (SHA256 `a3860fa802d1c1f0116ced8182493ce623e5c64ea2504e2263e9d8ed5297be19`)
- Native packed-mask transparent diagnostic, primary geometry: `F:/project/baye-sanguo/build/impact-skill-20261014/native-references/picture-1-16x.png` (SHA256 `72d5aedb552fdbfab2d6a60cb695a258759b90be956daccd03afbdd7832bfff1`)
- Previously accepted generated sibling, vessel/effect style reference: `F:/project/baye-sanguo/assets/hd-spe/impact-38/picture-0.png` (SHA256 `684cf0a1ead2b95dd672d99770178a1415d88deccd6bb7f7d1aadebc5f6988f2`)
- Existing BACKPIC16 HD backdrop, palette only: `F:/project/baye-sanguo/assets/hd-spe/attacks/backdrop-16/picture-0.png` (SHA256 `81ad53ac49c216f4972f64ec35d0bbe5b1c8c3892080a25109ac44d560e7e35f`)

## Slot 2

Asset: `assets/hd-spe/impact-38/picture-2.png`; 1314×1197, 1238434 bytes, SHA256 `799c68bbeffae400fbb301ac48b9f539617aaf9e4093365f464569e440746017`. Logical 23×21, native mask1.

Original tool output: `C:/Users/75112/.codex/generated_images/01a116e2-c940-7931-9e13-0a495970c85f/exec-be11cbad-2a5b-40d1-8ecf-16fa9daba0b3.png`.

Exact submitted prompt (including stored request text):

```text
Transform the original23x21 masked native impact sprite into ONE high resolution transparent game effect, Three Kingdoms impact skill13 resource38/picture2: the SMALL first collision burst.

Input1 is exact native23x21 pixels decoded at16x against gray, primary contour/shape evidence; input2 is the same original masked contour on transparency. Input3 is accepted battle backdrop16 for subdued charcoal-green/antique bronze/pale ivory game-art style only, no frame or scene.

Preserve the compact irregular star-shaped pale burst, a bright ivory center with a small number of short uneven outward lobes/spikes following native silhouette, darker charcoal-gray shading at the jagged edge. Render as a crisp restrained hand-painted physical impact puff/spray suitable for a wooden-boat collision. This is not a flame spell: no orange fire, lightning, magic ring, long motion trail or lens flare. No boat, person or debris objects absent from the native sprite. One coherent small burst only; its later larger state is a separate asset.

Near-square composition corresponding to the native23:21 logical rectangle, full contour visible with modest transparent margins. Background genuinely alpha0, including spaces between protrusions; no gray/white backing, checkerboard, shadow plane, scenery, decorative frame, text, logo, UI or sprite sheet. High resolution smooth hand-painted HD rather than enlarged pixel art. Return one complete original PNG with genuine transparency, no crop or external resizing.


```

- Native packed-mask diagnostic on gray, primary geometry: `F:/project/baye-sanguo/build/impact-skill-20261014/native-gray-references/picture-2-16x.png` (SHA256 `b9c649505a510b97532deca28e448f251b15bf39ecb57685fc9534794ce00ada`)
- Native packed-mask transparent diagnostic, primary geometry: `F:/project/baye-sanguo/build/impact-skill-20261014/native-references/picture-2-16x.png` (SHA256 `78c2bf1b314c1b707c24740ff4bc06ef388a50fb3358b177d727e6cccad13cc2`)
- Existing BACKPIC16 HD backdrop, palette only: `F:/project/baye-sanguo/assets/hd-spe/attacks/backdrop-16/picture-0.png` (SHA256 `81ad53ac49c216f4972f64ec35d0bbe5b1c8c3892080a25109ac44d560e7e35f`)

## Slot 3

Asset: `assets/hd-spe/impact-38/picture-3.png`; 1313×1198, 1649105 bytes, SHA256 `e635cc42e5ffb1c02ff173a81056c0fba3307c63b3889d673003887814cd0914`. Logical 46×42, native mask1.

Original tool output: `C:/Users/75112/.codex/generated_images/01a116e2-c940-7931-9e13-0a495970c85f/exec-6e259c41-1764-4ffb-bc03-6004d682e2c6.png`.

Exact submitted prompt (including stored request text):

```text
Transform original46x42 masked native sprite into ONE high resolution transparent historical game effect, Three Kingdoms impact skill13 resource38/picture3: the LARGER final collision cloud.

Input1 is exact46x42 native masked pixels decoded at16x against gray, primary roundish irregular silhouette. Input2 is the same original contour on alpha. Input3 is the accepted small first burst picture2: preserve its pale ivory/soft charcoal-gray hand-painted physical impact material, but expand and soften into this native large second state. Input4 accepted backdrop16 supplies restrained game palette only, do not copy frame or scenery.

Exactly one expanded, dense pale impact puff/cloud with broad bright ivory middle, a compact oval/near-round silhouette and short irregular rounded outer lobes matching native reference1. Subtle charcoal-gray ink-like shading around the rim makes its shape readable. The native larger frame is rounder and fuller than the small first star burst: use fewer, shorter protrusions, no long sharp star rays, no mushroom cloud or elongated trail. This represents the next stage of a wooden-boat collision; do not add a vessel, person, wood chunks or narrative objects absent from native. No orange flame, lightning, magical ring, lens flare or glowing sphere.

Near-square composition matching46:42 logical geometry. Full puff contour fits inside modest transparent margins. Genuine alpha0 background around/between lobes, no gray/white backing, checkerboard, shadow plane, river surface, horizon, decorative frame, text, logo, UI or sheet. One cohesive original high resolution transparent PNG in realistic restrained hand-painted HD, no pixel art, crop or external resizing.
```

- Native packed-mask diagnostic on gray, primary geometry: `F:/project/baye-sanguo/build/impact-skill-20261014/native-gray-references/picture-3-16x.png` (SHA256 `300cfeb42923b8597df13ba7f6b7f937f7feca2ce3e25e6ad33a40d35244e465`)
- Native packed-mask transparent diagnostic, primary geometry: `F:/project/baye-sanguo/build/impact-skill-20261014/native-references/picture-3-16x.png` (SHA256 `0047a861fe7e579ec1d4ef2155f5488bf0bbee921c7f1acddc778004402566fd`)
- Previously accepted generated sibling, vessel/effect style reference: `F:/project/baye-sanguo/assets/hd-spe/impact-38/picture-2.png` (SHA256 `799c68bbeffae400fbb301ac48b9f539617aaf9e4093365f464569e440746017`)
- Existing BACKPIC16 HD backdrop, palette only: `F:/project/baye-sanguo/assets/hd-spe/attacks/backdrop-16/picture-0.png` (SHA256 `81ad53ac49c216f4972f64ec35d0bbe5b1c8c3892080a25109ac44d560e7e35f`)

