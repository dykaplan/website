# CLAUDE.md — Dean Kaplan Academic Website

## Project Overview

- **Framework**: Jekyll with the `minimal-mistakes` remote theme
- **Deployed at**: https://dykaplan.github.io/website
- **GitHub repo**: `dykaplan/website` (remote also registered as `dykaplan/frieder.github.io`)
- **Branch**: `master` → triggers GitHub Pages build on every push (~1–2 min to go live)

## Key Files

| File | Purpose |
|---|---|
| `_config.yml` | Site-wide settings (URL, baseurl, theme) |
| `_pages/about.md` | Homepage / About Me content |
| `_pages/teaching.html` | Teaching page |
| `_data/navigation.yml` | Nav bar links |
| `_sass/_custom.scss` | All custom CSS overrides — **edit this first** |
| `_sass/_masthead.scss` | Masthead/nav layout |
| `_sass/_navigation.scss` | Greedy-nav and pagination styles |
| `_sass/_page.scss` | Body background and page-level styles |
| `_includes/masthead.html` | Nav bar HTML |
| `_includes/head.html` | `<head>` — CSS link lives here |
| `_includes/scripts.html` | JS `<script>` tags |

## Design Notes

### Colors
- **Page background**: `#faf5e6` (warm cream — set in `_sass/_page.scss`)
- **Nav bar**: `transparent` (inherits page background seamlessly)
- **Link color**: `#0066cc`, hover `#004499`

### Navigation / Hamburger
- Uses `jquery.greedy-navigation.js` (`assets/js/plugins/`)
- The script moves overflow nav links into a `.hidden-links` dropdown and toggles a `<button>` via the `.hidden` CSS class
- **Do not use CSS breakpoints to control button visibility** — the JS handles this automatically based on actual overflow width
- Button starts with `class="hidden"` in `masthead.html` to prevent a flash before JS runs

### Cache Busting
- All CSS/JS tags include `?v={{ site.time | date: '%s' }}` (set in `head.html` and `scripts.html`)
- Jekyll sets `site.time` at build time, so every deploy generates new URLs and browsers fetch fresh assets automatically

## Recent Change History

### Feb 18, 2026
- **Cache busting** — Added `?v={{ site.time | date: '%s' }}` to all CSS/JS asset URLs so browser cache is invalidated on every deploy
- **Nav bar redesign** — Made masthead seamless with page background:
  - `.masthead` and `.greedy-nav` set to `background: transparent`
  - Removed border and box-shadow from masthead
  - Hamburger button now fully controlled by `greedy-nav.js`; starts hidden to avoid flash on load
  - Hidden-links dropdown background updated to match page cream (`#faf5e6`)

### Feb 11, 2026
- Fixed `baseurl` to `/website` to match GitHub Pages deployment path
- Removed obsolete `.html` file that was silently overriding a markdown page
- Added `.gitignore` entries for common build artifacts
- Iterated on nav bar styling (gradient → gray → transparent)
- Refined About page content and teaching descriptions for professional academic tone
- Fixed Ruby/Gemfile compatibility and GitHub Actions deployment workflow
- Restored corrupted layout/include files that had broken the nav bar
