module.exports = class Command {
  constructor({
    alias = [],
    usage = '',
    description = '',
    flags = [],
    handler = () => {},
  } = {}) {
    alias = alias.map((_ = '') => _.trim());
    if (!alias.length) throw new Error('No aliases provided.');
    this.alias = alias;
    this.usage = usage;
    this.description = description;
    this.flags = flags;
    this.handler = handler;
  }
};
