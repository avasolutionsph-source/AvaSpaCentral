# Booking Slug Setup Guide

## What is the Booking Slug?

Each owner account has a `booking_slug` — a short, clean URL identifier for their booking page.

Example: If the slug is `daet-spa`, the booking page URL is:
```
https://yourdomain.com/book/daet-spa
```

## How It Works

1. **Root domain** (`daetmassage.com`) loads the **default** business based on `VITE_DEFAULT_BUSINESS_SLUG` env variable (falls back to `nagabranch`)
2. **Slug URL** (`/book/customer-slug`) loads the specific owner's business
3. Customers see branch selection (if multiple branches), then services, therapist, date/time, details

## Setting Up for a New Client

### Step 1: Set the booking slug in Supabase

```sql
-- Find the business
SELECT id, name, booking_slug FROM businesses;

-- Set the slug (replace values)
UPDATE businesses
SET booking_slug = 'their-slug-here'
WHERE id = 'their-business-uuid-here';
```

Slug rules:
- Lowercase letters, numbers, hyphens only
- 3-50 characters
- No spaces, no special characters
- Must be unique across all businesses

### Step 2: Update the default slug (if this is the main domain owner)

In the `.env` file (or Netlify/Vercel env settings):

```
VITE_DEFAULT_BUSINESS_SLUG=their-slug-here
```

This controls what `yourdomain.com` (root URL with no path) shows.

If not set, falls back to `nagabranch`.

### Step 3: Custom domain (optional)

If the client has their own domain (e.g., `clientspa.com`):
1. Point their domain to the same deployment
2. Set `VITE_DEFAULT_BUSINESS_SLUG` to their slug in that deployment's env
3. Their domain root will show their booking page

## Where the Code Lives

| What | File | Line |
|------|------|------|
| Default slug fallback | `src/pages/BookingPage.jsx` | ~145 |
| Slug lookup query | `src/pages/BookingPage.jsx` | ~147 |
| Slug editing (Settings) | `src/pages/Settings.jsx` | Branding tab |
| Env variable | `.env` | `VITE_DEFAULT_BUSINESS_SLUG` |
| Database column | `businesses.booking_slug` | Supabase |

## Who Can Edit the Slug?

- **Owner** — yes (in Settings > Branding tab)
- **Manager** (of the owner) — yes
- **Branch Owner** — no (cannot see Branding tab)

## Quick SQL Commands

```sql
-- View all slugs
SELECT id, name, booking_slug FROM businesses ORDER BY name;

-- Set a slug
UPDATE businesses SET booking_slug = 'new-slug' WHERE id = 'uuid';

-- Remove a slug
UPDATE businesses SET booking_slug = NULL WHERE id = 'uuid';

-- Check if slug is available
SELECT id, name FROM businesses WHERE booking_slug = 'desired-slug';
```
