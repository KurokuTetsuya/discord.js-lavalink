import { EventEmitter } from "events";
import { PlayerManager } from "./PlayerManager";
import { LavalinkNode } from "./LavalinkNode";
import { Client } from "discord.js";

export type PlayerOptions = {
    id: string;
    channel: string
};

export type PlayerState = {
    time?: number;
    position?: number;
    volume: number;
    equalizer: PlayerEqualizerBands;
};

export type PlayerPlayOptions = {
    startTime?: number;
    endTime?: number;
    noReplace?: boolean;
};

export type PlayerEqualizerBands = {
    band: number;
    gain: number;
}[];

export type PlayerUpdateVoiceState = {
    sessionId: string;
    event: {
        token: string;
        guild_id: string;
        endpoint: string;
    };
};

export class Player extends EventEmitter {
    public client: Client;
    public manager: PlayerManager;
    public node: LavalinkNode;
    public id: string;
    public channel: string;
    public state: PlayerState = { volume: 100, equalizer: [] };
    public playing: boolean = false;
    public timestamp?: number = null;
    public paused: boolean = false;
    public track?: string = null;
    public voiceUpdateState = {};

    public constructor(node: LavalinkNode, options: PlayerOptions) {
        super();

        this.client = node.manager.client;
        this.manager = node.manager;
        this.node = node;

        this.id = options.id;
        this.channel = options.channel;

        this.on("event", data => {
            switch (data.type) {
                case "TrackEndEvent":
                    if (data.reason !== "REPLACED") this.playing = false;
                    this.track = null;
                    this.timestamp = null;
                    if (this.listenerCount("end")) this.emit("end", data);
                    break;
                case "TrackExceptionEvent":
                    if (this.listenerCount("error")) this.emit("error", data);
                    break;
                case "TrackStuckEvent":
                    this.stop();
                    if (this.listenerCount("end")) this.emit("end", data);
                    break;
                case "WebSocketClosedEvent":
                    if (this.listenerCount("error")) this.emit("error", data);
                    break;
                default:
                    if (this.listenerCount("warn")) this.emit("warn", `Unexpected event type: ${data.type}`);
                    break;
            }
        })
        .on("playerUpdate", data => {
            this.state = { volume: this.state.volume, ...data.state };
        });
    }

    public async play(track: string, options: PlayerPlayOptions = {}): Promise<boolean> {
        const d = await this.send("play", { ...options, track });
        this.track = track;
        this.playing = true;
        this.timestamp = Date.now();
        return d;
    }

    public async stop(): Promise<boolean> {
        const d = await this.send("stop");
        this.playing = false;
        this.timestamp = null;
        return d;
    }

    public async pause(pause: boolean = true): Promise<boolean> {
        const d = await this.send("pause", { pause });
        this.paused = pause;
        return d;
    }

    public resume(): Promise<boolean> {
        return this.pause(false);
    }

    public async volume(volume: number): Promise<boolean> {
        const d = await this.send("volume", { volume });
        this.state.volume = volume;
        return d;
    }

    public seek(position: number): Promise<boolean> {
        return this.send("seek", { position });
    }

    public async equalizer(bands: PlayerEqualizerBands): Promise<boolean> {
        const d = await this.send("equalizer", { bands });
        this.state.equalizer = bands;
        return d;
    }

    public destroy(): Promise<boolean> {
        return this.send("destroy");
    }

    public connect(data: PlayerUpdateVoiceState): Promise<boolean> {
        this.voiceUpdateState = data;
        return this.send("voiceUpdate", data);
    }

    private send(op: string, data?: object): Promise<boolean> {
        if (!this.node.connected) return Promise.reject(new Error("No available websocket connection for selected node."));
        return this.node.send({
            ...data,
            op,
            guildId: this.id
        });
    }
}
