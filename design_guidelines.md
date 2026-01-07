# UI/UX & Design Guidelines

## Design Philosophy: "Neo-Brutalism"
The interface is designed to be high-contrast, bold, and functional. It combines the raw, unpolished look of brutalism with modern "glassmorphism" element and smooth animations.

### Core Principles
1.  **Dark by Default**: The app uses a deep black/zinc theme to reduce eye strain during long streaming sessions.
2.  **Visual Hierarchy**: Important actions (Approve/Deny) use bright, saturated colors (Blue/Red) against the dark background.
3.  **Feedback**: Every interaction has a hover state, active state, or motion effect.
4.  **"Pill" & "Panel" Geometry**: Contrast between fully rounded buttons (pills) and slightly rounded content areas (panels).

## Color Palette

| Name | Hex | Usage |
| :--- | :--- | :--- |
| **Background** | `#09090b` | Main application background (Zinc 950) |
| **Card / Surface** | `#18181b` | Cards, Sidebar, Panels (Zinc 900) |
| **Primary (Blue)** | `#3b82f6` | Active Tabs, "Approve" Actions, Highlights |
| **Danger (Red)** | `#ef4444` | "Block" Actions, Alerts, Shutdown |
| **Text Main** | `#f4f4f5` | Headings, Primary Text |
| **Text Dim** | `#a1a1aa` | Muted descriptions, metadata |
| **Border** | `#3f3f46` | Subtle dividers (Zinc 700) |

## Typography
- **Font Family**: `Inter` (Sans-serif)
- **Weights**:
    - **Black (900)**: Section Headers, Key Numbers.
    - **Bold (700)**: Button Labels, Important Usernames.
    - **Regular (400)**: Chat content.

## Components

### The "Neo Card"
Used for Action Cards and Containers.
- **Background**: `#141417`
- **Border**: `1px solid #3f3f46`
- **Radius**: `16px` or `24px` (`rounded-2xl` / `rounded-3xl`)
- **Shadow**: Deep drop shadow `0 4px 6px rgba(0,0,0,0.3)`

### Buttons
- **Primary / Action**: High saturation background, white text, glow effect on hover.
- **Ghost / Tab**: Transparent background, dim text. Becomes "Pill" shape when active.

### Motion (Framer Motion)
- **Page Transitions**: Simple fade + slight Y-axis slide.
- **Lists**: Items should animate in/out when added/removed.
- **Hover**: Buttons should lift (`-translate-y-1`) or scale slightly.

## Layout Structure
- **Sidebar (Left)**: Fixed navigation. 64px wide on desktop (expanded).
- **Topbar**: Contextual actions (Shutdown, Connection Status).
- **Main Area**: Scrollable content viewport, padded from edges.
