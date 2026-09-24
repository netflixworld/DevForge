import { pluginSelects } from '../modules/plugins.js';
import type { SelectHandler } from '../types.js';

export const selectHandlers: SelectHandler[] = [...pluginSelects];
