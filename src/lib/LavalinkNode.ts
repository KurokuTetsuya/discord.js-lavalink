import * as WebSocket from "ws";
import { EventEmitter } from "events";
import { PlayerManager } from "./PlayerManager";

export type LavalinkNodeOptions = {
    host: string;
    port: number | string;
    password?: string;
    reconnectInterval?: number;
};

export type LavalinkNodeStats = {
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
    }
};

export class LavalinkNode extends EventEmitter {
    public options: LavalinkNodeOptions;
    public manager: PlayerManager;
    public ws!: WebSocket;
    private reconnect?: NodeJS.Timeout;
    public stats?: LavalinkNodeStats;
    public resumeKey?: string;

    public constructor(manager: PlayerManager, options: LavalinkNodeOptions) {
        super();

        this.manager = manager;
        this.options = options;

        this.ws = null;
        this.stats = {
            players: 0,
            playingPlayers: 0,
            uptime: 0,
            memory: {
                free: 0,
                used: 0,
                allocated: 0,
                reservable: 0,
            },
            cpu: {
                cores: 0,
                systemLoad: 0,
                lavalinkLoad: 0,
            }
        };

        this.connect();
    }

    private connect(): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

        const headers = {
            Authorization: this.password,
            "Num-Shards": String(this.manager.shards),
            "User-Id": this.manager.user
        };

        if (this.resumeKey) headers["Resume-Key"] = this.resumeKey;

        this.ws = new WebSocket(this.address, { headers });

        this.ws
            .on("open", () => this.emit("ready"))
            .on("close", (code: number, reason: string) => {
                this.emit("disconnect", code, reason);
                if (code !== 1000 || reason !== "destroy") return this._reconnect();
            }).on("error", (error: Error) => {
                this.emit("error", error);
                this._reconnect();
            })
            .on("message", (data: WebSocket.Data) => {
                let d: Buffer | string;

                if (Buffer.isBuffer(data)) d = data;
                else if (Array.isArray(data)) d = Buffer.concat(data);
                else if (data instanceof ArrayBuffer) d = Buffer.from(data);
                else d = data;

                const msg = JSON.parse(d.toString());

                if (msg.op && msg.op === "stats") this.stats = msg;
                delete (this.stats as any).op;

                if (msg.guildId && this.manager.has(msg.guildId)) this.manager.get(msg.guildId).emit(msg.op, msg);

                this.emit("raw", msg);
            });
    }

    public send(msg: object): Promise<boolean> {
        return new Promise((res, rej) => {
            const parsed = JSON.stringify(msg);

            if (!this.OPEN) return res(false);
            this.ws.send(parsed, (error: Error) => {
                if (error) rej(error);
                else res(true);
            });
        });
    }

    public destroy(): boolean {
        if (!this.OPEN) return false;
        this.ws.close(1000, "destroy");
        this.ws = null;
        return true;
    }

    private _reconnect() {
        this.reconnect = setTimeout(() => {
            this.ws.removeAllListeners();
            /**
			 * Emmited when the node is attempting a reconnect
			 * @event LavalinkNode#reconnecting
			 */
            this.emit("reconnecting");
            this.connect();
        }, this.reconnectInterval);
    }

    public get host(): string {
        return this.options.host;
    }

    public get port(): string | number {
        return this.options.port || 2333;
    }

    public get password(): string {
        return this.options.password || "youshallnotpass";
    }

    public get reconnectInterval(): number {
        return this.options.reconnectInterval || 5000;
    }

    public get OPEN(): boolean {
        return this.ws.readyState === WebSocket.OPEN;
    }

    private get address(): string {
        const { host, port } = this.options;
        return `ws://${host}:${port}`;
    }
}
