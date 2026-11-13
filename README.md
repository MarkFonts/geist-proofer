# Geist font page: proofer proposal

A copy of the public https://vercel.com/font page (captured 2026-11-13) with one change: the
type proofer near the bottom has two default actions, picked with a View / Edit toggle.

- **View**: click or tap the text for the next sample. Every sample is set on two lines. On the
  Serif tab the samples go on to styles that are not released as fonts yet, drawn as SVG.
- **Edit**: type your own text in the live font.

https://markfonts.github.io/geist-proofer/

The page, its code, fonts, and media are Vercel's, unchanged; they are here only to show the
proposal in context. The addition is `addon/playground.js`. Videos play from Vercel's own storage.
Because the original page needs a server, a small service worker (`sw.js`) serves the copy.
