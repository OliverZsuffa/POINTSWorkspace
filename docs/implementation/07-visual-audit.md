# Package 07 Visual Audit

## Scope

This audit records the rendered baseline and the first correction pass for the workspace, editor and renderer. It is based on browser screenshots produced by the CI viewport review at desktop, tablet and phone sizes, including a ten participant circle passing scene.

The audit distinguishes observed presentation defects from domain and simulation limitations. It does not treat an automated screenshot as final user approval.

## Baseline findings

### Workspace structure

1. The editor and renderer were presented as separate full width views rather than as the intended desktop workspace.
2. The editor controls occupied a narrow vertical sidebar, leaving substantial unused horizontal space.
3. Initial object positions were expanded by default and consumed a large amount of vertical space, especially with many performers.
4. The renderer and editor did not have a consistent panel hierarchy.
5. Tablet and phone needed a clear view switching model.

### Sequence editor

1. The notation grid used small cells and the timeline headers did not consistently match the cell dimensions.
2. The toolbar used a vertical layout that reduced the width available to the notation grid.
3. In circle passing mode, equivalent A, B and C positions were repeated for every participant even though only one pattern is authored.
4. Initial object distribution controls dominated the page when many participants were configured.
5. Target fields did not consistently identify the performer who owned a position.
6. Notation symbols needed a strict square cell model with action edges drawn directly on the cell boundaries.

### Sequence renderer

1. The default camera angle was too low for the intended top down presentation.
2. Larger circle arrangements could be clipped by the camera framing.
3. The table was not guaranteed to be a polygon with exactly one side per circle participant.
4. Performer spacing and table position spacing needed to account for the number of positions assigned to each performer.
5. Performers needed to be closer to the table while retaining enough space to avoid overlap.

## First correction pass

### Workspace

1. Desktop now displays the editor and renderer side by side.
2. The divider can be dragged and supports keyboard arrow resizing.
3. Panels can be swapped, hidden and restored.
4. Phone and tablet use Editor and Renderer tabs.
5. The initial positions section is collapsed by default.
6. The editor toolbar is arranged above the notation grid rather than in a left sidebar.
7. The default application background is neutral.

### Editor

1. Notation cells use a responsive square size: 56 px on desktop, 52 px on tablet and 44 px on phone.
2. The timeline headers use the same cell width.
3. LIFT, HOLD and LEAVE are represented by their edge states. HOLD and ZIP are not printed as words inside the cells.
4. Target labels identify the owning performer.
5. Circle passing displays one representative Pattern and one People count control.
6. Equivalent circle position definitions are represented once in the settings panel.
7. The toolbar supports Ctrl click additive selection and deletion through the Delete button, Delete key or Backspace.
8. Typing a target letter on a selected cell updates the target and converts HOLD to BOUNCE or an empty cell to TAP as specified.

### Renderer

1. Circle passing uses a regular polygon whose side count equals the participant count.
2. Ten participant screenshot review shows ten performers around a decagonal table, with the full arrangement visible.
3. Performer anchors are closer to the table.
4. Table position spacing and rectangular seat spacing are derived from the number of owned positions.
5. The camera now starts much closer to a top down view and scales its distance with the scene size.
6. HOLD leaves the hand and held object at rest.

## Verification evidence

The CI run associated with commit `1b28d2450db4ea0bc73afd05c2d994e901d654bc` passed formatting, lint, TypeScript, unit tests, production build and browser checks. Its screenshots were reviewed. A later run built the PWA assets successfully, but its first offline reload assertion did not find the application root. The offline test now checks the actual precache entries and is being rerun.

That screenshot review identified one additional desktop issue: the toolbar retained an old full height minimum, causing the editor grid to be pushed out of view. The minimum height has been removed. A fresh screenshot review is required to verify that correction.

The ten participant screenshot from the same run shows the polygonal table and all ten performers within the scene. No obvious performer or table position overlap is visible at that participant count.

## Remaining review items

1. Review the desktop editor screenshot after the toolbar sizing correction.
2. Review the desktop editor and renderer together at narrow and wide panel proportions.
3. Review phone and tablet renderer tabs, including scene framing and playback controls.
4. Review a larger circle with more than ten participants.
5. Verify all notation action types and edge combinations visually.
6. Verify light and dark themes.
7. Verify the PWA manifest, install flow, offline reload and waiting update behaviour.
8. Verify the deployed GitHub Pages build after merge.

No item above is considered complete until the corresponding current build has been reviewed.
