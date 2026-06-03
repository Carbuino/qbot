import { CommandContext } from '../../structures/addons/CommandAddons.ts';
import { Command } from '../../structures/Command.ts';
import { discordClient, robloxClient } from '../../main.ts';
import type { User, PartialUser } from '../../structures/types.d.ts';
import { getLinkedRobloxUser } from '../../handlers/accountLinks.ts';
import { provider } from '../../database/index.ts';
import { logAction } from '../../handlers/handleLogging.ts';
import {
    getInvalidRobloxUserEmbed,
    getUnexpectedErrorEmbed,
    getSuccessfulGroupUnbanEmbed,
    getNoDatabaseEmbed,
    getUserNotBannedEmbed
} from '../../handlers/locale.ts';
import { config } from '../../config.ts';

class UnGroupBanCommand extends Command {
    constructor() {
        super({
            trigger: 'ungroupban',
            description: 'Unbans someone from the group',
            type: 'ChatInput',
            module: 'admin',
            args: [
                {
                    trigger: 'roblox-user',
                    description: 'Who do you wish to unban from the group?',
                    autocomplete: true,
                    required: true,
                    type: 'RobloxUser'
                },
                {
                    trigger: 'reason',
                    description: 'If you would like a reason to be supplied in the logs, put it here.',
                    required: false,
                    type: 'String'
                }
            ],
            permissions: [
                {
                    type: 'role',
                    ids: config.permissions.admin,
                    value: true,
                }
            ]
        })
    };

    async run(ctx: CommandContext) {
        let robloxUser: User | PartialUser;
        try {
            robloxUser = await robloxClient.getUser(ctx.args['roblox-user'] as number);
        } catch (err) {
            try {
                const robloxUsers = await robloxClient.getUsersByUsernames([ ctx.args['roblox-user'] as string ]);
                if(robloxUsers.length === 0) throw new Error();
                robloxUser = robloxUsers[0];
            } catch (err) {
                try {
                    const idQuery = ctx.args['roblox-user'].replace(/[^0-9]/gm, '');
                    const discordUser = await discordClient.users.fetch(idQuery);
                    const linkedUser = await getLinkedRobloxUser(discordUser.id);
                    if(!linkedUser) throw new Error();
                    robloxUser = linkedUser;
                } catch (err) {
                    return ctx.reply({ embeds: [ getInvalidRobloxUserEmbed() ]});
                }
            }
        }

        const userData = await provider.findUser(robloxUser.id.toString());
        if(!userData.isBanned) return ctx.reply({ embeds: [ getUserNotBannedEmbed() ] });

        try {
            await provider.updateUser(robloxUser.id.toString(), {
                isBanned: false
            });
            logAction('Ungroup Ban', ctx.user, ctx.args['reason'], robloxUser);
            return ctx.reply({ embeds: [ getSuccessfulGroupUnbanEmbed(robloxUser) ]});
        } catch(e) {
            console.log(e);
            return ctx.reply({ embeds: [ getUnexpectedErrorEmbed() ]});
        }
    }
}

export default UnGroupBanCommand;
