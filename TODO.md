# TODO

## Page Logic
- [ ] Automatically add items from background into user equipment
- [ ] Add more mappings to 2014 PDF generations
- [ ] Fix prepare spell modals incorrect slot numbers
- [ ] Fix subrace names containing the word "variant;"
- [ ] Fix race/class/proficiencies accordian border hover color
- [ ] Fix remove item button reducing the qauntity instead of removing the item
- [ ] Fix Modal block (see below to replicate)

## UI/UX Improvements
- [ ] Add HP and AC display / calculation somewhere in the app
- [ ] Add character portrait image selecttion to details page
- [ ] Fix + / - buttons on character creator modal ability boxes
- [ ] Move attuned item badge next to item name?

## File Management
- [ ] Save files (.ffp) embed portrait images directly, become self containted
      Extract image to user's defined portraits folder on load (if it doesn't exsist already)
      Update portraits path in save file after image extraction if needed

# CHANGELOG
- Added additional character inputs to the Details page
- Enhanced Allies and Organizations with images and improved descriptions
- Added missing starting equipment choices for backgrounds
- Added missing conditional class options (e.g., Dragon element for Draconic Sorcerer)
- Added sub-menu navigation to the Details and Spells pages
- Updated various UI styles, overall layout adjustments.
- Reworked Equipment page (attunement, equipping, quantity, currency, search filters, and more)
- Fixed Spell List tooltips (now only trigger when hovering the spell name)
- Fixed unintended backdrop blocking user interactions (hopefully)
- Various backend improvements and refactoring

# MODAL BLOCK TESTING STEPS
- Step 1: Select 1st character card (on Home)
- Step 2: Navigate to Sepll Page > Open "Add Spell" modal
- Step 3: Add 2 cantrips, 2 leveled spells > close modal
- Step 4: Open level up modal > Toggle "Ignore restrictions" > Add "Wizard" class > Close modal
- Step 5: Open "Add Spell" modal > Spell modal will not appear, ony the dark modal backdrop