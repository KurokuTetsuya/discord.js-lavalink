/// <reference types="node" />
import { Client, Collection } from "discord.js";
import { Player } from "./Player";
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
export declare class PlayerManager extends EventEmitter {
    client: Client;
    nodes: Collection<string, LavalinkNode>;
    players: Collection<string, Player>;
    voiceServers: Collection<string, VoiceServerUpdate>;
    voiceStates: Collection<string, VoiceStateUpdate>;
    user: string;
    shards: number;
    private Player;
    constructor(client: Client, nodes: LavalinkNodeOptions[], options?: PlayerManagerOptions);
    createNode(options: LavalinkNodeOptions): LavalinkNode;
    removeNode(host: string): boolean;
    join(data: PlayerManagerJoinData, { selfmute, selfdeaf }?: PlayerManagerJoinOptions): Player;
    leave(guild: string): Promise<boolean>;
    switch(player: Player, node: LavalinkNode): Promise<Player>;
    voiceServerUpdate(data: VoiceServerUpdate): Promise<boolean>;
    voiceStateUpdate(data: VoiceStateUpdate): Promise<boolean>;
    private _attemptConnection;
    private spawnPlayer;
    readonly idealNodes: Collection<string, LavalinkNode>;
    sendWS(data: any): void;
}
