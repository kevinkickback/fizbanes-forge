Testing the background selection displays the same results as before:

Urchin
You grew up on the streets alone, orphaned, and poor. You had no one to watch over you or to provide for you, so you learned to provide for yourself. You fought fiercely over food and kept a constant watch out for other desperate souls who might steal from you. You slept on rooftops and in alleyways, exposed to the elements, and endured sickness without the advantage of medicine or a place to recuperate. You've survived despite all odds, and did so through cunning, strength, speed, or some combination of each.

Skill Proficiencies
None
Tool Proficiencies
None
Languages
None
Equipment
None
Feature
City Secrets: You know the secret patterns and flow to cities and can find passages through the urban sprawl that others would miss. When you are not in combat, you (and companions you lead) can travel between any two locations in the city twice as fast as your speed would normally allow.

Thank you for the detailed feedback and the attached code. The issue is now clear:
The new _getBackgroundProficiencies method correctly parses and normalizes the data, but the UI code that displays proficiencies is not compatible with the new normalized structure.
What’s happening?
The new _getBackgroundProficiencies returns:
Apply to preload.js
However, the UI display methods (getFormattedSkillProficiencies, getFormattedToolProficiencies) expect a flat array (e.g., ["Stealth", "Sleight of Hand"]), not the new object structure.
Example:
In getFormattedSkillProficiencies:
Apply to preload.js
Solution
Update the getFormattedSkillProficiencies and getFormattedToolProficiencies methods to support the new normalized structure.
Display all fixed proficiencies.
If there are choices, display them as e.g. “Choose 1 from: X, Y, Z”.
Would you like me to update these formatting methods to support the new structure and display all proficiencies correctly?
yes please update

All linter errors except the one at line 198 (which is unrelated to the formatting methods) are now resolved.
Next Steps
The formatting methods now support the normalized structure and will display:
All fixed proficiencies (e.g., "Stealth, Sleight of Hand")
Any choices (e.g., "Choose 1 from: Arcana, Survival")
"None" if neither are present
Please re-test the Character Build page and select backgrounds like Urchin.
You should now see the correct skill and tool proficiencies displayed.
If you notice any further issues with the display or with other backgrounds, let me know!
when displaying the results for  Proficiencies please list them individually insated of together:

- item 1
- item 2

not:

- item 1, item 2

The formatting for skill and tool proficiencies will now display each proficiency as its own list item (using <li> tags), and choices as a single <li> with the appropriate text. This will render as a proper bulleted list in the UI.
You should now see:
Apply to preload.js
instead of a single comma-separated line.
Next step:
Please reload the Character Build page and verify that the proficiencies are now displayed as individual list items. If you want the HTML to be rendered as actual list items, make sure the UI is not wrapping the output in an extra <li> (it should just insert the HTML directly inside a <ul>).
Let me know if you want to further adjust the formatting or if you see any other issues!
Can you go through the entire codebase and generate a list of things that should be standardized? Things variable naming, comment style, singleton patterns, etc. ?

Here is a list of things that should be standardized across your codebase, based on the patterns and inconsistencies observed in your code and the search results:
1. Singleton Pattern
Pattern: Some classes use a static getInstance() method and a private _instance variable, while others simply export a singleton instance at the end of the file.
Standardize: Choose one approach for all singleton classes. The most robust is:
Private _instance variable.
Private constructor that throws if called directly.
Static getInstance() method.
Export the singleton via export const instance = Class.getInstance();
Example:
Apply to preload.js
2. Variable Naming
Pattern: Some variables use camelCase, others snake_case or PascalCase.
Standardize: Use camelCase for variables and function names, PascalCase for class names, and UPPER_CASE for constants.
Example: backgroundManager, getBackground, MAX_RETRIES, BackgroundCard.
3. Comment Style
Pattern: Some files use JSDoc-style comments, others use plain comments or none at all.
Standardize: Use JSDoc for all public classes, methods, and complex functions. Use // for inline comments.
Example:
Apply to preload.js
4. Export Style
Pattern: Some files use export default, others use named exports, and some export instances directly.
Standardize: Use named exports for classes and singleton instances. Avoid export default unless there is a clear reason.
Example: export class BackgroundManager { ... } and export const backgroundManager = BackgroundManager.getInstance();
5. File Naming
Pattern: Some files are named with PascalCase, others with camelCase or kebab-case.
Standardize: Use PascalCase.js for classes/components, camelCase.js for utilities, or pick one and apply it everywhere.
6. Consistent Use of const and let
Pattern: Some variables that are never reassigned use let instead of const.
Standardize: Use const by default, only use let if the variable will be reassigned.
7. HTML/JSX Output in JS
Pattern: Some methods return HTML strings (e.g., <li>...</li>), others return plain text.
Standardize: If returning HTML, always return valid, complete HTML fragments and document this in the method's JSDoc.
8. Error Handling
Pattern: Some methods use try/catch and log errors, others do not handle errors at all.
Standardize: Use try/catch for all async operations and critical logic, and log errors in a consistent format.
9. Type Definitions
Pattern: Some files use JSDoc typedefs, others do not.
Standardize: Use JSDoc typedefs for all complex objects, especially those passed between modules.
10. Event Naming
Pattern: Event names are sometimes inconsistent (e.g., 'background:selected', 'characterChanged').
Standardize: Use a consistent naming convention for events, such as camelCase or colon:separated.
11. Method Naming for Getters/Setters
Pattern: Some methods are named getX, others just x.
Standardize: Use getX for all getters, setX for all setters.
12. Consistent Indentation and Spacing
Pattern: Some files may use tabs, others spaces, or inconsistent indentation.
Standardize: Use 2 or 4 spaces for indentation, and configure your editor/formatter to enforce this.
13. Consistent Use of Template Literals
Pattern: Some string concatenations use +, others use template literals.
Standardize: Use template literals for all string interpolation.
14. Consistent Handling of Optional/Nullable Values
Pattern: Some code uses ?., others use explicit checks.
Standardize: Use optional chaining (?.) and nullish coalescing (??) where appropriate.
15. Consistent Data Normalization
Pattern: Data normalization (e.g., for proficiencies) is sometimes done in the manager, sometimes in the model.
Standardize: Normalize data as early as possible (ideally in the loader/manager), and document where normalization occurs.
Would you like a checklist or a codestyle document generated for your project based on these recommendations?