# Fizbane's Forge

A comprehensive Dungeons & Dragons character creator application built with Electron.

## Prerequisites

- Node.js (v16 or higher recommended)
- npm or yarn

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```
   npm install
   ```
   This will automatically:
   - Install all npm packages
   - Set up Electron app dependencies
   - Copy Bootstrap and FontAwesome assets to app/assets/

## Required Data Files

This application requires D&D 5e data files (JSON format) to be placed in the `app/data/` directory. These files are **not included** in the repository due to size and licensing considerations.

### Data File Structure

The `app/data/` directory should contain:
- Character classes (`class/`)
- Spells (`spells/`)
- Items and equipment (`items.json`, `items-base.json`)
- Races (`races.json`)
- Backgrounds (`backgrounds.json`)
- And other game data files

**Note:** You must provide your own D&D 5e data files or use data from officially licensed sources.

## Development

### Running the Application

```bash
npm start
```

### Running in Debug Mode

```bash
npm run start:debug
```

### Code Quality

- **Format code:** `npm run format`
- **Lint code:** `npm run lint`
- **Check formatting:** `npm run check:format`
- **Check linting:** `npm run check:lint`

### Running Tests

```bash
npx playwright test tests/unit
npx playwright test tests/e2e
```

## Building

### Development Build (unpacked)

```bash
npm run pack
```

### Production Build

```bash
npm run dist
```

This will create distributable packages for your platform in the `dist/` directory.

## Project Structure

```
fizbanes-forge/
 app/
    main.js              # Electron main process
    preload.js           # Preload script (context bridge)
    index.html           # Application entry point
    assets/              # Static assets (Bootstrap, FontAwesome, images)
    css/                 # Application styles
    data/                # D&D 5e data files (not in repo)
    electron/            # Main process modules
    js/                  # Renderer process JavaScript
    pages/               # HTML pages
 tests/                   # Playwright tests
 package.json
 README.md
```

## License

GPL-3.0-or-later

## Notes

- This is a **local-only** repository (no remote Git repository)
- Third-party assets (Bootstrap, FontAwesome) are installed via npm and copied during installation
- Large data files are excluded from version control
