// Predefined dialogue and point-of-interest text for the Town Planning guide. No AI, just a script.
export const GUIDE = 'Veda the city guide';

export const SCRIPT = {
  welcome: [
    'Welcome to Mohenjo-daro! Our city is carefully planned, with straight streets, houses, wells and drains.',
  ],
  menuQuestion: 'Where would you like to begin?',
  menu: { tour: 'Show me around the city', house: 'Take me inside a Harappan house', overview: 'Citadel vs Lower Town', free: 'I will explore on my own' },
  tourFollow: 'Follow me, and I will show you something.',
  tourNext: 'Shall we go on?',
  tourChoices: { next: 'Yes, continue the tour', stop: 'Let me explore for now' },
  houseIntro: [
    'Let us look inside a typical Harappan home. Come in through the doorway, and I will meet you inside.',
  ],
  overviewIntro: [
    'Mohenjo-daro is often described as having two parts: a raised western mound, the Citadel, and a larger Lower Town. Let us see how they differ.',
  ],
  farewell: 'Come and find me whenever you would like to hear more. Enjoy exploring!',
};

// Each point of interest: a title, a short explanation, and extra context from the guide.
export const POIS = {
  mainStreet: {
    title: 'Main Streets',
    text: 'The widest streets ran in straight lines and crossed one another at right angles. They were wide enough for ox-carts to pass.',
    guide: 'Smaller lanes branch off them and divide the city into blocks, which is what gives Mohenjo-daro its grid-like feel.',
  },
  lanes: {
    title: 'Lanes',
    text: 'Narrow lanes, only a few metres wide, linked the houses to the main streets. The blocks between them held rows of houses.',
    guide: 'Archaeologists describe a broadly planned street layout, though not every street is perfectly straight or regular.',
  },
  houses: {
    title: 'Residential Area',
    text: 'Houses were built of baked brick, usually with flat roofs and few openings on the street side. Many were arranged around a central courtyard.',
    guide: 'Bricks of similar proportions were used across the city, which suggests shared building practices.',
  },
  streetWell: {
    title: 'A Neighbourhood Well',
    text: 'Wells stood in streets and inside houses. Water close to home mattered a great deal in a hot, dry climate.',
    guide: 'Archaeologists have found a great many wells across the city, lined with carefully shaped bricks.',
  },
  drains: {
    title: 'Street Drains',
    text: 'Brick-lined drains ran along the streets, often covered with bricks or stone slabs, so waste water could flow away.',
    guide: 'Houses, streets and drains worked together: household outlets joined the street drains, and inspection covers let workers clear blockages.',
  },
  houseDoor: {
    title: 'A Harappan House',
    text: 'A plain street wall with a single doorway. Most of the life of the house happened inside, around the courtyard.',
    guide: 'Few windows faced the street, which gave the family privacy and kept the house cooler.',
  },
  courtyard: {
    title: 'The Courtyard',
    text: 'The open courtyard was the heart of the house. It let in light and fresh air, and was probably used for cooking, work and family life.',
    guide: 'Rooms opened onto the courtyard rather than the street, which is a common pattern in the houses archaeologists have excavated.',
  },
  rooms: {
    title: 'Rooms Around the Courtyard',
    text: 'Several rooms were arranged around the courtyard for sleeping, resting and storing goods. Mats, jars and baskets would have furnished them.',
    guide: 'We cannot be sure which room was used for what, so this furnishing is an informed reconstruction.',
  },
  kitchen: {
    title: 'Kitchen and Storage',
    text: 'A hearth, grinding stones and storage jars suggest where food was prepared and kept.',
    guide: 'Grinding stones like these have been found in many Indus houses.',
  },
  houseWell: {
    title: 'The Household Well',
    text: 'Many houses had their own well, so the family could draw water without leaving home.',
    guide: 'Water was used for drinking, cooking, washing and bathing, so a private well was a real convenience.',
  },
  bath: {
    title: 'Bathing Area',
    text: 'A brick-floored bathing area with a floor drain. Waste water ran out through a channel in the wall and into the street drain.',
    guide: 'This link between house and street drain is one of the most remarkable features of the city’s planning.',
  },
};

export const OVERVIEW = {
  citadel: {
    title: 'The Citadel',
    text: 'The Citadel is the raised mound on the western side of the city. It stood on a massive platform of mud and baked brick, high above the plain. Large structures found here, such as the Great Bath, suggest public or monumental use.',
    guide: 'Scholars still debate how each building was used, and the names we give them are modern.',
  },
  lower: {
    title: 'The Lower Town',
    text: 'East of the Citadel lies the larger Lower Town. Archaeologists have found streets in a broadly regular grid here, with blocks of houses, wells and drains.',
    guide: 'Everyday life did not stop at an invisible line, so this is a simplification. Workshops and public spaces may have been found in both areas.',
  },
  compare: {
    title: 'Citadel and Lower Town side by side',
    text: 'Both parts belonged to one city. Look at how they differ in position, buildings and character.',
    guide: 'These are general patterns, and the boundaries in this model are simplified.',
    rows: [
      ['Position', 'A raised mound on the west', 'Lower ground to the east, a larger area'],
      ['Buildings', 'Large, monumental structures such as the Great Bath', 'Houses, courtyards, wells and workshops'],
      ['Streets', 'Open platform with big buildings', 'Main streets and lanes in a grid, with drains'],
      ['Character', 'Often interpreted as public or ceremonial', 'Residential and everyday city life'],
    ],
  },
};
