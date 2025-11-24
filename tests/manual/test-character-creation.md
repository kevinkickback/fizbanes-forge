# Manual Test: Character Creation

## Test Steps

1. Launch the application
2. Click "New Character" or "Create Character" button
3. Fill in character name (e.g., "Test Character")
4. Select at least one source book (e.g., PHB)
5. Click "Create" button

## Expected Results

✅ Character is created successfully
✅ Success notification appears: "New character created successfully"
✅ Character appears in the character list
✅ Character file is saved to disk (.ffp file)
✅ No console errors

## Failure Indicators

❌ Error notification: "Failed to create character"
❌ Error notification: "Failed to generate character ID"
❌ Error notification: "Failed to save character"
❌ Console error: "CharacterManager.loadCharacters is not a function"
❌ Console error: "Cannot read properties of undefined"
❌ Character validation errors for hitPoints

## Test Date: November 24, 2025
**Status:** Testing after Modal.js refactor to use CharacterManager
