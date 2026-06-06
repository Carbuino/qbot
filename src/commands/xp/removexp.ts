import { discordClient, robloxClient, robloxGroup } from '../../main.ts';
import { CommandContext } from '../../structures/addons/CommandAddons.ts';
import { Command } from '../../structures/Command.ts';
import {
    getInvalidRobloxUserEmbed,
    getRobloxUserIsNotMemberEmbed,
    getUnexpectedErrorEmbed,
    getVerificationChecksFailedEmbed,
    getSuccessfulXPChangeEmbed,
    getInvalidXPEmbed,
    getSuccessfulDemotionEmbed,
} from '../../handlers/locale.ts';
import { checkActionEligibility } from '../../handlers/verificationChecks.ts';
import { config } from '../../config.ts';
import type { User, PartialUser, GroupMember, GroupRole } from '../../structures/types.d.ts';
import { logAction } from '../../handlers/handleLogging.ts';
import { getLinkedRobloxUser } from '../../handlers/accountLinks.ts';
import { provider } from '../../database/index.ts';

type XPResult = {
    user: User | PartialUser;
    previousXp: number;
    xp: number;
    rankupRole?: GroupRole;
    demotionProtected?: boolean;
};

const splitUserQueries = (value: unknown): string[] => {
    return String(value || '')
        .split(/\s+/)
        .map((query) => query.trim())
        .filter(Boolean);
};

const formatList = (items: string[]): string => {
    const visible = items.slice(0, 15);
    const hiddenCount = items.length - visible.length;
    return `${visible.map((item) => `- ${item}`).join('\n')}${hiddenCount > 0 ? `\n- ...and ${hiddenCount} more` : ''}`;
};

class RemoveXPCommand extends Command {
    constructor() {
        super({
            trigger: 'removexp',
            description: 'Removes XP from one or more users.',
            type: 'ChatInput',
            module: 'xp',
            args: [
                {
                    trigger: 'roblox-user',
                    description: 'Who do you want to remove XP from? Separate multiple users with spaces.',
                    autocomplete: true,
                    type: 'RobloxUser',
                },
                {
                    trigger: 'decrement',
                    description: 'How much XP would you like to remove?',
                    type: 'Number',
                },
                {
                    trigger: 'reason',
                    description: 'If you would like a reason to be supplied in the logs, put it here.',
                    isLegacyFlag: true,
                    required: false,
                    type: 'String',
                },
            ],
            permissions: [
                {
                    type: 'role',
                    ids: config.permissions.users,
                    value: true,
                }
            ]
        });
    }

    async resolveRobloxUser(query: string): Promise<User | PartialUser> {
        try {
            if(/^\d+$/.test(query)) {
                return await robloxClient.getUser(Number(query));
            }
        } catch (err) {};

        try {
            const robloxUsers = await robloxClient.getUsersByUsernames([ query ]);
            if(robloxUsers.length === 0) throw new Error();
            return robloxUsers[0];
        } catch (err) {};

        try {
            const idQuery = query.replace(/[^0-9]/gm, '');
            if(!idQuery) throw new Error();
            const discordUser = await discordClient.users.fetch(idQuery);
            const linkedUser = await getLinkedRobloxUser(discordUser.id);
            if(!linkedUser) throw new Error();
            return linkedUser;
        } catch (err) {};

        throw new Error('Invalid Roblox user.');
    }

    async run(ctx: CommandContext) {
        const decrement = Number(ctx.args['decrement']);
        if(!Number.isInteger(decrement) || decrement < 0) return ctx.reply({ embeds: [ getInvalidXPEmbed() ] });

        const userQueries = splitUserQueries(ctx.args['roblox-user']);
        if(userQueries.length === 0) return ctx.reply({ embeds: [ getInvalidRobloxUserEmbed() ]});
        if(userQueries.length > 1) await ctx.defer();

        const successes: XPResult[] = [];
        const failures: string[] = [];
        let groupRoles: GroupRole[];

        try {
            groupRoles = await robloxGroup.getRoles();
        } catch (err) {
            console.log(err);
            return ctx.reply({ embeds: [ getUnexpectedErrorEmbed() ]});
        }

        for (const userQuery of userQueries) {
            let robloxUser: User | PartialUser;
            try {
                robloxUser = await this.resolveRobloxUser(userQuery);
            } catch (err) {
                failures.push(`${userQuery}: invalid Roblox user`);
                continue;
            }

            let robloxMember: GroupMember;
            try {
                robloxMember = await robloxGroup.getMember(robloxUser.id);
                if(!robloxMember) throw new Error();
            } catch (err) {
                failures.push(`${robloxUser.name}: not in the Roblox group`);
                continue;
            }

            if(config.verificationChecks) {
                const actionEligibility = await checkActionEligibility(ctx.user.id, ctx.guild.id, robloxMember, robloxMember.role.rank);
                if(!actionEligibility) {
                    failures.push(`${robloxUser.name}: verification checks failed`);
                    continue;
                }
            }

            const userData = await provider.findUser(robloxUser.id.toString());
            const previousXp = Number(userData.xp);
            const actualRemoved = Math.min(decrement, previousXp);
            const xp = previousXp - actualRemoved;
            await provider.updateUser(robloxUser.id.toString(), { xp });

            const result: XPResult = { user: robloxUser, previousXp, xp };

            // Determine if a demotion is required based on the new XP.
            try {
                // Find the configured role which matches the new XP (highest xp threshold <= xp)
                const sortedXpRoles = config.xpSystem.roles.slice().sort((a, b) => b.xp - a.xp);
                const matchingRoleCfg = sortedXpRoles.find((r) => xp >= r.xp);
                const targetRole = matchingRoleCfg ? groupRoles.find((gr) => gr.rank === matchingRoleCfg.rank) : null;

                // Protect staff whose current rank is higher than any rank attainable via XP
                const xpRoles = config.xpSystem?.roles || [];
                const maxXpRoleRank = xpRoles.length ? Math.max(...xpRoles.map((r) => r.rank)) : 0;
                if (robloxMember.role.rank > maxXpRoleRank) {
                    // Do not demote staff above the XP system's max rank — mark as protected
                    result.demotionProtected = true;
                } else if (targetRole && targetRole.rank < robloxMember.role.rank) {
                    try {
                        await robloxGroup.updateMember(robloxUser.id, targetRole.id);
                        result.rankupRole = targetRole;
                        logAction('XP Rankdown', ctx.user, null, robloxUser, `${robloxMember.role.name} (${robloxMember.role.rank}) -> ${targetRole.name} (${targetRole.rank})`);
                    } catch (err) {
                        console.log(err);
                        failures.push(`${robloxUser.name}: XP removed, but rankdown failed`);
                    }
                }
            } catch (err) {
                console.log(err);
            }

            try {
                logAction('Remove XP', ctx.user, ctx.args['reason'], robloxUser, null, null, null, `${previousXp} -> ${xp} (-${actualRemoved})`);
            } catch (err) {
                console.log(err);
            }

            successes.push(result);
        }

        if(userQueries.length === 1 && successes.length === 1 && failures.length === 0) {
            const result = successes[0];
            if(result.rankupRole) {
                return ctx.reply({ embeds: [ await getSuccessfulDemotionEmbed(result.user, result.rankupRole.name) ]});
            }

            return ctx.reply({ embeds: [ await getSuccessfulXPChangeEmbed(result.user, result.xp) ]});
        }

        const summary: string[] = [];
        if(successes.length > 0) {
            summary.push(`Removed ${decrement} XP from ${successes.length} user${successes.length === 1 ? '' : 's'}:\n${formatList(successes.map((result) => `${result.user.name}: ${result.previousXp} -> ${result.xp}${result.demotionProtected ? ' (demotion protected)' : ''}`))}`);
        }

        const rankdowns = successes.filter((result) => result.rankupRole);
        if(rankdowns.length > 0) {
            summary.push(`Demoted ${rankdowns.length} user${rankdowns.length === 1 ? '' : 's'}:\n${formatList(rankdowns.map((result) => `${result.user.name} -> ${result.rankupRole.name}`))}`);
        }

        if(failures.length > 0) {
            summary.push(`Skipped ${failures.length} user${failures.length === 1 ? '' : 's'}:\n${formatList(failures)}`);
        }

        return ctx.reply({ content: summary.join('\n\n').slice(0, 1900) });
    }
}

export default RemoveXPCommand;
