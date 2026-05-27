# Tradeo

Tradeo frontend (React + Vite).

## Version

- Source of truth: `package.json` (`version`)
- Build-time injected version: `import.meta.env.VITE_APP_VERSION`
- Visible in the UI: next to the Tradeo logo in the navbar

To check the current version locally:

```bash
npm pkg get version
```

## Development

```bash
npm ci
npm run dev
```

## Tests

```bash
npm test
npm run build
```
