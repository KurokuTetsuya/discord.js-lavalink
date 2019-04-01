/// <reference types="@types/ws" />
/// <reference types="node" />
import * as WebSocket from "ws";
import { EventEmitter } from "events";
import { PlayerManager } from "./PlayerManager";
export declare type LavalinkNodeOptions = {
    host: string;
    port: number | string;
    password?: string;
    reconnectInterval?: number;
};
export declare type LavalinkNodeStats = {
    players: number;
    playingPlayers: number;
    uptime: number;
    memory: {
        free: number;
        used: number;
        allocated: number;
        reservable: number;
    };
    cpu: {
        cores: number;
        systemLoad: number;
        lavalinkLoad: number;
    };
    frameStats?: {
        sent?: number;
        nulled?: number;
        deficit?: number;
    };
};
export declare class LavalinkNode extends EventEmitter {
    options: LavalinkNodeOptions;
    manager: PlayerManager;
    ws: WebSocket;
    private reconnect?;
    stats?: LavalinkNodeStats;
    resumeKey?: string;
    constructor(manager: PlayerManager, options: LavalinkNodeOptions);
    private connect;
    send(msg: object): Promise<boolean>;
    configureResuming(key?: string, timeout?: number): Promise<boolean>;
    destroy(): boolean;
    private _reconnect;
    readonly host: string;
    readonly port: string | number;
    readonly password: string;
    readonly reconnectInterval: number;
    readonly connected: boolean;
    private readonly address;
}
