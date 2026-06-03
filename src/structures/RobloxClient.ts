import noblox from 'noblox.js';
import { config } from '../config.ts';

export const robloxClient = {
    user: { id: 0 },
    getUser: async (id: number | string) => {
        const userId = typeof id === 'string' ? parseInt(id) : id;
        const username = await noblox.getUsernameFromId(userId);
        return { id: userId, name: username };
    },
    getUsersByUsernames: async (usernames: string[]) => {
        try {
            const ids = await noblox.getIdFromUsername(usernames) as number | (number | null)[] | null;
            const normalizedIds = Array.isArray(ids) ? ids : [ids];
            return normalizedIds
                .map((id, i) => id ? ({ id, name: usernames[i] }) : null)
                .filter((user): user is { id: number; name: string } => user !== null);
        } catch {
            return [];
        }
    },
    getGroup: (groupId: number) => noblox.getGroup(groupId),
};

export const robloxGroup = {
    id: config.groupId,
    getMember: async (userId: number) => {
        try {
            const rank = await noblox.getRankInGroup(config.groupId, userId);
            if(rank === 0) return null;
            const roles = await noblox.getRoles(config.groupId);
            const role = roles.find((r) => r.rank === rank);
            const username = await noblox.getUsernameFromId(userId);
            return { id: userId, name: username, role: { id: role.id, name: role.name, rank: role.rank } };
        } catch {
            return null;
        }
    },
    getRoles: () => noblox.getRoles(config.groupId),
    updateMember: (userId: number, rankId: number) => noblox.setRank(config.groupId, userId, rankId),
    kickMember: (userId: number) => noblox.exile(config.groupId, userId),
    acceptJoinRequest: (userId: number) => noblox.handleJoinRequest(config.groupId, userId, true),
    declineJoinRequest: (userId: number) => noblox.handleJoinRequest(config.groupId, userId, false),
    getJoinRequest: (userId: number) => noblox.getJoinRequest(config.groupId, userId),
    getJoinRequests: (options?: { limit?: 10 | 25 | 50 | 100 }) => noblox.getJoinRequests(config.groupId, 'Asc', options?.limit || 100),
    updateShout: (content: string) => noblox.shout(config.groupId, content),
};
