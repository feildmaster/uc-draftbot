require('dotenv').config();
const cards = require('./src/cards');
const Discord = require('eris');
const Draft = require('./src/draft');
const loadPrefixes = require('./src/util/loadPrefixes');
const parseArray = require('./src/util/parseArray');
const parseFlags = require('./src/util/parseFlags');
const shuffle = require('./src/util/shuffle');
const Command = require('./src/command');
const Manager = require('./src/draftManager');

const token = process.env.TOKEN;
// TODO: Per-server prefixes
const prefixes = loadPrefixes(process.env.PREFIXES, ['@mention', '!']);
const userRegex = /<@(\d+)>/g;

const connection = new Discord.Client(token);

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

  if (command) connection.emit(`command:${command.toLowerCase()}`, getContext(msg, { rawText, prefix, command }), args, flags);
}).on('error', (e) => {
  console.error(e);
  // process.exit(1);
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
  description: 'Start a draft.',
  examples: [
    '`<command> @user1 @user2 --deck 30`: Runs draft until deck is at least 30 cards.',
    '`<command> @userX @userY --packs mix --packs mix`: First two packs are mixed ut/dr.',
    '`<command> @player @visitor --defaultPack mix`: Packs will be mixed ut/dr after the preset packs.',
    '`<command> @player @visitor --pick 2`: Pick 2 cards each round.',
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
    description: 'Set default pack type.',
  }, {
    alias: ['pick', 'pull'],
    usage: '<#>',
    default: 1,
    description: 'Set amount of cards you can pull per round. This value must be a factor of packSize.',
  }],
  handler: startDraft,
}), new Command({
  title: 'Clear Draft',
  alias: ['stop', 'clear', 'clearDraft'],
  usage: '[id]',
  description: 'Stop a draft, delete associated channels.',
  handler: clear,
}), new Command({
  title: 'Draft Status',
  alias: ['status', 'info'],
  usage: '[id]',
  description: 'View draft status.',
  handler(context, [id] = []) {
    const currentDraft = context.manager.find(context) || id ? context.manager.get(id) : context.manager.first();
    if (currentDraft) currentDraft.emit('status', context);
    else context.reply('No draft currently');
  }
}), new Command({
  title: 'Pick Card',
  alias: ['pick', 'pickCard', 'choose', 'chooseCard'],
  usage: '<# or Card Name>',
  examples: [
    '`<prefix>pick 1`: Choose card one',
    '`<prefix>chooseCard Doggo`: Choose doggo (if exists)',
  ],
  description: 'Pick a card.',
  handler: chooseCard,
}), new Command({
  title: 'Leave Draft',
  alias: ['leave', 'quit'],
  description: 'Leave the draft.',
  handler(context, args = []) {
    const currentDraft = context.manager.find(context, { user: true, wide: true });
    if (currentDraft) currentDraft.emit('leave', context);
    else context.reply('Not participating in any drafts.');
  },
}), new Command({
  title: 'Kick User(s)',
  alias: ['kick'],
  usage: '<@user1> [... @userX]',
  description: 'Kick user(s).',
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
    const label = args.length ? args[0] : context.command;
    const prefix = context.prefix;
    const commandPrefix = `${prefix === connection.user.mention ? '@me ' : prefix}`;
    const commandText = `${commandPrefix}${label}`;
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
        value: command.examples.map(a => a.replace('<command>', commandText).replace('<prefix>', commandPrefix)).join('\n'),
      });
    }

    if (!args.length && command === helpCommand) {
      embed.fields.push({
        name: '❯ Commands',
        value: commands.filter(_ => _ !== helpCommand)
          // .sort((a, b) => a.alias[0].localeCompare(b.alias[0], 'en', { sensitivity: 'base' }))
          .map(c => `\`${commandPrefix}${c.alias[0]}\`${c.description ? ` - ${c.description.split('\n')[0]}` : ''}`)
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
    connection.on(`command:${alias.toLowerCase()}`, (...args) => command.handle(...args));
  });
});

function startDraft(context, args = [], flags = {}) {
  // Create Category, Create sub-channels
  const users = findUsers(args.join(' ')).map((id) => context.guild.members.get(id) || id);
  if (!users.length) {
    return context.reply('Malformed command. Users required.');
  }
  const size = flags.packSize || flags.size;
  if (size && parseInt(size, 10) < 1) {
    return context.reply('Pack size must be more than zero.');
  }
  const pick = (flags.pick || flags.pull) && parseInt(flags.pick || flags.pull, 10);
  if (pick !== undefined) {
    const _size = size || 8;
    if (Number.isNaN(pick)) return context.reply('Pick is not a number.');
    if (pick > _size) return context.reply(`Pick can't be larger than pack size (${pick} > ${_size}).`);
    if (pick < 1) return context.reply('Pick must be at least 1.');
    if (_size % pick !== 0) return context.reply(`Pick (${pick}) is not a factor of ${_size}.`);
  }
  const draft = new Draft(connection, context.guild, {
    owner: context.user,
    users: shuffle(users),
    cardThreshold: flags.threshold || flags.cardThreshold || flags.cards || flags.deck,
    packSize: size,
    packs: parseArray(flags.packs, false),
    defaultPack: flags.defaultPack || flags.default,
    pick,
  });
  
  context.manager.register(draft);

  draft.emit('start', context);
}

function kickUser(context, args = []) {
  const currentDraft = context.manager.find(context, { owner: true });
  if (!currentDraft) return;
  const users = findUsers(args.join(' ')).map((id) => context.guild.members.get(id) || id);
  currentDraft.emit('kick', context, users);
}

function chooseCard(context, args = []) {
  const currentDraft = context.manager.find(context);
  if (currentDraft) currentDraft.emit('pick', context, args.join(' '));
  else context.reply('Move to your draft room to use this command.');
}

function clear(context, [id] = []) {
  const currentDraft = id ? context.manager.get(id) : context.manager.find(context, { owner: true });
  if (currentDraft) currentDraft.emit('clear', context);
  else context.reply(id ? `Draft (${id}) not found` : `No draft found, perhaps include the ID?`);
}

function findUsers(string = '') { // TODO: Also find user IDs that aren't specifically pings
  return [...new Set(Array.from(string.matchAll(userRegex), m => m[1])).values()];
}

function getContext(msg, extra) {
  const guildID = msg.guildID || msg.channel.guild.id;
  let isAdmin;
  return {
    ...extra,
    msg,
    user: msg.author,
    channel: msg.channel,
    guild: msg.channel.guild,
    guildID,
    manager: Manager.for(guildID),
    isAdmin() {
      if (isAdmin === undefined) {
        isAdmin = msg.channel.permissionsOf(msg.author.id).has('manageRoles');
      }
      return isAdmin;
    },
    reply(content) {
      return connection.createMessage(msg.channel.id, content)
        .catch(console.error);
    }
  };
}

// Reload cards daily
setInterval(() => cards.load()
  .catch(console.error), 24 * 3600000);
