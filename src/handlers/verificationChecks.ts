import type { GroupMember, User } from '../structures/types.d.ts';
import { robloxGroup } from '../main.ts';
import { getLinkedRobloxUser } from './accountLinks.ts';

const checkActionEligibility = async (discordId: string, guildId: string, targetMember: GroupMember, rankingTo: number): Promise<boolean>  => {
    let robloxUser: User;
    try {
        robloxUser = await getLinkedRobloxUser(discordId);
    } catch (err) {
        return false;
    }

    let robloxMember: GroupMember;
    try {
        robloxMember = await robloxGroup.getMember(robloxUser.id);
        if(!robloxMember) throw new Error();
    } catch (err) {
        return false;
    }

    if(robloxMember.role.rank <= targetMember.role.rank) return false;
    if(robloxMember.role.rank <= rankingTo) return false;
    if(robloxMember.id === targetMember.id) return false;
    return true;
}

export { checkActionEligibility };