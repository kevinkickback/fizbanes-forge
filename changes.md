updateImportsOnFileMove/electron
  main.js
  preload.js
  ipc/
    fileSystem.js        // load/save character files
    settings.js          // settings persistence
    dataLoader.js        // interface between renderer & dataloader.js
  rules/
    dataloader.js        // core logic to load 5eTools JSON files
    data/                // raw 5eTools JSON dump (races, classes, etc.)

/renderer
  index.html
  styles/
  scripts/
    app.js
    router.js

    utils/
      dom.js
      validators.js
      calculators.js     // stat mods, proficiency, spell slots, etc.
      filters.js         // search/filter helpers for huge 5eTools lists

    state/
      character.js       // in-memory character, mutations
      storage.js         // load/save via IPC
      rules.js           // renderer-level rule helper functions
                         // (uses window.api.rules.*)

    pages/
      home/
        home.html
        home.js

      build/
        build.html
        build.js
        sections/
          race.js
          subrace.js
          class.js
          subclass.js
          abilityScores.js
          proficiencies.js
          background.js
          feats.js
          equipment.js

      details/
        details.html
        details.js

      magic/
        magic.html
        magic.js

      settings/
        settings.html
        settings.js
