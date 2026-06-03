import { QbotClient } from './structures/QbotClient.ts';
import noblox from 'noblox.js';
import { handleInteraction } from './handlers/handleInteraction.ts';
import { handleLegacyCommand } from './handlers/handleLegacyCommand.ts';
import { config } from './config.ts'; 
import { recordShout } from './events/shout.ts';
import { checkSuspensions } from './events/suspensions.ts';
import { recordAuditLogs } from './events/audit.ts';
import { recordMemberCount } from './events/member.ts';
import { clearActions } from './handlers/abuseDetection.ts';
import { checkBans } from './events/bans.ts';
import { checkWallForAds } from './events/wall.ts';
import { robloxClient, robloxGroup } from './structures/RobloxClient.ts';
import 'dotenv/config';
import './api.ts'; // starts the Express API server

// [Ensure Setup]
if(!process.env.ROBLOX_COOKIE) {
    console.error('ROBLOX_COOKIE is not set in the .env file.');
    process.exit(1);
}

// [Clients]
const discordClient = new QbotClient();
discordClient.login(process.env.DISCORD_TOKEN);

(async () => {
    const currentUser = await noblox.setCookie(process.env.ROBLOX_COOKIE).catch(console.error);
    if(currentUser) {
        robloxClient.user.id = currentUser.id;
    }

    // [Events]
    checkSuspensions();
    checkBans();
    if(config.logChannels.shout) recordShout();
    if(config.recordManualActions) recordAuditLogs();
    if(config.memberCount.enabled) recordMemberCount();
    if(config.antiAbuse.enabled) clearActions();
    if(config.deleteWallURLs) checkWallForAds();
})();

// [Handlers]
discordClient.on('interactionCreate', handleInteraction as any);
discordClient.on('messageCreate', handleLegacyCommand);

// [Module]
export { discordClient, robloxClient, robloxGroup };
