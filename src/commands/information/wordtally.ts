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
            description: 'Tally the most said words in a channel for the given month.',
            type: 'ChatInput',
            module: 'information',
            args: [
                {
                    trigger: 'month',
                    description: 'The month to scan (default: current month).',
                    choices: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => ({
                        name: m,
                        value: `${new Date().getFullYear()}-${(i + 1).toString().padStart(2, '0')}-01`
                    })),
                    required: false,
                    type: 'String',
                },
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
            const monthArg = ctx.args?.month ? new Date(ctx.args.month) : new Date();
            const channel = ctx.args?.channel ? await discordClient.channels.fetch(ctx.args.channel) : ctx.subject?.channel;
            const limit = parseInt(ctx.args?.limit as any, 10) || 20;

            const start = new Date(monthArg.getFullYear(), monthArg.getMonth(), 1, 0, 0, 0);
            const end = new Date(monthArg.getFullYear(), monthArg.getMonth() + 1, 1, 0, 0, 0);

            if(!channel || !(channel as any).messages || typeof (channel as any).messages.fetch !== 'function') {
                const embed = new EmbedBuilder()
                    .setAuthor({ name: 'Invalid Channel' })
                    .setColor(mainColor)
                    .setDescription('Please specify a valid text channel to scan.');
                return ctx.reply({ embeds: [embed] });
            }

            const textChannel = channel as any;

            // Fetch messages in batches until we reach the start of the month or a sane fetch limit
            const collected = [] as Array<any>;
            const limitPerFetch = 100;
            const maxMessagesToFetch = 5000; // safety cap
            let lastId: string = null;
            let fetchedTotal = 0;

            while (true) {
                const options: any = { limit: limitPerFetch };
                if (lastId) options.before = lastId;
                const batch = await textChannel.messages.fetch(options);
                if (!batch || batch.size === 0) break;

                for (const msg of batch.values()) {
                    const created = msg.createdAt;
                    if (created >= start && created < end) collected.push(msg);
                }

                const last = batch.last();
                if (!last) break;
                // stop if we've gone past the month we're interested in
                if (last.createdAt < start) break;

                lastId = last.id;
                fetchedTotal += batch.size;
                if (fetchedTotal >= maxMessagesToFetch) break;
            }

            // Tally words
            const stopwords = new Set([
                'members', 'final', 'host', 'mountain', 'inital', 'notes', 'co-host', 'picture', 'expedition', 'summit', 'v0yd', 'report', 'expo', 'log', 'attendees'
            ]);

            const counts: { [k: string]: number } = {};
            for (const msg of collected) {
                if (!msg.content) continue;
                let content: string = msg.content;
                // Remove URLs, mentions, channel/role mentions and custom emojis
                content = content.replace(/https?:\/\/\S+/gi, ' ');
                content = content.replace(/<a?:\w+:\d+>/g, ' ');
                content = content.replace(/<@&?\d+>/g, ' ');
                content = content.replace(/<#\d+>/g, ' ');
                // Strip punctuation (keep apostrophes, hyphens and underscores inside words)
                content = content.replace(/[^A-Za-z0-9_'\-\s]+/g, ' ');
                const words = content.split(/\s+/).filter(Boolean);
                for (let w of words) {
                    w = (w || '').toLowerCase().trim();
                    if (w.length <= 2) continue;
                    if (stopwords.has(w)) continue;
                    counts[w] = (counts[w] || 0) + 1;
                }
            }

            const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            const top = entries.slice(0, limit);

            const monthName = start.toLocaleString('en-US', { month: 'long' });
            const title = `Word Tally — ${monthName} ${start.getFullYear()}`;

            if (top.length === 0) {
                const embed = new EmbedBuilder()
                    .setAuthor({ name: title })
                    .setColor(mainColor)
                    .setDescription('No words found for that month.');
                return ctx.reply({ embeds: [embed] });
            }

            let description = top.map((entry, i) => `**${i + 1}. ${entry[0]}** — ${entry[1]}`).join('\n');
            if (description.length > 4096) description = description.substring(0, 4093) + '...';

            const embed = new EmbedBuilder()
                .setAuthor({ name: title })
                .setColor(mainColor)
                .setDescription(description)
                .setFooter({ text: `Scanned ${collected.length} messages` });

            return ctx.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await ctx.reply({ embeds: [getUnexpectedErrorEmbed()] });
        }
    }
}

export default WordTallyCommand;
