# AVA Spa Central — Marketing Site

Marketing website for AVA Spa Central, built with **Astro 5** + **Tailwind CSS 4**.

Deployed to Netlify at: <https://spacentral.avasolutions.ph>

> Note: This is the **marketing site**, separate from the AVA Spa Central ERP application.

## Local development

```bash
cd astro-site
npm install
npm run dev    # http://localhost:4321
```

## Build

```bash
cd astro-site
npm run build  # outputs to astro-site/dist
npm run preview
```

## Deployment

Netlify auto-deploys on push to `main`. Build config is in [`netlify.toml`](netlify.toml).

## Pages

- `/` — Home (hero, showcase, pillars, mobile, final CTA)
- `/features` — Features overview (9-card grid + deep dive)
- `/pricing` — Tier pricing (Starter, Advance, Enterprise) + lifetime ownership
- `/contact` — Contact form, office, social, FAQ

## Project structure

```
.
├── netlify.toml          Netlify build config
├── astro-site/           Astro project root
│   ├── public/           Static assets (spa images)
│   └── src/
│       ├── components/   Nav, Footer, SectionDecor, FaqItem
│       ├── layouts/      Layout.astro (base)
│       ├── pages/        index, features, pricing, contact
│       └── styles/       global.css (brand tokens + animations)
└── README.md
```
