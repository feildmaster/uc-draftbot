const flagTemplate = {
  alias: [''],
  usage: '',
  default: '',
  description: '',
};

module.exports = class Command {
  constructor({
    title = '',
    alias = [''],
    examples = [''],
    usage = '',
    description = '',
    flags = [flagTemplate],
    handler = (context) => context.reply('Missing Handler'),
  } = {}) {
    alias = alias.filter(_ => _.trim());
    if (!alias.length) throw new Error('No aliases provided.');
    this.title = title;
    this.alias = alias;
    this.examples = examples.filter(_ => _.trim());
    this.usage = usage;
    this.description = description;
    this.flags = flags.filter(_ => _.alias.filter(_ => _.trim()).length);
    this.handler = handler;
  }
};
