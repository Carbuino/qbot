import { discordClient, robloxClient, robloxGroup } from '../../main.ts';
import { CommandContext } from '../../structures/addons/CommandAddons.ts';
import { Command } from '../../structures/Command.ts';
import {
    getInvalidRobloxUserEmbed,
    getRobloxUserIsNotMemberEmbed,
    getUnexpectedErrorEmbed,
    getNoRankAboveEmbed,
    getRoleNotFoundEmbed,
    getVerificationChecksFailedEmbed,
    getSuccessfulXPChangeEmbed,
    getInvalidXPEmbed,
    getNoRankupAvailableEmbed,
    getSuccessfulAddingAndRankupEmbed,
} from '../../handlers/locale.ts';
import { checkActionEligibility } from '../../handlers/verificationChecks.ts';
import { config } from '../../config.ts';
import type { User, PartialUser, GroupMember, GroupRole } from '../../structures/types.d.ts';
import { logAction } from '../../handlers/handleLogging.ts';
import { getLinkedRobloxUser } from '../../handlers/accountLinks.ts';
import { provider } from '../../database/index.ts';
import { findEligibleRole } from '../../handlers/handleXpRankup.ts';

type XPResult = {
    user: User | PartialUser;
    previousXp: number;
    xp: number;
    rankupRole?: GroupRole;
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

class AddXPCommand extends Command {
    constructor() {
        super({
            trigger: 'addxp',
            description: 'Adds XP to one or more users.',
            type: 'ChatInput',
            module: 'xp',
            args: [
                {
                    trigger: 'roblox-user',
                    description: 'Who do you want to add XP to? Separate multiple users with spaces.',
                    autocomplete: true,
                    type: 'RobloxUser',
                },
                {
                    trigger: 'increment',
                    description: 'How much XP would you like to add?',
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
        const increment = Number(ctx.args['increment']);
        if(!Number.isInteger(increment) || increment < 0) return ctx.reply({ embeds: [ getInvalidXPEmbed() ] });

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
            const xp = previousXp + increment;
            await provider.updateUser(robloxUser.id.toString(), { xp });

            const result: XPResult = { user: robloxUser, previousXp, xp };
            const role = await findEligibleRole(robloxMember, groupRoles, xp);

            if (role) {
                try {
                    await robloxGroup.updateMember(robloxUser.id, role.id);
                    result.rankupRole = role;
                    logAction('XP Rankup', ctx.user, null, robloxUser, `${robloxMember.role.name} (${robloxMember.role.rank}) -> ${role.name} (${role.rank})`);
                } catch (err) {
                    console.log(err);
                    failures.push(`${robloxUser.name}: XP added, but rankup failed`);
                }
            }

            try {
                logAction('Add XP', ctx.user, ctx.args['reason'], robloxUser, null, null, null, `${previousXp} -> ${xp} (+${increment})`);
            } catch (err) {
                console.log(err);
            }

            successes.push(result);
        }

        if(userQueries.length === 1 && successes.length === 1 && failures.length === 0) {
            const result = successes[0];
            if(result.rankupRole) {
                return ctx.reply({ embeds: [ await getSuccessfulAddingAndRankupEmbed(result.user, result.rankupRole.name, increment.toString()) ]});
            }

            return ctx.reply({ embeds: [ await getSuccessfulXPChangeEmbed(result.user, result.xp) ]});
        }

        const summary: string[] = [];
        if(successes.length > 0) {
            summary.push(`Added ${increment} XP to ${successes.length} user${successes.length === 1 ? '' : 's'}:\n${formatList(successes.map((result) => `${result.user.name}: ${result.previousXp} -> ${result.xp}`))}`);
        }

        const rankups = successes.filter((result) => result.rankupRole);
        if(rankups.length > 0) {
            summary.push(`Ranked up ${rankups.length} user${rankups.length === 1 ? '' : 's'}:\n${formatList(rankups.map((result) => `${result.user.name} -> ${result.rankupRole.name}`))}`);
        }

        if(failures.length > 0) {
            summary.push(`Skipped ${failures.length} user${failures.length === 1 ? '' : 's'}:\n${formatList(failures)}`);
        }

        return ctx.reply({ content: summary.join('\n\n').slice(0, 1900) });
    }
}

export default AddXPCommand;
