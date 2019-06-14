import { Client, Collection } from "discord.js";
import { Player, PlayerUpdateVoiceState } from "./Player";
import { LavalinkNode, LavalinkNodeOptions } from "./LavalinkNode";
import { EventEmitter } from "events";

export interface PlayerManagerOptions {
    user?: string;
    shards?: number;
    Player?: Player;
}

export interface PlayerManagerNodes {
    host: string;
    port?: number | string;
    password?: string;
}

export interface PlayerManagerJoinData {
    guild: string;
    channel: string;
    host: string;
}

export interface PlayerManagerJoinOptions {
    selfmute?: boolean;
    selfdeaf?: boolean;
}

export interface VoiceServerUpdate {
    token: string;
    guild_id: string;
    endpoint: string;
}

export interface VoiceStateUpdate {
    guild_id: string;
    channel_id?: string;
    user_id: string;
    session_id: string;
    deaf?: boolean;
    mute?: boolean;
    self_deaf?: boolean;
    self_mute?: boolean;
    suppress?: boolean;
}

export class PlayerManager extends EventEmitter {

    public client: Client;
    public nodes = new Collection<string, LavalinkNode>();
    public players = new Collection<string, Player>();
    public voiceServers = new Collection<string, VoiceServerUpdate>();
    public voiceStates = new Collection<string, VoiceStateUpdate>();
    public user: string;
    public shards: number;
    private Player: Player;

    public constructor(client: Client, nodes: LavalinkNodeOptions[], options: PlayerManagerOptions = {}) {
        super();

        if (!client) throw new Error("INVALID_CLIENT: No client provided.");

        this.client = client;
        this.user = client.user ? client.user.id : options.user;
        this.shards = options.shards || 1;
        this.Player = options.Player as any || Player;

        for (const node of nodes) this.createNode(node);

        client.on("raw", packet => {
            if (packet.t === "VOICE_SERVER_UPDATE") this.voiceServerUpdate(packet.d);
            if (packet.t === "VOICE_STATE_UPDATE") this.voiceStateUpdate(packet.d);
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

    public join(data: PlayerManagerJoinData, { selfmute = false, selfdeaf = false }: PlayerManagerJoinOptions = {}): Player {
        const player = this.players.get(data.guild);
        if (player) return player;
        this.sendWS({
            op: 4,
            d: {
                guild_id: data.guild,
                channel_id: data.channel,
                self_mute: selfmute,
                self_deaf: selfdeaf
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

    public async switch(player: Player, node: LavalinkNode): Promise<Player> {
        const { track, state, voiceUpdateState } = { ...player } as any;
        const position = state.position ? state.position + 2000 : 2000;

        await player.destroy();

        player.node = node;

        await player.connect(voiceUpdateState as PlayerUpdateVoiceState);
        await player.volume(state.volume);
        await player.equalizer(state.equalizer);
        await player.play(track, { startTime: position });

        return player;
    }

    public voiceServerUpdate(data: VoiceServerUpdate): Promise<boolean> {
        this.voiceServers.set(data.guild_id, data);
        return this._attemptConnection(data.guild_id);
    }

    public voiceStateUpdate(data: VoiceStateUpdate): Promise<boolean> {
        if (data.user_id !== this.client.user.id) return Promise.resolve(false);

        if (data.channel_id) {
            this.voiceStates.set(data.guild_id, data);
            return this._attemptConnection(data.guild_id);
        }

        this.voiceServers.delete(data.guild_id);
        this.voiceStates.delete(data.guild_id);

        return Promise.resolve(false);
    }

    private async _attemptConnection(guildId): Promise<boolean> {
        const server = this.voiceServers.get(guildId);
        const state = this.voiceStates.get(guildId);

        if (!server || !state) return false;

        const guild = this.client.guilds.get(guildId);
        if (!guild) return false;
        const player = this.players.get(guildId);
        if (!player) return false;

        await player.connect({ sessionId: state.session_id, event: server });
        this.voiceServers.delete(guildId);
        this.voiceStates.delete(guildId);
        return true;
    }

    private spawnPlayer(data: PlayerManagerJoinData): Player {
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

    public get idealNodes(): Collection<string, LavalinkNode> {
        return this.nodes.filter(node => node.connected).sort((a, b) => {
            const aload = a.stats.cpu ? a.stats.cpu.systemLoad / a.stats.cpu.cores * 100 : 0;
            const bload = b.stats.cpu ? b.stats.cpu.systemLoad / b.stats.cpu.cores * 100 : 0;
            return aload - bload;
        });
    }

    public sendWS(data): void {
        const guild = this.client.guilds.get(data.d.guild_id);
        if (!guild) return;
        return this.client.ws.shards ? this.client.ws.shards.get(guild.shardID).send(data) : (this.client as any).ws.send(data);
    }

}
