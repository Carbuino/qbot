import {
    TextChannel,
} from 'discord.js';
import { discordClient, robloxClient } from '../main.ts';
import { config } from '../config.ts';
import { getShoutLogEmbed } from '../handlers/locale.ts';
let firstShout = true;
let lastShout: string;

const recordShout = async () => {
    try {
        const group = await robloxClient.getGroup(config.groupId);
        const logChannel = await discordClient.channels.fetch(config.logChannels.shout) as TextChannel;
        if(firstShout) {
            firstShout = false;
        } else {
            if(group.shout !== null && lastShout !== group.shout?.body) {
                logChannel.send({ embeds: [ await getShoutLogEmbed(group.shout) ] });
            }
        }
        setTimeout(recordShout, 60 * 1000);
        if(group.shout?.body) lastShout = group.shout?.body;
    } catch (err) {
        console.error(err);
    }
}

export { recordShout };
