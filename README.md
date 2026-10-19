# Mascot Maker

Turn a photo into an interactive, cursor-following cartoon mascot for your website. **Free, runs entirely in your browser, nothing is uploaded anywhere.**

> **Built on [page-mascot](https://github.com/nilbuild/page-mascot) by Kamran Ahmed (MIT).** The image pipeline, the prompt text, the runtime component and all fifty-three gallery characters are his work, ported or used directly. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [public/mascots/CREDITS.txt](public/mascots/CREDITS.txt). Keep those notices with any copy.
>
> **Looking for the one without the borrowed parts?** [**Mascotry**](https://github.com/LihanCanCode/Mascotry) is a clean-room rebuild of the same idea: every character is drawn by code rather than by an image model, so it needs no prompts, no chat and no upload, and it carries no third-party work. This repository is kept for the route Mascotry does not have — turning a real photograph into a mascot through a chat model.

## How it works

1. **Describe** your character, pick a style (colour, ink, sketch, riso, paper, pixel, anime, cartoon). The app writes two prompts for you.
2. **Generate** in your own free Gemini or ChatGPT chat: attach your photo and paste Message 1, then paste Message 2 in the same chat. Download both images.
3. **Upload** the two images. The app removes the flat background, slices the 3x3 grids, aligns every cell so the character does not jump, and checks the result. If something is wrong it tells you which prompt to redo.
4. **Export** two webp sheets, a React component, a framework-free `<page-mascot>` element and copy-paste snippets.

Why bring-your-own generation? Gemini's free API tier has no image output, and we do not rent GPUs, so the generation happens in the free chat you already have. Your photo goes only to that provider, never to us.

## Develop

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm test         # unit + integration tests (Vitest)
pnpm test:cov     # with coverage (80% thresholds)
pnpm typecheck
pnpm build        # static site in dist/
```

Deploy `dist/` to any static host (Cloudflare Pages, GitHub Pages). `public/_headers` carries a strict CSP for hosts that support it.

## Layout

| Path | What |
|---|---|
| `src/core` | Pure image pipeline on RGBA buffers: keyer, slicer, measure, aligner, composer, validator, pipeline |
| `src/prompts` | Prompt builders, style presets, key-colour picker, chat how-to |
| `src/mascot`, `src/embed` | The runtime component and the embed snippets (shipped raw to users) |
| `src/adapters`, `src/worker` | Browser decode/encode, Web Worker |
| `src/ui` | React steps, components, state machine |
| `docs/PLAN.md` | Full design and module contracts |

## Credits and licence

MIT. The pipeline thresholds, prompt text and runtime component are ported from [page-mascot](https://github.com/nilbuild/page-mascot) by Kamran Ahmed (MIT). See `THIRD_PARTY_NOTICES.md`. The fox test sheets in `src/test/assets` are from that project and are used only as fixtures.
