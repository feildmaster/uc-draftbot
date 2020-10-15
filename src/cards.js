const needle = require('needle');
const shuffle = require('./util/shuffle');

const cards = [];

exports.load = () => {
  return needle('https://undercards.net/AllCards').then((res) => {
    if (res.body && res.body.cards) {
      return JSON.parse(res.body.cards);
    }
  }).then((res) => {
    if (res) {
      if (cards.length) cards.splice(0, cards.length); // Clear cards
      cards.push(...res);
    }
  });
};

exports.pick = (rarity = 'any', type = 'mix', baseIsCommon = true) => {
  const subset = cards.filter((card) => validateRarity(card, rarity, baseIsCommon) && validateType(card, type));
  shuffle(subset);
  return subset[0];
};

function validateRarity({rarity: cardRarity = ''}, rarity = '', baseIsCommon = true) {
  switch(rarity.toLowerCase()) {
    case 'determination':
    case 'dt': return cardRarity === 'DETERMINATION';
    case 'legendary':
    case 'legend': return cardRarity === 'LEGENDARY';
    case 'epic': return cardRarity === 'EPIC';
    case 'rare': return cardRarity === 'RARE'
    case 'common': return cardRarity === 'COMMON' || baseIsCommon && cardRarity === 'BASE';
    case 'base': return cardRarity === 'BASE';
    case 'all':
    case 'any': return cardRarity !== 'TOKEN';
    default: return false;
  }
}

function validateType({extension: cardType = ''}, type = '') {
  switch(type.toLowerCase()) {
    case 'deltarune':
    case 'dr': return cardType === 'DELTARUNE';
    case 'base':
    case 'undertale':
    case 'ut': return cardType === 'BASE';
    case 'all':
    case 'any':
    case 'mix': return true;
    default: return false;
  }
}
