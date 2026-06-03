import { ActivityType } from 'discord.js';
import type { BotConfig } from './structures/types'; 

export const config: BotConfig = {
    groupId: 5039397,
    slashCommands: true,
    legacyCommands: {
        enabled: false,
        prefixes: ['q!'],
    },
    permissions: {
		// @Commissioner, @Program Director, @Founder, @Admin (#happyplace), @V0YD Bot
        all: ['598772957237608458','598133902053474304','705775681715568651', '898663114847952956','853946662295699486'],
        ranking: [''],
		// @XP permissions
        users: ['1017876633522274445'],
        shout: [''],
        join: [''],
        signal: [''],
        admin: [''],
    },
    logChannels: {
        actions: '',
        shout: '',
    },
    api: false,
    maximumRank: 255,
    verificationChecks: false,
    bloxlinkGuildId: '',
    firedRank: 1,
    suspendedRank: 1,
    recordManualActions: true,
    memberCount: {
        enabled: false,
        channelId: '726022531483697203',
        milestone: 1000,
        onlyMilestones: true,
    },
    xpSystem: {
        enabled: true,
        autoRankup: true,
        roles: [
            {
                rank: 28,
                xp: 1000,
            },
            {
                rank: 27,
                xp: 920,
            },
            {
                rank: 26,
                xp: 830,
            },
            {
                rank: 25,
                xp: 750,
            },
            {
                rank: 24,
                xp: 680,
            },
            {
                rank: 23,
                xp: 610,
            },
            {
                rank: 22,
                xp: 550,
            },
            {
                rank: 21,
                xp: 500,
            },
            {
                rank: 20,
                xp: 450,
            },
            {
                rank: 19,
                xp: 405,
            },
            {
                rank: 18,
                xp: 360,
            },
            {
                rank: 17,
                xp: 320,
            },
	    {
                rank: 16,
                xp: 280,
            },
            {
                rank: 15,
                xp: 245,
            },
            {
                rank: 14,
                xp: 210,
            },
            {
                rank: 13,
                xp: 180,
            },
            {
                rank: 12,
                xp: 150,
            },
            {
                rank: 11,
                xp: 125,
            },
            {
                rank: 10,
                xp: 100,
            },
            {
                rank: 9,
                xp: 80,
            },
            {
                rank: 8,
                xp: 60,
            },
            {
                rank: 7,
                xp: 45,
            },
            {
                rank: 6,
                xp: 30,
            },
            {
                rank: 5,
                xp: 20,
            },
            {
                rank: 4,
                xp: 15,
            },
            {
                rank: 3,
                xp: 10,
            },
            {
                rank: 2,
                xp: 5,
            },
        ],
    },
    antiAbuse: {
        enabled: false,
        clearDuration: 1 * 60,
        threshold: 10,
        demotionRank: 1,
    },
    activity: {
        enabled: true,
        type: ActivityType.Watching,
        value: 'the Expeditions! (2025-11-03)',
    },
    status: 'online',
    deleteWallURLs: true,
}
