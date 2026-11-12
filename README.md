# POINTS Workspace

A web based workspace for creating and working with POINTS notation.

## Project direction

The application is being migrated from the existing Godot prototype to a browser based application. Its visual direction combines the interface design of [Bone008/jif-web](https://github.com/Bone008/jif-web) with the colour identity of the [POINTS website](https://pointscs.github.io/).

See [Design Direction](docs/DESIGN_DIRECTION.md) for the agreed visual and technical references. The proposed agent work packages are documented in [Implementation Work Packages](docs/implementation/README.md).

## Technology stack

- React 18
- TypeScript
- Vite
- Sass
- ESLint
- Prettier
- Vitest
- React Testing Library

The initial project scaffold and shared domain model are available on the [implementation/01-foundation-domain-model branch](https://github.com/OliverZsuffa/POINTSWorkspace/tree/implementation/01-foundation-domain-model).

## Local development

Requires Node.js 20 or newer.

```sh
npm install
npm run dev
```

Available checks:

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

## Development workflow

Work is plan first. A written implementation plan must be added to the repository and explicitly approved before implementation begins. See [Workflow](docs/WORKFLOW.md) and the [implementation plan template](docs/IMPLEMENTATION_PLAN_TEMPLATE.md).
