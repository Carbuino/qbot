import { discordClient } from '../../main.ts';
import { CommandContext } from '../../structures/addons/CommandAddons.ts';
import { Command } from '../../structures/Command.ts';
import { EmbedBuilder } from 'discord.js';
import { mainColor, getUnexpectedErrorEmbed } from '../../handlers/locale.ts';
import { config } from '../../config.ts';

class WordTallyCommand extends Command {
    constructor() {
        super({
            trigger: 'wordtally',
            description: 'Tally the most said words in a channel for the last month (case-insensitive).',
            type: 'ChatInput',
            module: 'information',
            args: [
                {
                    trigger: 'channel',
                    description: 'The channel to scan (defaults to the current channel).',
                    required: false,
                    type: 'DiscordChannel',
                },
                {
                    trigger: 'limit',
                    description: 'How many top words to show (default: 20).',
                    required: false,
                    type: 'Number',
                }
            ]
        });
    }

    async run(ctx: CommandContext) {
        try {
            const limitArg = ctx.args['limit'];
            const limit = typeof limitArg === 'number' && limitArg > 0 ? Math.min(100, Math.floor(limitArg)) : 20;

            // Hardcoded blacklist (case-insensitive stopwords and common tokens)
            const blacklistSet = new Set<string>([
                "V0YD", "Expedition", "Report", "Host", "Co-Host", "Mountain", "Initial", "Final", "Members", "Notes", "Summit", "Picture"
            ]);

            // Resolve channel
            let channel: any = ctx.args['channel'];
            if(!channel) {
                // Try to use the subject channel (works for message or interaction)
                // @ts-ignore
                channel = ctx.subject && (ctx.subject as any).channel ? (ctx.subject as any).channel : null;
                // If still not found, try channelId on interaction
                // @ts-ignore
                if(!channel && ctx.subject && (ctx.subject as any).channelId) {
                    // @ts-ignore
                    channel = await discordClient.channels.fetch((ctx.subject as any).channelId as string);
                }
            } else {
                // If the provided arg is an ID string, fetch the channel to ensure messages are available
                if(typeof channel === 'string') {
                    channel = await discordClient.channels.fetch(channel as string);
                } else if(channel && channel.id && !('messages' in channel)) {
                    channel = await discordClient.channels.fetch(channel.id);
                }
            }

            if(!channel || !('messages' in channel)) {
                return ctx.reply('Please specify a text channel to scan, or run this command in a text channel.');
            }

            await ctx.defer();

            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

            const counts = new Map<string, number>();

            let lastId: string | undefined = undefined;
            while(true) {
                const fetchOptions: any = { limit: 100 };
                if(lastId) fetchOptions.before = lastId;
                const fetched = await channel.messages.fetch(fetchOptions);
                if(!fetched || fetched.size === 0) break;

                for(const message of fetched.values()) {
                    if(!message || !message.createdAt) continue;
                    if(message.createdAt < oneMonthAgo) continue;
                    if(message.author && message.author.bot) continue;

                    let text = message.content || '';
                    if(!text) continue;

                    // Remove code blocks and inline code, and URLs
                    text = text.replace(/```[\s\S]*?```/g, ' ');
                    text = text.replace(/`[^`]*`/g, ' ');
                    text = text.replace(/https?:\/\/\S+/g, ' ');

                    const words = text.toLowerCase().match(/[a-z0-9']+/g);
                    if(!words) continue;
                    for(const w of words) {
                        if(blacklistSet.has(w)) continue;
                        counts.set(w, (counts.get(w) || 0) + 1);
                    }
                }

                const last = fetched.last();
                if(!last) break;
                if(last.createdAt < oneMonthAgo) break;
                lastId = last.id;
                if(fetched.size < 100) break;
            }

            const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
            const top = sorted.slice(0, limit);

            if(top.length === 0) return ctx.reply('No words found in the last month for that channel.');

            const description = top.map((t, i) => `**${i + 1}.** ${t[0]} — ${t[1]}`).join('\n');
            const embed = new EmbedBuilder()
                .setTitle(`Most said words in #${channel.name} (last month)`)
                .setColor(mainColor)
                .setDescription(description)
                .setTimestamp();

            return ctx.reply({ embeds: [ embed ] });
        } catch (err) {
            console.error(err);
            return ctx.reply({ embeds: [ getUnexpectedErrorEmbed() ] });
        }
    }
}

export default WordTallyCommand;
