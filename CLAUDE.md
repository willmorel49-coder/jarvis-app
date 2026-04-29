# Intégral Pharma — Context for Claude

## What is this project
Single-page HTML app (`ip_app-8.html` / `index.html`) for pharmaceutical sales reps and managers.
Premium mobile-first UI built with vanilla HTML/CSS/JS — no frameworks, no build step.

## Stack
- Pure HTML5 + CSS (CSS variables, flexbox, grid)
- Vanilla JavaScript (no dependencies)
- Google Fonts: DM Sans
- Deployed via GitHub Pages: https://willmorel49-coder.github.io/jarvis-app

## Brand / Design tokens
| Token | Value | Usage |
|---|---|---|
| `--blue` | `#0057FF` | Primary CTA, links |
| `--navy` | `#0B1F4D` | Headers, splash |
| `--green` | `#14B86A` | Positive KPIs, gains |
| `--amber` | `#FF9F1C` | Warnings |
| `--rose` | `#F43F5E` | Danger, losses |
| `--purple` | `#7C3AED` | Secondary accent |
| `--bg` | `#F7FAFF` | App background |
| Font | DM Sans | All text |

## Architecture (screens)
- **Splash** — loading screen with animated stats
- **User Picker** — role selection (commercial, manager, etc.)
- **Home** — KPI cards + favorites + top products list
- **Catalogue** — product search and filters
- **Product Detail** — pricing, margin, rotation stats
- *(more screens TBD)*

## Key conventions
- All screens are `.screen` divs toggled with class `.on`
- CSS variables defined in `:root`
- No external JS libraries — keep it that way
- Mobile-first, tested at 390px width (iPhone 14)
- `safe-area-inset` used for notch support

## Deployment
```bash
cd ~/jarvis/APP
git add . && git commit -m "message"
git push
```
GitHub Pages auto-deploys on push to `main`.

## What NOT to do
- Do not add npm/node/webpack/bundlers
- Do not split into multiple files unless the user asks
- Do not change the design tokens without checking DESIGN.md
- Do not add external JS libraries without user approval
