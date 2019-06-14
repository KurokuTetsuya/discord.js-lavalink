/// <reference types="node" />
import { EventEmitter } from "events";
import { PlayerManager } from "./PlayerManager";
import { LavalinkNode } from "./LavalinkNode";
import { Client } from "discord.js";
export interface PlayerOptions {
    id: string;
    channel: string;
}
export interface PlayerState {
    time?: number;
    position?: number;
    volume: number;
    equalizer: PlayerEqualizerBand[];
}
export interface PlayerPlayOptions {
    startTime?: number;
    endTime?: number;
    noReplace?: boolean;
    pause?: boolean;
    volume?: number;
}
export interface PlayerEqualizerBand {
    band: number;
    gain: number;
}
export interface PlayerUpdateVoiceState {
    sessionId: string;
    event: {
        token: string;
        guild_id: string;
        endpoint: string;
    };
}
export declare class Player extends EventEmitter {
    client: Client;
    manager: PlayerManager;
    node: LavalinkNode;
    id: string;
    channel: string;
    state: PlayerState;
    playing: boolean;
    timestamp: number | null;
    paused: boolean;
    track: string | null;
    voiceUpdateState: PlayerUpdateVoiceState | null;
    constructor(node: LavalinkNode, options: PlayerOptions);
    play(track: string, options?: PlayerPlayOptions): Promise<boolean>;
    stop(): Promise<boolean>;
    pause(pause?: boolean): Promise<boolean>;
    resume(): Promise<boolean>;
    volume(volume: number): Promise<boolean>;
    seek(position: number): Promise<boolean>;
    equalizer(bands: PlayerEqualizerBand[]): Promise<boolean>;
    destroy(): Promise<boolean>;
    connect(data: PlayerUpdateVoiceState): Promise<boolean>;
    private send;
}
