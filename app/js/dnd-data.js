// D&D 5E Data
const dndData = {
    races: {
        human: {
            name: 'Human',
            description: 'Humans are the most adaptable and ambitious people among the common races.',
            quickDesc: 'Versatile and ambitious, humans are known for their adaptability and drive to achieve greatness.',
            imageUrl: './assets/images/races/human.jpg',
            age: 'Humans reach adulthood in their late teens and live less than a century.',
            size: 'Medium',
            speed: 30,
            languages: ['Common', 'One extra language of your choice'],
            traits: [
                {
                    name: 'Versatile',
                    description: 'Humans are adaptable and diverse, able to excel in many different environments and roles.'
                },
                {
                    name: 'Extra Language',
                    description: 'You can speak, read, and write Common and one extra language of your choice.'
                }
            ],
            subraces: {
                standard: {
                    name: 'Standard Human',
                    abilityScoreIncrease: 'All ability scores increase by 1',
                    traits: [
                        {
                            name: 'Versatile',
                            description: 'Humans are adaptable and diverse, able to excel in many different environments and roles.'
                        },
                        {
                            name: 'Extra Language',
                            description: 'You can speak, read, and write Common and one extra language of your choice.'
                        }
                    ]
                },
                variant: {
                    name: 'Variant Human',
                    abilityScoreIncrease: 'Two different ability scores of your choice increase by 1',
                    traits: [
                        {
                            name: 'Skill Proficiency',
                            description: 'You gain proficiency in one skill of your choice.'
                        },
                        {
                            name: 'Feat',
                            description: 'You gain one feat of your choice.'
                        },
                        {
                            name: 'Extra Language',
                            description: 'You can speak, read, and write Common and one extra language of your choice.'
                        }
                    ]
                }
            }
        },
        elf: {
            name: 'Elf',
            description: 'Elves are a magical people of otherworldly grace, living in the world but not entirely part of it.',
            quickDesc: 'Graceful and long-lived, elves are magical beings with an affinity for art and nature.',
            imageUrl: './assets/images/races/elf.jpg',
            abilityScoreIncrease: 'Dexterity +2',
            age: 'Elves reach physical maturity at about 100 and can live to be 750 years old.',
            size: 'Medium',
            speed: 30,
            languages: ['Common', 'Elvish'],
            traits: [
                {
                    name: 'Darkvision',
                    description: 'You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.'
                },
                {
                    name: 'Keen Senses',
                    description: 'You have proficiency in the Perception skill.'
                },
                {
                    name: 'Fey Ancestry',
                    description: 'You have advantage on saving throws against being charmed, and magic can\'t put you to sleep.'
                },
                {
                    name: 'Trance',
                    description: 'Elves don\'t need to sleep. Instead, they meditate deeply for 4 hours a day.'
                }
            ],
            subraces: {
                high: {
                    name: 'High Elf',
                    abilityScoreIncrease: 'Intelligence +1',
                    traits: [
                        {
                            name: 'Cantrip',
                            description: 'You know one cantrip of your choice from the wizard spell list. Intelligence is your spellcasting ability for it.'
                        },
                        {
                            name: 'Extra Language',
                            description: 'You can speak, read, and write one extra language of your choice.'
                        }
                    ],
                    spells: [
                        {
                            name: 'Wizard Cantrip',
                            level: 0,
                            description: 'Choose one cantrip from the wizard spell list.'
                        }
                    ],
                    description: 'High elves have a keen mind and a natural affinity for magic.'
                },
                wood: {
                    name: 'Wood Elf',
                    abilityScoreIncrease: 'Wisdom +1',
                    traits: [
                        {
                            name: 'Fleet of Foot',
                            description: 'Your base walking speed increases to 35 feet.'
                        },
                        {
                            name: 'Mask of the Wild',
                            description: 'You can attempt to hide even when you are only lightly obscured by foliage, heavy rain, falling snow, mist, and other natural phenomena.'
                        }
                    ],
                    speed: 35,
                    description: 'Wood elves are reclusive and at home in the wilderness.'
                },
                drow: {
                    name: 'Dark Elf (Drow)',
                    abilityScoreIncrease: 'Charisma +1',
                    traits: [
                        {
                            name: 'Superior Darkvision',
                            description: 'Your darkvision has a radius of 120 feet.'
                        },
                        {
                            name: 'Sunlight Sensitivity',
                            description: 'You have disadvantage on attack rolls and on Wisdom (Perception) checks that rely on sight when you, the target of your attack, or whatever you are trying to perceive is in direct sunlight.'
                        },
                        {
                            name: 'Drow Magic',
                            description: 'You know the dancing lights cantrip. When you reach 3rd level, you can cast the faerie fire spell once per day. When you reach 5th level, you can also cast the darkness spell once per day.'
                        }
                    ],
                    spells: [
                        {
                            name: 'Dancing Lights',
                            level: 0,
                            description: 'You can create up to four torch-sized lights within range, making them appear as torches, lanterns, or glowing orbs.'
                        },
                        {
                            name: 'Faerie Fire',
                            level: 1,
                            description: 'Each object in a 20-foot cube within range is outlined in blue, green, or violet light (your choice).',
                            availableAtLevel: 3
                        },
                        {
                            name: 'Darkness',
                            level: 2,
                            description: 'Magical darkness spreads from a point you choose within range to fill a 15-foot-radius sphere.',
                            availableAtLevel: 5
                        }
                    ],
                    description: 'Drow are the dark-skinned elves of the Underdark, known for their cruelty and magical abilities.'
                }
            }
        },
        dwarf: {
            name: 'Dwarf',
            description: 'Bold and hardy, dwarves are known as skilled warriors, miners, and workers of stone and metal.',
            quickDesc: 'Hardy and steadfast, dwarves are known for their craftsmanship and resilience.',
            imageUrl: './assets/images/races/dwarf.jpg',
            abilityScoreIncrease: 'Constitution +2',
            age: 'Dwarves mature at the same rate as humans but live about 350 years.',
            size: 'Medium',
            speed: 25,
            languages: ['Common', 'Dwarvish'],
            traits: [
                {
                    name: 'Darkvision',
                    description: 'You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.'
                },
                {
                    name: 'Dwarven Resilience',
                    description: 'You have advantage on saving throws against poison, and you have resistance against poison damage.'
                },
                {
                    name: 'Dwarven Combat Training',
                    description: 'You have proficiency with the battleaxe, handaxe, light hammer, and warhammer.'
                },
                {
                    name: 'Tool Proficiency',
                    description: 'You gain proficiency with the artisan\'s tools of your choice: smith\'s tools, brewer\'s supplies, or mason\'s tools.'
                },
                {
                    name: 'Stonecunning',
                    description: 'Whenever you make an Intelligence (History) check related to the origin of stonework, you are considered proficient in the History skill and add double your proficiency bonus to the check.'
                }
            ],
            subraces: {
                hill: {
                    name: 'Hill Dwarf',
                    abilityScoreIncrease: 'Wisdom +1',
                    traits: [
                        {
                            name: 'Dwarven Toughness',
                            description: 'Your hit point maximum increases by 1, and it increases by 1 every time you gain a level.'
                        }
                    ],
                    description: 'Hill dwarves have keen senses and remarkable resilience.'
                },
                mountain: {
                    name: 'Mountain Dwarf',
                    abilityScoreIncrease: 'Strength +2',
                    traits: [
                        {
                            name: 'Dwarven Armor Training',
                            description: 'You have proficiency with light and medium armor.'
                        }
                    ],
                    description: 'Mountain dwarves are strong and hardy, accustomed to a difficult life in rugged terrain.'
                }
            }
        },
        halfling: {
            name: 'Halfling',
            description: 'The diminutive halflings survive in a world full of larger creatures by avoiding notice or, barring that, avoiding offense.',
            quickDesc: 'Small and nimble, halflings are known for their luck and bravery despite their size.',
            imageUrl: './assets/images/races/halfling.jpg',
            abilityScoreIncrease: 'Dexterity +2',
            age: 'Halflings reach adulthood at age 20 and generally live into the middle of their second century.',
            size: 'Small',
            speed: 25,
            languages: ['Common', 'Halfling'],
            traits: [
                {
                    name: 'Lucky',
                    description: 'When you roll a 1 on an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.'
                },
                {
                    name: 'Brave',
                    description: 'You have advantage on saving throws against being frightened.'
                },
                {
                    name: 'Halfling Nimbleness',
                    description: 'You can move through the space of any creature that is of a size larger than yours.'
                }
            ],
            subraces: {
                lightfoot: {
                    name: 'Lightfoot Halfling',
                    abilityScoreIncrease: 'Charisma +1',
                    traits: [
                        {
                            name: 'Naturally Stealthy',
                            description: 'You can attempt to hide even when you are obscured only by a creature that is at least one size larger than you.'
                        }
                    ],
                    description: 'Lightfoot halflings are capable of remarkable stealth, even using other creatures as cover.'
                },
                stout: {
                    name: 'Stout Halfling',
                    abilityScoreIncrease: 'Constitution +1',
                    traits: [
                        {
                            name: 'Stout Resilience',
                            description: 'You have advantage on saving throws against poison, and you have resistance against poison damage.'
                        }
                    ],
                    description: 'Stout halflings are hardier than average and have some resistance to poison.'
                }
            }
        },
        dragonborn: {
            name: 'Dragonborn',
            description: 'Born of dragons, as their name proclaims, the dragonborn walk proudly through a world that greets them with fearful incomprehension.',
            quickDesc: 'Draconic humanoids with breath weapons and proud warrior traditions.',
            imageUrl: './assets/images/races/dragonborn.jpg',
            abilityScoreIncrease: 'Strength +2, Charisma +1',
            age: 'Young dragonborn grow quickly. They walk hours after hatching, reach the size and development of a 10-year-old human child by the age of 3, and reach adulthood by 15.',
            size: 'Medium',
            speed: 30,
            languages: ['Common', 'Draconic'],
            traits: [
                {
                    name: 'Draconic Ancestry',
                    description: 'You have draconic ancestry. Choose one type of dragon from the Draconic Ancestry table. Your breath weapon and damage resistance are determined by the dragon type.'
                },
                {
                    name: 'Breath Weapon',
                    description: 'You can use your action to exhale destructive energy. Your draconic ancestry determines the size, shape, and damage type of the exhalation. When you use your breath weapon, each creature in the area of the exhalation must make a saving throw, the type of which is determined by your draconic ancestry. The DC for this saving throw equals 8 + your Constitution modifier + your proficiency bonus. A creature takes 2d6 damage on a failed save, and half as much damage on a successful one. The damage increases to 3d6 at 6th level, 4d6 at 11th level, and 5d6 at 16th level. After you use your breath weapon, you can\'t use it again until you complete a short or long rest.'
                },
                {
                    name: 'Damage Resistance',
                    description: 'You have resistance to the damage type associated with your draconic ancestry.'
                }
            ],
            subraces: {
                // Dragonborn don't have traditional subraces, but we can use draconic ancestry
                black: {
                    name: 'Black Dragon Ancestry',
                    description: 'Black dragon ancestry grants acid breath and resistance to acid damage.',
                    traits: [
                        {
                            name: 'Acid Breath',
                            description: 'Your breath weapon is a 5 by 30 ft. line of acid. Creatures in the area must make a Dexterity saving throw.'
                        },
                        {
                            name: 'Acid Resistance',
                            description: 'You have resistance to acid damage.'
                        }
                    ]
                },
                blue: {
                    name: 'Blue Dragon Ancestry',
                    description: 'Blue dragon ancestry grants lightning breath and resistance to lightning damage.',
                    traits: [
                        {
                            name: 'Lightning Breath',
                            description: 'Your breath weapon is a 5 by 30 ft. line of lightning. Creatures in the area must make a Dexterity saving throw.'
                        },
                        {
                            name: 'Lightning Resistance',
                            description: 'You have resistance to lightning damage.'
                        }
                    ]
                },
                brass: {
                    name: 'Brass Dragon Ancestry',
                    description: 'Brass dragon ancestry grants fire breath and resistance to fire damage.',
                    traits: [
                        {
                            name: 'Fire Breath',
                            description: 'Your breath weapon is a 5 by 30 ft. line of fire. Creatures in the area must make a Dexterity saving throw.'
                        },
                        {
                            name: 'Fire Resistance',
                            description: 'You have resistance to fire damage.'
                        }
                    ]
                },
                bronze: {
                    name: 'Bronze Dragon Ancestry',
                    description: 'Bronze dragon ancestry grants lightning breath and resistance to lightning damage.',
                    traits: [
                        {
                            name: 'Lightning Breath',
                            description: 'Your breath weapon is a 5 by 30 ft. line of lightning. Creatures in the area must make a Dexterity saving throw.'
                        },
                        {
                            name: 'Lightning Resistance',
                            description: 'You have resistance to lightning damage.'
                        }
                    ]
                },
                copper: {
                    name: 'Copper Dragon Ancestry',
                    description: 'Copper dragon ancestry grants acid breath and resistance to acid damage.',
                    traits: [
                        {
                            name: 'Acid Breath',
                            description: 'Your breath weapon is a 5 by 30 ft. line of acid. Creatures in the area must make a Dexterity saving throw.'
                        },
                        {
                            name: 'Acid Resistance',
                            description: 'You have resistance to acid damage.'
                        }
                    ]
                },
                gold: {
                    name: 'Gold Dragon Ancestry',
                    description: 'Gold dragon ancestry grants fire breath and resistance to fire damage.',
                    traits: [
                        {
                            name: 'Fire Breath',
                            description: 'Your breath weapon is a 15 ft. cone of fire. Creatures in the area must make a Dexterity saving throw.'
                        },
                        {
                            name: 'Fire Resistance',
                            description: 'You have resistance to fire damage.'
                        }
                    ]
                },
                green: {
                    name: 'Green Dragon Ancestry',
                    description: 'Green dragon ancestry grants poison breath and resistance to poison damage.',
                    traits: [
                        {
                            name: 'Poison Breath',
                            description: 'Your breath weapon is a 15 ft. cone of poisonous gas. Creatures in the area must make a Constitution saving throw.'
                        },
                        {
                            name: 'Poison Resistance',
                            description: 'You have resistance to poison damage.'
                        }
                    ]
                },
                red: {
                    name: 'Red Dragon Ancestry',
                    description: 'Red dragon ancestry grants fire breath and resistance to fire damage.',
                    traits: [
                        {
                            name: 'Fire Breath',
                            description: 'Your breath weapon is a 15 ft. cone of fire. Creatures in the area must make a Dexterity saving throw.'
                        },
                        {
                            name: 'Fire Resistance',
                            description: 'You have resistance to fire damage.'
                        }
                    ]
                },
                silver: {
                    name: 'Silver Dragon Ancestry',
                    description: 'Silver dragon ancestry grants cold breath and resistance to cold damage.',
                    traits: [
                        {
                            name: 'Cold Breath',
                            description: 'Your breath weapon is a 15 ft. cone of cold. Creatures in the area must make a Constitution saving throw.'
                        },
                        {
                            name: 'Cold Resistance',
                            description: 'You have resistance to cold damage.'
                        }
                    ]
                },
                white: {
                    name: 'White Dragon Ancestry',
                    description: 'White dragon ancestry grants cold breath and resistance to cold damage.',
                    traits: [
                        {
                            name: 'Cold Breath',
                            description: 'Your breath weapon is a 15 ft. cone of cold. Creatures in the area must make a Constitution saving throw.'
                        },
                        {
                            name: 'Cold Resistance',
                            description: 'You have resistance to cold damage.'
                        }
                    ]
                }
            }
        },
        tiefling: {
            name: 'Tiefling',
            description: 'To be greeted with stares and whispers, to suffer violence and insult on the street, to see mistrust and fear in every eye: this is the lot of the tiefling.',
            quickDesc: 'Infernal-touched beings with magical aptitude and charismatic presence.',
            imageUrl: './assets/images/races/tiefling.jpg',
            abilityScoreIncrease: 'Charisma +2',
            age: 'Tieflings mature at the same rate as humans but live a few years longer.',
            size: 'Medium',
            speed: 30,
            languages: ['Common', 'Infernal'],
            traits: [
                {
                    name: 'Darkvision',
                    description: 'Thanks to your infernal heritage, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can\'t discern color in darkness, only shades of gray.'
                },
                {
                    name: 'Hellish Resistance',
                    description: 'You have resistance to fire damage.'
                }
            ],
            subraces: {
                asmodeus: {
                    name: 'Asmodeus Tiefling',
                    description: 'The standard tiefling, with a connection to Asmodeus, Lord of the Nine Hells.',
                    abilityScoreIncrease: 'Intelligence +1',
                    traits: [
                        {
                            name: 'Infernal Legacy',
                            description: 'You know the thaumaturgy cantrip. When you reach 3rd level, you can cast the hellish rebuke spell as a 2nd-level spell once with this trait and regain the ability to do so when you finish a long rest. When you reach 5th level, you can cast the darkness spell once with this trait and regain the ability to do so when you finish a long rest. Charisma is your spellcasting ability for these spells.'
                        }
                    ],
                    spells: [
                        {
                            name: 'Thaumaturgy',
                            level: 0,
                            description: 'You manifest a minor wonder, a sign of supernatural power.',
                            availableAtLevel: 1
                        },
                        {
                            name: 'Hellish Rebuke',
                            level: 1,
                            description: 'You point your finger, and the creature that damaged you is momentarily surrounded by hellish flames.',
                            availableAtLevel: 3
                        },
                        {
                            name: 'Darkness',
                            level: 2,
                            description: 'Magical darkness spreads from a point you choose within range to fill a 15-foot-radius sphere.',
                            availableAtLevel: 5
                        }
                    ]
                },
                baalzebul: {
                    name: 'Baalzebul Tiefling',
                    description: 'Tieflings with a connection to Baalzebul have a different set of spells.',
                    abilityScoreIncrease: 'Intelligence +1',
                    traits: [
                        {
                            name: 'Legacy of Maladomini',
                            description: 'You know the thaumaturgy cantrip. When you reach 3rd level, you can cast the ray of sickness spell once per day as a 2nd-level spell. When you reach 5th level, you can also cast the crown of madness spell once per day. Charisma is your spellcasting ability for these spells.'
                        }
                    ],
                    spells: [
                        {
                            name: 'Thaumaturgy',
                            level: 0,
                            description: 'You manifest a minor wonder, a sign of supernatural power.',
                            availableAtLevel: 1
                        },
                        {
                            name: 'Ray of Sickness',
                            level: 1,
                            description: 'A ray of sickening greenish energy lashes out toward a creature within range.',
                            availableAtLevel: 3
                        },
                        {
                            name: 'Crown of Madness',
                            level: 2,
                            description: 'One humanoid of your choice must succeed on a Wisdom saving throw or become charmed by you for the duration.',
                            availableAtLevel: 5
                        }
                    ]
                },
                dispater: {
                    name: 'Dispater Tiefling',
                    description: 'Tieflings with a connection to Dispater have a different set of spells.',
                    abilityScoreIncrease: 'Dexterity +1',
                    traits: [
                        {
                            name: 'Legacy of Dis',
                            description: 'You know the thaumaturgy cantrip. When you reach 3rd level, you can cast the disguise self spell once per day. When you reach 5th level, you can also cast the detect thoughts spell once per day. Charisma is your spellcasting ability for these spells.'
                        }
                    ],
                    spells: [
                        {
                            name: 'Thaumaturgy',
                            level: 0,
                            description: 'You manifest a minor wonder, a sign of supernatural power.',
                            availableAtLevel: 1
                        },
                        {
                            name: 'Disguise Self',
                            level: 1,
                            description: 'You make yourself—including your clothing, armor, weapons, and other belongings on your person—look different.',
                            availableAtLevel: 3
                        },
                        {
                            name: 'Detect Thoughts',
                            level: 2,
                            description: 'You can focus your mind to read the thoughts of certain creatures.',
                            availableAtLevel: 5
                        }
                    ]
                },
                fierna: {
                    name: 'Fierna Tiefling',
                    description: 'Tieflings with a connection to Fierna have a different set of spells.',
                    abilityScoreIncrease: 'Wisdom +1',
                    traits: [
                        {
                            name: 'Legacy of Phlegethos',
                            description: 'You know the friends cantrip. When you reach 3rd level, you can cast the charm person spell once per day as a 2nd-level spell. When you reach 5th level, you can also cast the suggestion spell once per day. Charisma is your spellcasting ability for these spells.'
                        }
                    ],
                    spells: [
                        {
                            name: 'Friends',
                            level: 0,
                            description: 'For the duration, you have advantage on all Charisma checks directed at one creature of your choice that isn\'t hostile toward you.',
                            availableAtLevel: 1
                        },
                        {
                            name: 'Charm Person',
                            level: 1,
                            description: 'You attempt to charm a humanoid you can see within range.',
                            availableAtLevel: 3
                        },
                        {
                            name: 'Suggestion',
                            level: 2,
                            description: 'You suggest a course of activity (limited to a sentence or two) and magically influence a creature you can see within range that can hear and understand you.',
                            availableAtLevel: 5
                        }
                    ]
                },
                glasya: {
                    name: 'Glasya Tiefling',
                    description: 'Tieflings with a connection to Glasya have a different set of spells.',
                    abilityScoreIncrease: 'Dexterity +1',
                    traits: [
                        {
                            name: 'Legacy of Malbolge',
                            description: 'You know the minor illusion cantrip. When you reach 3rd level, you can cast the disguise self spell once per day. When you reach 5th level, you can also cast the invisibility spell once per day. Charisma is your spellcasting ability for these spells.'
                        }
                    ],
                    spells: [
                        {
                            name: 'Minor Illusion',
                            level: 0,
                            description: 'You create a sound or an image of an object within range that lasts for the duration.',
                            availableAtLevel: 1
                        },
                        {
                            name: 'Disguise Self',
                            level: 1,
                            description: 'You make yourself—including your clothing, armor, weapons, and other belongings on your person—look different.',
                            availableAtLevel: 3
                        },
                        {
                            name: 'Invisibility',
                            level: 2,
                            description: 'A creature you touch becomes invisible until the spell ends.',
                            availableAtLevel: 5
                        }
                    ]
                },
                levistus: {
                    name: 'Levistus Tiefling',
                    description: 'Tieflings with a connection to Levistus have a different set of spells.',
                    abilityScoreIncrease: 'Constitution +1',
                    traits: [
                        {
                            name: 'Legacy of Stygia',
                            description: 'You know the ray of frost cantrip. When you reach 3rd level, you can cast the armor of Agathys spell once per day as a 2nd-level spell. When you reach 5th level, you can also cast the darkness spell once per day. Charisma is your spellcasting ability for these spells.'
                        }
                    ],
                    spells: [
                        {
                            name: 'Ray of Frost',
                            level: 0,
                            description: 'A frigid beam of blue-white light streaks toward a creature within range.',
                            availableAtLevel: 1
                        },
                        {
                            name: 'Armor of Agathys',
                            level: 1,
                            description: 'A protective magical force surrounds you, manifesting as a spectral frost that covers you and your gear.',
                            availableAtLevel: 3
                        },
                        {
                            name: 'Darkness',
                            level: 2,
                            description: 'Magical darkness spreads from a point you choose within range to fill a 15-foot-radius sphere.',
                            availableAtLevel: 5
                        }
                    ]
                },
                mammon: {
                    name: 'Mammon Tiefling',
                    description: 'Tieflings with a connection to Mammon have a different set of spells.',
                    abilityScoreIncrease: 'Intelligence +1',
                    traits: [
                        {
                            name: 'Legacy of Minauros',
                            description: 'You know the mage hand cantrip. When you reach 3rd level, you can cast the Tenser\'s floating disk spell once per day. When you reach 5th level, you can also cast the arcane lock spell once per day. Charisma is your spellcasting ability for these spells.'
                        }
                    ],
                    spells: [
                        {
                            name: 'Mage Hand',
                            level: 0,
                            description: 'A spectral, floating hand appears at a point you choose within range.',
                            availableAtLevel: 1
                        },
                        {
                            name: 'Tenser\'s Floating Disk',
                            level: 1,
                            description: 'This spell creates a circular, horizontal plane of force, 3 feet in diameter and 1 inch thick, that floats 3 feet above the ground in an unoccupied space of your choice that you can see within range.',
                            availableAtLevel: 3
                        },
                        {
                            name: 'Arcane Lock',
                            level: 2,
                            description: 'You touch a closed door, window, gate, chest, or other entryway, and it becomes locked for the duration.',
                            availableAtLevel: 5
                        }
                    ]
                },
                mephistopheles: {
                    name: 'Mephistopheles Tiefling',
                    description: 'Tieflings with a connection to Mephistopheles have a different set of spells.',
                    abilityScoreIncrease: 'Intelligence +1',
                    traits: [
                        {
                            name: 'Legacy of Cania',
                            description: 'You know the mage hand cantrip. When you reach 3rd level, you can cast the burning hands spell once per day as a 2nd-level spell. When you reach 5th level, you can also cast the flame blade spell once per day. Charisma is your spellcasting ability for these spells.'
                        }
                    ],
                    spells: [
                        {
                            name: 'Mage Hand',
                            level: 0,
                            description: 'A spectral, floating hand appears at a point you choose within range.',
                            availableAtLevel: 1
                        },
                        {
                            name: 'Burning Hands',
                            level: 1,
                            description: 'As you hold your hands with thumbs touching and fingers spread, a thin sheet of flames shoots forth from your outstretched fingertips.',
                            availableAtLevel: 3
                        },
                        {
                            name: 'Flame Blade',
                            level: 2,
                            description: 'You evoke a fiery blade in your free hand. The blade is similar in size and shape to a scimitar, and it lasts for the duration.',
                            availableAtLevel: 5
                        }
                    ]
                },
                zariel: {
                    name: 'Zariel Tiefling',
                    description: 'Tieflings with a connection to Zariel have a different set of spells.',
                    abilityScoreIncrease: 'Strength +1',
                    traits: [
                        {
                            name: 'Legacy of Avernus',
                            description: 'You know the thaumaturgy cantrip. When you reach 3rd level, you can cast the searing smite spell once per day as a 2nd-level spell. When you reach 5th level, you can also cast the branding smite spell once per day. Charisma is your spellcasting ability for these spells.'
                        }
                    ],
                    spells: [
                        {
                            name: 'Thaumaturgy',
                            level: 0,
                            description: 'You manifest a minor wonder, a sign of supernatural power.',
                            availableAtLevel: 1
                        },
                        {
                            name: 'Searing Smite',
                            level: 1,
                            description: 'The next time you hit a creature with a melee weapon attack during the spell\'s duration, your weapon flares with white-hot intensity.',
                            availableAtLevel: 3
                        },
                        {
                            name: 'Branding Smite',
                            level: 2,
                            description: 'The next time you hit a creature with a weapon attack before this spell ends, the weapon gleams with astral radiance as you strike.',
                            availableAtLevel: 5
                        }
                    ]
                }
            }
        }
    },
    classes: {
        fighter: {
            name: 'Fighter',
            description: 'Fighters share an unparalleled mastery with weapons and armor, and a thorough knowledge of the skills of combat.',
            quickDesc: 'Masters of martial combat, skilled with a variety of weapons and armor.',
            imageUrl: './assets/images/classes/fighter.jpg',
            hitDie: 'd10',
            primaryAbility: 'Strength or Dexterity',
            savingThrows: ['Strength', 'Constitution'],
            armorProficiencies: ['Light Armor', 'Medium Armor', 'Heavy Armor', 'Shields'],
            weaponProficiencies: ['Simple Weapons', 'Martial Weapons'],
            features: {
                1: ['Fighting Style', 'Second Wind'],
                2: ['Action Surge'],
                3: ['Martial Archetype'],
                4: ['Ability Score Improvement']
            },
            subclasses: {
                champion: {
                    name: 'Champion',
                    description: 'The archetypal Champion focuses on the development of raw physical power honed to deadly perfection.',
                    features: ['Improved Critical', 'Remarkable Athlete', 'Additional Fighting Style']
                },
                battlemaster: {
                    name: 'Battle Master',
                    description: 'Battle Masters are fighters who have studied the art of weaponry and combat maneuvers.',
                    features: ['Combat Superiority', 'Student of War', 'Know Your Enemy']
                },
                eldritch: {
                    name: 'Eldritch Knight',
                    description: 'Eldritch Knights combine martial prowess with magical ability, casting spells alongside their weapon attacks.',
                    features: ['Spellcasting', 'Weapon Bond', 'War Magic']
                }
            }
        },
        wizard: {
            name: 'Wizard',
            description: 'Wizards are supreme magic-users, defined and united as a class by the spells they cast.',
            quickDesc: 'Masters of arcane magic, capable of casting powerful spells through study and practice.',
            imageUrl: './assets/images/classes/wizard.jpg',
            hitDie: 'd6',
            primaryAbility: 'Intelligence',
            savingThrows: ['Intelligence', 'Wisdom'],
            armorProficiencies: [],
            weaponProficiencies: ['Daggers', 'Darts', 'Slings', 'Quarterstaffs', 'Light Crossbows'],
            features: {
                1: ['Spellcasting', 'Arcane Recovery'],
                2: ['Arcane Tradition'],
                3: ['Cantrip Formulas'],
                4: ['Ability Score Improvement']
            },
            subclasses: {
                abjuration: {
                    name: 'School of Abjuration',
                    description: 'Abjuration wizards specialize in protective magic and excel at blocking, banishing, and countering spells.',
                    features: ['Abjuration Savant', 'Arcane Ward', 'Projected Ward']
                },
                evocation: {
                    name: 'School of Evocation',
                    description: 'Evocation wizards focus on magic that creates powerful elemental effects such as bitter cold, searing flame, or crackling lightning.',
                    features: ['Evocation Savant', 'Sculpt Spells', 'Potent Cantrip']
                },
                divination: {
                    name: 'School of Divination',
                    description: 'Divination wizards are seers who specialize in discerning the past, present, and future through magic.',
                    features: ['Divination Savant', 'Portent', 'Expert Divination']
                }
            }
        },
        rogue: {
            name: 'Rogue',
            description: 'Rogues rely on skill, stealth, and their foes\' vulnerabilities to get the upper hand in any situation.',
            quickDesc: 'Skilled tricksters and stealthy operatives who excel at finding and disabling traps and picking locks.',
            imageUrl: './assets/images/classes/rogue.jpg',
            hitDie: 'd8',
            primaryAbility: 'Dexterity',
            savingThrows: ['Dexterity', 'Intelligence'],
            armorProficiencies: ['Light Armor'],
            weaponProficiencies: ['Simple Weapons', 'Hand Crossbows', 'Longswords', 'Rapiers', 'Shortswords'],
            features: {
                1: ['Expertise', 'Sneak Attack', 'Thieves\' Cant'],
                2: ['Cunning Action'],
                3: ['Roguish Archetype'],
                4: ['Ability Score Improvement']
            },
            subclasses: {
                thief: {
                    name: 'Thief',
                    description: 'Thieves excel at getting into and out of tight situations using stealth and agility.',
                    features: ['Fast Hands', 'Second-Story Work', 'Supreme Sneak']
                },
                assassin: {
                    name: 'Assassin',
                    description: 'Assassins focus on the grim art of death, using stealth and disguise to eliminate targets.',
                    features: ['Bonus Proficiencies', 'Assassinate', 'Infiltration Expertise']
                },
                arcane: {
                    name: 'Arcane Trickster',
                    description: 'Arcane Tricksters enhance their skills with magic, focusing on enchantment and illusion spells.',
                    features: ['Spellcasting', 'Mage Hand Legerdemain', 'Magical Ambush']
                }
            }
        }
    },
    backgrounds: {
        acolyte: {
            name: 'Acolyte',
            description: 'You have spent your life in the service of a temple to a specific god or pantheon of gods.',
            quickDesc: 'A devoted servant of a temple who has deep knowledge of religious rites and traditions.',
            imageUrl: './assets/images/backgrounds/acolyte.jpg',
            skillProficiencies: ['Insight', 'Religion'],
            languages: ['Two of your choice'],
            equipment: ['Holy symbol', 'Prayer book', 'Stick of incense (5)', 'Vestments', 'Common clothes', 'Belt pouch with 15 gp'],
            feature: 'Shelter of the Faithful'
        },
        criminal: {
            name: 'Criminal',
            description: 'You are an experienced criminal with a history of breaking the law.',
            quickDesc: 'A skilled lawbreaker with connections to the criminal underworld.',
            imageUrl: './assets/images/backgrounds/criminal.jpg',
            skillProficiencies: ['Deception', 'Stealth'],
            toolProficiencies: ['Thieves\' tools', 'One type of gaming set'],
            equipment: ['Crowbar', 'Dark common clothes with hood', 'Belt pouch with 15 gp'],
            feature: 'Criminal Contact'
        },
        noble: {
            name: 'Noble',
            description: 'You understand wealth, power, and privilege.',
            quickDesc: 'A person of high social standing with connections to wealth and power.',
            imageUrl: './assets/images/backgrounds/noble.jpg',
            skillProficiencies: ['History', 'Persuasion'],
            toolProficiencies: ['One type of gaming set'],
            languages: ['One of your choice'],
            equipment: ['Fine clothes', 'Signet ring', 'Scroll of pedigree', 'Purse with 25 gp'],
            feature: 'Position of Privilege'
        }
    },
    skills: [
        { name: 'Acrobatics', ability: 'Dexterity' },
        { name: 'Animal Handling', ability: 'Wisdom' },
        { name: 'Arcana', ability: 'Intelligence' },
        { name: 'Athletics', ability: 'Strength' },
        { name: 'Deception', ability: 'Charisma' },
        { name: 'History', ability: 'Intelligence' },
        { name: 'Insight', ability: 'Wisdom' },
        { name: 'Intimidation', ability: 'Charisma' },
        { name: 'Investigation', ability: 'Intelligence' },
        { name: 'Medicine', ability: 'Wisdom' },
        { name: 'Nature', ability: 'Intelligence' },
        { name: 'Perception', ability: 'Wisdom' },
        { name: 'Performance', ability: 'Charisma' },
        { name: 'Persuasion', ability: 'Charisma' },
        { name: 'Religion', ability: 'Intelligence' },
        { name: 'Sleight of Hand', ability: 'Dexterity' },
        { name: 'Stealth', ability: 'Dexterity' },
        { name: 'Survival', ability: 'Wisdom' }
    ],
    equipment: {
        weapons: {
            simple: {
                melee: [
                    { name: 'Club', damage: '1d4 bludgeoning', price: '1 sp', weight: '2 lb.' },
                    { name: 'Dagger', damage: '1d4 piercing', price: '2 gp', weight: '1 lb.' },
                    { name: 'Quarterstaff', damage: '1d6 bludgeoning', price: '2 sp', weight: '4 lb.' }
                ],
                ranged: [
                    { name: 'Light Crossbow', damage: '1d8 piercing', price: '25 gp', weight: '5 lb.' },
                    { name: 'Shortbow', damage: '1d6 piercing', price: '25 gp', weight: '2 lb.' }
                ]
            },
            martial: {
                melee: [
                    { name: 'Battleaxe', damage: '1d8 slashing', price: '10 gp', weight: '4 lb.' },
                    { name: 'Longsword', damage: '1d8 slashing', price: '15 gp', weight: '3 lb.' },
                    { name: 'Rapier', damage: '1d8 piercing', price: '25 gp', weight: '2 lb.' }
                ],
                ranged: [
                    { name: 'Heavy Crossbow', damage: '1d10 piercing', price: '50 gp', weight: '18 lb.' },
                    { name: 'Longbow', damage: '1d8 piercing', price: '50 gp', weight: '2 lb.' }
                ]
            }
        },
        armor: {
            light: [
                { name: 'Leather', ac: 11, price: '10 gp', weight: '10 lb.' },
                { name: 'Studded leather', ac: 12, price: '45 gp', weight: '13 lb.' }
            ],
            medium: [
                { name: 'Hide', ac: 12, price: '10 gp', weight: '12 lb.' },
                { name: 'Chain shirt', ac: 13, price: '50 gp', weight: '20 lb.' }
            ],
            heavy: [
                { name: 'Chain mail', ac: 16, price: '75 gp', weight: '55 lb.' },
                { name: 'Plate', ac: 18, price: '1,500 gp', weight: '65 lb.' }
            ]
        }
    },
    weapons: {
        longsword: {
            name: 'Longsword',
            damage: '1d8',
            damageType: 'Slashing',
            properties: ['Versatile (1d10)']
        },
        shortbow: {
            name: 'Shortbow',
            damage: '1d6',
            damageType: 'Piercing',
            properties: ['Ammunition', 'Range (80/320)']
        },
        dagger: {
            name: 'Dagger',
            damage: '1d4',
            damageType: 'Piercing',
            properties: ['Finesse', 'Light', 'Thrown (20/60)']
        }
    },
    armor: {
        leather: {
            name: 'Leather Armor',
            ac: '11 + Dex modifier',
            type: 'Light'
        },
        chainmail: {
            name: 'Chain Mail',
            ac: '16',
            type: 'Heavy',
            requirements: 'Str 13'
        },
        shield: {
            name: 'Shield',
            ac: '+2',
            type: 'Shield'
        }
    }
};

// Export the data for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = dndData;
}

// Make data available globally
window.dndData = dndData; 