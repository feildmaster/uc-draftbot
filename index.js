require('dotenv').config();
const cards = require('./src/cards');
const Discord = require('eris').Client;
const parseFlags = require('./src/util/parseFlags');

const token = process.env.TOKEN;
const prefixes = loadPrefixes();

const connection = new Discord(token);

connection.on('messageCreate', (msg) => {
  // TODO: flags to bypass self/bots
  const ignoreSelf = msg.author.id === connection.user.id;
  const ignoreBots = msg.author.bot;
  if (ignoreSelf || ignoreBots) return;
  
  const filtered = msg.content.replace(/<@!/g, '<@');
  const from = prefixes.map((pref) => pref.replace('@mention', connection.user.mention)).filter(_ => _);
  const prefix = from.find((pref) => filtered.startsWith(pref));
  
  if (!prefix) return;
  const {
    message: rawText = '',
    flags = {},
  } = parseFlags(filtered.substring(prefix.length));

  const args = rawText.split(/\s+/g);
  const command = (args.shift() || '').toLowerCase();

  if (!command) return;
  msg.prefix = prefix;
  msg.command = command;
  connection.emit(`command:${command}`, msg, rawText, args, flags);
});

cards.load()
  .then(() => connection.connect());

connection.on('command:start', startDraft);
connection.on('command:startDraft', startDraft);

function startDraft(msg, rawText, args, flags) {
  // Create Category, Create sub-channels
}

function kickUser(msg, rawText, args, flags) {}

function chooseCard(msg, rawText, args, flags) {}

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
