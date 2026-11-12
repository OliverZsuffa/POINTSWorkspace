# Implementation Plan 07: Workspace Shell and PWA

## Goal

Build the application shell, responsive workspace layout and offline installable PWA behaviour.

## Scope

### Included

- Application workspace shell.
- Desktop editor and renderer panels.
- Resizable and rearrangeable panels.
- Hide and restore panels.
- Generator panel below the main panels.
- Phone and tablet navigation between Editor and Renderer.
- Responsive controls and touch support at shell level.
- PWA manifest, service worker and offline application loading.
- Consistent global styling and reusable UI primitives.

### Excluded

- Editor notation logic.
- Renderer scene and playback.
- Generator search logic.
- Sequence serialization and persistence implementation.

## Proposed approach

Follow the agreed visual direction in the design direction document. Keep the workspace compact and notation focused. Do not add decorative copy or filler labels.

On desktop, place editor and renderer side by side with approximately equal initial width. Support resizing, swapping, hiding and restoring panels. The generator sits below the main panels and can be pulled up when needed. Do not implement detached windows or additional predefined layouts.

On phones, show Editor and Renderer through separate tabs. Tablets use the phone layout model. Do not remove functionality based on screen size. Provide touch alternatives for workspace controls.

The application must work offline after the first successful load. Cache the application shell and required static assets. Ensure updates do not leave the user with a broken mixture of old and new application assets.

## Files and components

| File or area | Planned change |
|---|---|
| src/app/ | Application shell and view switching |
| src/components/layout/ | Panels, dividers and responsive workspace |
| src/components/ui/ | Reusable buttons, menus and shared controls |
| src/styles/ | Global Sass tokens and layout styling |
| public/ | Manifest and PWA assets |
| Service worker configuration | Offline caching and update handling |

## Steps

1. Inspect design references and define shared layout tokens.
2. Build desktop workspace shell with placeholder feature slots.
3. Implement panel resize, swap, hide and restore.
4. Implement generator lower panel.
5. Implement phone and tablet Editor and Renderer tabs.
6. Ensure shell interactions work with touch and keyboard.
7. Configure PWA manifest and service worker.
8. Implement offline caching and update handling.
9. Test installation and offline reload on supported browsers.

## Verification

- [ ] Formatting
- [ ] Linting
- [ ] TypeScript strict type check
- [ ] Automated tests
- [ ] Production build
- [ ] Desktop layout and panel interaction tests
- [ ] Phone and tablet responsive tests
- [ ] Keyboard and touch accessibility checks
- [ ] Offline reload after first successful load
- [ ] PWA installation checks

## Dependencies

Package 01. The shell can use placeholder feature components until editor, renderer and generator packages are integrated.

## Risks and open questions

- Exact breakpoints and tablet behaviour need testing on real devices.
- Remembering workspace layout between sessions is undecided.
- PWA update strategy must protect locally stored sequence data.
- Mobile editing gestures must be coordinated with the editor agent.

## Approval

Status: Awaiting approval

Implementation must not begin until this plan is explicitly approved.
