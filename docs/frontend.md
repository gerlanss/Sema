# User Experience Quality

When Sema governs a UI, dashboard, app, site, game, or terminal tool, the
experience must be modern, contextual, and verified. This is a quality gate, not
decoration.

## Before Building

Define:

- audience and domain
- primary workflow
- density and information hierarchy
- interaction states
- responsive behavior
- accessibility basics
- evidence needed before closing

## Browser Evidence

For web UI, check desktop and mobile. On a narrow viewport such as 390px, this
must be true:

```js
document.documentElement.scrollWidth <= document.documentElement.clientWidth
```

Fix overlapping text, broken wrapping, hidden controls, and incoherent layout
before closing the change.

## Terminal Evidence

For CLI/TUI work, smoke-check:

- `--help`
- success output
- error output
- JSON output when supported

The public Sema CLI itself must stay local-only and must not depend on private
or sensitive operational material for these checks.
