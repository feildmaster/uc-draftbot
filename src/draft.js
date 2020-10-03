const { Permission } = require('eris');
const pack = require('./pack');

const Emitter = require('events').EventEmitter;
const Permissions = require('eris').Constants.Permissions;

let id = 1;

module.exports = class Draft extends Emitter {
  constructor(connection, server, {
    // finishOnThreshold = false,
    cardThreshold = 40,
    packSize = 8,
    users = [],
    packs = ['dr', 'dr'],
    defaultPack = 'ut',
    owner = {
      id: 0,
    },
  } = {}) {
    super();
    this.id = id++;
    this.server = server.id || server;
    this.round = 0;
    this.packSize = packSize;
    this.packs = packs;
    this.defaultPack = defaultPack;
    this.running = false;

    let participants = [];
    let category = null;

    const process = () => {
      if (this.running !== true) return;
      // Check if still waiting
      const waiting = participants.some((draftee) => !draftee.chosen);
      if (!waiting || !participants.length) {
        this.emit('nextRound');
      }
    };

    this.on('start', (context) => {
      if (this.running) {
        context.reply(`Draft${this.id}: ${this.running === true ? 'Already running' : 'Finished'}.`);
        return;
      }
      if (!participants.length) {
        context.reply(`Draft${this.id}: No participants`);
        return;
      }
      const guildID = context.guildID;
      this.running = true;
      connection.createChannel(guildID, `draft${this.id}`, 4).then((cat) => {
        category = cat;
        const promises = [];
        participants.forEach((draftee, i) => {
          // Create a channel for the user
          promises.push(connection.createChannel(guildID, `room${i + 1}`, 0, {
            parentID: category.id,
            permissionOverwrites: [{ // Everyone role
              id: guildID,
              type: 'role',
              allow: 0,
              deny: Permissions.readMessages,
            }, { // Bot member
              id: connection.user.id,
              type: 'member',
              allow: Permissions.readMessages,
              deny: 0,
            }, { // Owner
              id: draftee.user,
              type: 'member',
              allow: Permissions.readMessages,
              deny: 0,
            }],
          }).then((channel) => {
            draftee.channel = channel.id;
          }));
        });
        return Promise.all(promises);
      }).then(() => {
        this.emit('nextRound');
        context.reply(`Draft${this.id}: Started!`);
      }).catch(() => {
        context.reply(`Error starting Draft${this.id}`);
        this.running = false;
      });
    });
    this.on('nextRound', () => {
      if (this.running !== true) return;
      if (!participants.length) {
        this.emit('clear');
        return;
      }
      // Check threshold
      if (participants[0].cards.length >= cardThreshold) {
        this.emit('finish');
        return;
      }
      if (!participants[0].pack.length) {
        // Give people new cards
        participants.forEach((draftee) => {
          draftee.pack = this.nextPack();
        });
        this.round += 1;
      } else {
        // Rotate packs
        const temp = participants[0].pack;
        let i = 0;
        while (i < participants.length - 1) {
          participants[i++].pack = participants[i].pack;
        }
        participants[i].pack = temp;
      }
      // Message current pack
      participants.forEach((draftee) => {
        const message = draftee.pack.map((card, i) => `${i + 1}: ${card.name}`).join('\n');
        draftee.chosen = false;
        connection.createMessage(draftee.channel, message);
      });
    });
    this.on('pick', (context, card = 0) => {
      if (this.running !== true) return undefined;
      const { channel, user } = context;
      const draftee = participants.find((draftee) => draftee.user === (user.id || user));
      if (!draftee) {
        return context.reply('Not registered to Draft.');
      } else if (draftee.channel !== (channel.id || channel)) {
        return context.reply('Move to your draft room to use this command.');
      } else if (draftee.chosen) {
        return context.reply('You have already chosen. Please wait for the others to choose.');
      } else if (parseInt(card, 10) === NaN || card < 1 || card > draftee.pack.length) {
        return context.reply(`Invalid input: ${card}`);
      }
      const selected = draftee.pack.splice(card - 1, 1)[0];
      draftee.cards.push(selected);
      draftee.chosen = true;
      return context.reply(`Chosen card ${card}: ${selected.name}`);
    });
    this.on('pick', process);
    this.on('finish', () => {
      if (this.running === 'finished') return;
      this.running = 'finished';
      if (!category) return;
      // Send decks to participants
      participants.forEach((draftee) => {
        const deck = draftee.cards.map((card, i) => `${i + 1}: ${card.name}`).join('\n');
        connection.createMessage(draftee.channel, `Your deck:\n${deck}`);
      });
    });
    this.on('kick', (context, users = []) => {
      if (this.running !== true) return;
      const resp = [];
      if (isOwner(context, owner.id || owner)) {
        return context.reply('Only owner can kick.');
      }
      users.forEach((user) => {
        resp.push(new Promise((res) => {
          const draftee = participants.find((draftee) => draftee.user === (user.id || user));
          if (!draftee) {
            return res('Not found');
          }
          const promise = Promise.resolve(draftee.channel ? connection.deleteChannel(draftee.channel) : 'No channel');
          res(promise.then(() => {
            participants.splice(participants.indexOf(draftee), 1);
            return 'Kicked'; 
          }).catch(() => 'Failed to kick'));
        }).then(resp => `${user.nick || user.username && `${user.username}#${user.discriminator}` || user}: ${resp}`));
      });
      Promise.all(resp)
        .then(responses => context.reply(responses.join('\n') || 'Invalid syntax.'))
        .then(process);
    });
    this.on('clear', (context) => {
      if (!this.running || !category) return;
      if (context && isOwner(context, owner.id || owner)) {
        this.emit('cleared', 'Missing Permissions');
        return context.reply('Only owner can clear draft.');
      }
      const promises = category.channels.map((channel) => connection.deleteChannel(channel.id));
      return Promise.all(promises)
        .then(() => connection.deleteChannel(category.id))
        .then(() => {
          category = null;
          this.emit('finished');
          this.emit('cleared');
          return 'Cleared draft rooms.';
        }).catch((e = '') => {
          context.reply();
          this.emit('cleared', e);
          return `Error clearing draft: ${e.message || e}`;
        }).then((msg) => {
          if (context && msg) {
            context.reply(msg);
          }
        });
    });
    this.on('status', (context) => {
      const embed = {
        title: `Draft ${this.id}: ${this.running === true ? 'Ongoing' : 'Finished'}`,
        color: 1794964,
        fields: [{
          name: '❯ Settings',
          value: [
            `Deck Size: ${cardThreshold}`,
            `Pack Size: ${packSize}`,
            `Default Pack: ${defaultPack}`,
            `Pack Sets: ${packs.join(', ')}`,
          ].join('\n'),
        }],
      };

      if (participants.length) {
        embed.fields.push({
          name: '❯ Participants',
          value: participants.map((draftee) => {
            const user = context.guild.members.get(draftee.user);
            return `${user && user.mention || draftee.user} (${draftee.cards.length}/${cardThreshold})${this.running === true && !draftee.chosen ? ': Picking card' : ''}`
          }).join('\n'),
        });
      }

      context.reply({ embed });
    });

    users.forEach((user) => participants.push({
      user: user.id || user, // User object or ID
      channel: 0,
      chosen: false,
      pack: [],
      cards: [],
    }));
  }

  nextPack() {
    const type = this.packs[this.round] || this.defaultPack || 'ut'; // fall back to UT incase a setting is broken
    return pack(this.packSize, type);
  }
};

function isOwner(context, owner) {
  return context.user.id !== owner && !context.channel.permissionsOf(context.user.id).has('manageRoles');
}
