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
        free: number,
        used: number,
        allocated: number,
        reservable: number
    };
    cpu: {
        cores: number,
        systemLoad: number,
        lavalinkLoad: number
    };
    frameStats?: {
        sent?: number,
        nulled?: number,
        deficit?: number
    };
}

export class LavalinkNode extends EventEmitter {

    public manager: PlayerManager;
    public host: string;
    public port: number | string;
    public reconnectInterval: number;
    public password: string;
    private address: string;
    public ws!: WebSocket;
    private reconnect?: NodeJS.Timeout;
    public stats?: LavalinkNodeStats;
    public resumeKey?: string;

    public constructor(manager: PlayerManager, options: LavalinkNodeOptions) {
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

    private connect(): void {
        if (this.connected) this.ws.close();

        const headers = {
            Authorization: this.password,
            "Num-Shards": String(this.manager.shards || 1),
            "User-Id": this.manager.user
        };

        if (this.resumeKey) headers["Resume-Key"] = this.resumeKey;

        this.ws = new WebSocket(this.address, { headers });

        this.ws.onopen = this.onOpen.bind(this);
        this.ws.onmessage = this.onMessage.bind(this);
        this.ws.onerror = this.onError.bind(this);
        this.ws.onclose = this.onClose.bind(this);
    }

    private onOpen(): void {
        if (this.reconnect) clearTimeout(this.reconnect);
        this.manager.emit("ready", this);
        this.configureResuming();
    }

    private onMessage({ data }: { data: WebSocket.Data }): void {
        let d: Buffer | string;

        if (Buffer.isBuffer(data)) d = data;
        else if (Array.isArray(data)) d = Buffer.concat(data);
        else if (data instanceof ArrayBuffer) d = Buffer.from(data);
        else d = data;

        const msg = JSON.parse(d.toString());

        if (msg.op && msg.op === "stats") this.stats = { ...msg };
        delete (this.stats as any).op;

        if (msg.guildId && this.manager.players.has(msg.guildId)) this.manager.players.get(msg.guildId).emit(msg.op, msg);

        this.manager.emit("raw", this, msg);
    }

    private onError(event): void {
        const error = event && event.error ? event.error : event;
        if (!error) return;

        this.manager.emit("error", this, error);
        this._reconnect();
    }

    private onClose(event): void {
        this.manager.emit("disconnect", this, event);
        if (event.code !== 1000 || event.reason !== "destroy") return this._reconnect();
    }

    public send(msg: object): Promise<boolean> {
        return new Promise((res, rej) => {
            const parsed = JSON.stringify(msg);

            if (!this.connected) return res(false);
            this.ws.send(parsed, (error: Error) => {
                if (error) rej(error);
                else res(true);
            });
        });
    }

    public configureResuming(key: string = this.manager.user, timeout: number = 120): Promise<boolean> {
        this.resumeKey = key;

        return this.send({ op: "configureResuming", key, timeout });
    }

    public destroy(): boolean {
        if (!this.connected) return false;
        this.ws.close(1000, "destroy");
        this.ws = null;
        return true;
    }

    private _reconnect(): void {
        this.reconnect = setTimeout(() => {
            this.ws.removeAllListeners();
            this.ws = null;

            this.manager.emit("reconnecting", this);
            this.connect();
        }, this.reconnectInterval);
    }

    public get connected(): boolean {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }

}
