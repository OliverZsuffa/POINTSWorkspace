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
5. Circle passing displays one representative Pattern. The visual participant count is configured in the renderer, not as additional authored performers.
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

The final CI run `43393713807`, on the merged Package 07 head, passed formatting, lint, TypeScript, all 109 unit tests, the production build and all 10 Playwright browser tests. The final screenshots were reviewed.

The offline test initially exposed that the cached HTML loaded but the React application did not mount. The service worker now matches cached resources while ignoring response Vary differences. The final offline reload returned HTTP 200, restored the full application interface and passed the browser assertion. The screenshot `07-pwa-offline-reload.png` records the restored interface while offline.

That screenshot review identified one additional desktop issue: the toolbar retained an old full height minimum, causing the editor grid to be pushed out of view. The minimum height has been removed. A fresh screenshot review is required to verify that correction.

The ten participant screenshot from the same run shows the polygonal table and all ten performers within the scene. No obvious performer or table position overlap is visible at that participant count.

## Final verification results

1. Desktop layout reviewed at 1440 × 900 and 1280 × 800.
2. Tablet layout reviewed at 1024 × 768 and 768 × 1024.
3. Phone layout reviewed at 390 × 844 and 320 × 700.
4. Desktop editor and renderer are displayed side by side, with the divider and panel controls tested.
5. Phone Editor and Renderer tabs tested, including renderer canvas sizing after tab switching.
6. Ten participant circle passing screenshot reviewed. The table is a decagon, all ten performers are visible, and no obvious performer or position marker overlap is visible.
7. Circle passing uses one authored pattern. The expanded simulation model is a renderer side projection and was verified by unit tests.
8. Square notation cells and action edge rendering are present in the reviewed screenshots.
9. The offline reload browser test passed. The app shell, JavaScript and stylesheet resources are available offline after first load.
10. The app manifest and icon are included in the production build.

## Remaining follow up

1. Verify the GitHub Pages deployment itself after merge. The CI production build and offline browser test passed, but they are not a substitute for opening the newly deployed public site.
2. Verify installation and offline reload in an additional browser beyond Chromium.
3. The solo renderer scene occupies relatively little of its panel compared with the circle scene. This is a visual refinement opportunity, not a geometry or overlap failure.
4. Light and dark theme visual review remains separate from the current screenshot evidence.

No item above is considered complete until the corresponding current build has been reviewed.


## Package 07C corrections

Package 07C was merged through PR #16 on 13 November 2026.

1. Circle passing is selectable with one authored performer. The editor retains one pattern row, while the renderer has an independent visual juggler count control.
2. The renderer projects the authored pattern onto each visual participant. The visual count does not create extra authored performers, notation rows or balls.
3. Three visual participants use a triangular table with nine distinct table positions. Geometry tests check separation between all nine positions.
4. The vertical camera orbit direction is reversed. Horizontal orbit and camera panning logic remain unchanged.
5. Ball identity is retained when the final state of one playback cycle becomes the initial state of the next. A regression test verifies two objects that exchange positions retain their identities and locations.
6. New sequences now start with four beats. Existing sequence lengths are not rewritten.
7. The beat slider uses boundary values. Zero is the initial state, one is the state after beat one, and the final boundary displays the completed final beat.
8. Looping is enabled by default and can still be disabled.
9. Browser tests capture both three participant and ten participant circle scenes. The test suite also covers the six responsive viewports and the existing workspace and offline workflows.

The complete Package 07C automated verification run passed formatting, lint, strict TypeScript, unit tests, production build and Chromium browser tests. The three and ten participant screenshots were generated by CI. Manual inspection of those two screenshots and manual camera orbit testing remain outstanding.
