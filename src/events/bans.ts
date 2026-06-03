import { robloxGroup } from '../main.ts';
import { config } from '../config.ts';
import { provider } from '../database/index.ts';

const checkBans = async () => {
    try {
        const bannedUsers = await provider.findBannedUsers();
        bannedUsers.forEach(async (user) => {
            try {
                const member = await robloxGroup.getMember(Number(user.robloxId)); 
                if(!member) throw new Error();
                if(member) {
                    await robloxGroup.kickMember(member.id);
                }
            } catch (err) {};
        });
    } catch (err) {
        console.error(err);
    }
    setTimeout(checkBans, 30000);
}

export { checkBans };