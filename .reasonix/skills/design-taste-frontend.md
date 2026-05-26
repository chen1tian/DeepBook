---
name: design-taste-frontend
description: Anti-slop frontend skill for landing pages, portfolios, and redesigns — infers design direction, ships interfaces that do not look templated, uses real design systems when applicable.
---

# tasteskill: Anti-Slop Frontend Skill

> Landing pages, portfolios, and redesigns. Not dashboards, not data tables, not multi-step product UI.
> Every rule below is **contextual**. None of it fires automatically. First read the brief, then pull only what fits.

---

## 0. BRIEF INFERENCE (Read the Room Before Anything Else)

Before touching code or tweaking dials, **infer what the user actually wants**. Most LLM design output is bad because the model jumps to a default aesthetic instead of reading the room.

### 0.A Read these signals first
1. **Page kind** - landing (SaaS / consumer / agency / event), portfolio (dev / designer / creative studio), redesign (preserve vs overhaul), editorial / blog.
2. **Vibe words** the user used - "minimalist", "calm", "Linear-style", "Awwwards", "brutalist", "premium consumer", "Apple-y", "playful", "serious B2B", "editorial", "agency-y", "glassy", "dark tech".
3. **Reference signals** - URLs they linked, screenshots they pasted, products they named, brands they're competing with.
4. **Audience** - B2B procurement panel vs. design-conscious consumer vs. recruiter scanning a portfolio. The audience picks the aesthetic, not your taste.
5. **Brand assets that already exist** - logo, color, type, photography. For redesigns, these are starting material, not optional input (see Section 11).
6. **Quiet constraints** - accessibility-first audiences, public-sector, regulated industries, trust-first commerce, kids' products. These constraints OVERRIDE aesthetic preference.

### 0.B Output a one-line "Design Read" before generating
Before any code, state in one line: **"Reading this as: \<page kind> for \<audience>, with a \<vibe> language, leaning toward \<design system or aesthetic family>."**

Example reads:
- *"Reading this as: B2B SaaS landing for technical buyers, with a Linear-style minimalist language, leaning toward Tailwind utilities + Geist + restrained motion."*
- *"Reading this as: solo designer portfolio for hiring managers, with an editorial / kinetic-type language, leaning toward native CSS + scroll-driven animation + custom typography."*
- *"Reading this as: redesign of a public-sector service site, with a trust-first language, leaning toward GOV.UK Frontend or USWDS."*

### 0.C If the brief is ambiguous, ask one question, do not guess
Ask exactly **one** clarifying question - never a multi-question dump - and only when the design read genuinely diverges. Example: *"Should this feel closer to Linear-clean or Awwwards-experimental?"*

If you can confidently infer from context, **do not ask**. Just declare the design read and proceed.

### 0.D Anti-Default Discipline
Do not default to: AI-purple gradients, centered hero over dark mesh, three equal feature cards, generic glassmorphism on everything, infinite-loop micro-animations everywhere, Inter + slate-900. These are the LLM defaults. Reach past them deliberately based on the design read.

---

## 1. THE THREE DIALS (Core Configuration)

After the design read, set three dials. Every layout, motion, and density decision below is gated by these.

* **`DESIGN_VARIANCE: 8`** - 1 = Perfect Symmetry, 10 = Artsy Chaos
* **`MOTION_INTENSITY: 6`** - 1 = Static, 10 = Cinematic / Physics
* **`VISUAL_DENSITY: 4`** - 1 = Art Gallery / Airy, 10 = Cockpit / Packed Data

**Baseline:** `8 / 6 / 4`. Use these unless the design read overrides them. Do not ask the user to edit this file - overrides happen conversationally.

### 1.A Dial Inference (design read → dial values)
| Signal | VARIANCE | MOTION | DENSITY |
|---|---|---|---|
| "minimalist / clean / calm / editorial / Linear-style" | 5-6 | 3-4 | 2-3 |
| "premium consumer / Apple-y / luxury / brand" | 7-8 | 5-7 | 3-4 |
| "playful / wild / Dribbble / Awwwards / experimental / agency" | 9-10 | 8-10 | 3-4 |
| "landing page / portfolio / marketing site (default)" | 7-9 | 6-8 | 3-5 |
| "trust-first / public-sector / regulated / accessibility-critical" | 3-4 | 2-3 | 4-5 |
| "redesign - preserve" | match existing | +1 | match existing |
| "redesign - overhaul" | +2 | +2 | match existing |

### 1.B Use-Case Presets
| Use case | VARIANCE | MOTION | DENSITY |
|---|---|---|---|
| Landing (SaaS, mainstream) | 7 | 6 | 4 |
| Landing (Agency / creative) | 9 | 8 | 3 |
| Landing (Premium consumer) | 7 | 6 | 3 |
| Portfolio (Designer / studio) | 8 | 7 | 3 |
| Portfolio (Developer) | 6 | 5 | 4 |
| Editorial / Blog | 6 | 4 | 3 |
| Public-sector service | 3 | 2 | 5 |
| Redesign - preserve | match | match+1 | match |
| Redesign - overhaul | +2 | +2 | match |

### 1.C How the Dials Drive Output
Use these (or user-overridden values) as global variables. Cross-references throughout this document refer to these exact variable names - never invent aliases like `LAYOUT_VARIANCE` or `ANIM_LEVEL`.

---

## 2. BRIEF → DESIGN SYSTEM MAP

Once you have the design read (Section 0) and dials (Section 1), pick the right foundation. Do not invent CSS for things that have an official package. Do not pretend an aesthetic trend is an official system.

### 2.A When to reach for a real design system (use official packages)
| Brief reads as… | Reach for | Why |
|---|---|---|
| Microsoft / enterprise SaaS / dashboards | `@fluentui/react-components` or `@fluentui/web-components` | Official Fluent UI, Microsoft tokens, accessibility done |
| Google-ish UI, Material-flavored product | `@material/web` + Material 3 tokens | Official, theme-able via Material Theming |
| IBM-style B2B / enterprise analytics | `@carbon/react` + `@carbon/styles` | Official Carbon, mature data-density patterns |
| Shopify app surfaces | `polaris.js` web components / Polaris React | Required for Shopify admin UI |
| Atlassian / Jira-style product | `@atlaskit/*` + `@atlaskit/tokens` | Official Atlassian DS |
| GitHub-style devtool / community page | `@primer/css` or `@primer/react-brand` | Official Primer; Brand variant for marketing |
| Public-sector UK service | `govuk-frontend` | Legally / regulatorily expected |
| US public-sector / trust-first | `uswds` | Same |
| Fast local-business / agency MVP | Bootstrap 5.3 | Boring, fast, works |
| Modern accessible React foundation | `@radix-ui/themes` | Primitives + polished theme |
| Modern SaaS where you own the components | shadcn/ui (`npx shadcn@latest add ...`) | You own the code, easy to customise; never ship default state |
| Tailwind-based modern SaaS / AI marketing | Tailwind v4 utilities + `dark:` variant | Default for indie + small team builds |

**Honesty rule:** if the brief reads as one of the systems above, install and use the **official** package. Do not recreate its CSS by hand. Do not import a system's tokens but then override 90% of them.

**One system per project.** Do not mix Fluent React with Carbon in the same tree. Do not import shadcn/ui components into a Material 3 app.

### 2.B When the brief is an aesthetic, not a system
For these directions, there is **no single official package**. Build with native CSS + Tailwind + a maintained component library. Be honest in code comments about what is borrowed inspiration vs. official material.

| Aesthetic | Honest implementation |
|---|---|
| Glassmorphism / "frosted glass" | `backdrop-filter`, layered borders, highlight overlays. Provide solid-fill fallback for `prefers-reduced-transparency`. |
| Bento (Apple-style tile grids) | CSS Grid with mixed cell sizes. No single library owns this. |
| Brutalism | Native CSS, monospace, raw borders. No library. |
| Editorial / magazine | Serif type, asymmetric grid, generous whitespace. No library. |
| Dark tech / hacker | Mono + accent neon, terminal motifs. No library. |
| Aurora / mesh gradients | SVG or layered radial gradients. No library. |
| Kinetic typography | Native CSS animations, scroll-driven animations, GSAP for hijacks. No library. |
| **Apple Liquid Glass** | Apple documents this for Apple platforms only. **There is no official `liquid-glass.css`.** Web implementations are approximations using `backdrop-filter` + layered borders + highlights. Label clearly as approximation. |

---

## 3. DEFAULT ARCHITECTURE & CONVENTIONS

Unless the design read picks a real design system (Section 2.A), these are the defaults:

### 3.A Stack
* **Framework:** React or Next.js. Default to Server Components (RSC).
  * **RSC SAFETY:** Global state works ONLY in Client Components. In Next.js, wrap providers in a `"use client"` component.
  * **INTERACTIVITY ISOLATION:** Any component using Motion, scroll listeners, or pointer physics MUST be an isolated leaf with `'use client'` at the top. Server Components render static layouts only.
* **Styling:** **Tailwind v4** (default). Tailwind v3 only if the existing project demands it.
  * For v4: do NOT use `tailwindcss` plugin in `postcss.config.js`. Use `@tailwindcss/postcss` or the Vite plugin.
* **Animation:** **Motion** (the library formerly known as Framer Motion). Import from `motion/react` (`import { motion } from "motion/react"`). The `framer-motion` package still works as a legacy alias - prefer `motion/react` in new code.
* **Fonts:** Always use `next/font` (Next.js) or self-host with `@font-face` + `font-display: swap`. Never link Google Fonts via `<link>` in production.

### 3.B State
* Local `useState` / `useReducer` for isolated UI.
* Global state ONLY for deep prop-drilling avoidance - Zustand, Jotai, or React context.
* **NEVER** use `useState` to track continuous values driven by user input (mouse position, scroll progress, pointer physics, magnetic hover). Use Motion's `useMotionValue` / `useTransform` / `useScroll`. `useState` re-renders the React tree on every change and collapses on mobile.

### 3.C Icons
* **Allowed libraries (priority order):** `@phosphor-icons/react`, `hugeicons-react`, `@radix-ui/react-icons`, `@tabler/icons-react`.
* **Discouraged:** `lucide-react`. Acceptable only when the user explicitly asks for it or the project already depends on it.
* **NEVER hand-roll SVG icons.** If a glyph is missing, install a second library or compose from primitives - do not draw icon paths from scratch.
* **One family per project.** Do not mix Phosphor with Lucide in the same component tree.
* **Standardize `strokeWidth` globally** (e.g. `1.5` or `2.0`).

### 3.D Emoji Policy
Discouraged by default in code, markup, and visible text. Replace symbols with icon-library glyphs. **Override:** allow emojis only when the user explicitly asks for a playful / chat-style / social-native vibe - and even then use them sparingly with intent.

### 3.E Responsiveness & Layout Mechanics
* Standardize breakpoints (`sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`).
* Contain page layouts using `max-w-[1400px] mx-auto` or `max-w-7xl`.
* **Viewport Stability:** NEVER use `h-screen` for full-height Hero sections. ALWAYS use `min-h-[100dvh]` to prevent layout jumping on mobile (iOS Safari address bar).
* **Grid over Flex-Math:** NEVER use complex flexbox percentage math (`w-[calc(33%-1rem)]`). ALWAYS use CSS Grid (`grid grid-cols-1 md:grid-cols-3 gap-6`).

### 3.F Dependency Verification (mandatory)
Before importing ANY 3rd-party library, check `package.json`. If the package is missing, output the install command first. **Never** assume a library exists.

---

## 4. DESIGN ENGINEERING DIRECTIVES (Bias Correction)

LLMs default to clichés. Override these defaults proactively. Each rule has a context-aware override path.

### 4.1 Typography
* **Display / Headlines:** Default `text-4xl md:text-6xl tracking-tighter leading-none`.
* **Body / Paragraphs:** Default `text-base text-gray-600 leading-relaxed max-w-[65ch]`.
* **Font choice:**
  * **Discouraged as default:** `Inter`. Pick `Geist`, `Outfit`, `Cabinet Grotesk`, `Satoshi`, or a brand-appropriate serif first.
  * **Override:** Inter is acceptable when the user explicitly asks for a neutral / standard / Linear-style feel, or when the brief is a public-sector / accessibility-first site.
* **Serif:** allowed for editorial / luxury / publication briefs. Not for technical SaaS dashboards.
* **Pairings to know:** `Geist` + `Geist Mono`, `Satoshi` + `JetBrains Mono`, `Cabinet Grotesk` + `Inter Tight`, `GT America` + `IBM Plex Mono`.
* **ITALIC DESCENDER CLEARANCE (mandatory):** When italic is used in display type and the word contains a descender letter (`y g j p q`), `leading-[1]` or `leading-none` will clip the descender. Use `leading-[1.1]` minimum and add `pb-1` or `mb-1` reserve on the wrapping element. Audit every italic word in display headlines before shipping.

### 4.2 Color Calibration
* Max 1 accent color. Saturation < 80% by default.
* **THE LILA RULE:** The "AI Purple / Blue glow" aesthetic is discouraged as a default. No automatic purple button glows, no random neon gradients. Use neutral bases (Zinc / Slate / Stone) with high-contrast singular accents (Emerald, Electric Blue, Deep Rose, Burnt Orange, etc.).
* **Override:** if the brand or brief explicitly asks for purple / violet / lila, embrace it. But execute with intent: consistent palette, harmonised neutrals, restrained gradients. Not generic AI gradient slop.
* **One palette per project.** Do not fluctuate between warm and cool grays within the same project.
* **COLOR CONSISTENCY LOCK (mandatory):** Once an accent color is chosen for a page, it is used on the WHOLE page. A warm-grey site does not suddenly get a blue CTA in section 7. A rose-accented site does not get a teal status badge in the footer. Pick one accent, lock it, audit every component before shipping.

### 4.3 Layout Diversification
* **ANTI-CENTER BIAS:** Centered Hero / H1 sections are avoided when `DESIGN_VARIANCE > 4`. Force "Split Screen" (50/50), "Left-aligned content / right-aligned asset", "Asymmetric white-space", or scroll-pinned structures.
* **Override:** centered hero is OK for editorial / manifesto / launch-announcement briefs where the message itself is the design.

### 4.4 Materiality, Shadows, Cards
* Use cards ONLY when elevation communicates real hierarchy. Otherwise group with `border-t`, `divide-y`, or negative space.
* When a shadow is used, tint it to the background hue. No pure-black drop shadows on light backgrounds.
* For `VISUAL_DENSITY > 7`: generic card containers are banned. Data metrics breathe in plain layout.
* **SHAPE CONSISTENCY LOCK (mandatory):** Pick ONE corner-radius scale for the page and stick to it. Options: all-sharp (radius 0), all-soft (radius 12-16px), all-pill (full radius for interactive). Mixed systems are allowed only when there is a documented rule (e.g. "buttons are full-pill, cards are 16px, inputs are 8px") and that rule is followed everywhere. Round buttons in a square layout, or square cards on a pill-button page, is broken design.

### 4.5 Interactive UI States
LLMs default to "static successful state only." Always implement full cycles:
* **Loading:** Skeletal loaders matching the final layout's shape. Avoid generic circular spinners.
* **Empty States:** Beautifully composed; indicate how to populate.
* **Error States:** Clear, inline (forms), or contextual (toasts only for transient).
* **Tactile Feedback:** On `:active`, use `-translate-y-[1px]` or `scale-[0.98]` to simulate a physical push.
* **BUTTON CONTRAST CHECK (mandatory, a11y):** Before shipping any button, verify the button text is readable against the button background. White button + white text, `bg-white` CTA with `text-white` label, transparent button against the page background with no border → all banned. Audit every CTA: contrast ratio WCAG AA min (4.5:1 for body, 3:1 for large text 18px+).

### 4.6 Data & Form Patterns
* Label ABOVE input. Helper text optional but present in markup. Error text BELOW input. Standard `gap-2` for input blocks.
* No placeholder-as-label. Ever.

### 4.7 Layout Discipline (Hard Rules. Failing any of these is shipping broken work)

* **Hero MUST fit in the initial viewport.** Headline max 2 lines on desktop, subtext max **20 words** AND max 3-4 lines, CTAs visible without scroll. If the copy is too long: reduce font scale OR cut copy. If you cannot describe the value-prop in 20 words of subtext, the value-prop is unclear, not the rule too tight. Never let the hero overflow and force scroll to find the CTA.
* **Hero font-scale discipline.** Plan font size and image size *together*. If the hero asset is large and the headline is more than 6 words, do not start at `text-7xl/text-8xl`. Default sensible range: `text-4xl md:text-5xl lg:text-6xl` for most heroes; `text-6xl md:text-7xl` only when the headline is 3-5 words. A 4-line hero headline is always a font-size error, never a copy-length error.
* **"Used by" / "Trusted by" logo wall belongs UNDER the hero, never inside it.** The hero is for the value prop and primary CTA. The logo wall is a separate section directly below. Do not stuff trust logos into the same flex row as the hero copy.
* **Navigation MUST render on a single line on desktop.** If items don't fit at `lg` (1024px), condense labels, drop secondary items, or move to a hamburger. A two-line nav at desktop is broken design.
* **Navigation height cap: 80px max desktop, default 64-72px.** No huge "agency" nav bars that eat 15% of the viewport.
* **Bento grids MUST have rhythm, not one-sided repetition.** Do not stack 6 left-image / right-text rows. Vary the composition: alternate full-width feature rows, asymmetric tile sizes, vertical breaks.
* **BENTO CELL COUNT RULE (mandatory):** A bento grid has EXACTLY as many cells as you have content for. 3 items → 3 cells (1+2 split, or 2+1, or asymmetric trio). 5 items → 5 cells (2+3, 3+2, hero+4, etc.). If your grid has an empty cell in the middle or at the end, you planned wrong. Re-shape the grid; do not paste a blank tile.
* **Section-Layout-Repetition Ban.** Once you use a layout family for a section (e.g., 3-column-image-cards, full-width-quote, split-text-image), that family can appear at most ONCE on the page. "Selected commissions" must not look like "What we do." A landing page with 8 sections must use at least 4 different layout families.
* **Mobile collapse must be explicit per section.** For every multi-column layout, declare the `< 768px` fallback in the same component. No "it'll work, Tailwind handles it" assumptions.

### 4.8 Image & Visual Asset Strategy

Landing pages and portfolios are **visual products**. Text-only pages with fake-screenshot divs are slop.

**Priority order for visual assets:**
1. **Image-generation tool first.** If ANY image-gen tool is available in the environment (`generate_image`, MCP image tool, IDE-integrated gen, OpenAI image tools, etc.) you MUST use it to create section-specific assets: hero photography, product shots, texture backgrounds, mood images. Generate at the right aspect ratio for the section. Do not skip this step because hand-rolled CSS feels faster.
2. **Real web images second.** When no gen tool is available, use real photography sources. Acceptable defaults:
   * `https://picsum.photos/seed/{descriptive-seed}/{w}/{h}` for placeholder photography (seed should describe the section, e.g. `marrow-cookware-kitchen`)
   * Actual stock or brand URLs when the brief provides them
   * Open-license sources (Unsplash via direct URL, Pexels) if explicitly allowed
3. **Last resort: tell the user.** If neither is possible, do NOT fill the page with hand-rolled SVG illustrations or div-based "fake screenshots." Instead, leave clearly-labeled placeholder slots (`<!-- TODO: hero product photo, 1600x1200 -->`) and at the end of the response say: *"This page needs real images at: \[list of placements\]. Please generate or provide them."*

**Even minimalist sites need real images.** A pure-text page is not minimalism. It is incomplete work. Even an editorial Linear-style site needs at least 2-3 real images (hero, one product/lifestyle shot, one supporting image). Generate B&W minimalist photography if the brief is restrained; do not skip images entirely because the dial is low.

**Real company logos for social proof.** When the brief calls for a "Trusted by / Used by / Customers" logo wall, do NOT default to plain text wordmarks (`<span>Acme Co</span>` styled in a row). Use real SVG logos:
* **Source: Simple Icons** (`https://cdn.simpleicons.org/{slug}/ffffff` for any color, or `simple-icons` npm package). Covers most known brands.
* **Alternative: devicon** for tech-stack logos (`@svgr/cli` or CDN).
* **Make-up the brand name? Then make-up an SVG mark too.** Generate a simple monogram (one letter in a circle, two-letter ligature, abstract glyph) rendered as an inline `<svg>` matching the page style. Plain text wordmarks for invented brand names look generic.
* **Always** ensure logos render in both light and dark mode (white-on-dark, black-on-light, or single-color theme variable).

**Hand-rolled illustrations:**
* SVG icons from libraries: fine (see Section 3.C).
* Hand-rolled decorative SVGs (custom illustrations, logos, marks): **strongly discouraged**, never as default. Acceptable only when:
  - The brief explicitly calls for it ("draw me an SVG logo")
  - It's a single, simple geometric mark (a square, a circle, a wordmark in display type)
  - You're confident in the output quality

**Div-based fake screenshots are banned.** A "hand-built product preview" rendered with `<div>` rectangles, fake task lists, fake dashboards, fake terminal windows is a Tell. If you need to show a product:
* Use a real screenshot URL if one exists
* Generate one via image tool
* Use a real component preview (an actual mini-version of the UI inside the page)
* Or skip the preview entirely and use editorial photography

**Hero needs a real visual.** Text + gradient blob is not a hero - it's a placeholder.

### 4.9 Content Density

Landing pages live on the **first impression**, not the full read. Cut ruthlessly.

* **Default content shape per section:** short headline (≤ 8 words) + short sub-paragraph (≤ 25 words) + one visual asset OR one CTA. Anything more must be justified by the section's job.
* **No data-dump sections.** A 20-row publication table, a 30-row award list, a giant pricing matrix on a marketing page = wrong layout. Use:
  - Top 3-5 highlights + "View full list" link
  - Marquee / carousel for breadth
  - Different page entirely if the data is the product
* **Long lists need a different UI component, not a longer list.** Default `<ul>` with bullets / `divide-y` rows is the lazy choice. If you have > 5 items, reach for one of these instead:
  - 2-column split with grouped items
  - Card grid with image + label per item
  - Tabs / accordion if items are categorisable
  - Horizontal scroll-snap pills
  - Carousel for breadth-heavy lists (testimonials, logos, capabilities)
  - Marquee for "lots-of-things-that-don't-need-individual-attention"
  A spec sheet with 10 rows + a hairline under every row is the WORST default. Either group rows into 2-3 chunks with sparse dividers, or move to a card-per-spec layout.
* **Fake-precise numbers are flagged.** Numbers like `92%`, `4.1×`, `48k`, `5.8 mm`, `13.4 lb` either:
  - Come from real data (brief, brand guidelines, public metrics) - fine
  - Are explicitly labeled as mock (`<!-- mock -->`, "example", "sample data") - fine
  - Are AI-invented spec aesthetics - banned. Don't fake engineering precision the brand doesn't claim.
* **One copy register per page.** Don't mix technical mono ("47 tasks · 0.6 ctx-switches/day"), editorial prose, and marketing punch in the same composition unless the brand voice explicitly calls for it.

### 4.10 Quotes & Testimonials

* **Max 3 lines** of quote body. Never 6. If the original quote is longer → cut it. A landing-page quote is a snippet, not the full review.
* For very small font sizes (e.g. footer-style testimonials), the line cap can stretch slightly. Spirit: "fits in a glance."
* **No em-dashes inside the quote text** as design flourish (long pauses, kinetic em-dashes, em-dash-bullets). See Section 9.G - em-dash is completely banned.
* Attribution: name + role + (optionally) company. Never name only ("- Sarah").
* Quote marks: use real typographic quotes ( " " ) or none at all. Not straight ASCII ( " ).

### 4.11 Page Theme Lock (Light / Dark Mode Consistency)

The page has ONE theme. Sections do not invert.

* If the page is dark mode, ALL sections are dark mode. No light-mode-warm-paper section sandwiched between dark sections (or vice versa). The user must not feel they walked into a different website mid-scroll.
* The exception: if the brief explicitly calls for a "Color Block Story" or "Theme Switch on Scroll" device AND that is a deliberate composition (one full theme switch with a strong transition, not random alternation), it is allowed once per page.
* Default behaviour: pick light, dark, or auto (`prefers-color-scheme`) at the page level and lock it. Section-level background tints within the same theme family are fine (`bg-zinc-950` next to `bg-zinc-900`); flipping to `bg-amber-50` in the middle of a `bg-zinc-950` page is broken.
* When using a design system with built-in theming (Radix Themes, shadcn/ui with `<Theme>`), set the theme ONCE in `layout.tsx` or the page root. Do not let individual sections override.

---

## 5. CONTEXT-AWARE PROACTIVITY

These are tools, not defaults. Use them when the design read calls for them. **None of these fire automatically.**

* **Liquid Glass / Glassmorphism:** Appropriate for premium consumer, Apple-adjacent, luxury brand, or media-overlay vibes. Inappropriate for dashboards, public-sector, or "boring B2B." When used, go beyond `backdrop-blur`: add a 1px inner border (`border-white/10`) and a subtle inner shadow (`shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]`) for physical edge refraction. Provide a solid-fill fallback under `prefers-reduced-transparency`.
* **Magnetic Micro-physics:** Use when `MOTION_INTENSITY > 5` AND the brief reads premium / playful / agency. Implement EXCLUSIVELY with Motion's `useMotionValue` / `useTransform` outside the React render cycle. Never `useState`. See Section 3.B.
* **Perpetual Micro-Interactions** (Pulse, Typewriter, Float, Shimmer, Carousel): Use when `MOTION_INTENSITY > 5` AND the section actively benefits from motion (status indicators, live feeds, AI-feel). **Not every card needs an infinite loop.** If a section is informational, leave it still. Apply Spring Physics (`type: "spring", stiffness: 100, damping: 20`) - no linear easing.
* **"Motion claimed, motion shown."** If `MOTION_INTENSITY > 4`, the page must actually move: entry transitions on hero, scroll-reveal on key sections, hover physics on CTAs, at minimum. A static page that claims `MOTION_INTENSITY: 7` is broken. Conversely, if you cannot ship working motion in the available scope, drop the dial to 3 and ship a clean static page. Never half-build motion that breaks (cut-off ScrollTriggers, jumpy enters, missing cleanups).
* **GSAP Sticky-Stack Pattern (when scroll-stack is used).** A "card stack on scroll" must be a REAL sticky-stack, not a sequential reveal list. See Section 5.A below for the canonical code skeleton. Common failure: trigger fires halfway through scroll instead of pinning at viewport top. Fix: `start: "top top"` not `start: "top center"` or `"top 80%"`.
* **GSAP Horizontal-Pan Pattern (when horizontal scroll-hijack is used).** See Section 5.B below for the canonical skeleton. Common failure: animation starts before the section is pinned, so the user sees half a slide. Same fix: `start: "top top"`, pin the wrapper, scrub the inner track.

### 5.A Sticky-Stack - Canonical Skeleton

```tsx
"use client";
import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "motion/react";

gsap.registerPlugin(ScrollTrigger);

export function StickyStack({ cards }: { cards: React.ReactNode[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce || !ref.current) return;
    const ctx = gsap.context(() => {
      const cardEls = gsap.utils.toArray<HTMLElement>(".stack-card");
      cardEls.forEach((card, i) => {
        if (i === cardEls.length - 1) return;
        ScrollTrigger.create({
          trigger: card,
          start: "top top",
          endTrigger: cardEls[i + 1],
          end: "top top",
          pin: true,
          pinSpacing: false,
          anticipatePin: 1,
        });
        const nextPos = cardEls[i + 1]?.offsetTop - card.offsetTop;
        gsap.to(card, {
          y: -nextPos,
          ease: "none",
          scrollTrigger: {
            trigger: card,
            start: "top top",
            end: () => `+=${nextPos}`,
            scrub: true,
          },
        });
      });
    }, ref);
    return () => ctx.revert();
  }, [cards, reduce]);

  return (
    <div ref={ref} className="relative">
      {cards.map((child, i) => (
        <div key={i} className="stack-card sticky top-0">
          {child}
        </div>
      ))}
    </div>
  );
}
```

### 5.B Horizontal-Pan - Canonical Skeleton

```tsx
"use client";
import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "motion/react";

gsap.registerPlugin(ScrollTrigger);

export function HorizontalPan({ panels }: { panels: React.ReactNode[] }) {
  const outer = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce || !track.current || !outer.current) return;
    const ctx = gsap.context(() => {
      const width = track.current!.scrollWidth - outer.current!.clientWidth;
      gsap.to(track.current, {
        x: -width,
        ease: "none",
        scrollTrigger: {
          trigger: outer.current,
          start: "top top",
          end: () => `+=${width}`,
          scrub: true,
          pin: true,
        },
      });
    }, outer);
    return () => ctx.revert();
  }, [panels, reduce]);

  return (
    <div ref={outer} className="overflow-hidden">
      <div ref={track} className="flex w-max">
        {panels.map((p, i) => (
          <div key={i} className="w-screen shrink-0">
            {p}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 5.C Scroll-Reveal Stagger - Canonical Skeleton (lighter alternative)

For simple "items appear as they enter viewport" (no pinning), prefer Motion's `whileInView` over GSAP - lighter, no ScrollTrigger needed:

```tsx
"use client";
import { motion, useReducedMotion } from "motion/react";

export function RevealStagger({ items }: { items: string[] }) {
  const reduce = useReducedMotion();
  return (
    <ul className="grid gap-6">
      {items.map((item, i) => (
        <motion.li
          key={item}
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{
            duration: 0.6,
            delay: i * 0.06,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          {item}
        </motion.li>
      ))}
    </ul>
  );
}
```

---

## 6. PRE-FLIGHT SHIPPING CHECKLIST (Must Pass)

Before shipping any generated page:
1. ✅ No AI-purple gradients unless explicitly requested.
2. ✅ No default `Inter` unless explicitly requested.
3. ✅ `h-screen` replaced with `min-h-[100dvh]`.
4. ✅ No placeholder-as-label in forms.
5. ✅ Buttons pass contrast ratio (WCAG AA min).
6. ✅ All `framer-motion` imports use the `motion/react` package path.
7. ✅ RSC: no `useState` / `useEffect` in Server Components (`"use client"` on interactive leaves).
8. ✅ `next/font` used for all web fonts.
9. ✅ No emojis unless explicitly requested.
10. ✅ No div-based fake screenshots.
11. ✅ No `useState` for continuous pointer/scroll values.

---

## 7. HARD BAN (Complete Non-Negotiable)

These are never allowed regardless of design read, variance, or mood. No override path.

1. **No `h-screen` for Hero.** Use `min-h-[100dvh]`. (iOS Safari address bar collapses, `h-screen` jumps.)
2. **No `useState` for pointer tracking or scroll.** Use `useMotionValue` / `useTransform` / `useScroll` from Motion. (Section 3.B.)
3. **No placeholder-as-label.** Label goes above the input, inline. (Section 4.6.)
4. **No em-dash (—) anywhere.** See Section 9.G for replacement rules.
5. **No Section-Layout Repetition.** No layout family used twice on one page. (Section 4.7.)
6. **No fake-precise numbers without source.** (Section 4.9.)

---

## 8. SHIPPING PHILOSOPHY

* **Full Outputs Only:** Ship complete files. No placeholder comments, no `// TODO`, no `/* rest of the page */`. If a component references another file, ship that file too. The user should be able to copy-paste and run.
* **Progressive Feedback:** If a section is complex (bento grid, scroll-stack), ship the core structure first, then let the user confirm before adding motion. Front-load the big layout decisions; motion is the last pass.
* **One System, One Palette, One Accent.** Pick once and lock. Mixing mid-page is the #1 cause of "this looks generated."
* **Don't Oversell.** A 4-section landing page is not a "design system." A CSS variable file is not a "design token pipeline." Call things what they are.

---

## 9. GLOBAL SYNTAX & FORMAT BANS

These are editor-agnostic rules that apply to ALL generated output.

### 9.A Full Output Enforcement
Model must output **complete, copy-pasteable code** for all files. No truncation markers (`[...]`, `// ... (omitted)`, `// etc.`), no placeholder comments (`<!-- TODO: -->`, `// implement this`), no partial snippets with "finish later." If a component references another file, ship that file too. If a page needs N components, ship all N before the response ends.

### 9.B Markdown Fence Format
Use **standard ` ``` ` fences** for code blocks. **Avoid** indented code blocks (4 spaces) as they are ambiguous and break copy-paste. All code files must be inside proper fences.

### 9.C File Path Comment (Single Line)
Precede every code fence with a single line: `// path/to/file.tsx` (or whatever the comment character is for that language - `#` for CSS/SCSS, `<!-- -->` for HTML). No preceding explanation paragraph for the path; just the comment, then the fence.

### 9.D No Bundled Install Blocks
Do NOT output `npm install` commands as a code block at the end of a component file. Output install commands inline BEFORE the first code block that uses the dependency (Section 3.F). At the end of the response, if dependencies accumulated during the response, state them once in a single summary command.

### 9.E Output Sequence
Global CSS / fonts / theme config FIRST, then layout, then sections (hero → features → ... → footer), then motion components (scroll-stack, horizontal-pan, etc.), then the page file that assembles everything. The reader should be able to copy in order and have each subsequent file's imports resolve.

### 9.F No Greeting / No Elaboration Start
FIRST LINE of every response is: either (a) the one-line Design Read (Section 0.B), or (b) the first file-path comment (`// path/to/file.ext`) if the Design Read was already stated in a prior response. Never start with "Sure!", "Let's build this!", "Here's the design:", or any greeting. If you need to explain a design decision, do it in a one-line comment inside the relevant code, or in a short paragraph AFTER the first code fence.

### 9.G Em-Dash Ban (mandatory, no override)
The em-dash character `—` (U+2014) is completely banned in ALL output — code, comments, copy text, and prose. Use the em-dash replacement table below. No exceptions, no context, no mood, no creative intent.

| Instead of | Use | Context |
|---|---|---|
| Em-dash as pause or break | `,` (comma) or `:` (colon) or `—` (en-dash, U+2013) | All prose and copy text |
| Em-dash as parenthetical | `(` `)` or `,` , `,` pair | All prose and copy text |
| Em-dash as bullet | `-` (hyphen) or `•` (bullet, U+2022) | Lists |
| Em-dash in code comments | `—` (en-dash, U+2013) or `--` | Code comments only |

En-dash `—` IS allowed. Em-dash `—` is NOT. If you never type `—` (U+2014), you pass this rule.

### 9.H No "Dark Purple" or "Dark Violet" Backgrounds
Do not use `bg-purple-950`, `bg-violet-950`, `bg-purple-900`, `bg-violet-900` or any dark-saturation purple/violet as a page or section background. These are the most common AI aesthetic defaults and they read as generated slop. If the brand or brief requires purple, use it as an accent on a neutral base (Section 4.2). Override: this is a hard rule, not a dial. No override path.

### 9.I No "Expert / Master" Self-Praise
Do not call yourself an "expert," "master," or any self-praising label. Do not claim "mastery" of design, typography, animation, or color. Let the output speak.

### 9.J Capitalization Discipline
- `hero` is lowercase. The Hero section is `hero`, not `Hero`.
- `footer` is lowercase. Not `Footer`.
- `navbar` or `nav` is lowercase. Not `Navbar`
- All other section names follow the same rule: `features`, `testimonials`, `pricing`, `cta`, `faq`, `contact`. Lowercase in file names, component names, comments, and prose.
- Component files follow PascalCase: `HeroSection.tsx`, `FeatureCards.tsx` — the FILE is PascalCase, the reference in comments is lowercase.

### 9.K Brightness Discipline for Dark Mode
Dark mode does not mean "everything must be luminous." In dark mode:
- Text: use `text-zinc-400` / `text-zinc-300` for body, `text-zinc-100` for headings. Never `text-white` for body text.
- Cards: use `bg-zinc-900` or `bg-zinc-800/50`. Never `bg-zinc-700` or brighter.
- Borders: use `border-zinc-800` or `border-zinc-700/50`. Never `border-zinc-500`.
- Rule: nothing in dark mode should be brighter than `zinc-700` except text and accent CTAs.

### 9.L Motion Dependency Verification
Before using GSAP, verify it's installed. GSAP is NOT a default dependency. Do NOT blindly import GSAP in every project. Only use it when `MOTION_INTENSITY >= 7` AND the brief calls for scroll-driven patterns that Motion's native ScrollTimeline can't handle cleanly.

---

## 10. CODE REFERENCES & BRAND INTEGRITY

### 10.A Reference Handling (Honesty First)
If the user provides a reference URL or screenshot:
- **Analyze the reference:** layout structure, typography style, color palette, spacing rhythm, motion feel.
- **Extract the principle**, not the pixels. "Apple's hero uses a tight grid with asymmetric content" is useful. "Copy Apple's exact header pixel-for-pixel" is not.
- **Credit where clear:** if a design decision is clearly inspired by a named product or brand, acknowledge it in a code comment: `// layout inspired by ...`
- **For redesigns:** treat the existing site as the PRIMARY reference. Do not discard its choices without documenting why.

### 10.B Brand Asset Priority
If the brief mentions a brand and you can look it up:
1. Check if the brand assets (logo, color, type) are stated in the brief. If so, use them exactly.
2. If not stated but the brand is well-known, use publicly-known brand identity elements where appropriate and note your source in a comment.
3. If the brand has a public design system or brand guidelines, follow them.
4. If nothing is provided and the brand is unknown, do not guess. Use the design read defaults.

---

## 11. REDESIGN PROTOCOL (Audit-First, Never Blank-Slate)

When the brief says "redesign," "improve," "fix the UX of," "modernize," or references an existing URL for improvement:

### 11.A Mandatory Audit Step (BEFORE any code)
Before writing a single line of new code, audit the existing site and answer:
1. **What does the current site do well?** (layout, typography, brand consistency, content clarity — list at least 2 positives.)
2. **What are the top 3 specific failures?** (not "it looks bad" — name the layout, spacing, hierarchy, or typography issue with a concrete example.)
3. **What brand assets exist?** (logo, official colors, official fonts, photography style — list every asset you can identify from the current site.)
4. **What must be preserved?** (brand identity, content structure, URL paths, core user flows.)

### 11.B Redesign Exit Rule
If the audit identifies NO specific failures in the current site and the brief asks for "modernize" or "improve," respond: *"I audited this site and couldn't find a specific visual or UX failure that needs fixing. If you have a specific change in mind, tell me which section or behavior you want improved — I won't redesign something that already works."*

### 11.C Design Read for Redesigns
For redesigns, the Design Read (Section 0.B) MUST include:
- **Preservation category:** "preserve" or "overhaul"
- **What's kept:** e.g., "preserving brand teal and existing logo, overhauling layout and motion"
- **What's changed:** e.g., "full layout restructure, new motion language, modernized type scale"

---

## Appendix A - Design System Reference & Honesty

This appendix contains reference information about real design systems. It is NOT documentation that replaces the official docs of those systems. It is honest about coverage, limitations, and when to use each system.

### Fluent UI v9
- **Package:** `@fluentui/react-components` (React), `@fluentui/web-components` (web components)
- **Coverage:** Complete Microsoft design language. Components, theming, accessibility.
- **Honesty:** Full Microsoft fidelity. Not a clone — this IS Microsoft's design system.
- **When to use:** Microsoft / enterprise SaaS, dashboards, Office-adjacent UI.

### Material Web (MWC)
- **Package:** `@material/web`
- **Coverage:** Google Material Design 3 components as web components.
- **Honesty:** Official Google implementation. Full Material 3 spec coverage.
- **When to use:** Google-ish UI, Material-flavored product.

### Carbon Design System
- **Package:** `@carbon/react`, `@carbon/styles`
- **Coverage:** IBM's full design language. Data tables, charts, dashboards.
- **Honesty:** Official IBM. Mature data-density patterns.
- **When to use:** IBM-style B2B, enterprise analytics, data-heavy products.

### Polaris
- **Package:** `polaris.js` web components, Polaris React (`@shopify/polaris`)
- **Coverage:** Shopify's admin design system.
- **Honesty:** Required for Shopify app surfaces. Not a general-purpose UI kit.
- **When to use:** Shopify app UI.

### Atlaskit
- **Package:** `@atlaskit/*`, `@atlaskit/tokens`
- **Coverage:** Atlassian design system.
- **Honesty:** Official Atlassian. Jira/Confluence-adjacent.
- **When to use:** Atlassian-style product UI.

### Primer
- **Package:** `@primer/css`, `@primer/react-brand`
- **Coverage:** GitHub's design system. Brand variant for marketing pages.
- **Honesty:** Official GitHub. Primer CSS is for product UI; React Brand is for marketing sites.
- **When to use:** GitHub-style devtool, community page, developer marketing.

### GOV.UK Frontend
- **Package:** `govuk-frontend`
- **Coverage:** UK government digital services.
- **Honesty:** Legally/regulatorily expected for UK public-sector services.
- **When to use:** UK public-sector digital services.

### USWDS
- **Package:** `uswds`
- **Coverage:** US Web Design System.
- **Honesty:** US federal standard.
- **When to use:** US public-sector, trust-first sites.

---

## Appendix B - Common Dependency Install Reference

These are canonical install commands for the libraries and design systems referenced throughout this skill. Verify against `package.json` before running (Section 3.F).

**React / Next.js projects:**
```bash
npm install motion
npm install gsap        # Only when MOTION_INTENSITY >= 7 AND scroll-driven patterns needed
npm install @phosphor-icons/react
npm install hugeicons-react
npm install @radix-ui/react-icons
npm install @tabler/icons-react
```

**Design systems (React):**
```bash
# Fluent UI
npm install @fluentui/react-components

# Material Web
npm install @material/web

# Carbon
npm install @carbon/react @carbon/styles

# Polaris (Shopify)
npm install @shopify/polaris

# Primer
npm install @primer/css
npm install @primer/react-brand

# Radix Themes
npm install @radix-ui/themes

# shadcn/ui (Next.js)
npx shadcn@latest init
npx shadcn@latest add button card dialog
```

**Design systems (non-React):**
```bash
# GOV.UK Frontend
npm install govuk-frontend

# USWDS
npm install uswds

# Bootstrap
npm install bootstrap@5.3
```

---

## Appendix C - Apple Liquid Glass: Honest Web Approximation

### What is official
Apple documents Liquid Glass as a visual material for visionOS, iOS, and macOS. The official implementation uses Core Animation and Metal rendering on Apple platforms. There is no official CSS or web implementation.

### What is NOT official
Any CSS file, npm package, or CDN link claiming to be "Apple Liquid Glass for web" is a community approximation, not an Apple product. Treat it as such.

### Safer web approximation skeleton
When a brief calls for Liquid Glass and you cannot use native Apple UI, be honest:

```css
/* Apple Liquid Glass - honest web approximation
   Official material is Apple-proprietary (Core Animation + Metal).
   This is a CSS approximation using backdrop-filter + layered highlights.
   Pairs with Section 5 (Liquid Glass / Glassmorphism) rules. */

.liquid-glass-web-approx {
  backdrop-filter: blur(40px) saturate(1.4);
  -webkit-backdrop-filter: blur(40px) saturate(1.4);
  background:
    radial-gradient(ellipse at 30% 20%, rgb(255 255 255 / .15), transparent 60%),
    linear-gradient(135deg, rgb(255 255 255 / .12), rgb(255 255 255 / .02));
  border: 1px solid rgb(255 255 255 / .12);
  border-top: 1px solid rgb(255 255 255 / .22);
  border-bottom: 1px solid rgb(255 255 255 / .06);
  border-radius: 24px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / .18),
    0 12px 40px rgb(0 0 0 / .3);
}

@media (prefers-reduced-transparency: reduce) {
  .liquid-glass-web-approx {
    background: rgb(255 255 255 / .92);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
```

**Dark mode variant:**
```css
@media (prefers-color-scheme: dark) {
  .liquid-glass-web-approx {
    border-color: rgb(255 255 255 / .18);
    background:
      linear-gradient(135deg, rgb(255 255 255 / .16), rgb(255 255 255 / .04)),
      rgb(15 23 42 / .42);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / .22),
      0 18px 60px rgb(0 0 0 / .42);
  }
}

@media (prefers-reduced-transparency: reduce) {
  .liquid-glass-web-approx {
    background: rgb(255 255 255 / .96);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
```

**Important:** `prefers-reduced-transparency` has uneven browser support; test it. Always provide enough contrast even without blur.

---

**End of appendices.** Install commands above are reality anchors. The Apple Liquid Glass skeleton is a labeled approximation, not an Apple-issued package. For canonical docs per design system, consult the system's official docs (links in Section 2 plus Appendix B).
