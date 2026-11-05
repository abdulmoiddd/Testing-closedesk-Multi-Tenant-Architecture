# CloseDesk (Aicyro Pulse Engine v2.1.0)
## Master UI/UX Design System Specification

---

### 1. Design Philosophy & Visual Language

CloseDesk (branded as **Aicyro Pulse**) uses a modern, high-density, glassmorphic design system tailored for enterprise SaaS, multi-tenant operations, and real-time field-service dispatching.

* **Aesthetic Theme:** Dark glassmorphism by default (`#0a0118`) with ambient radial glows, combined with support for high-contrast light mode (`#f4f4f5`) across all screens.
* **Component Styling:** Translucent card surfaces (`backdrop-blur-xl`, `backdrop-blur-2xl`), subtle hairline borders (`border-white/10` or `border-black/10`), pill-shaped status badges, and glowing accent rings.
* **Responsive Layout:** Adaptive desktop sidebar (`w-72`), slide-over lead/booking triage drawers, responsive grid cards, and auto-expanding mobile drawers.
* **Interactions & Feedback:** Micro-spring transitions (`cubic-bezier(0.16, 1, 0.3, 1)`), hover elevation (`hover:-translate-y-0.5`), audio chimes on urgent inbound triage, pulsing radar map pins, and live sound visualizer bars during WebRTC voice calls.

---

### 2. Global CSS Variables & Token Architecture (`src/styles/globals.css`)

The application dynamic theming is built on pure CSS Custom Properties synchronized at runtime via `src/Closedesk/ThemeProvider.jsx` and `applyThemeToDOM` functions:

| CSS Variable Token | Light Mode Default | Dark Mode Default | Role / Description |
|---|---|---|---|
| `--background` | `#f4f4f5` | `#0a0118` | Root page background |
| `--foreground` | `#0b0219` | `#ffffff` | Primary high-contrast text |
| `--foreground-muted` | `#4a4a6a` | `#9ca3af` | Secondary labels, descriptions, captions |
| `--primary` | `#8a2be2` | `#8a2be2` | Primary brand accent (Violet/Purple default) |
| `--secondary` | `#7b71db` | `#7b71db` | Secondary accent & gradient pair |
| `--accent-blue` | `#5b6ec2` | `#5b86d3` | Ambient highlights & links |
| `--border-color` | `rgba(11, 2, 25, 0.15)` | `rgba(255, 255, 255, 0.1)` | Subtle card & container borders |
| `--card-bg` | `#ffffff` | `#120b18` | Elevated card & surface container |
| `--grid-line` | `rgba(11, 2, 25, 0.05)` | `#4a4a6a` | Chart & canvas grid lines |
| `--footer-bg` | `#eaebf0` | `#060010` | Drawer / footer container background |
| `--sidebar-bg` | `#ffffff` | `#120b18` | Cockpit navigation sidebar background |
| `--sidebar-border` | `rgba(11, 2, 25, 0.2)` | `rgba(255, 255, 255, 0.1)` | Sidebar border separator |
| `--card-gradient-start` | `#ffffff` | `#1f1629` | Vertical card gradient top |
| `--card-gradient-end` | `#f4f4f5` | `#120b18` | Vertical card gradient bottom |
| `--hero-from` | `#e0e7ff` | `#1e1b4b` | Spotlight ambient radial start |
| `--hero-via` | `#f4f4f5` | `#0a0118` | Spotlight ambient radial middle |
| `--hero-to` | `#ffffff` | `#0b0219` | Spotlight ambient radial edge |
| `--lead-glow` | `rgba(138, 43, 226, 0.05)` | `rgba(138, 43, 226, 0.15)` | Interactive glow shadow behind primary CTAs |

---

### 3. Multi-Palette Theme Hue Matrix

CloseDesk provides **8 distinct theme palettes**, each supporting both light and dark modes:

1. **Default (Violet):** Base `#8a2be2` / `#7b71db`. Light: `data-theme="light"`, Dark: `data-theme="dark"`.
2. **Red (Ruby/Crimson):** Base `#ef4444` / `#dc2626`. Light: `data-theme="red-light"`, Dark: `data-theme="red-dark"`.
3. **Orange (Amber/Fire):** Base `#f97316` / `#ea580c`. Light: `data-theme="orange-light"`, Dark: `data-theme="orange-dark"`.
4. **Yellow (Sun/Gold):** Base `#f59e0b` / `#d97706`. Light: `data-theme="yellow-light"`, Dark: `data-theme="yellow-dark"`.
5. **Green (Emerald):** Base `#10b981` / `#059669`. Light: `data-theme="green-light"`, Dark: `data-theme="green-dark"`.
6. **Blue (Ocean/Electric):** Base `#3b82f6` / `#2563eb`. Light: `data-theme="blue-light"`, Dark: `data-theme="blue-dark"`.
7. **Indigo (Deep Night):** Base `#6366f1` / `#4f46e5`. Light: `data-theme="indigo-light"`, Dark: `data-theme="indigo-dark"`.
8. **Violet (Amethyst):** Base `#8b5cf6` / `#7c3aed`. Light: `data-theme="violet-light"`, Dark: `data-theme="violet-dark"`.

#### Dynamic Shade Adjustment Engine:
When the user adjusts the accent shade slider (`100` to `900` with `500` default):
* **Darker Shade (> 500):** Calculates intensity `Math.abs(shade - 500) / 450`. Mixes base color with black:  
  `--primary: color-mix(in srgb, black ${intensity * 70}%, ${baseColor})`
* **Lighter Shade (< 500):** Mixes base color with white:  
  `--primary: color-mix(in srgb, white ${intensity * 85}%, ${baseColor})`

---

### 4. Typography & Iconography System

* **Primary Font Stack:** System Sans-Serif (`font-sans`: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`).
* **Code & Monospace Stack:** `font-mono` (`ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`) used for Correlation IDs, UUIDs, Session IDs, and phone numbers.
* **Font Weights:**
  * Regular (`400`): Body paragraphs, transcript messages.
  * Medium (`500`): Filter options, helper tooltips, input text.
  * Semibold (`600`): Card headers, table cell titles, primary CTA buttons.
  * Bold (`700`): Screen titles, navigation items, metric counters.
  * Extrabold / Black (`800` / `900`): Landing hero banners, superadmin brand headings.
* **Icon Library:**
  * Inline SVG icons matching Heroicons and Lucide React specifications.
  * Avatar SVGs: `/avatars/ai-spark.svg`, `/avatars/bot-classic.svg`, `/avatars/human-agent.svg`, `/avatars/minimal-dot.svg`.

---

### 5. UI Component Patterns

#### 5.1 Glassmorphic Cards
```html
<div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 shadow-xl backdrop-blur-xl transition-all">
  <!-- Content -->
</div>
```

#### 5.2 Status Badges
* **Pending / In Progress:** Amber background `bg-amber-500/10`, border `border-amber-500/30`, text `text-amber-500`, with animated pulsing dot `<span class="animate-pulse"></span>`.
* **Booked / Completed:** Emerald background `bg-emerald-500/10`, border `border-emerald-500/30`, text `text-emerald-400`.
* **Abandoned / Cancelled:** Rose background `bg-rose-500/10`, border `border-rose-500/30`, text `text-rose-400`.
* **Captured / Default:** Muted background `bg-[var(--foreground-muted)]/10`, border `border-[var(--border-color)]`.

#### 5.3 Modals & Slide-Over Drawers
* **Backdrop:** Fixed overlay `fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300`.
* **Sidebar:** Fixed left drawer `w-72 bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] shadow-[20px_0_50px_rgba(0,0,0,0.1)]`.
* **Triage Detail Drawer:** Slide-over panel from right `fixed inset-y-0 right-0 w-full max-w-xl bg-[var(--card-bg)] border-l border-[var(--border-color)] z-50 p-6 overflow-y-auto`.

#### 5.4 Form Controls & Inputs
* High contrast dark/light inputs: `bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] rounded-xl px-4 py-2.5 focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none`.
* Sliders: Custom accent-colored range inputs styled with CSS custom properties.
* Toggle Switches: Smooth slide toggle with green active background (`bg-emerald-500`) and rounded knob (`translate-x-5`).

#### 5.5 Notification Toasts (`.app-toast`)
Independent floating toast container with success circle (`bg-emerald-500/15`, `text-emerald-500`) or error circle (`bg-rose-500/15`, `text-rose-500`), auto-dismissed after 3500ms.
