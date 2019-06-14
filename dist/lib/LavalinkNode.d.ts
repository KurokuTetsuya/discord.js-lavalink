/// <reference types="node" />
import * as WebSocket from "ws";
import { EventEmitter } from "events";
import { PlayerManager } from "./PlayerManager";
export interface LavalinkNodeOptions {
    host: string;
    port: number | string;
    password?: string;
    reconnectInterval?: number;
}
export interface LavalinkNodeStats {
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
}
export declare class LavalinkNode extends EventEmitter {
    manager: PlayerManager;
    host: string;
    port: number | string;
    reconnectInterval: number;
    password: string;
    ws: WebSocket | null;
    private reconnect?;
    stats: LavalinkNodeStats;
    resumeKey?: string;
    constructor(manager: PlayerManager, options: LavalinkNodeOptions);
    private connect;
    private onOpen;
    private onMessage;
    private onError;
    private onClose;
    send(msg: object): Promise<boolean>;
    configureResuming(key?: string, timeout?: number): Promise<boolean>;
    destroy(): boolean;
    private _reconnect;
    readonly connected: boolean;
}
