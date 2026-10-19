/**
 * Style paragraphs and picker labels.
 *
 * Ported from page-mascot (MIT License, Copyright (c) 2026 Kamran Ahmed) generate.py /
 * reference/prompts.md. `anime` and `cartoon` are mascot-maker additions in the same register.
 *
 * Do NOT weaken these. They are written to ask for appeal rather than to forbid it:
 * newer image models obey negatives literally and return two-tone fills, beady eyes and
 * smooth-blob silhouettes (see page-mascot reference/design-rules.md, "Ask for appeal").
 */
import type { StylePreset } from '../core/types'

export const STYLE_PARAGRAPHS: Readonly<Record<StylePreset, string>> = {
  colour:
    'Cute storybook sticker art: clean bold black outlines with some weight variation, ' +
    'big expressive eyes each with a bright white catchlight, soft pink cheek blush, ' +
    'and warm saturated colours. Give it several tones per colour -- a lighter muzzle ' +
    'or belly, a darker shaded edge, coloured inner ears -- and a textured, tufted ' +
    'silhouette wherever the character has fur or hair, rather than a smooth blob. ' +
    'Charming and playful, full of small appealing details. Not flat, not plain, not ' +
    'minimal. No photorealism, no heavy 3D gloss, no airbrushed gradients.',

  ink:
    'Black and white pen-and-ink drawing. Confident varied-weight black linework with ' +
    'fine cross-hatching and stippling for shading. NO colour anywhere and no flat grey ' +
    'fills -- every tone comes from the density of the hatching. Big expressive eyes ' +
    'with a white catchlight left as clean paper. Crisp, high contrast, plenty of open ' +
    "white. Charming and characterful, like a children's book illustration. Keep the " +
    'big-head chibi cartoon proportions and the soft cheek blush exactly as they would ' +
    'be in colour -- this is the same cute cartoon character, only drawn in ink. Do NOT ' +
    'make it realistic or detailed.',

  sketch:
    'Loose graphite pencil sketch. Visible hand-drawn strokes with a slightly rough, ' +
    'searching quality, soft smudged shading, a few construction lines left showing. ' +
    'Warm grey graphite tones only, no flat colour and no hard vector edges. Big ' +
    'expressive eyes with a bright highlight left as clean paper. Warm and handmade. Keep ' +
    'the big-head chibi cartoon proportions and the soft cheek blush exactly as they ' +
    'would be in colour -- the same cute cartoon character, only drawn in pencil. Do ' +
    'NOT make it realistic or detailed.',

  riso:
    'Two-colour risograph print. Flat spot inks in warm coral red and deep teal ONLY, ' +
    'plus the paper showing through. Visible paper grain, coarse halftone dot texture in ' +
    'the shaded areas, and a slight misregistration offset between the two ink layers. ' +
    'Bold simple shapes, no black outline -- forms are defined by the colour blocks.',

  paper:
    'Cut-paper collage. The character built entirely from flat torn and cut paper ' +
    'shapes in layered matte colours, with visible paper fibre texture and a soft drop ' +
    'shadow where one piece overlaps another. No drawn outlines at all -- every edge is ' +
    'a cut or torn paper edge. Warm, tactile and handmade.',

  pixel:
    '16-bit pixel art. Chunky visible square pixels on a strict grid, a small limited ' +
    'palette, hard-edged dithering for shading, a crisp one-pixel dark outline, and ' +
    'absolutely no anti-aliasing or soft edges anywhere. Readable and characterful at ' +
    'a small size, like a Super Nintendo sprite.',

  anime:
    'Cute chibi anime sticker art: clean confident dark line art with tapered strokes, ' +
    'very large glossy anime eyes each with two white highlights and a soft gradient iris, ' +
    'a tiny simple nose and mouth, soft pink cheek blush, and crisp cel shading with one ' +
    'shadow tone and one highlight per colour. Hair drawn as defined clumps with a sharp ' +
    'highlight band. Bright, clear, saturated colours. Charming and expressive. Keep the ' +
    'big-head chibi proportions -- not realistic, not semi-realistic, no painterly ' +
    'rendering, no 3D.',

  cartoon:
    'Bold modern animated-series cartoon art: thick confident black outlines, simple ' +
    'rounded shapes, big friendly oval eyes each with a white catchlight, soft pink cheek ' +
    'blush, and bright saturated colours each with one soft shadow tone and a highlight. ' +
    'A clean graphic silhouette that reads at a small size. Playful and expressive. No ' +
    'photorealism, no 3D render, no airbrushed gradients.',
}

export const STYLE_LABELS: Readonly<Record<StylePreset, { label: string; blurb: string }>> = {
  colour: { label: 'Storybook', blurb: 'Bold outlines, soft blush, warm saturated colour. The reliable default.' },
  ink: { label: 'Pen and ink', blurb: 'Black and white linework with hatching and stippling.' },
  sketch: { label: 'Pencil sketch', blurb: 'Loose graphite strokes with soft smudged shading.' },
  riso: { label: 'Risograph', blurb: 'Two spot inks, halftone texture and a little misregistration.' },
  paper: { label: 'Cut paper', blurb: 'Layered torn and cut paper shapes with no outlines.' },
  pixel: { label: 'Pixel art', blurb: 'Chunky 16-bit sprite look with hard edges.' },
  anime: { label: 'Chibi anime', blurb: 'Glossy eyes, tapered line art and crisp cel shading.' },
  cartoon: { label: 'Cartoon', blurb: 'Thick outlines and simple rounded shapes, like an animated series.' },
}
