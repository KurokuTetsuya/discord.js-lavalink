"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const WebSocket = require("ws");
const events_1 = require("events");
class LavalinkNode extends events_1.EventEmitter {
    constructor(manager, options) {
        super();
        this.manager = manager;
        this.host = options.host;
        this.port = options.port || 2333;
        this.reconnectInterval = options.reconnectInterval || 5000;
        Object.defineProperty(this, "password", { value: options.password || "youshallnotpass" });
        Object.defineProperty(this, "address", { value: `ws://${this.host}:${this.port}` });
        this.ws = null;
        this.stats = {
            players: 0,
            playingPlayers: 0,
            uptime: 0,
            memory: {
                free: 0,
                used: 0,
                allocated: 0,
                reservable: 0
            },
            cpu: {
                cores: 0,
                systemLoad: 0,
                lavalinkLoad: 0
            }
        };
        this.connect();
    }
    connect() {
        if (this.connected)
            this.ws.close();
        const headers = {
            Authorization: this.password,
            "Num-Shards": String(this.manager.shards || 1),
            "User-Id": this.manager.user
        };
        if (this.resumeKey)
            headers["Resume-Key"] = this.resumeKey;
        this.ws = new WebSocket(this.address, { headers });
        this.ws.onopen = this.onOpen.bind(this);
        this.ws.onmessage = this.onMessage.bind(this);
        this.ws.onerror = this.onError.bind(this);
        this.ws.onclose = this.onClose.bind(this);
    }
    onOpen() {
        if (this.reconnect)
            clearTimeout(this.reconnect);
        this.manager.emit("ready", this);
        this.configureResuming();
    }
    onMessage({ data }) {
        let d;
        if (Buffer.isBuffer(data))
            d = data;
        else if (Array.isArray(data))
            d = Buffer.concat(data);
        else if (data instanceof ArrayBuffer)
            d = Buffer.from(data);
        else
            d = data;
        const msg = JSON.parse(d.toString());
        if (msg.op && msg.op === "stats")
            this.stats = { ...msg };
        delete this.stats.op;
        if (msg.guildId && this.manager.players.has(msg.guildId))
            this.manager.players.get(msg.guildId).emit(msg.op, msg);
        this.manager.emit("raw", this, msg);
    }
    onError(event) {
        const error = event && event.error ? event.error : event;
        if (!error)
            return;
        this.manager.emit("error", this, error);
        this._reconnect();
    }
    onClose(event) {
        this.manager.emit("disconnect", this, event);
        if (event.code !== 1000 || event.reason !== "destroy")
            return this._reconnect();
    }
    send(msg) {
        return new Promise((res, rej) => {
            const parsed = JSON.stringify(msg);
            if (!this.connected)
                return res(false);
            this.ws.send(parsed, (error) => {
                if (error)
                    rej(error);
                else
                    res(true);
            });
        });
    }
    configureResuming(key = this.manager.user, timeout = 120) {
        this.resumeKey = key;
        return this.send({ op: "configureResuming", key, timeout });
    }
    destroy() {
        if (!this.connected)
            return false;
        this.ws.close(1000, "destroy");
        this.ws = null;
        return true;
    }
    _reconnect() {
        this.reconnect = setTimeout(() => {
            this.ws.removeAllListeners();
            this.ws = null;
            this.manager.emit("reconnecting", this);
            this.connect();
        }, this.reconnectInterval);
    }
    get connected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }
}
exports.LavalinkNode = LavalinkNode;
//# sourceMappingURL=LavalinkNode.js.map