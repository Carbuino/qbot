import { robloxGroup } from '../../main.ts';
import { CommandContext } from '../../structures/addons/CommandAddons.ts';
import { Command } from '../../structures/Command.ts';
import { getJoinRequestsEmbed } from '../../handlers/locale.ts';
import { config } from '../../config.ts';

class JoinRequestsCommand extends Command {
    constructor() {
        super({
            trigger: 'joinrequests',
            description: 'Gets a list of pending join requests.',
            type: 'ChatInput',
            module: 'join-requests',
            permissions: [
                {
                    type: 'role',
                    ids: config.permissions.join,
                    value: true,
                }
            ]
        });
    }

    async run(ctx: CommandContext) {
        const joinRequests = await robloxGroup.getJoinRequests({});
        return await ctx.reply({ embeds: [ getJoinRequestsEmbed(joinRequests.data) ] });
    }
}

export default JoinRequestsCommand;