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
    permission = '',
    flags = [flagTemplate],
    handler = (context, args = [''], flags = {}) => context.reply('Missing Handler'),
  } = {}) {
    alias = alias.filter(_ => _.trim());
    if (!alias.length) throw new Error('No aliases provided.');
    this.title = title;
    this.alias = alias;
    this.examples = examples.filter(_ => _.trim());
    this.usage = usage;
    this.permission = permission;
    this.description = description;
    this.flags = flags.filter(_ => _.alias.filter(_ => _.trim()).length);
    this.handler = handler;
  }

  handle(context, ...rest) {
    if (this.permission) {
      const permissions = context.channel.permissionsOf(context.user.id);
      const allowed = Array.isArray(this.permission) ? this.permission.find((perm) => permissions.has(perm)) : permissions.has(this.permission);
      if (!allowed) {
        context.reply('Missing permissions');
        return;
      }
    }
    this.handler(context, ...rest);
  }
};
