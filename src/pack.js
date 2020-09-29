const cards = require('./cards');
const random = require('./util/random');

function defaultRandomizer() {
  const needle = random(10000);
  if (needle < 3) {
    return 'determination';
  } else if (needle < 100) {
    return 'legendary';
  } else if (needle < 1500) {
    return 'epic';
  } else if (needle < 5000) {
    return 'rare';
  }
  return 'common';
}

module.exports = (size = 8, type = 'mix', {
  randomizer = defaultRandomizer,
  baseIsCommon = true,
} = {}) => {
  const pack = [];
  for (let i = 0, l = size * 3; pack.length < size && i < l; i++) { // Allow up to 3x the pack size to meet the pack size
    const card = cards.pick(randomizer(), type, baseIsCommon);
    if (card) {
      pack.push(card);
    }
  }
  return pack;
};
