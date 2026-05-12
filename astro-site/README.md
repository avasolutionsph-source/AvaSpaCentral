# AVA Spa Central — Astro + Tailwind v4

Marketing site rebuilt sa Astro 5 + Tailwind CSS v4.

## Run locally

```bash
cd astro-site
npm install
npm run dev
```

Buksan ang http://localhost:4321 sa browser.

## Build for production

```bash
npm run build
npm run preview
```

Yung built files nasa `dist/`.

## Project structure

```
astro-site/
├── public/               # Static assets (spa images)
├── src/
│   ├── components/       # Reusable Astro components
│   │   ├── Nav.astro
│   │   ├── Footer.astro
│   │   ├── SectionDecor.astro
│   │   └── FaqItem.astro
│   ├── layouts/
│   │   └── Layout.astro  # Base layout (nav + footer)
│   ├── pages/
│   │   ├── index.astro   # /
│   │   ├── pricing.astro # /pricing
│   │   └── contact.astro # /contact
│   └── styles/
│       └── global.css    # Tailwind + brand tokens
├── astro.config.mjs
├── tailwind.config (in global.css @theme)
└── tsconfig.json
```

## Brand tokens

Naka-define sa `src/styles/global.css` via Tailwind v4 `@theme`:
- `emerald-brand`, `emerald-deep`, `emerald-hover`
- `gold-brand`, `gold-soft`
- `ivory`, `cream`, `ink`, `muted`, `border-soft`
- `success-spa`

Usage: `bg-emerald-brand`, `text-gold-brand`, etc.
