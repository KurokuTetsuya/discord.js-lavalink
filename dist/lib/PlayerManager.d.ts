/// <reference types="node" />
import { Client, Collection } from "discord.js";
import { Player } from "./Player";
import { LavalinkNode, LavalinkNodeOptions } from "./LavalinkNode";
import { EventEmitter } from "events";
export declare type PlayerManagerOptions = {
    user: string;
    shards: number;
    Player?: Player;
};
export declare type PlayerManagerNodes = {
    host: string;
    port?: number | string;
    password?: string;
};
export declare type PlayerManagerJoinData = {
    guild: string;
    channel: string;
    host: string;
};
export declare type PlayerManagerJoinOptions = {
    selfmute?: boolean;
    selfdeaf?: boolean;
};
export declare type VoiceServerUpdateData = {
    token: string;
    guild_id: string;
    endpoint: string;
};
export declare class PlayerManager extends EventEmitter {
    client: Client;
    nodes: Collection<string, LavalinkNode>;
    players: Collection<string, Player>;
    user: string;
    shards: number;
    private Player;
    constructor(client: Client, nodes: LavalinkNodeOptions[], options: PlayerManagerOptions);
    createNode(options: LavalinkNodeOptions): LavalinkNode;
    removeNode(host: string): boolean;
    join(data: PlayerManagerJoinData, options?: PlayerManagerJoinOptions): Player;
    leave(guild: string): Promise<boolean>;
    switch(player: Player, node: LavalinkNode): Promise<Player>;
    voiceServerUpdate(data: VoiceServerUpdateData): Promise<void>;
    private spawnPlayer;
    readonly idealNode: LavalinkNode;
    sendWS(data: any): void;
}
