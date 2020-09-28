// Fetch cards from undercards
const shuffle = require('./util/shuffle');

const cards = [];

exports.load = () => {
  return Promise.resolve();
};

exports.pick = (rarity = 'any', type = 'mix') => {
  const subset = cards.filter((card) => validateRarity(card, rarity) && validateType(card, type));
  shuffle(subset);
  return subset[0];
};

function validateRarity({rarity: cardRarity = ''}, rarity = '', baseIsCommon = true) {
  switch(rarity.toLowerCase()) {
    case 'determination':
    case 'dt': return cardRarity === 'DETERMINATION';
    case 'legendary':
    case 'legend': return cardRarity === 'DETERMINATION';
    case 'epic': return cardRarity === 'EPIC';
    case 'rare': return cardRarity === 'RARE'
    case 'common': return cardRarity === 'COMMON' || baseIsCommon && cardRarity === 'BASE';
    case 'base': return cardRarity === 'BASE';
    case 'any': return true;
    default: return false;
  }
}

function validateType({type: cardType = ''}, type = '') {
  switch(type.toLowerCase()) {
    case 'deltarune':
    case 'dr': return cardType === 'DELTARUNE';
    case 'base':
    case 'undertale':
    case 'ut': return cardType === 'BASE';
    case 'mix': return true;
    default: return false;
  }
}
