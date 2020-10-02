require('dotenv').config();
const cards = require('./src/cards');
const Discord = require('eris');
const Draft = require('./src/draft');
const loadPrefixes = require('./src/util/loadPrefixes');
const parseArray = require('./src/util/parseArray');
const parseFlags = require('./src/util/parseFlags');
const shuffle = require('./src/util/shuffle');
const Command = require('./src/command');

const token = process.env.TOKEN;
const prefixes = loadPrefixes(process.env.PREFIXES, ['@mention', '!']);
const userRegex = /<@(\d+)>/g;

const connection = new Discord.Client(token);

let currentDraft = null; // TODO: temporary

connection.on('messageCreate', (msg) => {
  if (!(msg.channel instanceof Discord.GuildChannel)) return;
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
  const command = args.shift() || '';

  if (!command) return;
  msg.prefix = prefix;
  msg.command = command;
  connection.emit(`command:${command.toLowerCase()}`, getContext(msg), args, flags);
});

cards.load()
  .then(() => connection.connect())
  .then(() => console.log('Connected'))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

// TODO: Move to commands folder
const commands = [new Command({
  title: 'Start Draft',
  alias: ['start', 'startdraft', 'draft'],
  usage: '<@user1> [... @userX]',
  description: 'Start a draft',
  flags: [{
    alias: ['cardThreshold', 'threshold', 'cards'],
    usage: '<#>',
    default: 40,
    description: 'Build a deck of at least X size.',
  }, {
    alias: ['packSize', 'size'],
    usage: '<#>',
    default: 8,
    description: 'Make packs X size.',
  }, {
    alias: ['packs'],
    usage: '<ut | dr | mix>',
    default: `['dr', 'dr']`,
    description: 'Set pack type for the round.',
  }, {
    alias: ['defaultPack', 'default'],
    usage: '<ut | dr | mix>',
    default: 'ut',
    description: 'Set default pack type',
  }],
  handler: startDraft,
}), new Command({
  title: 'Clear Draft',
  alias: ['stop', 'clear', 'cleardraft'],
  description: 'Stop a draft, delete associated channels.',
  handler: clear,
}), new Command({
  title: 'Pick Card',
  alias: ['pick', 'pickcard', 'choose', 'choosecard'],
  usage: '<#>',
  description: 'Pick a card.',
  handler: chooseCard,
}), new Command({
  title: 'Kick User(s)',
  alias: ['kick'],
  usage: '<@user1> [... @userX]',
  description: 'Kick user(s)',
  handler: kickUser,
})];

commands.forEach((command) => {
  command.alias.forEach((alias) => {
    connection.on(`command:${alias}`, command.handler)
  });
});

function startDraft(context, args = [], flags = {}) {
  if (currentDraft && currentDraft.running) {
    if (currentDraft.running !== 'finished') {
      return context.reply(`Sorry, there's already a draft in progress.`);
    } else { // TODO: Temporary until multi-draft allowed
      return context.reply('Please clear current draft before starting new draft.');
    }
  }
  // Create Category, Create sub-channels
  const users = findUsers(args.join(' ')).map((id) => context.guild.members.get(id) || id);
  if (!users.length) {
    return context.reply('Malformed command. Users required.');
  }
  currentDraft = new Draft(connection, context.guild, {
    owner: context.user,
    users: shuffle(users),
    cardThreshold: flags.threshold || flags.cardThreshold || flags.cards,
    packSize: flags.packSize || flags.size,
    packs: parseArray(flags.packs, false),
    defaultPack: flags.defaultPack || flags.default,
  }).on('cleared', (err) => {
    if (!err) currentDraft = null;
  });

  currentDraft.emit('start', context);
}

function kickUser(context, args = []) {
  if (!currentDraft) return;
  const users = findUsers(args.join(' ')).map((id) => context.guild.members.get(id) || id);
  currentDraft.emit('kick', context, users);
}

function chooseCard(context, args = []) {
  if (!currentDraft) return;
  currentDraft.emit('pick', context, args[0]);
}

function clear(context) {
  if (!currentDraft) return context.reply('No draft ongoing');
  currentDraft.emit('clear', context);
}

function findUsers(string = '') { // TODO: Also find user IDs that aren't specifically pings
  return [...new Set(Array.from(string.matchAll(userRegex), m => m[1])).values()];
}

function getContext(msg) {
  return {
    msg,
    user: msg.author,
    channel: msg.channel,
    guild: msg.channel.guild,
    guildID: msg.guildID || msg.channel.guild.id,
    reply(content) {
      return connection.createMessage(msg.channel.id, content)
        .catch(console.error);
    }
  };
}
