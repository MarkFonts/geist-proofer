# Geist font page: proofer proposal

A copy of the public https://vercel.com/font page (captured 2026-11-13) with one change: the
type proofer near the bottom has two default actions, picked with a View / Edit toggle.

- **View**: click or tap the text for the next sample. Every sample is set on two lines. On the
  Serif tab the samples go on to styles that are not released as fonts yet, drawn as SVG.
- **Edit**: type your own text in the live font.

https://markfonts.github.io/geist-proofer/

## Flag for the original page: switching fonts moves the page

On vercel.com/font, switching between Sans, Serif, Mono, and Pixel pushes the glyph inspector and
the playground up or down, because two sections above them change height with the font.
Measured at 1280 px wide:

| Section | Sans | Serif | Mono | Pixel |
| --- | --- | --- | --- | --- |
| Stats block under the hero ("About Geist …") | 538 px | 474 px | 538 px | 474 px |
| Playground | 730 px | 786 px | 709 px | 709 px |

So the glyph inspector jumps 64 px between Sans or Mono and Serif or Pixel, and the playground
text moves again with its own control rows. The proper fix is in the page: give those two
sections the same height for every font (reserve the missing stats row, and a fixed number of
control rows in the playground).

This copy patches it from the outside, in `addon/playground.js`:

- `lockHeights` reserves padding: every section down to the playground keeps the tallest height
  it has in any font, the playground's control rows keep the height of the most rows, and the
  two sample lines are padded up to the tallest font. Text-only sections are measured in all
  four fonts on load; the rest is learned the first time a font is shown and remembered per
  window width.
- `holdStill` covers that first time: it notes where the thing in view sits before a font
  switch and scrolls by whatever it moved.

Once each font has been shown once, a switch moves nothing and scrolls nothing.

## Credits

The page, its code, fonts, and media are Vercel's, unchanged; they are here only to show the
proposal in context. The addition is `addon/playground.js`. Videos play from Vercel's own storage.
Because the original page needs a server, a small service worker (`sw.js`) serves the copy.
