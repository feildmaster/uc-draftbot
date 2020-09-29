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
  } = {}) {
    super();
    this.id = id++;
    this.server = server.id || server;
    this.round = 0;
    this.packSize = packSize;
    this.packs = packs;
    this.defaultPack = defaultPack;

    let participants = [];
    let running = false;
    let category = null;

    this.on('start', (context) => {
      if (running) {
        context.reply(`Draft${this.id}: ${running === true ? 'Already running' : 'Finished'}.`);
        return;
      }
      if (!participants.length) {
        context.reply(`Draft${this.id}: No participants`);
        return;
      }
      const guildID = context.guildID;
      running = true;
      connection.createChannel(guildID, `draft${this.id}`, 4, {
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
        }],
      }).then((cat) => {
        category = cat;
        const promises = [];
        participants.forEach((draftee, i) => {
          // Create a channel for the user
          promises.push(connection.createChannel(guildID, `room${i + 1}`, 0, {
            parent_id: category.id,
            permissionOverwrites: [{
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
      }).catch(() => {
        running = false;
      });
    });
    this.on('nextRound', () => {
      if (!running) return;
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
        participants[i] = temp;
      }
      // Message current pack
      participants.forEach((draftee) => {
        const message = draftee.pack.map((card, i) => `${i + 1}: ${card.name}`).join('\n');
        connection.createMessage(draftee.channel, message);
      });
    });
    this.on('pickCard', (user, card) => {
      if (!running) return;
     const draftee = participants.find((entry) => entry.userID === user.id || user);
     if (!draftee || draftee.chosen || card < 1 || card > draftee.pack.length) return;
     const selected = draftee.pack.splice(card - 1, 1)[0];
     draftee.cards.push(selected);
     draftee.chosen = true;
     connection.createMessage(draftee.channel, `Chosen card ${card}: ${selected.name}`);
    });
    this.on('pickCard', () => {
      if (!running) return;
      // Check if still waiting
      const waiting = participants.some((draftee) => !draftee.chosen);
      if (waiting) return;
      this.emit('nextRound');
    });
    this.on('finish', () => {
      if (!running) return;
      running = 'finished';
      // Send decks to participants
      participants.forEach((draftee) => {
        const deck = draft.cards.map((card, i) => `${i + 1}: ${card.name}`).join('\n');
        connection.createMessage(draftee.channel, `Your deck:\n${deck}`);
      });
    });
    this.on('kick', (user) => {
      // TODO: kick the user
    });
    this.on('clear', () => {
      if (!running || !category) return;
      const promises = category.channels.map((channel) => connection.deleteChannel(channel.id));
      Promise.all(promises)
        .then(() => connection.deleteChannel(category.id))
        .then(() => category = null);
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
