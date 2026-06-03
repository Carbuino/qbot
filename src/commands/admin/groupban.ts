import { CommandContext } from '../../structures/addons/CommandAddons.ts';
import { Command } from '../../structures/Command.ts';
import { discordClient, robloxClient, robloxGroup } from '../../main.ts';
import type { User, PartialUser, GroupMember } from '../../structures/types.d.ts';
import { getLinkedRobloxUser } from '../../handlers/accountLinks.ts';
import { checkActionEligibility } from '../../handlers/verificationChecks.ts';
import { provider } from '../../database/index.ts';
import { logAction } from '../../handlers/handleLogging.ts';
import {
    getInvalidRobloxUserEmbed,
    getRobloxUserIsNotMemberEmbed,
    getVerificationChecksFailedEmbed,
    getUnexpectedErrorEmbed,
    getSuccessfulGroupBanEmbed,
    getNoDatabaseEmbed,
    getUserBannedEmbed
} from '../../handlers/locale.ts';
import { config } from '../../config.ts';

class GroupBanCommand extends Command {
    constructor() {
        super({
            trigger: 'groupban',
            description: 'Bans someone from the group',
            type: 'ChatInput',
            module: 'admin',
            args: [
                {
                    trigger: 'roblox-user',
                    description: 'Who do you wish to ban from the group?',
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

        let robloxMember: GroupMember;
        try {
            robloxMember = await robloxGroup.getMember(robloxUser.id);
            if(!robloxMember) throw new Error();
        } catch (err) {};

        if(config.verificationChecks && robloxMember) {
            const actionEligibility = await checkActionEligibility(ctx.user.id, ctx.guild.id, robloxMember, robloxMember.role.rank);
            if(!actionEligibility) return ctx.reply({ embeds: [ getVerificationChecksFailedEmbed() ] });
        }

        const userData = await provider.findUser(robloxUser.id.toString());
        if(userData.isBanned) return ctx.reply({ embeds: [ getUserBannedEmbed() ] });
        
        try {
            await provider.updateUser(robloxUser.id.toString(), {
                isBanned: true
            });
            if(robloxMember) await robloxGroup.kickMember(robloxUser.id);
            logAction('Group Ban', ctx.user, ctx.args['reason'], robloxUser);
            return ctx.reply({ embeds: [ getSuccessfulGroupBanEmbed(robloxUser) ]});
        } catch(e) {
            console.log(e);
            return ctx.reply({ embeds: [ getUnexpectedErrorEmbed() ]});
        }

    }
}

export default GroupBanCommand;
