// Predefined dialogue and educational text for "The River, the Dockyard and Dusk". No AI, just a script.
// Wording is deliberately careful: this is a historically inspired riverside trading area, not a confirmed Mohenjo-daro dockyard.
export const MERCHANT = 'Rudra the river merchant';
export const MERCHANTS = { trader: 'Mira the boat merchant', weigh: 'Tarun the weigher', map: 'Sena the trader' };

export const SCRIPT = {
  welcome: [
    'Welcome to the river! The Indus and its tributaries were the roads of this land. People settled beside them, farmed their floodplains, and moved goods along them.',
    'One note before we start. The famous excavated dockyard belongs to Lothal, far to the south-east in Gujarat. No dockyard like it is confirmed at Mohenjo-daro, so think of this place as a riverside trading area inspired by the evidence.',
  ],
  menuQuestion: 'What would you like to do?',
  menu: { cargo: 'Help load a trading boat', weigh: 'Visit the weighing station', map: 'Explore the trade routes map', journey: 'Take a river journey by boat', dusk: 'Watch the sun go down', free: 'I will look around on my own' },
  menuDone: 'Is there anything else you would like to see?',

  cargo: {
    greet: ['Hello, friend! We are getting this boat ready to leave. Archaeological evidence suggests that goods moved between settlements by many means: on foot, by ox-cart and by boat.',
      'Could you help me load it? The goods are lined up on the pier. Pick each one up, carry it over and set it down inside the boat.'],
    hint: 'Click and hold a trade good, drag it over the boat, then let go to set it down.',
    thanks: ['Thank you, that is everything! Grain, beads, pots and woven goods, all stowed.',
      'Rivers make heavy loads easier to move, and that helps explain why so many settlements grew beside them.'],
    departing: 'Off she goes. Remember that this was only one way of moving goods. Plenty travelled overland too.',
    early: 'No harm done. The goods will be waiting whenever you like.',
    repeat: 'The boat has not come back yet. Give it a little while, then we can load it again.',
    stop: 'Stop loading', done: 'Loaded',
  },
  weigh: {
    greet: ['Welcome to my weighing station! Traders need to agree on how much of something they are buying.',
      'Archaeologists have found many small stone weights across Harappan sites, mostly cubes of a hard stone called chert. They follow a regular set of ratios, so a trader in one town could weigh like a trader in another.',
      'Try it! Put goods on the left pan, then add weights to the right pan until the beam is level.'],
    done: 'Level! You have the idea. The stone weights found at many Harappan sites fall into a consistent system, which researchers read as a sign of shared standards.',
    early: 'We can weigh more whenever you like.',
  },
  map: {
    greet: ['Trade did not stop at the edge of a settlement. Archaeological evidence suggests that materials and finished goods moved between the Indus region and many other places.',
      'This map shows some of the raw materials and the general directions of exchange that researchers have reconstructed. Take a look. Choose a material or a region to read about it.'],
    after: ['The arrows show general directions of movement. They are not a single route, and not everything travelled by boat.',
      'Rivers and coastal waters did help. A boat can carry a heavy load far more easily than a person, so waterways like this one mattered. Shall we take a boat ride on the river?'],
  },
  journey: {
    ask: 'The boat can take us along the river. It is only a short ride. Would you like to climb aboard?',
    boardChoices: { yes: 'Yes, let us go aboard', no: 'Not just now' },
    leave: 'End the journey',
    // lines shown during the ride, in order
    lines: [
      'Rivers like the Indus brought water, rich silt for farming and a ready route for moving people and goods.',
      'Many Harappan settlements grew up near rivers. Archaeologists use the pattern of sites to understand how people lived and moved.',
      'River boats were probably flat-bottomed and suited to shallow water. We know them mainly from clay models and seal images, so details are partly reconstruction.',
      'Not all trade went by water. Ox-carts, which clay models also show, and porters carried goods across land.',
      'Evidence of exchange with regions as far as Mesopotamia exists, though we cannot say which exact routes any one object took.',
      'Look at the sky. The sun is sinking towards the horizon, and the lamps along the quay will soon be lit.',
    ],
    end: 'And we are back. Rivers shaped where people lived, and how far their goods could go.',
  },
  dusk: {
    ask: 'The day is almost over. Shall we watch the sun go down over the river?',
    choices: { yes: 'Yes, watch the sunset', no: 'Not yet' },
    line: 'Look how the light changes. The traders are finishing their work, the boats are settling in for the night and the lamps are being lit. You can keep exploring.',
    back: 'It is still evening. Walk along the quay as long as you like.',
  },
  farewell: 'Come back whenever you like. The river is always busy.',
};

// -------- the weighing station
// Cubical chert weights from Harappan sites are widely reported to follow ratios such as 1, 2, 4, 8, 16, 32, 64 (then a decimal-like series).
export const WEIGHTS = [1, 2, 4, 8, 16, 32];
export const GOODS = [
  { id: 'beads', name: 'A bag of beads', icon: '📿', units: 11, say: 'These beads weigh eleven units. Try 8, 2 and 1.' },
  { id: 'grain', name: 'A basket of grain', icon: '🌾', units: 20, say: 'Grain by weight is fairer than by the heap. Twenty units this time.' },
  { id: 'copper', name: 'A copper ingot', icon: '🟧', units: 37, say: 'Copper was precious. This ingot weighs thirty-seven units.' },
];
export const WEIGH_INFO = [
  { title: 'Harappan standard weights', text: 'Many small cubical weights, mostly of chert, have been found at Harappan sites. Their masses fall into a regular series of ratios, such as 1, 2, 4, 8, 16, 32 and 64, and then larger steps. Researchers often estimate the basic unit at roughly 0.85 grams, though estimates vary.' },
  { title: 'Their role in trade', text: 'A trusted set of weights lets two people agree on a quantity of valuable goods, such as beads, metal or spices, without arguing. Weights are often found with seals and in places connected with craft and exchange.' },
  { title: 'Why consistent measurement mattered', text: 'If every town used a different unit, exchange over distance would be hard. A shared system makes goods comparable between traders, towns and regions.' },
  { title: 'Evidence of organised practice', text: 'Similar weights turn up across a very large area, and Harappan bricks also follow regular proportions. Researchers read this as evidence of shared standards. How they were enforced, and by whom, is still discussed.' },
];

// -------- the map panel (image is the supplied reference, used unchanged)
export const MAP_TITLE = 'HARAPPAN TRADE ROUTES & RAW MATERIALS';
export const MAP_NOTE = 'The arrows on the map summarise general directions of exchange that researchers have reconstructed. They are not documented shipping routes, and not every connection was by boat. Where the sources of a material are uncertain, scholars still debate them.';
export const MATERIALS = [
  { id: 'lapis', icon: '🔷', title: 'Lapis lazuli', text: 'A deep blue stone used for beads and inlay. On this map its sources are marked in northern Afghanistan. Lapis beads are found at Harappan sites, and a Harappan settlement at Shortugai in northern Afghanistan is often connected with this trade. The map also marks sodalite, which is often confused with lapis.' },
  { id: 'carnelian', icon: '🟠', title: 'Carnelian', text: 'A red-orange stone. The map marks high-quality carnelian in Gujarat and nearby areas. Craftspeople shaped long, polished carnelian beads, and beads of Harappan style have been found far away, including in Mesopotamian graves. Heating and careful drilling were part of the craft.' },
  { id: 'agate', icon: '🟡', title: 'Agate and jasper', text: 'Banded agate and jasper are hard, attractive stones. The map marks them in several parts of the Indus region and nearby uplands. They were worked into beads and ornaments, and show how craftspeople used many stones from different places.' },
  { id: 'copper', icon: '🔺', title: 'Copper', text: 'Used to make tools, vessels, mirrors and bangles. The map marks copper in several regions, including the western hills, Rajasthan and Oman. Researchers continue to study which sources supplied which objects.' },
  { id: 'gold', icon: '🟨', title: 'Gold', text: 'Gold jewellery has been found at Harappan sites. The map marks gold in the north-west, in Afghanistan and Central Asia. Gold was probably valued for ornaments, though its exact sources are debated.' },
  { id: 'shell', icon: '🐚', title: 'Shell', text: 'Large sea shells from the coast were cut into bangles, beads and inlay. The map marks shell along the coasts of Makran, Kutch and Gujarat. Shell objects found far inland show that coastal materials reached inland towns.' },
  { id: 'tin', icon: '⭐', title: 'Tin', text: 'Tin mixed with copper makes bronze. The map marks tin in Afghanistan and Central Asia. Most Harappan metal objects are copper or low-tin bronze, and where the tin came from is still debated.' },
  { id: 'steatite', icon: '⚪', title: 'Steatite', text: 'A soft stone that is easy to carve and hardens when fired. Many Indus seals were made of steatite, as were small beads. The map marks steatite sources in several upland areas.' },
  { id: 'chert', icon: '🟪', title: 'Chert', text: 'A hard, fine-grained stone used for blades and, as the weighing station shows, for many Harappan weights. The map marks chert in Sindh and nearby areas.' },
  { id: 'leadsilver', icon: '🔹', title: 'Lead and silver', text: 'Lead and silver often occur together in ore. The map marks them in the western uplands and north-west. Silver vessels and ornaments are rarer finds than copper objects, so they were probably valuable.' },
];
export const REGIONS = [
  { id: 'indus', icon: '🌾', title: 'The Indus region', text: 'The heartland of the civilisation, with its plains, rivers and cities. More than a thousand Harappan sites have been identified, from large towns like Mohenjo-daro and Harappa to small villages. Settlements near rivers and fertile land were connected by streets, tracks and waterways.' },
  { id: 'afghan', icon: '⛰', title: 'Afghanistan and Central Asia', text: 'Mountainous regions to the north-west. The map marks sources of lapis lazuli, tin and gold here. A Harappan settlement at Shortugai in northern Afghanistan suggests organised links with the area. These routes crossed mountains, so much of the movement must have been overland.' },
  { id: 'west', icon: '🏔', title: 'Baluchistan and the western hills', text: 'The hills west of the Indus plain hold several of the stones and metals on the map, such as copper, steatite and agate. Links between highland and lowland communities existed long before the cities appeared.' },
  { id: 'coast', icon: '🌊', title: 'Coasts and shell', text: 'Along the Makran coast and the Gulf of Kutch, coastal communities supplied shell, and some Harappan settlements stood on the coast. At Lothal in Gujarat a large brick basin has been interpreted by many researchers as a dock, though others suggest different uses.' },
  { id: 'oman', icon: '⛵', title: 'Oman and the Arabian Sea', text: 'Across the Gulf of Oman lies the Oman peninsula, which the map marks for copper. Harappan-style objects, such as carnelian beads, have been found in Oman. This is evidence of exchange across the sea, though it does not tell us the route of any single voyage.' },
  { id: 'meso', icon: '🏺', title: 'Mesopotamia', text: 'West of this map, in the land of Sumer and Akkad. Harappan seals and carnelian beads have been found in Mesopotamian cities such as Ur, and Mesopotamian texts mention a distant land called Meluhha, which many scholars connect with the Indus region. Evidence of exchange is clear, but it does not prove direct contact between particular places.' },
];

// -------- one fun fact per merchant: shown when the visitor clicks a person
export const FACTS = [
  'I need to sail for Mesopotamia as soon as my grain is ready. Travellers say they call our land Meluhha over there.',
  'My cousin makes carnelian beads. Drilling one long bead takes days, and beads like his have turned up in far-off graves.',
  'Have you noticed that bricks all over the city are nearly the same shape? Builders seem to share the same measures.',
  'Many houses here have their own well and bathing room. Archaeologists have counted hundreds of wells at Mohenjo-daro.',
  'I carry a seal of carved steatite. The little pictures and signs on it are still unread. Nobody can say what they say.',
  'Cotton cloth is prized. Scraps of cotton thread have actually been found at Mohenjo-daro, which is very old evidence for cotton.',
  'Shell bangles come from the coast, and you see them on wrists everywhere, even far from the sea.',
  'My weights are small stone cubes. People say similar ones have been found in towns hundreds of kilometres away.',
  'Our children play with toys of baked clay: little carts, whistles and animals. Some of them have survived to this day.',
  'Oxen pull our carts, and clay models of those carts have been found. That is how we know what they looked like.',
  'Covered drains run beside our streets. For its time, this city looks after its water very carefully.',
  'The name Mohenjo-daro is a modern one, said to mean "mound of the dead". We do not know what the city was called then.',
  'A tiny bronze figure of a dancing girl was found here. It is only about ten centimetres tall, but people remember it well.',
  'Copper and bronze tools are made in our workshops. The metal itself came from far away, as the map shows.',
];

// -------- what each trade good was used for in trade, and with whom (shown when it is picked up)
export const CARGO_INFO = {
  sack: { title: 'Sack of grain', use: 'Wheat and barley were staple crops of the Indus plains, and large storehouses suggest grain was collected and kept in quantity. Sacks and baskets were easy to stack and carry by hand, ox-cart or boat.', who: 'Mostly local exchange between farming villages, towns and cities. Whether grain was sent abroad is not known from the evidence.' },
  beads: { title: 'Basket of beads', use: 'Carnelian, agate, lapis, steatite and shell beads were made in specialist workshops. Small, light and valuable, they suited long-distance exchange.', who: 'Beads in Harappan style have been found in Mesopotamian cities such as Ur and at sites around the Gulf, which suggests exchange with those regions, though not along any single known route.' },
  jar: { title: 'Pottery jar', use: 'Large jars held and moved grain, water and other liquids. Painted and plain jars are among the commonest finds at Harappan sites.', who: 'Mainly households and markets within the Indus region. A few Harappan-style vessels have been reported from Gulf sites such as Oman, so some travelled further.' },
  bowls: { title: 'Pottery bowls', use: 'Bowls and dishes were everyday tableware, made in great numbers on the potter\'s wheel. Pottery was cheap to make, so most of it was probably used close to where it was made.', who: 'Local households and neighbouring towns that bought from potters\' workshops. Pottery is not usually thought to have been the main reason for long voyages.' },
  basket: { title: 'Basket of woven goods', use: 'Woven baskets carried light goods such as cloth or dried food. Baskets rarely survive, but mat and basket impressions appear on pot bases, and cotton thread has been found at Mohenjo-daro.', who: 'Local markets and neighbouring regions. Impressions on clay sealings from some sites suggest bundles of goods were sealed by merchants, but no particular trading partner can be named.' },
};
