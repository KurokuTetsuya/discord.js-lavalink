import { Client, Collection } from "discord.js";
import { Player, PlayerUpdateVoiceState } from "./Player";
import { LavalinkNode, LavalinkNodeOptions } from "./LavalinkNode";
import { EventEmitter } from "events";

export type PlayerManagerOptions = {
    user?: string;
    shards?: number;
    Player?: Player;
};

export type PlayerManagerNodes = {
    host: string;
    port?: number | string;
    password?: string;
};

export type PlayerManagerJoinData = {
    guild: string;
    channel: string;
    host: string;
};

export type PlayerManagerJoinOptions = {
    selfmute?: boolean,
    selfdeaf?: boolean
};

export type VoiceServerUpdateData = {
    token: string;
    guild_id: string;
    endpoint: string;
};

export class PlayerManager extends EventEmitter {
    public client: Client;
    public nodes = new Collection<string, LavalinkNode>();
    public players = new Collection<string, Player>();
    public user: string;
    public shards: number;
    private Player: Player;

    public constructor(client: Client, nodes: LavalinkNodeOptions[], options: PlayerManagerOptions = {}) {
        super();

        if (!client) throw new Error("INVALID_CLIENT: No client provided.");

        this.client = client;
        this.user = client.user ? client.user.id : options.user;
        this.shards = options.shards || client.shard ? client.shard.count : 1;
        this.Player = (options.Player as any) || Player;

        for (const node of nodes) this.createNode(node);

        client.on("raw", message => {
            switch (message.t) {
                case "VOICE_SERVER_UPDATE": this.voiceServerUpdate(message.d);
            }
        });
    }

    public createNode(options: LavalinkNodeOptions): LavalinkNode {
        const node = new LavalinkNode(this, options);

        this.nodes.set(options.host, node);

        return node;
    }

    public removeNode(host: string): boolean {
        const node = this.nodes.get(host);
        if (!node) return false;
        node.removeAllListeners();
        return this.nodes.delete(host);
    }

    public join(data: PlayerManagerJoinData, options: PlayerManagerJoinOptions = { selfdeaf: false, selfmute: false }): Player {
        const player = this.players.get(data.guild);
        if (player) return player;
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

    public async leave(guild: string): Promise<boolean> {
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
        if (!player) return false;
        player.removeAllListeners();
        await player.destroy();
        return this.players.delete(guild);
    }

    public async switch(player: Player, node: LavalinkNode) {
        const { id, channel, track, state, voiceUpdateState } = { ...player };
        const position = (state.position + 2000) || 0;

        // @ts-ignore
        const events = player._events;

        player.removeAllListeners();
        await player.destroy();
        this.players.delete(id);

        const newPlayer = this.spawnPlayer({
            guild: id,
            channel,
            host: node.host
        });

        // @ts-ignore
        newPlayer._events = events;

        await newPlayer.connect((voiceUpdateState as PlayerUpdateVoiceState));
        await newPlayer.volume(state.volume);
        await newPlayer.play(track, { startTime: position });

        return newPlayer;
    }

    /**
     * Used for the Voice Server Update event
     * @param {Object} data Data
     * @returns {void}
     * @private
     */
    public async voiceServerUpdate(data: VoiceServerUpdateData): Promise<void> {
        const guild = this.client.guilds.get(data.guild_id);
        if (!guild) return;
        const player = this.players.get(data.guild_id);
        if (!player) return;
        if (!guild.me) await guild.members.fetch(this.client.user.id).catch(() => null);
        await player.connect({
            // @ts-ignore: support both versions of discord.js
            sessionId: guild.me.voice ? guild.me.voice.sessionID : guild.me.voiceSessionID,
            event: data
        });
    }

    /**
     * Creates or returns a player
     * @param {Object} data Data for the player
     * @param {string} data.guild Player guild id
     * @param {string} data.channel Player channel id
     * @param {string} data.host Player host id
     * @returns {Player}
     */
    private spawnPlayer(data: PlayerManagerJoinData) {
        const exists = this.players.get(data.guild);
        if (exists) return exists;
        const node = this.nodes.get(data.host);
        if (!node) throw new Error(`INVALID_HOST: No available node with ${data.host}`);
        const player: Player = new (this.Player as any)(node, {
            id: data.guild,
            channel: data.channel
        });
        this.players.set(data.guild, player);
        return player;
    }

    public get idealNodes() {
        return this.nodes.filter(node => node.connected).sort((a, b) => {
            const aload = a.stats.cpu ? (a.stats.cpu.systemLoad / a.stats.cpu.cores) * 100 : 0;
            const bload = b.stats.cpu ? (b.stats.cpu.systemLoad / b.stats.cpu.cores) * 100 : 0;
            return aload - bload;
        });
    }

    /**
     * Private function for sending WS packets.
     * @param {Object} data Data for the player
     * @param {number} data.op OP for WS
     * @param {Object} data.d The actual data for the WS
     * @returns {void}
     * @private
     */
    public sendWS(data): void {
        // @ts-ignore: support both versions of discord.js
        return typeof this.client.ws.send === "function" ? this.client.ws.send(data) : this.client.guilds.get(data.d.guild_id).shard.send(data);
    }

}
