import { robloxClient, robloxGroup } from '../../main';
import { EmbedBuilder } from 'discord.js';
import { CommandContext } from '../../structures/addons/CommandAddons';
import { Command } from '../../structures/Command';
import { config } from '../../config';
import type { User, PartialUser, GroupMember, GroupRole } from '../../structures/types.d.ts';
import { provider } from '../../database';
import { logAction } from '../../handlers/handleLogging';
import { checkIconUrl } from '../../handlers/locale';

const findEligibleRole = async (member: GroupMember, roles: GroupRole[], xp: number, forceBelow: number): Promise<GroupRole> => {
    const role = roles.find((role) => role.rank === config.xpSystem.roles.sort((a, b) => a.xp + b.xp).find((role) => xp >= role.xp)?.rank);
    if(role && ((member.role.id === role.id) || ((role.rank <= member.role.rank) && (member.role.rank > forceBelow) ))) return null;
    return role;
}

const getUpdatedRanksEmbed = async(url: string, 
                                    newRank: number, 
                                    sameRank: number, 
                                    notInGroup: number, 
                                    otherError: number): Promise<EmbedBuilder> => {
    const embed = new EmbedBuilder()
        .setAuthor({ name: 'Success!', iconURL: checkIconUrl })
        .setColor('#50C790')
        .setThumbnail(url)
        .setDescription(`${newRank} users have had their group rank changed.\n ${sameRank} users kept their rank. \n ${notInGroup} users are no longer in the group. \n ${otherError} unexpected errors occured. \nCheck <#${config.logChannels.actions}> to see all changes.`)

    return embed
}

class UpdateRanksCommand extends Command {
    constructor() {
        super({
            trigger: 'updateranks',
            description: 'Reranks all users, based on their XP. Useful for if config was changed',
            type: 'ChatInput',
            module: 'xp',
            args: [
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
        ctx.defer()
        let notInGroup = 0
        let sameRank = 0
        let newRank = 0
        let otherError = 0

        let users = await provider.db.user.findMany();
        const groupRoles = await robloxGroup.getRoles();

        for (const index in users) {
            let user = users[index];
            let robloxMember: GroupMember;
            let robloxUser: User | PartialUser;
            let xp: number;
            xp = user.xp
            
            try {
                robloxUser = await robloxClient.getUser(Number(user.robloxId));
                if(!robloxUser) throw new Error();
            } catch (err) {
                console.log(`${Number(index) + 1}/${users.length} - Failed to find User (${xp} XP)`);
                otherError = otherError + 1
                continue 
            };

            try {
                robloxMember = await robloxGroup.getMember(Number(user.robloxId));
                if(!robloxMember) throw new Error();
            } catch (err) {
                console.log(`${Number(index) + 1}/${users.length} - ${robloxUser.name} - No Longer in Group (${xp} XP)`);
                notInGroup = notInGroup + 1
                continue
            };
            
            const role = await findEligibleRole(robloxMember, groupRoles, xp, 15);
            if (role) {
                try {
                    console.log(`${Number(index) + 1}/${users.length} - New Rank - ${robloxUser.name} - ${robloxMember.role.name} -> ${role.name} (${xp} XP)`);
                    await robloxGroup.updateMember(Number(user.robloxId), role.id);
                    newRank = newRank + 1;
                    logAction('XP Rankup - Config Update', ctx.user, null, robloxUser, `${robloxMember.role.name} (${robloxMember.role.rank}) → ${role.name} (${role.rank})`);
                } catch (err) {
                    console.log(err);
                    console.log(`${Number(index) + 1}/${users.length} - ${robloxUser.name} - Unexpected Error (${xp} XP)`);
                    otherError = otherError + 1
                    continue
                }
            } else {
                console.log(`${Number(index) + 1}/${users.length} - No Change - ${robloxUser.name} - ${robloxMember.role.name} (${xp} XP)`);
                sameRank = sameRank + 1;
            }
        }
        return ctx.reply({ embeds: [ await getUpdatedRanksEmbed(ctx.user.displayAvatarURL(), newRank, sameRank, notInGroup, otherError) ]});
    }
}
export default UpdateRanksCommand;