import { robloxClient, robloxGroup } from '../../main.ts';
import { EmbedBuilder } from 'discord.js';
import { CommandContext } from '../../structures/addons/CommandAddons.ts';
import { Command } from '../../structures/Command.ts';
import { config } from '../../config.ts';
import type { User, PartialUser, GroupMember, GroupRole } from '../../structures/types.d.ts';
import { logAction } from '../../handlers/handleLogging.ts';
import { getUnexpectedErrorEmbed, checkIconUrl } from '../../handlers/locale.ts';
import { provider } from '../../database/index.ts';
import got from 'got';

let changed = 0;
let unchanged = 0;

const getChangeRankToXPEmbed = async(url: string): Promise<EmbedBuilder> => {
    const embed = new EmbedBuilder()
        .setAuthor({ name: 'Success!', iconURL: checkIconUrl })
        .setColor('#50C790')
        .setThumbnail(url)
        .setDescription(`${changed} users have had their XP set to their group rank.\n ${unchanged} users were found with more XP than needed at their rank\nCheck <#${config.logChannels.actions}> to see changes.`)

    return embed
}

async function sendRequest(groupId: number, rolesetId: number, cursor = '') {
    let data;

    try {
		const res = await got
			.get(`https://groups.roblox.com/v1/groups/${groupId}/roles/${rolesetId}/users?limit=100&cursor=${cursor}&sortOrder=Asc`)
			.json();
        data = res;
	} catch (err) {
		console.log(err);
	}

    return await data
};


async function rankMembers(ctx: CommandContext, groupRole: GroupRole, xp: number, cursor = '') {
    let roleMemberList;
    roleMemberList = await sendRequest(config.groupId, groupRole.id, cursor);
    for (const index in roleMemberList.data) {
            let member = roleMemberList.data[index];
            let user: User | PartialUser;

            const userData = await provider.findUser(member.userId.toString());
            user = await robloxClient.getUser(member.userId);
    
            if (userData.xp < xp) {
                changed = changed + 1
                logAction('Rank used to set XP', ctx.user, ctx.args['reason'], user, null, null, null, `${userData.xp} → ${xp} (${groupRole.name})`);
                await provider.updateUser((member.userId.toString()), { xp });
    
            } else {
                unchanged = unchanged + 1
            } 
    }

    if (roleMemberList.nextPageCursor === null) {
        return
    } else {
        await rankMembers(ctx, groupRole, xp, roleMemberList.nextPageCursor)
    }
}

class RankToXPCommand extends Command {
    constructor() {
        super({
            trigger: 'ranktoxp',
            description: 'Sets user\'s xp to be equal to their group rank. This will cause a lot of log spam!',
            type: 'ChatInput',
            module: 'admin',
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

    async run(ctx: CommandContext){
        try {
            let robloxGroup: Group;
            let groupRoleList: GroupRole[];
            let xpRoleList = config.xpSystem.roles;
            changed = 0;
            unchanged = 0;
            ctx.defer()

            robloxGroup = await robloxClient.getGroup(config.groupId)
            groupRoleList = await robloxGroup.getRoles()

            for (const index in xpRoleList) {
                let groupRole = groupRoleList.find((role) => role.rank === xpRoleList[index].rank)
                
                await rankMembers(ctx, groupRole, xpRoleList[index].xp)
            }
            
            return ctx.reply({ embeds: [ await getChangeRankToXPEmbed(ctx.user.displayAvatarURL()) ]});
        } catch {
            return ctx.reply({ embeds: [ await getUnexpectedErrorEmbed() ]});
        }
    }
            
}

export default RankToXPCommand;