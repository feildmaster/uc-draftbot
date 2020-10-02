require('dotenv').config();
const cards = require('./src/cards');
const Discord = require('eris');
const Draft = require('./src/draft');
const loadPrefixes = require('./src/util/loadPrefixes');
const parseArray = require('./src/util/parseArray');
const parseFlags = require('./src/util/parseFlags');
const shuffle = require('./src/util/shuffle');

const token = process.env.TOKEN;
const prefixes = loadPrefixes(process.env.PREFIXES, ['@mention', '!']);
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
  connection.emit(`command:${command}`, msg, args, flags);
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
connection.on('command:clear', clear);
connection.on('command:cleardraft', clear);
connection.on('command:choose', chooseCard);
connection.on('command:choosecard', chooseCard);
connection.on('command:pick', chooseCard);
connection.on('command:pickcard', chooseCard);
connection.on('command:kick', kickUser);

function startDraft(msg, args = [], flags = {}) {
  const context = getContext(msg);
  if (currentDraft && currentDraft.running) {
    if (currentDraft.running !== 'finished') {
      return context.reply(`Sorry, there's already a draft in progress.`);
    } else { // TODO: Temporary until multi-draft allowed
      return context.reply('Please clear current draft before starting new draft.');
    }
  }
  // Create Category, Create sub-channels
  const users = findUsers(args.join(' ')).map((id) => msg.guild.members.get(id) || id);
  if (!users.length) {
    return context.reply('Malformed command. Users required.');
  }
  currentDraft = new Draft(connection, msg.guild, {
    owner: context.user,
    users: shuffle(users),
    cardThreshold: flags.threshold || flags.cardThreshold,
    packSize: flags.packSize || flags.size,
    packs: parseArray(flags.packs, false),
    defaultPack: flags.defaultPack || flags.default,
  });

  currentDraft.emit('start', context);
}

function kickUser(msg, args = []) {
  if (!currentDraft) return;
  const context = getContext(msg);
  const users = findUsers(args.join(' ')).map((id) => msg.guild.members.get(id) || id);
  currentDraft.emit('kick', context, users);
}

function chooseCard(msg, args = []) {
  if (!currentDraft) return;
  const context = getContext(msg);
  currentDraft.emit('pick', context, args[0]);
}

function clear(msg) {
  const context = getContext(msg);
  if (!currentDraft) return context.reply('No draft ongoing');
  currentDraft.emit('clear', context);
  currentDraft.once('cleared', (err) => {
    if (!err) currentDraft = null;
  });
}

function findUsers(string = '') { // TODO: Also find user IDs that aren't specifically pings
  return [...new Set(Array.from(string.matchAll(userRegex), m => m[1])).values()];
}

function getContext(msg) {
  return {
    msg,
    user: msg.author,
    channel: msg.channel,
    guildID: msg.guild.id,
    reply(content) {
      return connection.createMessage(msg.channel.id, content);
    }
  };
}
