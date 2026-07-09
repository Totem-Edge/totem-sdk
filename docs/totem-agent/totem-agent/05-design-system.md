# Totem Design System - Flat Brutalist Aesthetic

## Philosophy
Totem embraces a **flat brutalist** design language inspired by the raw, unpolished aesthetic of Brutalist architecture. This approach prioritizes **function over form**, creating an unapologetically bold and utilitarian interface that emphasizes trust through transparency.

### Core Principles
1. **Radical Honesty** - No skeuomorphism, no gradients, no illusions. What you see is what you get.
2. **High Contrast** - Maximum readability through stark color separation
3. **Sharp Geometry** - Hard edges, no rounded corners (except where functionally necessary for touch targets)
4. **Monochrome Base** - Black, white, and grays form the foundation
5. **Neon Accents** - Strategic use of burnt orange for CTAs and highlights
6. **Typography as Structure** - Bold, uppercase headings create visual hierarchy

## Color Palette

### Primary Colors
```css
--totem-white: #FFFFFF;         /* Pure white - backgrounds, text */
--totem-orange: #FF6B35;        /* Burnt neon orange - primary CTA */
--totem-slate: #475569;         /* Slate gray - secondary elements */
--totem-black: #0A0A0A;         /* Near-black - borders, emphasis */
```

### Extended Palette (Context-Specific)
```css
/* Backgrounds */
--bg-primary: #FFFFFF;          /* Main background */
--bg-secondary: #F8F8F8;        /* Alternate panels */
--bg-inverse: #0A0A0A;          /* Dark mode / emphasis */

/* Text */
--text-primary: #0A0A0A;        /* Main copy */
--text-secondary: #475569;      /* Less important text */
--text-inverse: #FFFFFF;        /* On dark backgrounds */
--text-muted: #94A3B8;          /* Disabled, placeholders */

/* Borders */
--border-default: #0A0A0A;      /* 2-3px hard borders */
--border-light: #E2E8F0;        /* Dividers */
--border-focus: #FF6B35;        /* Focus states */

/* States */
--state-success: #10B981;       /* Confirmed transactions */
--state-warning: #F59E0B;       /* Pending, caution */
--state-error: #EF4444;         /* Failed, danger */
--state-info: #3B82F6;          /* Informational */
```

## Typography

### Font Stack
```css
font-family: 
  -apple-system, 
  BlinkMacSystemFont, 
  "Segoe UI", 
  Roboto, 
  "Helvetica Neue", 
  Arial, 
  sans-serif;
```
**Rationale**: System fonts ensure instant loading and native feel across platforms.

### Type Scale
```css
/* Display (Hero headings) */
--text-display: 900 32px/1.1 var(--font-family);
text-transform: uppercase;
letter-spacing: 2px;

/* Heading 1 */
--text-h1: 700 24px/1.2 var(--font-family);
text-transform: uppercase;
letter-spacing: 1.5px;

/* Heading 2 */
--text-h2: 700 20px/1.3 var(--font-family);
text-transform: uppercase;
letter-spacing: 1px;

/* Heading 3 */
--text-h3: 700 16px/1.4 var(--font-family);
text-transform: uppercase;
letter-spacing: 0.5px;

/* Body */
--text-body: 400 14px/1.6 var(--font-family);

/* Small */
--text-small: 400 12px/1.5 var(--font-family);

/* Label */
--text-label: 700 11px/1.4 var(--font-family);
text-transform: uppercase;
letter-spacing: 1px;
```

### Usage Rules
- **Headings**: Always uppercase, always bold (700+)
- **Body**: Never uppercase (reduces readability)
- **Labels**: Uppercase for forms, settings, UI chrome
- **Numbers**: Tabular figures for amounts (`font-variant-numeric: tabular-nums`)

## Component Styling Patterns

### Buttons

#### Primary CTA
```css
.btn-primary {
  background: #FF6B35;           /* Burnt orange */
  color: #FFFFFF;
  border: 3px solid #0A0A0A;     /* Hard black border */
  padding: 12px 24px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.1s;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 4px 4px 0 #0A0A0A;  /* Brutalist shadow */
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: none;
}
```

#### Secondary Button
```css
.btn-secondary {
  background: #FFFFFF;
  color: #0A0A0A;
  border: 3px solid #0A0A0A;
  /* Same padding, typography as primary */
}

.btn-secondary:hover {
  background: #F8F8F8;
}
```

#### Danger Button
```css
.btn-danger {
  background: #EF4444;
  color: #FFFFFF;
  border: 3px solid #0A0A0A;
}
```

### Cards / Panels
```css
.card {
  background: #FFFFFF;
  border: 3px solid #0A0A0A;
  padding: 20px;
  /* NO border-radius */
  /* NO box-shadow (except on hover/interactive) */
}

.card-interactive:hover {
  transform: translateY(-2px);
  box-shadow: 6px 6px 0 #0A0A0A;
}
```

### Inputs
```css
.input {
  background: #FFFFFF;
  border: 2px solid #0A0A0A;
  padding: 10px 12px;
  font-size: 14px;
  /* NO border-radius */
}

.input:focus {
  outline: none;
  border-color: #FF6B35;
  box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.2);
}

.input::placeholder {
  color: #94A3B8;
  text-transform: none;
}
```

### Badges / Tags
```css
.badge {
  background: #0A0A0A;
  color: #FFFFFF;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: inline-block;
}

.badge-orange {
  background: #FF6B35;
}

.badge-outline {
  background: transparent;
  border: 2px solid #0A0A0A;
  color: #0A0A0A;
}
```

## Layout Principles

### Grid System
```css
/* 8px base unit */
--spacing-1: 8px;   /* 1 unit */
--spacing-2: 16px;  /* 2 units */
--spacing-3: 24px;  /* 3 units */
--spacing-4: 32px;  /* 4 units */
--spacing-6: 48px;  /* 6 units */
--spacing-8: 64px;  /* 8 units */
```

**Rule**: All margins, padding, gaps must be multiples of 8px

### Extension Viewport
```css
/* Chrome/Edge */
width: 400px;
height: 600px;

/* Firefox */
width: 380px;
height: 580px;

/* Safari */
width: 420px;
height: 620px;
```

**Layout Strategy**:
- Use `max-width: 100%` on all containers
- Test at smallest viewport (Firefox 380px)
- Horizontal scrolling is **forbidden**

### Z-Index Scale
```css
--z-base: 0;        /* Default layer */
--z-dropdown: 100;  /* Dropdowns, tooltips */
--z-overlay: 200;   /* Modals, overlays */
--z-modal: 300;     /* Critical modals */
--z-toast: 400;     /* Notifications */
```

## Iconography

### Icon Style
- **Line weight**: 2px minimum
- **Style**: Outline only (no filled icons except logos)
- **Size**: 16px, 20px, 24px (multiples of 4)
- **Color**: Inherit from parent or use `--text-secondary`

### Icon Library
Use **Lucide React** (consistent with Axia Dashboard):
```tsx
import { Send, Activity, Settings, AlertTriangle } from 'lucide-react';

<Send size={20} stroke={2} />
```

## Animation

### Permitted Animations
1. **Hover lifts**: `transform: translateY(-2px)` + shadow
2. **Button press**: `transform: translateY(0)` (remove shadow)
3. **Focus rings**: `box-shadow` fade in (200ms)
4. **Loading spinners**: Rotate only (no bounce, no fade)

### Forbidden Animations
- ❌ Fades (opacity changes) - too subtle for brutalism
- ❌ Bounces - playful, not utilitarian
- ❌ Elastic easing - overly decorative
- ❌ Page transitions - instant navigation only

### Timing
```css
--duration-instant: 0ms;
--duration-fast: 100ms;     /* Hovers */
--duration-normal: 200ms;   /* Focus states */
--duration-slow: 300ms;     /* Modals opening */
```

**Easing**: `cubic-bezier(0.4, 0, 0.2, 1)` (Material "standard")

## States & Feedback

### Loading State
```css
.loading {
  position: relative;
  pointer-events: none;
  opacity: 0.6;
}

.loading::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 10px,
    #0A0A0A 10px,
    #0A0A0A 12px
  );
  animation: loading-stripe 1s linear infinite;
}

@keyframes loading-stripe {
  to { background-position: 50px 0; }
}
```

### Success State
```css
.success {
  border-left: 4px solid #10B981;
  background: rgba(16, 185, 129, 0.05);
}
```

### Error State
```css
.error {
  border-left: 4px solid #EF4444;
  background: rgba(239, 68, 68, 0.05);
}
```

### Disabled State
```css
.disabled {
  opacity: 0.4;
  pointer-events: none;
  filter: grayscale(100%);
}
```

## Accessibility

### Contrast Ratios
- **Normal text**: Minimum 4.5:1 (WCAG AA)
- **Large text** (18px+): Minimum 3:1
- **UI components**: Minimum 3:1

### Focus Indicators
```css
:focus-visible {
  outline: 3px solid #FF6B35;
  outline-offset: 2px;
}
```
**Never** use `outline: none` without providing alternative focus indicator.

### Touch Targets
- **Minimum size**: 44x44px (iOS HIG, Material)
- **Spacing**: 8px minimum between adjacent targets

## Dark Mode (Future)

### Inverted Palette
```css
[data-theme="dark"] {
  --bg-primary: #0A0A0A;
  --bg-secondary: #1A1A1A;
  --text-primary: #FFFFFF;
  --text-secondary: #94A3B8;
  --border-default: #FFFFFF;
}
```

**Principle**: Maintain same contrast ratios, invert black/white only.

## Code Examples

### Complete Button Component
```tsx
import { cn } from '@/lib/utils';

interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger';
  size: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

export function Button({ variant, size, children, onClick, disabled }: ButtonProps) {
  return (
    <button
      className={cn(
        // Base styles
        'font-bold uppercase tracking-wide transition-transform',
        'border-3 border-black hover:translate-y-[-2px]',
        'active:translate-y-0 active:shadow-none',
        
        // Variant styles
        variant === 'primary' && 'bg-[#FF6B35] text-white hover:shadow-[4px_4px_0_#0A0A0A]',
        variant === 'secondary' && 'bg-white text-black hover:bg-gray-50',
        variant === 'danger' && 'bg-red-500 text-white hover:shadow-[4px_4px_0_#0A0A0A]',
        
        // Size styles
        size === 'sm' && 'px-3 py-2 text-xs',
        size === 'md' && 'px-6 py-3 text-sm',
        size === 'lg' && 'px-8 py-4 text-base',
        
        // Disabled
        disabled && 'opacity-40 pointer-events-none grayscale'
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
```

### Complete Card Component
```tsx
export function Card({ children, interactive = false }: { children: React.ReactNode; interactive?: boolean }) {
  return (
    <div
      className={cn(
        'bg-white border-3 border-black p-5',
        interactive && 'hover:translate-y-[-2px] hover:shadow-[6px_6px_0_#0A0A0A] transition-all cursor-pointer'
      )}
    >
      {children}
    </div>
  );
}
```

## Anti-Patterns (Don't Do This)

### ❌ Rounded Corners
```css
/* WRONG */
border-radius: 8px;

/* RIGHT */
/* No border-radius property */
```

### ❌ Subtle Gradients
```css
/* WRONG */
background: linear-gradient(180deg, #fff 0%, #f8f8f8 100%);

/* RIGHT */
background: #FFFFFF;
```

### ❌ Drop Shadows
```css
/* WRONG */
box-shadow: 0 4px 6px rgba(0,0,0,0.1);

/* RIGHT (only on hover, and geometric) */
box-shadow: 4px 4px 0 #0A0A0A;
```

### ❌ Lowercase Headings
```css
/* WRONG */
h1 {
  text-transform: none;
}

/* RIGHT */
h1 {
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 1.5px;
}
```

## Brand Assets

### Logo Usage
- **Primary**: Black on white
- **Inverse**: White on black
- **Accent**: Burnt orange (#FF6B35) for icon mark only
- **Clear space**: Minimum 16px on all sides
- **Minimum size**: 24px height

### Color Usage Percentages
- **Monochrome (Black/White/Gray)**: 80% of interface
- **Burnt Orange**: 15% (CTAs, active states, highlights)
- **State Colors**: 5% (success, error, warning indicators)

This creates a visually striking but focused interface where **color draws attention to what matters**.
