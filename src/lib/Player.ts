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
    positon?: number;
    volume: number;
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

export class Player extends EventEmitter {
    public client: Client;
    public manager: PlayerManager;
    public node: LavalinkNode;
    public id: string;
    public channel: string;
    public state: PlayerState = { volume: 100 };
    public playing: boolean = false;
    public timestamp?: number = null;
    public paused: boolean = false;

    public constructor(node: LavalinkNode, options: PlayerOptions) {
        super();

        this.client = node.manager.client;
        this.manager = node.manager;
        this.node = node;

        this.id = options.id;
        this.channel = options.channel;

        this.on("event", data => {
            switch (data.type) {
                case "TrackEndEvent": {
                    if (data.reason !== "REPLACED") this.playing = false;
                    if (this.listenerCount("end")) this.emit("end", data);
                }
                case "TrackExceptionEvent": {
                    if (this.listenerCount("error")) return this.emit("error", data);
                }
                case "TrackStuckEvent": {
                    this.stop();
                    if (this.listenerCount("end")) this.emit("end", data);
                }
                default: return this.emit("warn", `Unexpected event type: ${data.type}`);
            }
        });
    }

    public async play(track: string, options: PlayerPlayOptions = { startTime: 0, endTime: 0, noReplace: false }) {
        const d = await this.send("play", {
            track,
            ...options
        });
        this.playing = true;
        this.timestamp = Date.now();
        return d;
    }

    public async stop() {
        const d = await this.send("stop");
        this.playing = false;
        this.timestamp = null;
        return d;
    }

    public async pause(pause: boolean = true) {
        const d = await this.send("pause", { pause });
        this.paused = pause;
        return d;
    }

    public resume() {
        return this.pause(false);
    }

    public async volume(volume: number) {
        const d = await this.send("volume", { volume });
        this.state.volume = volume;
        return d;
    }

    public seek(position: number) {
        return this.send("seek", { position });
    }

    public equalizer(bands: PlayerEqualizerBands) {
        return this.send("equalizer", { bands });
    }

    public destroy() {
        return this.send("destroy");
    }

    public connect(data) {
        return this.send("voiceUpdate", {
            sessionId: data.sessionId,
            event: data.event
        });
    }

    private send(op: string, data?: object) {
        if (!this.node.OPEN) return Promise.reject(new Error("No available websocket connection for selected node."));
        return this.node.send({
            ...data,
            op,
            guildId: this.id
        });
    }
}
