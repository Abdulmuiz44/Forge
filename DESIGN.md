---
version: alpha
name: Codra Desktop
description: Premium dark engineering workspace for local-first AI coding workflows.
colors:
  primary: "#E7EBFF"
  secondary: "#94A0C6"
  tertiary: "#6D5EF7"
  neutral: "#070B12"
  surface-0: "#060910"
  surface-1: "#0B1019"
  surface-2: "#101722"
  border-subtle: "#FFFFFF14"
  success: "#22C55E"
  warning: "#F59E0B"
  danger: "#EF4444"
typography:
  h1:
    fontFamily: Inter
    fontSize: 2rem
    fontWeight: 600
    lineHeight: 1.2
  h2:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.3
  body-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  label-caps:
    fontFamily: Inter
    fontSize: 0.6875rem
    fontWeight: 600
    lineHeight: 1.2
rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 10px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
components:
  sidebar:
    backgroundColor: "{colors.surface-0}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
  panel:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
  panel-border:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.sm}"
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: 8px
  button-primary-hover:
    backgroundColor: "#7C70FA"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
  button-secondary:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: 8px
---

## Overview

Codra should read as a serious engineering surface: dark, dense, and purposeful. The interface prioritizes operational clarity over decoration, with focused accents only on actionable controls and live status.

## Colors

The palette is anchored in layered dark neutrals to keep long sessions comfortable while preserving strong contrast for code, logs, and system state.

- **Primary** supports key labels and selected state text.
- **Secondary** supports metadata and non-critical annotation.
- **Tertiary** is reserved for primary actions and selected interactive state.
- **Surface layers** distinguish navigation, work surface, and utility rails.

## Typography

Typography is compact and practical.

- Headings establish hierarchy in task and panel titles.
- Body text supports dense operational content.
- Label caps are used for subtle section labeling and mode/state indicators.

## Layout

Use a left navigation rail, task column, center work surface, bottom utility strip, and right context rail. Maintain stable panel proportions and avoid layout shift during updates.

## Elevation & Depth

Use subtle borders and restrained shadows to separate work regions. Elevation is functional, not decorative.

## Shapes

Panels and controls use small radii (`4px` to `10px`) for a professional desktop-tool aesthetic. Avoid pill-heavy treatments except for status chips.

## Components

Core components include sidebar groups, status chips, task cards, code/diff panes, timeline entries, and browser preview blocks. Primary buttons should always use the tertiary accent and appear only for key workflow actions.

## Do's and Don'ts

- **Do** keep state explicit: provider, mode, workspace, and agent status must stay visible.
- **Do** prioritize readability in split diff and terminal/log surfaces.
- **Do** keep one dominant accent and neutral supporting surfaces.
- **Don't** use bright gradients or ornamental graphics in core work panels.
- **Don't** hide destructive or high-impact actions behind implicit clicks.
- **Don't** collapse the desktop shell into a single chat column.
