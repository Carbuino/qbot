import type { GroupMember, GroupRole } from '../structures/types';
import { config } from '../config';

const findEligibleRole = async (member: GroupMember, roles: GroupRole[], xp: number): Promise<GroupRole | null> => {
    const xpRoles = config.xpSystem?.roles || [];
    if (xpRoles.length === 0) return null;

    // Find the configured role with the highest XP threshold that is <= xp
    const matchingRoleCfg = xpRoles.slice().sort((a, b) => b.xp - a.xp).find((r) => xp >= r.xp);
    if (!matchingRoleCfg) return null;

    // Find the corresponding group role object
    const targetRole = roles.find((r) => r.rank === matchingRoleCfg.rank) || null;
    if (!targetRole) return null;

    // Protect staff whose current rank is higher than any XP-configured rank
    const maxXpRoleRank = xpRoles.length ? Math.max(...xpRoles.map((r) => r.rank)) : 0;
    if (member.role.rank > maxXpRoleRank) return null;

    // No change needed if ranks are the same
    if (targetRole.rank === member.role.rank) return null;

    // Return target role for both promotions and demotions
    return targetRole;
}

export { findEligibleRole };
