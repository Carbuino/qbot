import {
    AutocompleteInteraction,
} from 'discord.js';

import type {
    APIApplicationCommandOptionChoice,
} from 'discord.js';
import { getLinkedRobloxUser } from '../handlers/accountLinks.ts';
import { robloxClient } from '../main.ts';

const handleRobloxUser = async (interaction: AutocompleteInteraction, option: APIApplicationCommandOptionChoice) => {
    if(!option.value) return;
    try {
        const rawQuery = option.value as string;
        const queryParts = rawQuery.split(/\s+/).filter(Boolean);
        const hasTrailingSpace = /\s$/.test(rawQuery);
        const query = hasTrailingSpace ? '' : queryParts[queryParts.length - 1];
        const prefixParts = hasTrailingSpace ? queryParts : queryParts.slice(0, -1);
        const prefix = prefixParts.length > 0 ? `${prefixParts.join(' ')} ` : '';

        if(!query) return;

        const discordUsers = await interaction.guild.members.search({
            query,
            limit: 5,
        });
        const robloxQuery = await robloxClient.getUsersByUsernames([ query ]);

        const linkedRobloxUsers: { name: string; value: string; }[] = [];
        let checkedUsers = 0;
        for (const member of discordUsers.values()) {
            if(checkedUsers >= 3) break;
            checkedUsers += 1;

            const linkedRobloxUser = await getLinkedRobloxUser(member.id);
            if(!linkedRobloxUser) continue;

            linkedRobloxUsers.push({
                name: `?? @${member.user.username}: ${linkedRobloxUser.name} (${linkedRobloxUser.id})`,
                value: `${prefix}${linkedRobloxUser.id}`,
            });
        }

        const choices = [
            ...robloxQuery.map((robloxUser) => ({
                name: `?? ${robloxUser.name} (${robloxUser.id})`,
                value: `${prefix}${robloxUser.id}`,
            })),
            ...linkedRobloxUsers,
        ];

        if(choices.length === 0) return;
        await interaction.respond(choices.slice(0, 25));
    } catch (err) {};
}

export { handleRobloxUser };
