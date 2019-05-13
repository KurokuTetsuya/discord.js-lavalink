"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
class Player extends events_1.EventEmitter {
    constructor(node, options) {
        super();
        this.state = { volume: 100, equalizer: [] };
        this.playing = false;
        this.timestamp = null;
        this.paused = false;
        this.track = null;
        this.voiceUpdateState = {};
        this.client = node.manager.client;
        this.manager = node.manager;
        this.node = node;
        this.id = options.id;
        this.channel = options.channel;
        this.on("event", data => {
            switch (data.type) {
                case "TrackEndEvent": {
                    if (data.reason !== "REPLACED")
                        this.playing = false;
                    this.track = null;
                    this.timestamp = null;
                    if (this.listenerCount("end"))
                        this.emit("end", data);
                }
                case "TrackExceptionEvent": {
                    if (this.listenerCount("error"))
                        this.emit("error", data);
                }
                case "TrackStuckEvent": {
                    this.stop();
                    if (this.listenerCount("end"))
                        this.emit("end", data);
                }
                case "WebSocketClosedEvent": {
                    if (this.listenerCount("error"))
                        this.emit("error", data);
                }
                default: if (this.listenerCount("warn"))
                    this.emit("warn", `Unexpected event type: ${data.type}`);
            }
        })
            .on("playerUpdate", data => {
            this.state = { volume: this.state.volume, ...data.state };
        });
    }
    async play(track, options = {}) {
        const d = await this.send("play", { ...options, track });
        this.track = track;
        this.playing = true;
        this.timestamp = Date.now();
        return d;
    }
    async stop() {
        const d = await this.send("stop");
        this.playing = false;
        this.timestamp = null;
        return d;
    }
    async pause(pause = true) {
        const d = await this.send("pause", { pause });
        this.paused = pause;
        return d;
    }
    resume() {
        return this.pause(false);
    }
    async volume(volume) {
        const d = await this.send("volume", { volume });
        this.state.volume = volume;
        return d;
    }
    seek(position) {
        return this.send("seek", { position });
    }
    async equalizer(bands) {
        const d = await this.send("equalizer", { bands });
        this.state.equalizer = bands;
        return d;
    }
    destroy() {
        return this.send("destroy");
    }
    connect(data) {
        this.voiceUpdateState = data;
        return this.send("voiceUpdate", data);
    }
    send(op, data) {
        if (!this.node.connected)
            return Promise.reject(new Error("No available websocket connection for selected node."));
        return this.node.send({
            ...data,
            op,
            guildId: this.id
        });
    }
}
exports.Player = Player;
//# sourceMappingURL=Player.js.map