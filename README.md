# Fizbane's Forge

A comprehensive Dungeons & Dragons character creator application built with Electron.

## Prerequisites

- Node.js (v16 or higher recommended)
- npm or yarn

## Installation

1. Clone or download this repository.
2. Install dependencies:
   ```
   npm install
   ```
   This will automatically:
   - Install all npm packages
   - Set up Electron app dependencies
   - Copy Bootstrap and FontAwesome assets to app/assets/

## Required Data Files

This application requires D&D 5e data files (JSON format) to be placed in the `src/data/` directory. These files are **not included** in the repository due to size and licensing considerations.

### Data File Structure

Under `src/data/`, include:
- Character classes (`class/`)
- Spells (`spells/`)
- Items and equipment (`items.json`, `items-base.json`)
- Races (`races.json`)
- Backgrounds (`backgrounds.json`)
- Other game data files

**Note:** Provide your own D&D 5e data from licensed sources. If you search the 5eTools Community Wiki (https://wiki.tercept.net/en/home) carefully, you may find compatible JSON resources.

## Development

### Running the Application

```bash
npm start
```

### Running in Debug Mode

```bash
npm run debug
```

### Code Quality

- **Format code:** `npm run format`
- **Lint code:** `npm run lint`
- **Check formatting:** `npm run check:format`
- **Check linting:** `npm run check:lint`

### Running Tests

All tests use Playwright for end-to-end testing with the Electron app:

```bash
npx playwright test
```

This will run all specs in the `tests/` directory, including:

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