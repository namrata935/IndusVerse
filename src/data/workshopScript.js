// Predefined dialogue for the Harappan Artisan Workshop. No AI, just a fixed script.
export const ARTISAN = 'Dhanya the artisan';

export const SCRIPT = {
  greet: [
    'Welcome, traveller! You have arrived at my workshop in Mohenjo-daro.',
    'Here, our artisans transform simple materials into objects of beauty and purpose. We work with clay, stone, wax and metal to create vessels, seals and sculptures.',
    'Come inside! I would be delighted to show you our crafts.',
  ],
  greetButton: 'Follow the artisan inside ›',
  intro: [
    'Welcome to my workshop!',
    'Our civilisation is known not only for its remarkable cities and drainage systems, but also for the skill of its craftsmen.',
    'We shape clay into vessels, carve stone into seals and work with metals to create beautiful objects.',
    'Today, I shall show you three of our important crafts. You may choose whichever interests you most!',
  ],
  tour: {
    pottery: 'Over here is the potter’s corner, where we create and decorate everyday clay vessels.',
    seal: 'At the long bench, we carve distinctive animal motifs and symbols into stone seals.',
    bronze: 'And by the furnace, you can learn how sculptures like the famous Dancing Girl were made in bronze.',
  },
  ask: 'Which craft would you like to explore first?',
  choices: { pottery: 'I want to make pottery.', seal: 'I want to create a seal.', bronze: 'I want to learn bronze casting.' },
  station: {
    pottery: [
      'Welcome to the potter’s corner! Pottery matters a great deal to us. We use vessels for storing grain, carrying water, cooking and so many everyday tasks.',
      'Let us make a vessel together, and you shall decorate it yourself.',
    ],
    seal: [
      'This is where we make seals. Small square seals carved from stone were probably used in trade and to show who owned something.',
      'Let me show you two famous kinds, and then you may carve a seal of your own.',
    ],
    bronze: [
      'Now, let us explore the art of bronze casting!',
      'Our craftsmen work with metals to create tools, ornaments and sculptures.',
      'One remarkable example is the bronze figure known today as the Dancing Girl, discovered right here at Mohenjo-daro.',
      'Let me show you how a sculpture like this could be created using the lost-wax casting technique.',
    ],
  },
  begin: 'Begin ›',
  done: {
    pottery: 'Wonderful! A fine vessel, made and painted by your own hands. Our potters would be proud of it.',
    seal: 'Splendid work! Your seal will leave its mark wherever you press it.',
    bronze: 'Now you have seen how a bronze sculpture is born, from wax to metal. Those craftsmen were truly masters of their art.',
  },
  early: 'Take your time. You are welcome to come back to this bench whenever you like.',
  more: 'Would you like to try another craft?',
  moreChoices: { pottery: 'Pottery making', seal: 'Seal making', bronze: 'Bronze casting', finish: 'I have seen enough, thank you!', stay: 'Let me look around the workshop' },
  farewell: [
    'Thank you for visiting my workshop. May your journey through Mohenjo-daro be a happy one!',
  ],
  farewellChoices: { menu: 'Return to the main menu', stay: 'Keep exploring the workshop' },
};
