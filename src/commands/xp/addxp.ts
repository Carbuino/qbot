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
    getSuccessfulXPAndRankChangeEmbed,
} from '../../handlers/locale.ts';
import { checkActionEligibility } from '../../handlers/verificationChecks.ts';
import { config } from '../../config.ts';
import type { User, PartialUser, GroupMember, GroupRole } from '../../structures/types.d.ts';
import { logAction } from '../../handlers/handleLogging.ts';
import { getLinkedRobloxUser } from '../../handlers/accountLinks.ts';
import { provider } from '../../database/index.ts';
import { findEligibleRole } from '../../handlers/handleXpRankChange.ts';

const getUserXPChangeEmbed = ( successes: XPResult[], failures: XPResult[] ): EmbedBuilder => {
    let increment: number;
    
    if (successes.length === 0) {
        increment = 0;
    } else {
        increment = successes[0].xp! - successes[0].previousXp!;
    }

    let description = '';
    
    // Sucessful XP adds
    if(successes.length > 0) {
        description = `Added ${increment} XP to ${successes.length} user${successes.length === 1 ? '' : 's'}:\n`;
        for (const user of successes) {
            description += `- ${user.robloxUser?.name || user.username}: ${user.previousXp} → ${user.xp}\n`;
        }
        description += '\n';

        // Rankups
        const rankups = successes.filter((result) => result.newRole);
        if(rankups.length > 0) {
            description += `Ranked up ${rankups.length} user${rankups.length === 1 ? '' : 's'}:\n`;
            for (const user of rankups) {
                description += `- ${user.robloxUser?.name || user.username}: ${user.oldRole?.name} → ${user.newRole?.name}\n`;
            }
            description += '\n';
        }
    }

    // Failures
    if(failures.length > 0) {
        description += `Skipped ${failures.length} user${failures.length === 1 ? '' : 's'}:\n`;
        for (const user of failures) {
            description += `- ${user.robloxUser?.name || user.username}: ${user.message}\n`;
        }
    }

    const embed = new EmbedBuilder()
        .setAuthor({ name: 'XP Add Results', iconURL: infoIconUrl })
        .setColor('#906FED')
        .setDescription(description);

    return embed;
}

async function resolveRobloxUser(query: string): Promise<User | PartialUser> {
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

type XPResult = {
    username: string;
    robloxUser?: User | PartialUser;
    previousXp?: number;
    xp?: number;
    oldRole?: GroupRole;
    newRole?: GroupRole;
    message?: string;
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

    async run(ctx: CommandContext) {
        ctx.defer();
        const successes: XPResult[] = [];
        const failures: XPResult[] = [];
        let increment = Number(ctx.args['increment']);
        

        async function processUser(user: string) {
            let robloxUser: User | PartialUser;

            // Resolve the Roblox user
            try {
                robloxUser = await resolveRobloxUser(user);
            } catch (err) {
                failures.push({ username: user, message: 'Invalid Roblox user' });
                return;
            }

            // Check if the user is in the group
            let robloxMember: GroupMember;
            try {
                robloxMember = await robloxGroup.getMember(robloxUser.id);
                if(!robloxMember) throw new Error();
            } catch (err) {
                failures.push({ username: user, message: 'Not in Group' });
                return;
            }
            
            // If enabled, check if the verification checks pass
            if(config.verificationChecks) {
                const actionEligibility = await checkActionEligibility(ctx.user.id, ctx.guild.id, robloxMember, robloxMember.role.rank);
                if(!actionEligibility) {
                    failures.push({ username: user, message: 'Verification Checks Failed' });
                    return getVerificationChecksFailedEmbed()
                };
            };
            
            // Update the user's XP
            const userData = await provider.findUser(robloxUser.id.toString());
            const newXP = Number(userData.xp) + increment;
            await provider.updateUser(robloxUser.id.toString(), { xp: newXP });
            logAction('Add XP', ctx.user, ctx.args['reason'], robloxUser, null, null, null, `${userData.xp} → ${newXP} (+${increment})`);
            
            // Rankup Check
            const groupRoles = await robloxGroup.getRoles();
            const role = await findEligibleRole(robloxMember, groupRoles, newXP);

            
            if (role) {
                // Can rankup
                try {
                    await robloxGroup.updateMember(robloxUser.id, role.id);
                    successes.push({ 
                        username: user, 
                        robloxUser, 
                        previousXp: userData.xp, 
                        xp: newXP,
                        oldRole: robloxMember.role,
                        newRole: role 
                    });
                    logAction('XP Rankup', ctx.user, null, robloxUser, `${robloxMember.role.name} (${robloxMember.role.rank}) → ${role.name} (${role.rank})`);
                
                // Failed to rankup
                } catch (err) {
                    console.log(err);
                    successes.push({ 
                        username: user, 
                        robloxUser, 
                        previousXp: userData.xp, 
                        xp: newXP, 
                        oldRole: robloxMember.role,
                        newRole: role, 
                        message: 'XP added but failed to rankup' 
                    });
                }
            
            // XP added, no rankup
            } else {
                successes.push({ 
                    username: user, 
                    robloxUser,
                    previousXp: userData.xp,
                    xp: newXP
                });

            }
        }

        let users = ctx.args['roblox-user'].split(' ')

        // Valid XP increment must be a non-negative integer
        if( !Number.isInteger(Number(ctx.args['increment'])) || Number(ctx.args['increment']) < 0) 
            return ctx.reply({ embeds: [ getInvalidXPEmbed() ] });
        
        // Loop through Users
        for (const user of users) {
            if (user == '') continue;
            let result = await processUser(user);

            if (result) {
                return ctx.reply({ embeds: [ result ] });
            }
        }

        // Normal Case if 1 user
        if(successes.length === 1 && failures.length === 0) {
            const result = successes[0];

            if(result.newRole) {
                return ctx.reply({ embeds: [ await getSuccessfulXPAndRankChangeEmbed(result.robloxUser, result.newRole.name, increment.toString()) ]});
            }

            return ctx.reply({ embeds: [ await getSuccessfulXPChangeEmbed(result.robloxUser, result.xp) ]});
        }

        // Return Multiuser Rankup
        return ctx.reply({ embeds: [ getUserXPChangeEmbed(successes, failures) ] });
    }
}

export default AddXPCommand;