require('dotenv').config();
const cards = require('./src/cards');
const Discord = require('eris').Client;
const random = require('./src/util/random');

const token = process.env.TOKEN;
const prefixes = loadPrefixes();

const connection = new Discord(token);

connection.on('messageCreate', (msg) => {
  // TODO: flags to bypass self/bots
  const ignoreSelf = msg.author.id === connection.user.id;
  const ignoreBots = msg.author.bot;
  if (ignoreSelf || ignoreBots) return;
  
  const filtered = msg.content.replace(/<@!/g, '<@');
  msg.prefix = prefixes.find((pref) => filtered.startsWith(pref === '@mention' ? connection.user.mention : pref));
  // Parse command
});

cards.load()
  .then(() => connection.connect());

function startDraft() {
  // Create Category, Create sub-channels
}

function kickUser() {}

function chooseCard() {}

function openPack() {} // NOTE: not necessary, simulate vanilla pack opening

function buildPack(size = 8, type='mix') {
  const pack = [];
  for (let i = 0; i < size; i++) {
    pack.push(cards.pick(pickRarity(), type));
  }
  return pack;
}

function pickRarity() {
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

function loadPrefixes() {
  const set = new Set();

  let temp = ['@mention', '!'];
  if (process.env.PREFIX) {
    try {
      temp = JSON.parse(process.env.PREFIX);
    } catch {}
  }
  
  if (Array.isArray(temp)) {
    temp.forEach((e) => set.add(e));
  } else if (typeof temp === 'string') {
    set.add(temp);
  }

  return [...set.values()];
}
