import * as discord from 'discord.js';
import { writeFileSync } from 'fs';
writeFileSync('/home/container/discord-exports.json', JSON.stringify(Object.keys(discord).sort(), null, 2));