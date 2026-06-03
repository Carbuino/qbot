import { config } from '../config.ts';
import { logAction } from '../handlers/handleLogging.ts';
import noblox from 'noblox.js';

const checkWallForAds = async () => {
    setTimeout(checkWallForAds, 30000);
    try {
        const posts = await noblox.getWall(config.groupId, 'Desc', 100);
        posts.data?.forEach((post, index) => {
            setTimeout(async () => {
                if(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*)/gm.test(post.body)) {
                    await noblox.deleteWallPost(config.groupId, post.id);
                }
            }, 1000 * index);
        });
    } catch (err) {
        console.error(err);
    }
}

export { checkWallForAds };
