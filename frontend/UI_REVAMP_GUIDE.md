# APEX UI Revamp — Complete Design System

## 🎨 Color Palette

The new APEX design system uses a warm, sophisticated color palette:

| Color | Hex | Usage | RGB |
|-------|-----|-------|-----|
| **Deep Crimson** | `#5E0006` | Primary dark accent, backgrounds | `rgb(94, 0, 6)` |
| **Dark Red** | `#9B0F06` | Secondary dark, borders | `rgb(155, 15, 6)` |
| **Burnt Orange** | `#D53E0F` | Primary action, highlights, glows | `rgb(213, 62, 15)` |
| **Cream** | `#EED9B9` | Text, light accents | `rgb(238, 217, 185)` |

## 📦 New Components

### Core UI Components

#### 1. **Card Component** (`Card.tsx`)
Multiple variants with smooth animations:
- `default`: Clean minimal design
- `bordered`: Burn-colored border with interactive effects
- `glowing`: Animated glow effect
- `gradient`: Soft gradient background

```tsx
<Card variant="glowing" interactive>
  <CardHeader>Title</CardHeader>
  <CardContent>Content</CardContent>
  <CardFooter>Footer</CardFooter>
</Card>
```

#### 2. **Button Component** (`Button.tsx`)
Five button variants with smooth hover animations:
- `primary`: Gradient background (orange → dark red)
- `secondary`: Crimson gradient
- `danger`: Dark red with bold styling
- `ghost`: Minimal/transparent
- `outline`: Border-focused

Features:
- Loading state support
- Icon support
- Multiple sizes (sm, md, lg)
- Smooth 300ms transitions

```tsx
<Button variant="primary" size="md" isLoading={false}>
  Click Me
</Button>
```

#### 3. **Badge Component** (`Badge.tsx`)
Status, info, and stat badges:
- 7 variants (default, success, warning, danger, info, burn, crimson)
- Pulse animation support
- Size options (sm, md, lg)
- Icon support

```tsx
<Badge variant="burn" pulse icon="🔥">Active</Badge>
```

#### 4. **StatCard Component** (`StatCard.tsx`)
Animated metric cards with:
- Dynamic trend indicators (up/down/neutral)
- Glowing hover effect
- Custom icons
- Three variants (default, burn, success)
- Auto-stagger animations

```tsx
<StatCard
  title="Total APY"
  value="24.5"
  unit="%"
  change={+5.2}
  trend="up"
  variant="burn"
/>
```

#### 5. **Form Components** (`Input.tsx`)
- `Input`: Text input with icon support, validation
- `Textarea`: Multi-line input
- `Select`: Dropdown with options
- `Checkbox`: Custom-styled checkbox

All support:
- Error states with red styling
- Helper/hint text
- Labels
- Three variants (default, burn, success)

```tsx
<Input
  label="Username"
  placeholder="Enter..."
  icon="👤"
  variant="burn"
  error={errorMessage}
/>
```

#### 6. **Feedback Components** (`Feedback.tsx`)
- `Toast`: Success/error/info/warning notifications
- `Tooltip`: Hover-triggered inline help
- `Modal`: Beautiful dialog with animations
- `Dropdown`: Context menu with dividers

### CSS Utilities & Theme

#### New CSS Classes (in `theme.css`)
```css
.text-apex-burn        /* Burn color text */
.text-apex-cream       /* Cream text */
.text-gradient-apex    /* Gradient text effect */
.btn-apex-primary      /* Primary button */
.card-apex             /* Card styling */
.badge-apex            /* Badge styling */
.float-apex            /* Floating animation */
.rotate-apex           /* Rotating animation */
.terminal-apex         /* Terminal/mono effect */
.grid-apex             /* Responsive grid */
.border-glow-apex      /* Glowing border */
.shadow-apex           /* Custom shadow */
.status-active         /* Pulsing status dot */
.status-burn           /* Orange status dot */
```

#### CSS Custom Properties (in `globals.css`)
```css
--apex-crimson:     #5E0006
--apex-dark-red:    #9B0F06
--apex-burn:        #D53E0F
--apex-cream:       #EED9B9
--apex-glow:        rgba(213, 62, 15, 0.15)
--apex-glow-bright: rgba(213, 62, 15, 0.3)
```

## ✨ Animations

### Keyframe Animations

| Animation | Duration | Effect |
|-----------|----------|--------|
| `glow` | 2s | Pulsing glow effect |
| `glowBorder` | 2s | Animated border glow |
| `slideInRight` | varies | Slide in from right |
| `slideInLeft` | varies | Slide in from left |
| `slideInDown` | varies | Slide in from top |
| `scaleIn` | varies | Scale + fade in |
| `float` | 3s | Floating motion |
| `rotate` | 20s | Continuous rotation |
| `burn` | varies | Burn/glow effect |
| `pulse-burn` | 2s | Pulsing opacity |

### Accessibility

All animations respect `prefers-reduced-motion`:
```css
@media (prefers-reduced-motion: reduce) {
  /* All animations disabled */
}
```

## 🎭 Component Showcase

Visit `/components-showcase` to see all components in action with:
- Color palette reference
- All button variants
- Badge variations
- Form components
- Card styles
- Interactive elements
- Live examples

## 📱 Responsive Design

All components are mobile-responsive:
- Grid utilities auto-adjust to single column on mobile
- Buttons maintain usability on touch devices
- Modals scale appropriately
- Text remains readable at all sizes

## 🚀 Getting Started

### Using Components

```tsx
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';

export default function MyComponent() {
  return (
    <Card variant="glowing">
      <CardHeader>
        <h2>Welcome to APEX</h2>
      </CardHeader>
      <CardContent>
        <Badge variant="burn">Active</Badge>
        <StatCard title="APY" value="24.5" unit="%" />
      </CardContent>
    </Card>
  );
}
```

## 🎨 Design Tokens Summary

- **Typography**: Display (Bebas Neue), Mono (DM Mono), Sans (DM Sans)
- **Spacing**: Scales from 4px to 160px
- **Ease**: Out (0.16, 1, 0.3, 1), In-Out (0.76, 0, 0.24, 1)
- **Timing**: Fast (200ms), Base (400ms), Slow (800ms)
- **Border Radius**: 8px (buttons), 12px (cards), 20px (badges)

## 📋 Features

✅ Consistent color system throughout  
✅ Smooth 300-400ms transitions  
✅ Glow and shadow effects  
✅ Hover state animations  
✅ Loading states  
✅ Accessibility support  
✅ Mobile responsive  
✅ Dark mode optimized  
✅ TypeScript support  
✅ Framer Motion integration  

## 🔧 Configuration

### Update RainbowKit Theme

The providers have been updated to use the new accent color (#D53E0F).

### Global Styles

All global colors, spacing, and animations are defined in:
- `/src/styles/globals.css` — Core design system
- `/src/styles/theme.css` — Component utilities

## 📚 Component File Structure

```
src/components/
├── ui/
│   ├── Card.tsx              # Card component with variants
│   ├── Button.tsx            # Button and IconButton
│   ├── Badge.tsx             # Badge variants (status, stat)
│   ├── StatCard.tsx          # Metric cards and progress
│   ├── Input.tsx             # Form inputs (input, textarea, select, checkbox)
│   └── Feedback.tsx          # Toasts, tooltips, modals, dropdown
├── shared/
│   ├── Nav.tsx               # Navigation (styled with new palette)
│   ├── Footer.tsx            # Footer
│   └── Logo.tsx              # Logo component
└── marketing/
    ├── Hero.tsx              # Hero section (updated colors)
    ├── WhatSection.tsx
    ├── AgentsShowcase.tsx
    └── ... other sections
```

## 🎯 Next Steps

1. Update all existing components to use new Card/Button variants
2. Apply new colors to dashboard pages
3. Update Nav and Footer with new styling
4. Implement animations on dashboard transitions
5. Add more micro-interactions (ripples, tooltips, etc.)

## 💡 Tips for Developers

- Use `className` for one-off styles
- Use components for consistency
- Combine variants for different effects
- Check component-showcase for examples
- Follow the 300ms animation standard
- Test on mobile devices
- Use semantic HTML

---

**APEX UI Revamp** — Built with passion for beautiful, functional design.
