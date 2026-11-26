# DER — Christmas PS1-style landing page

Static site (no build step). Built with three.js loaded from a CDN.

## Deploy on Vercel
1. Import this repo in Vercel.
2. Framework preset: **Other**. Leave build command and output directory empty.
3. Deploy.

## Edit your links
Open `js/main.js` and fill in `CONFIG` at the top:

```js
const CONFIG = { ca: '', x: '' };
```

Empty values show "coming soon". The music is `audio/song.mp3`.

## Files
- `index.html` — page, styles
- `js/` — scene, effects, audio
- `assets/` — 3D models (.glb)
- `img/` — meme gallery images
