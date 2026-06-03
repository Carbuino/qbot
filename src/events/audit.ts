import { robloxClient, robloxGroup } from '../main.ts';
import { logAction } from '../handlers/handleLogging.ts';
import { config } from '../config.ts';
import noblox from 'noblox.js';

let lastRecordedDate: number;

const recordAuditLogs = async () => {
    try {
        const auditLog = await noblox.getAuditLog(config.groupId, 'ChangeRank', undefined, 'Desc', 10);
        const mostRecentDate = new Date(auditLog.data?.[0].created).getTime();
        if(lastRecordedDate) {
            const groupRoles = await robloxGroup.getRoles();
            auditLog.data.forEach(async (log) => {
                if(robloxClient.user.id !== log.actor.user.userId) {
                    const logCreationDate = new Date(log.created);
                    if(Math.round(logCreationDate.getTime() / 1000) > Math.round(lastRecordedDate / 1000)) {
                        const oldRole = groupRoles.find((role) => role.id === log.description['OldRoleSetId']);
                        const newRole = groupRoles.find((role) => role.id === log.description['NewRoleSetId']);
                        const target = await robloxClient.getUser(log.description['TargetId']);
                        logAction('Manual Set Rank', log.actor.user, null, target, `${oldRole.name} (${oldRole.rank}) ? ${newRole.name} (${newRole.rank})`);
                    }
                }
            });
            lastRecordedDate = mostRecentDate;
        } else {
            lastRecordedDate = mostRecentDate;
        }
    } catch (err) {
        console.error(err);
    }
    setTimeout(recordAuditLogs, 60000);
}

export { recordAuditLogs };
