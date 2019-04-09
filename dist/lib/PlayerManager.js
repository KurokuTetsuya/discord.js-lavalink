"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Player_1 = require("./Player");
const LavalinkNode_1 = require("./LavalinkNode");
const events_1 = require("events");
class PlayerManager extends events_1.EventEmitter {
    constructor(client, nodes, options = {}) {
        super();
        this.nodes = new discord_js_1.Collection();
        this.players = new discord_js_1.Collection();
        if (!client)
            throw new Error("INVALID_CLIENT: No client provided.");
        this.client = client;
        this.user = client.user ? client.user.id : options.user;
        this.shards = options.shards || 1;
        this.Player = options.Player || Player_1.Player;
        for (const node of nodes)
            this.createNode(node);
        client.on("raw", message => {
            switch (message.t) {
                case "VOICE_SERVER_UPDATE": this.voiceServerUpdate(message.d);
            }
        });
    }
    createNode(options) {
        const node = new LavalinkNode_1.LavalinkNode(this, options);
        this.nodes.set(options.host, node);
        return node;
    }
    removeNode(host) {
        const node = this.nodes.get(host);
        if (!node)
            return false;
        node.removeAllListeners();
        return this.nodes.delete(host);
    }
    join(data, options = { selfdeaf: false, selfmute: false }) {
        const player = this.players.get(data.guild);
        if (player)
            return player;
        this.sendWS({
            op: 4,
            d: {
                guild_id: data.guild,
                channel_id: data.channel,
                self_mute: options.selfmute,
                self_deaf: options.selfdeaf
            }
        });
        return this.spawnPlayer(data);
    }
    async leave(guild) {
        this.sendWS({
            op: 4,
            d: {
                guild_id: guild,
                channel_id: null,
                self_mute: false,
                self_deaf: false
            }
        });
        const player = this.players.get(guild);
        if (!player)
            return false;
        player.removeAllListeners();
        await player.destroy();
        return this.players.delete(guild);
    }
    async switch(player, node) {
        const { id, channel, track, state, voiceUpdateState } = { ...player };
        const position = (state.position + 2000) || 0;
        await player.destroy();
        player.node = node;
        await player.connect(voiceUpdateState);
        await player.volume(state.volume);
        await player.equalizer(state.equalizer);
        await player.play(track, { startTime: position });
        return player;
    }
    async voiceServerUpdate(data) {
        const guild = this.client.guilds.get(data.guild_id);
        if (!guild)
            return;
        const player = this.players.get(data.guild_id);
        if (!player)
            return;
        if (!guild.me)
            await guild.members.fetch(this.client.user.id).catch(() => null);
        await player.connect({
            sessionId: guild.me.voice ? guild.me.voice.sessionID : guild.me.voiceSessionID,
            event: data
        });
    }
    spawnPlayer(data) {
        const exists = this.players.get(data.guild);
        if (exists)
            return exists;
        const node = this.nodes.get(data.host);
        if (!node)
            throw new Error(`INVALID_HOST: No available node with ${data.host}`);
        const player = new this.Player(node, {
            id: data.guild,
            channel: data.channel
        });
        this.players.set(data.guild, player);
        return player;
    }
    get idealNodes() {
        return this.nodes.filter(node => node.connected).sort((a, b) => {
            const aload = a.stats.cpu ? (a.stats.cpu.systemLoad / a.stats.cpu.cores) * 100 : 0;
            const bload = b.stats.cpu ? (b.stats.cpu.systemLoad / b.stats.cpu.cores) * 100 : 0;
            return aload - bload;
        });
    }
    sendWS(data) {
        if (!this.client.guilds.has(data.d.guild_id))
            return;
        return typeof this.client.ws.send === "function" ? this.client.ws.send(data) : this.client.guilds.get(data.d.guild_id).shard.send(data);
    }
}
exports.PlayerManager = PlayerManager;
//# sourceMappingURL=PlayerManager.js.map