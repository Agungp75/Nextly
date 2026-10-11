---
name: Electric Glass Stream
colors:
  surface: '#0f131c'
  surface-dim: '#0f131c'
  surface-bright: '#353942'
  surface-container-lowest: '#0a0e16'
  surface-container-low: '#181c24'
  surface-container: '#1c2028'
  surface-container-high: '#262a33'
  surface-container-highest: '#31353e'
  on-surface: '#dfe2ee'
  on-surface-variant: '#bbcabf'
  inverse-surface: '#dfe2ee'
  inverse-on-surface: '#2c3039'
  outline: '#86948a'
  outline-variant: '#3c4a42'
  surface-tint: '#4edea3'
  primary: '#4edea3'
  on-primary: '#003824'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#006c49'
  secondary: '#4cd7f6'
  on-secondary: '#003640'
  secondary-container: '#03b5d3'
  on-secondary-container: '#00424e'
  tertiary: '#ffb2b7'
  on-tertiary: '#67001b'
  tertiary-container: '#ff7886'
  on-tertiary-container: '#780021'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#acedff'
  secondary-fixed-dim: '#4cd7f6'
  on-secondary-fixed: '#001f26'
  on-secondary-fixed-variant: '#004e5c'
  tertiary-fixed: '#ffdadb'
  tertiary-fixed-dim: '#ffb2b7'
  on-tertiary-fixed: '#40000d'
  on-tertiary-fixed-variant: '#92002a'
  background: '#0f131c'
  on-background: '#dfe2ee'
  surface-variant: '#31353e'
typography:
  display-hero:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.03em
  display-hero-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.03em
  label-sm:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.05em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.5rem
  margin: 1.5rem
  margin-mobile: 0.75rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
---

## Brand & Style

The design system powers an intimate, fast-paced peer-to-peer live video platform. The brand personality balances effortless digital spontaneity with absolute modern safety, trust, and refined sleekness. The audience spans Gen Z and digital-native millennials seeking authentic, low-friction spontaneous interactions across borders.

The aesthetic fuses **Ultra-Refined Dark Glassmorphism** with **Kinetic Minimalism**:
- Deep obsidian and charcoal backdrops recede into the canvas, putting the human face and live video feed front and center.
- Translucent, frosted glass control surfaces (`backdrop-filter: blur(16px)`) float directly over streams to preserve immersive 1:1 screen real estate without clutter.
- High-velocity energetic accents (electric emerald, hyper-teal, and urgent coral) deliver instantaneous status recognition: connected, searching, live, or terminating.
- Micro-interactions feel snappy and tactile—instant feedback is mandatory for core triggers like "Next", "Report", and stream connection transitions.

## Colors

The palette is engineered specifically for OLED and low-light environments, maximizing video clarity while rendering clear operational cues:

- **Primary (`#10B981` - Electric Emerald):** Denotes safe states, active video connection, online indicators, and the prominent "Start" action.
- **Secondary (`#06B6D4` - Cyber Teal):** Handles pairing status, discovery pulses, matchmaking badges, and active text chat highlights.
- **Tertiary (`#F43F5E` - Vivid Coral):** Reserved strictly for high-stakes, disruptive actions—stream skipping, disconnect ("Stop"), safety flags, and user blocking/reporting.
- **Violet Accent (`#8B5CF6`):** Used selectively for special interactions, emoji reaction bursts, and verified interest tags.
- **Neutral Core (`#0B0F17` to `#1E293B`):** Multi-layered obsidian surfaces (`#0B0F17` base canvas, `#111827` card backings, `#1F2937` glass tinting, `#374151` structural borders).
- **Text & Foreground:** `#F9FAFB` for primary high-contrast readability over video, `#9CA3AF` for metadata/timestamps, and `#4B5563` for muted states.

## Typography

The type scale combines **Plus Jakarta Sans** for expressive, humanistic headers and body text with **Inter** for ultra-legible, compact functional chrome.

- Headings use negative tracking to ensure impact without crowding tight mobile video overlays.
- `label-sm` and `label-md` employ uppercase treatment and elevated tracking (`0.03em` to `0.05em`) to render system telemetry like network latency, connection speed, and badge statuses unmistakably sharp against moving video backgrounds.
- Dynamic mobile scaling triggers below `768px` to guarantee that stream controls, prompt banners, and report sheets do not obscure camera viewport zones.

## Layout & Spacing

The layout is built for real-time video partitioning across two distinct viewport dynamics:

- **Desktop (>= 1024px):** Dual split-pane viewport (1:1 aspect split). The remote peer feeds the primary left pane (or top-dominant frame), and the local preview stays fixed on the right pane or pinned dynamically. The control deck floats anchored 32px above the bottom edge.
- **Mobile (< 768px):** Stacked vertical viewports (top half remote peer, bottom half local feed) or a primary full-bleed remote stream with a floating Picture-in-Picture (PiP) local preview anchored top-right with `0.75rem` safe margin padding.
- Control HUDs hover within comfortable thumb reach (bottom 96px screen zone). Floating reaction trays sit `0.5rem` above the primary action shelf.

## Elevation & Depth

Visual depth is achieved through layered translucent glass surfaces over dark video feeds rather than heavy drop shadows:

- **Base Layer (Level 0):** Canvas backdrop (`#0B0F17`) and active WebRTC raw video streams.
- **Floating Overlays (Level 1):** Video HUD badges (country flag, latency, user name) use `rgba(17, 24, 39, 0.65)` with `backdrop-filter: blur(12px)` and a subtle `1px solid rgba(255, 255, 255, 0.08)` border.
- **Action Deck & Trays (Level 2):** Primary control pill and emoji reaction tray sit at `rgba(15, 23, 42, 0.85)` with `backdrop-filter: blur(20px)`, framed by a faint top glow `border-t: 1px solid rgba(255, 255, 255, 0.15)` and an ambient shadow `0 20px 40px -15px rgba(0, 0, 0, 0.7)`.
- **Modals & Safety Sheets (Level 3):** Report flows and safety verification screens use solid slate-surfaced sheets (`#111827`) with `0 25px 50px -12px rgba(0, 0, 0, 0.85)` and an overlay tint of `rgba(11, 15, 23, 0.8)`.

## Shapes

The interface embraces a **pill-shaped (`roundedness: 3`)** design language to cultivate an approachable, modern, and fluid environment:

- Primary action decks, CTA buttons ("Start", "Next", "Stop"), and pill badges utilize complete circular caps (`border-radius: 9999px`).
- Video containers, side chat sheets, and modal cards utilize soft curved corners (`1.5rem` to `2rem`) to feel friendly and non-rigid.
- Interactive elements invite physical taps through smooth radius-matched focus rings (`ring-2 ring-emerald-400/50`).

## Components

### Buttons
- **Start / Connect Button:** High-prominence pill filled with energetic emerald (`#10B981`), high-contrast dark text (`#062D1F`), glowing pulse on idle matching states.
- **Next Button (Core Loop):** High-contrast glass pill or cyber teal fill (`#06B6D4`) with forward-facing chevron iconography. Rapid transition responsiveness (under 100ms visual state change).
- **Stop / Disconnect Button:** Bordered glass pill (`border: 1px solid rgba(244, 63, 94, 0.4)`) featuring a transition to full tertiary coral fill on hover/press.
- **Safety / Report Button:** Understated circular floating glass icon button with shield-alert icon; changes to high-visibility coral upon engagement.

### Badges & Status Indicators
- **Online Counter:** Frosted pill containing an emerald pulsating LED node, accompanied by numerical counter in `label-md`.
- **Matchmaking Radar Badge:** Floating center-screen badge with cyan radar sweep animation displaying "Searching for peer..." or interest match tags.

### Emoji Reaction Bar
- Floating horizontal pill tray containing pre-rendered 3D/lottie reactions (🔥, 😂, 👏, 😮, ❤️). Tap creates an upward drifting particle fountain with randomized sway over the remote video canvas.

### Input Fields & In-Stream Chat
- Low-profile horizontal message bar positioned along the bottom grid boundary. Transparent backdrop (`rgba(255, 255, 255, 0.05)`), subtle inner border, auto-expanding text field, and quick-send trigger button.

### Video Containers
- Rounded video shells (`1.5rem` border radius) with integrated audio visualizer meters along the frame boundary that gently glow based on incoming peer mic activity.