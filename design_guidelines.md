# Design Guidelines: News Crawler Archive System

## Design Approach

**Selected Approach:** Apple-inspired Modern Design
**Justification:** Clean, elegant, and user-friendly interface with emphasis on clarity, breathing room, and refined aesthetics. The design prioritizes readability and ease of use while maintaining a premium, polished appearance.

**Key Design Principles:**
- Generous spacing and breathing room
- Soft, natural shadows for depth
- Smooth rounded corners (12px)
- Clean typography with excellent readability
- Subtle, refined color palette
- Effortless interactions

---

## Core Design Elements

### A. Color Palette

**Light Mode Primary** (default):
- Background Base: 0 0% 99% (almost white)
- Surface: 0 0% 100% (pure white cards)
- Border: 0 0% 92% (very light gray)
- Text Primary: 0 0% 13% (dark gray, not pure black)
- Text Secondary: 0 0% 45% (medium gray)
- Text Tertiary: 0 0% 65% (light gray)
- Accent: 211 100% 50% (iOS blue)
- Accent Hover: 211 100% 45%
- Destructive: 0 84% 60% (soft red)

**Dark Mode:**
- Background Base: 0 0% 8%
- Surface: 0 0% 11%
- Border: 0 0% 18%
- Text Primary: 0 0% 92%
- Text Secondary: 0 0% 58%
- Text Tertiary: 0 0% 40%
- Accent: 211 100% 55%
- Accent Hover: 211 100% 50%

**Status Colors** (used sparingly):
- Success: 142 76% 36%
- Warning: 38 92% 50%
- Error: 0 84% 60%

### B. Typography

**Font Stack:**
- Primary: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui
- Monospace: 'SF Mono', 'Monaco', 'Menlo' (for dates, technical data)

**Type Scale:**
- Headlines (H1): text-2xl font-semibold
- Subheads (H2): text-lg font-medium
- Body: text-base font-normal
- Small: text-sm
- Tiny: text-xs

**Line Height:**
- Headlines: leading-tight
- Body text: leading-relaxed
- UI elements: leading-normal

### C. Layout System

**Spacing Primitives:** Generous spacing throughout
- Micro spacing: gap-3, p-3
- Standard spacing: gap-6, p-6 (cards, list items)
- Section spacing: gap-10, py-10 (between major sections)
- Page margins: px-8 md:px-16 lg:px-24

**Border Radius:**
- Standard: rounded-xl (12px) - Apple style
- Small: rounded-lg (8px)
- Large: rounded-2xl (16px)

**Shadows:**
- Cards: shadow-sm (soft, natural)
- Elevated: shadow-md
- Modals: shadow-xl
- Subtle depth throughout

**Grid System:**
- Container: max-w-7xl mx-auto
- Single column layout for article list
- Generous padding and margins

**Responsive Breakpoints:**
- Mobile: base (single column)
- Tablet: md (expanded spacing)
- Desktop: lg (full feature set)

### D. Component Library

**Navigation Header:**
- Fixed top bar (h-16)
- Clean, minimal design
- Soft shadow for depth
- Generous padding

**Date Picker:**
- Rounded design with soft borders
- Clean dropdown
- Selected date with blue accent

**Slide-out Management Panel:**
- Right-aligned panel
- Smooth transitions
- Backdrop blur
- Spacious button layout

**Category Sections:**
- Clear section headers
- Subtle divider lines
- Proper spacing between sections

**Article Cards:**
- White/dark background
- Soft hover states
- Clean typography
- Ample padding
- Rounded corners

**Buttons:**
- Rounded design (rounded-lg)
- Comfortable padding
- Smooth transitions
- Clear visual hierarchy

**Modal Dialogs:**
- Centered with backdrop blur
- Rounded corners (rounded-xl)
- Generous padding
- Clear actions

**Empty States:**
- Centered with icon
- Clear messaging
- Subtle colors

**Loading States:**
- Smooth animations
- Subtle spinners
- Non-intrusive

### E. Interactions & Animations

**Smooth Transitions:**
- All transitions: 200-300ms ease
- Hover states: subtle
- Focus states: blue ring
- No jarring movements

**Micro-interactions:**
- Smooth hover effects
- Gentle scale on press
- Fade transitions

---

## Layout Structure

**Main Dashboard:**
- Clean header with date picker
- Category sections with breathing room
- Article cards with generous spacing
- Everything feels spacious and organized

**Information Hierarchy:**
1. Date (prominent in header)
2. Category names (clear dividers)
3. Article titles (easy to read)
4. Summaries (supporting text)
5. Metadata (subtle)

**Visual Rhythm:**
- Consistent spacing throughout
- Natural flow
- Easy to scan
- Comfortable reading

---

## Critical Specifications

- Soft shadows for depth (not harsh borders)
- Generous spacing between all elements
- Rounded corners (12px standard)
- Clean, readable typography
- Smooth, subtle interactions
- Premium, polished feel
- Everything should feel effortless and elegant
