import './commands/index.ts';

export type { CommandContext, CommandRole } from './context.ts';
export { dispatch, resolveCommand, type CommandResult } from './dispatcher.ts';
export { parseCommand, tokenize } from './parser.ts';
export { serializeCommand } from './serialize.ts';
export {
  allCommands,
  commandKey,
  getCommand,
  isReachable,
  listCommands,
  registerCommand,
  type Command,
  type CommandFormat,
  type CommandScope,
} from './registry.ts';
