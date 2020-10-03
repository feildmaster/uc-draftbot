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
}).on('error', (e) => {
  console.error(e);
  process.exit(1);
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
  alias: ['start', 'startDraft', 'draft'],
  usage: '<@user1> [... @userX]',
  description: 'Start a draft',
  examples: [
    '`<command> @user1 @user2 --deck 30`: Runs draft until deck is at least 30 cards.',
    '`<command> @userX @userY --packs mix --packs mix`: First two packs are mixed ut/dr.',
    '`<command> @player @visitor --defaultPack mix`: Packs will be mixed ut/dr after the preset packs.',
  ],
  flags: [{
    alias: ['cards', 'cardThreshold', 'deck', 'threshold'],
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
  alias: ['stop', 'clear', 'clearDraft'],
  description: 'Stop a draft, delete associated channels.',
  handler: clear,
}), new Command({
  title: 'Draft Status',
  alias: ['status', 'info'],
  description: 'View draft status',
  handler(context, args = []) {
    if (!currentDraft) {
      return context.reply('No draft currently');
    }
    currentDraft.emit('status', context);
  }
}), new Command({
  title: 'Pick Card',
  alias: ['pick', 'pickCard', 'choose', 'chooseCard'],
  usage: '<#>',
  description: 'Pick a card.',
  handler: chooseCard,
}), new Command({
  title: 'Leave Draft',
  alias: ['leave', 'quit'],
  description: 'Leave the draft.',
  handler(context, args = []) {
    if (currentDraft) currentDraft.emit('leave', context);
  },
}), new Command({
  title: 'Kick User(s)',
  alias: ['kick'],
  usage: '<@user1> [... @userX]',
  description: 'Kick user(s)',
  handler: kickUser,
})];

const helpCommand = new Command({
  title: 'Draft Commands',
  alias: ['help'],
  usage: '[command]',
  description: 'Show help text.',
  handler(context, args = []) {
    const command = (args.length && (commands.find((cmd) => cmd.alias.includes(args[0].toLowerCase())) || context.reply('Command not found.'))) || helpCommand;
    if (!(command instanceof Command)) return;
    const label = args.length ? args[0] : context.msg.command;
    const prefix = context.msg.prefix;
    const commandText = `${prefix}${label}`;
    const embed = {
      title: command.title || command.alias[0],
      color: 1794964,
      fields: [{
        name: '❯ Usage',
        value: `\`${commandText}${command.usage ? ` ${command.usage}` : ''}${command.flags.length ? ' [--flags...]' : ''}\``,
      }, {
        name: '❯ Aliases',
        value: command.alias.filter(a => a !== label.toLowerCase()).map(a => `\`${a}\``).join(', ') || '`None`',
      }],
    };

    if (command.description) {
      embed.description = command.description;
    }

    if (command.flags.length) {
      embed.fields.push({
        name: '❯ Flags',
        value: command.flags.map(i => `\`--${i.alias[0]}${i.usage ? ` ${i.usage}` : ''}\` - ${i.description}${i.default ? ` (default: \`${i.default}\`)` : ''}${
          i.alias.length > 1 ? `\n • Aliases: ${i.alias.slice(1).map(a => `\`--${a}\``).join(', ')}` : ''
        }`).join('\n'),
      });
    }

    if (command.examples.length) {
      embed.fields.push({
        name: '❯ Examples',
        value: command.examples.map(a => a.replace('<command>', commandText)).join('\n'),
      });
    }

    if (!args.length && command === helpCommand) {
      embed.fields.push({
        name: '❯ Commands',
        value: commands.filter(_ => _ !== helpCommand)
          // .sort((a, b) => a.alias[0].localeCompare(b.alias[0], 'en', { sensitivity: 'base' }))
          .map(c => `\`${prefix}${c.alias[0]}\`${c.description ? ` - ${c.description.split('\n')[0]}` : ''}`)
          .join('\n'),
      });
    }

    embed.fields.push({
      name: '❯ Legend',
      value: '`<required>, [optional], ...multiple`',
    });
    context.reply({ embed });
  },
});
commands.push(helpCommand);

commands.forEach((command) => {
  command.alias.forEach((alias) => {
    connection.on(`command:${alias.toLowerCase()}`, command.handler)
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
    cardThreshold: flags.threshold || flags.cardThreshold || flags.cards || flags.deck,
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
