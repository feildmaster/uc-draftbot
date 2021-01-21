const Draft = require('./draft');

const placeholder = new Draft();

const defaultFindOptions = {
  user: true,
  wide: false,
  owner: false,
  admin: false,
};

class Manager {
  constructor() {
    this.drafts = new Set([placeholder]);
    this.drafts.delete(placeholder);
  }

  first() {
    let value;
    for (value of this.drafts) return value;
    return value;
  }

  last() {
    let value;
    for (value of this.drafts) /* Go to last */;
    return value;
  }

  running() {
    return [...this.drafts.values()].find(draft => draft.running && draft.running !== 'finished');
  }

  finished() {
    return [...this.drafts.values()].find(draft => draft.running === 'finished');
  }

  find(context, {
    user,
    wide,
    owner,
    admin,
  } = defaultFindOptions) {
    const drafts = [...this.drafts.values()];
    const userID = context.user.id;

    return (user && (wide ? drafts : drafts.filter(draft => draft.channels.includes(context.channel.id)))
      // Is channel owner (be more specific first)
      .find(draft => draft.participants.find(draftee => draftee.user === userID))) ||
      // Is draft owner (widen the net now)
      (owner && drafts.find(draft => (draft.owner.id || draft.owner) === userID)) ||
      // Is admin
      (admin && context.isAdmin() && drafts[0]);
  }

  get(id = '0') {
    return [...this.drafts.values()].find(draft => draft.id == id);
  }

  register(draft = placeholder) {
    if (draft === placeholder || !(draft instanceof Draft)) throw new Error('Missing Draft');
    if (this.drafts.has(draft)) throw new Error('Duplicate Draft');
    const last = this.last();
    // Set Draft ID
    draft.id = last ? last.id + 1 : 1;
    // Delete on clear
    draft.on('cleared', err => err || this.drafts.delete(draft));
    this.drafts.add(draft);
  }

  static for(key = '') {
    if (!key.trim()) throw new Error('Missing Server Key');
    if (!registry.has(key)) {
      registry.set(key, new Manager())
    }
    return registry.get(key);
  }
}

const registry = new Map([['', new Manager()]]);
registry.delete('');

module.exports = Manager;
