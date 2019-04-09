/// <reference types="node" />
import { EventEmitter } from "events";
import { PlayerManager } from "./PlayerManager";
import { LavalinkNode } from "./LavalinkNode";
import { Client } from "discord.js";
export declare type PlayerOptions = {
    id: string;
    channel: string;
};
export declare type PlayerState = {
    time?: number;
    position?: number;
    volume: number;
    equalizer: PlayerEqualizerBands;
};
export declare type PlayerPlayOptions = {
    startTime?: number;
    endTime?: number;
    noReplace?: boolean;
};
export declare type PlayerEqualizerBands = {
    band: number;
    gain: number;
}[];
export declare type PlayerUpdateVoiceState = {
    sessionId: string;
    event: {
        token: string;
        guild_id: string;
        endpoint: string;
    };
};
export declare class Player extends EventEmitter {
    client: Client;
    manager: PlayerManager;
    node: LavalinkNode;
    id: string;
    channel: string;
    state: PlayerState;
    playing: boolean;
    timestamp?: number;
    paused: boolean;
    track?: string;
    voiceUpdateState: {};
    constructor(node: LavalinkNode, options: PlayerOptions);
    play(track: string, options?: PlayerPlayOptions): Promise<boolean>;
    stop(): Promise<boolean>;
    pause(pause?: boolean): Promise<boolean>;
    resume(): Promise<boolean>;
    volume(volume: number): Promise<boolean>;
    seek(position: number): Promise<boolean>;
    equalizer(bands: PlayerEqualizerBands): Promise<boolean>;
    destroy(): Promise<boolean>;
    connect(data: PlayerUpdateVoiceState): Promise<boolean>;
    private send;
}
