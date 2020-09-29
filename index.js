require('dotenv').config();
const cards = require('./src/cards');
const Discord = require('eris').Client;

const token = process.env.TOKEN;
const prefixes = loadPrefixes();

const connection = new Discord(token);

connection.on('messageCreate', (msg) => {
  // TODO: flags to bypass self/bots
  const ignoreSelf = msg.author.id === connection.user.id;
  const ignoreBots = msg.author.bot;
  if (ignoreSelf || ignoreBots) return;
  
  const filtered = msg.content.replace(/<@!/g, '<@');
  // TODO: @mention handling is wrong, probably (too tired for this)
  msg.prefix = prefixes.find((pref) => filtered.startsWith(pref === '@mention' ? connection.user.mention : pref));
  // TODO: Parse command
});

cards.load()
  .then(() => connection.connect());

function startDraft() {
  // Create Category, Create sub-channels
}

function kickUser() {}

function chooseCard() {}

function openPack() {} // NOTE: not necessary, simulate vanilla pack opening

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
