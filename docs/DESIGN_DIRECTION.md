# Design Direction

This document records the agreed visual references and technical direction. It intentionally does not specify application functionality.

## Visual references

### Interface reference: Bone008/jif-web

Repository: https://github.com/Bone008/jif-web

Use this project as the reference for the interface's overall feel and presentation:

- Compact, information focused layout.
- Clearly separated content panels and cards.
- Rounded corners and restrained borders.
- Consistent spacing and aligned controls.
- Compact, unobtrusive form controls.
- Responsive behaviour across desktop and mobile.
- Clear hierarchy without unnecessary decoration.
- Inter as the interface font.

The intention is to adopt its visual language, not copy its juggling notation logic or product structure.

### Brand colour reference: POINTS website

Repository: https://github.com/pointscs/pointscs.github.io  
Website: https://pointscs.github.io/

Use the Workspace editor's agreed blue palette. This supersedes the original turquoise website palette for the application interface.

| Role | Colour |
|---|---|
| Main brand colour | `#3569BD` |
| Secondary brand colour | `#7FA5E8` |
| Light blue surface | `#D9E6FB` |
| Light text / neutral | `azure` / white |
| Dark text | `#161616` to `#222222` |

These values are taken from the website's stylesheet. The final interface should use the POINTS palette consistently for backgrounds, accents, interactive states, and supporting surfaces.

## Combined direction

The result should look and feel structurally like Bone008's interface, but clearly belong to POINTS.

- Keep Bone008's compact, card based layout and restrained component styling.
- Replace its purple colour palette with the POINTS turquoise palette.
- Do not retain the purple colours as a secondary brand palette.
- Keep the interface clean and functional rather than decorative.
- Prioritise responsive behaviour and visual consistency.

## Technology stack

The planned stack follows the foundations used by Bone008/jif-web:

| Area | Technology |
|---|---|
| UI framework | React 18 |
| Language | TypeScript |
| Development server and bundler | Vite |
| Styling | Sass |
| Linting | ESLint |
| Formatting | Prettier |
| Unit and component tests | Vitest and React Testing Library |

Exact dependency versions, scripts, and configuration will be fixed when the application scaffold is created.

## Scope boundary

This document covers only visual direction and the technology stack. Product requirements and detailed functionality will be documented separately before implementation planning.
