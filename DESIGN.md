# Design System: Noida Sports Talent Hunt 2026

## 1. Visual Theme & Atmosphere

Warm editorial sport on cream paper. Density 4, variance 8, motion 6. The site feels like a confident city sports programme rendered as a contemporary storybook: oversized type, flat athletic illustrations, open space, tactile pill controls, and asymmetrical compositions. It stays welcoming for parents while giving young athletes a serious stage.

## 2. Color Palette & Roles

- **Cream Paper** (`#F5F1E4`) — dominant page canvas.
- **Pure Surface** (`#FFFFFF`) — raised form and information surfaces.
- **Charcoal Ink** (`#2C2E2A`) — primary text and high-contrast controls.
- **Stone Gray** (`#747873`) — supporting copy and metadata.
- **Sandstone** (`#E3DED0`) — recessed surfaces and quiet structural lines.
- **Fresh Grass** (`#78C850`) — the single functional accent for CTAs, focus, selection, and brand punctuation.

Illustrations may use muted sky, coral, and yellow as decorative paper-cut colors. They never act as interface state colors.

## 3. Typography Rules

- **Display and body:** Plus Jakarta Sans. Display text uses weight 700–800, tight tracking, and `clamp()` scaling. Body copy uses weight 400–500 with relaxed 1.6 leading and a maximum line length of 65 characters.
- **Micro labels:** uppercase, 10–12px, weight 700, with wide tracking.
- Avoid generic serif faces, gradient text, and novelty type. Primary headings remain controlled even at large scale.

## 4. Component Stylings

- **Navigation:** a detached white pill on the cream canvas, with a circular green menu control on mobile.
- **Buttons:** fully rounded, tactile scale feedback, and a nested circular arrow island. Primary actions use Fresh Grass; secondary actions use white or cream.
- **Cards:** concentric double-bezel construction with a quiet sandstone outer shell and white inner core. Cards only appear where grouping or elevation helps comprehension.
- **Forms:** labels sit above controls. Focus uses Fresh Grass. Validation appears inline below the relevant field or above the payment action.
- **Options:** selectable paper chips with generous tap areas and a clearly visible native radio or checkbox.

## 5. Layout Principles

Use a 1200px contained CSS Grid. Heroes are left-aligned and asymmetrical. Sport entries use an offset two-column composition, never a row of three identical cards. All layouts collapse to one column below 768px with no horizontal overflow. Every tap target is at least 44px.

## 6. Motion & Interaction

Viewport entry uses staggered transform-and-opacity reveals through IntersectionObserver. Controls use `cubic-bezier(0.32, 0.72, 0, 1)` and tactile press states. Decorative figures float subtly. Reduced-motion preferences disable all non-essential movement.

## 7. Anti-Patterns (Banned)

No emojis, pure black, neon glow, gradient headline, centered hero, custom cursor, filler scroll prompts, equal three-card grids, generic testimonials, invented impact statistics, or vague AI copywriting. No content overlaps. No layout-property animation.
