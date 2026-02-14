# IPC Contracts

This document lists current IPC channels, handler locations, request parameters, and response shapes, based on the implemented code in main process. Use preload-exposed APIs in renderer; do not call `ipcRenderer` directly.

## Character
- **Save**: [src/main/ipc/channels.js](src/main/ipc/channels.js#L11-L17) → [src/main/ipc/CharacterHandlers.js](src/main/ipc/CharacterHandlers.js#L8)
  - Request: `{ characterData: object|string }`
  - Response: `{ success: true, path } | { success: false, error }`
- **Load**: [channels](src/main/ipc/channels.js#L12) → [CharacterHandlers](src/main/ipc/CharacterHandlers.js#L35)
  - Request: `id: string`
  - Response: `{ success: true, character: object } | { success: false, error }`
- **List**: [channels](src/main/ipc/channels.js#L15) → [CharacterHandlers](src/main/ipc/CharacterHandlers.js#L44)
  - Request: none
  - Response: `{ success: true, characters: object[] } | { success: false, error, characters: [] }`
- **Delete**: [channels](src/main/ipc/channels.js#L12) → [CharacterHandlers](src/main/ipc/CharacterHandlers.js#L82)
  - Request: `id: string`
  - Response: `{ success: true } | { success: false, error }`
- **Export**: [channels](src/main/ipc/channels.js#L14) → [CharacterHandlers](src/main/ipc/CharacterHandlers.js#L101)
  - Request: `id: string`
  - Response: `{ success: true, path } | { success: false, error | canceled }`
- **Import**: [channels](src/main/ipc/channels.js#L13) → [CharacterHandlers](src/main/ipc/CharacterHandlers.js#L133)
  - Request: `{ sourceFilePath?: string, character?: object, action?: 'overwrite'|'keepBoth'|'cancel' }`
  - Response: `{ success: true, character } | { success: false, error | canceled | duplicateId, ...conflictInfo }`
- **Generate UUID**: [channels](src/main/ipc/channels.js#L16) → [CharacterHandlers](src/main/ipc/CharacterHandlers.js#L244)
  - Request: none
  - Response: `{ success: true, data: string }`

## Data
- **Load JSON**: [channels](src/main/ipc/channels.js#L39) → [src/main/ipc/DataHandlers.js](src/main/ipc/DataHandlers.js#L102)
  - Request: `fileName: string` (relative to configured data root; must end with `.json`)
  - Response: `{ success: true, data } | { success: false, error }`
- **Get Source**: [channels](src/main/ipc/channels.js#L40) → [DataHandlers](src/main/ipc/DataHandlers.js#L326)
  - Request: none
  - Response: `{ success: true, type, value }`
- **Validate Source**: [channels](src/main/ipc/channels.js#L42) → [DataHandlers](src/main/ipc/DataHandlers.js#L344)
  - Request: `{ type: 'local'|'url', value: string }`
  - Response: `{ success: true } | { success: false, error }`
- **Refresh Source**: [channels](src/main/ipc/channels.js#L41) → [DataHandlers](src/main/ipc/DataHandlers.js#L337)
  - Request: none
  - Response: `{ success: true, downloaded, skipped } | { success: false, error }`
- **Check Default**: [channels](src/main/ipc/channels.js#L43) → [DataHandlers](src/main/ipc/DataHandlers.js#L315)
  - Request: none
  - Response: `{ success: true, hasDefaultData: boolean }`
- **Download Progress (event)**: [channels](src/main/ipc/channels.js#L44) → sent via `event.sender.send`
  - Payload: `{ status: 'start'|'progress'|'complete'|'error', total, completed, file?, skipped?, success?, error? }`

## Settings
- **Get Path (value)**: [channels](src/main/ipc/channels.js#L28) → [src/main/ipc/SettingsHandlers.js](src/main/ipc/SettingsHandlers.js#L15)
  - Request: `key: string` (must be one of allowed keys)
  - Response: raw value | `{ success: false, error }`
- **Set Path (value)**: [channels](src/main/ipc/channels.js#L29) → [SettingsHandlers](src/main/ipc/SettingsHandlers.js#L21)
  - Request: `key: string`, `value: any`
  - Response: `{ success: true } | `{ success: false, error }`
- **Get All (filtered)**: [channels](src/main/ipc/channels.js#L30) → [SettingsHandlers](src/main/ipc/SettingsHandlers.js#L27)
  - Request: none
  - Response: `{ [key]: value }` limited to allowed keys
- **Util: App Path**: [channels](src/main/ipc/channels.js#L46) → [SettingsHandlers](src/main/ipc/SettingsHandlers.js#L35)
  - Request: none
  - Response: `string`
- **Util: User Data**: [channels](src/main/ipc/channels.js#L47) → [SettingsHandlers](src/main/ipc/SettingsHandlers.js#L39)
  - Request: none
  - Response: `string`

## Files & Portraits
- **Select Folder**: [channels](src/main/ipc/channels.js#L19) → [src/main/ipc/FileHandlers.js](src/main/ipc/FileHandlers.js#L15)
  - Request: none
  - Response: `{ success: true, path } | { success: false, error | canceled }`
- **Read JSON**: [channels](src/main/ipc/channels.js#L20) → [FileHandlers](src/main/ipc/FileHandlers.js#L36)
  - Request: `filePath: string` (must resolve under allowed roots)
  - Response: `{ success: true, data } | { success: false, error }`
- **Write JSON**: [channels](src/main/ipc/channels.js#L21) → [FileHandlers](src/main/ipc/FileHandlers.js#L50)
  - Request: `filePath: string`, `data: object`
  - Response: `{ success: true } | { success: false, error }`
- **Exists**: [channels](src/main/ipc/channels.js#L22) → [FileHandlers](src/main/ipc/FileHandlers.js#L69)
  - Request: `filePath: string`
  - Response: `{ success: true, exists: boolean }`
- **Open**: [channels](src/main/ipc/channels.js#L23) → [FileHandlers](src/main/ipc/FileHandlers.js#L84)
  - Request: `filePath: string`
  - Response: `{ success: true } | { success: false, error }`
- **Portraits List**: [channels](src/main/ipc/channels.js#L34) → [FileHandlers](src/main/ipc/FileHandlers.js#L95)
  - Request: `dirPath: string` (must be under portraits root)
  - Response: `{ success: true, files: string[] } | { success: false, error }`
- **Portraits Save**: [channels](src/main/ipc/channels.js#L35) → [FileHandlers](src/main/ipc/FileHandlers.js#L134)
  - Request: `portraitsDir: string`, `imageData: string|Buffer`, `fileName: string`
  - Response: `{ success: true, filePath, fileName } | { success: false, error }`

## Notes
- Renderer must go through preload bridges (e.g., `window.app`, `window.characterStorage`) per architecture in [docs/CODEBASE_ARCHITECTURE.md](docs/CODEBASE_ARCHITECTURE.md#L1). Do not call IPC directly in UI.
- For contract changes, update both handler and preload bridging. Channels list is the single source of truth in [src/main/ipc/channels.js](src/main/ipc/channels.js).
