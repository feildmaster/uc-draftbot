require('dotenv').config();
const cards = require('./src/cards');
const Discord = require('eris');
const Draft = require('./src/draft');
const parseArray = require('./src/util/parseArray');
const parseFlags = require('./src/util/parseFlags');
const shuffle = require('./src/util/shuffle');

const token = process.env.TOKEN;
const prefixes = loadPrefixes();
const userRegex = /<@(\d+)>/g;

const connection = new Discord.Client(token);

let currentDraft = null; // TODO: temporary

connection.on('messageCreate', (msg) => {
  if (!(msg instanceof Discord.GuildChannel)) return;
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
  .then(() => connection.connect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });;

connection.on('command:start', startDraft);
connection.on('command:startdraft', startDraft);
connection.on('command:draft', startDraft);

function startDraft(msg, rawText = '', args = [], flags = {}) {
  const context = getContext(msg);
  if (currentDraft && currentDraft.running) {
    if (currentDraft.running !== 'finished') {
      return context.reply(`Sorry, there's already a draft in progress.`);
    }
  }
  // Create Category, Create sub-channels
  const users = findUsers(args.join(' ')).map((id) => msg.guild.members.get(id) || id);
  if (!users.length) {
    return context.reply('Malformed command. Users required.');
  }
  const packs = parseArray(flags.packs, false);
  currentDraft = new Draft(connection, msg.guild, {
    owner: msg.author,
    users: shuffle(users),
    cardThreshold: flags.threshold,
    packSize: flags.packSize || flags.size,
    packs,
    defaultPack: flags.defaultPack,
  });

  currentDraft.emit('start', context);
}

function kickUser(msg, rawText, args, flags) {}

function chooseCard(msg, rawText, args, flags) {}

function findUsers(string = '') {
  return [...new Set(Array.from(rawText.matchAll(userRegex), m => m[1])).values()];
}

function getContext(msg) {
  return {
    msg,
    user: msg.author,
    guildID: msg.guild.id,
    reply(content) {
      return connection.createMessage(msg.channel.id, content);
    }
  };
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
