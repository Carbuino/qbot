import {
    TextChannel,
    User as DiscordUser,
} from 'discord.js';
import type { GroupMember, PartialUser, User as RobloxUser } from '../structures/types.d.ts';
import { discordClient } from '../main.ts';
import { getLogEmbed } from './locale.ts';
import { config } from '../config.ts';
import { recordAction } from './abuseDetection.ts';

let actionLogChannel: TextChannel;
const getLogChannels = async () => {
    if(config.logChannels.actions) {
        actionLogChannel = await discordClient.channels.fetch(config.logChannels.actions) as TextChannel;
    }
}

const logAction = async (action: string, moderator: DiscordUser | RobloxUser | GroupMember | any, reason?: string, target?: RobloxUser | PartialUser, rankChange?: string, endDate?: Date, body?: string, xpChange?: string) => {
    if(moderator.id !== discordClient.user.id) recordAction(moderator);
    if(!actionLogChannel) return;
    actionLogChannel.send({ embeds: [ await getLogEmbed(action, moderator, reason, target, rankChange, endDate, body, xpChange) ] });
}

export { logAction, getLogChannels };