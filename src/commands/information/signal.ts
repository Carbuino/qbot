import { CommandContext } from '../../structures/addons/CommandAddons.ts';
import { Command } from '../../structures/Command.ts';
import { getSuccessfulSignalEmbed } from '../../handlers/locale.ts';
import { addSignal } from '../../api.ts';
import { config } from '../../config.ts';

class SignalCommand extends Command {
    constructor() {
        super({
            trigger: 'signal',
            description: 'If configured, this will store a command and make it available through our API.',
            type: 'ChatInput',
            module: 'information',
            args: [
                {
                    trigger: 'signal',
                    description: 'What signal/command would you like to run?',
                    required: false,
                    type: 'String',
                },
            ],
            permissions: [
                {
                    type: 'role',
                    ids: config.permissions.signal,
                    value: true,
                }
            ]
        });
    }

    async run(ctx: CommandContext) {
        addSignal(ctx.args['signal']);
        return ctx.reply({ embeds: [ getSuccessfulSignalEmbed() ] });
    }
}

export default SignalCommand;