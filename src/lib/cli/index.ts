import './commands';

export type { CommandContext, CommandRole } from './context';
export { dispatch, resolveCommand, type CommandResult } from './dispatcher';
export { parseCommand, tokenize } from './parser';
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
} from './registry';
