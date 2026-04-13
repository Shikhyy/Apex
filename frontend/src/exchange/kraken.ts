import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

function quoteArg(value: string): string {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) {
    return value;
  }

  return `'${value.replace(/'/g, "'\\''")}'`;
}

export class KrakenCLI {
  constructor(private readonly binary = "kraken") {}

  async run(args: string[], asJson = false): Promise<string | unknown> {
    const command = [
      this.binary,
      asJson ? "-o json" : "",
      ...args.map(quoteArg),
    ]
      .filter(Boolean)
      .join(" ");

    const { stdout } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024,
    });

    const output = stdout.trim();
    if (!asJson) {
      return output;
    }

    return output.length > 0 ? JSON.parse(output) : {};
  }

  ticker(...pairs: string[]) {
    return this.run(["ticker", ...pairs], true);
  }

  balance() {
    return this.run(["balance"], true);
  }

  paperInit(balance: string | number, currency: string) {
    return this.run(["paper", "init", "--balance", String(balance), "--currency", currency]);
  }

  paperBuy(pair: string, volume: string | number) {
    return this.run(["paper", "buy", pair, String(volume)]);
  }

  paperSell(pair: string, volume: string | number) {
    return this.run(["paper", "sell", pair, String(volume)]);
  }

  paperBalance() {
    return this.run(["paper", "balance"]);
  }

  paperHistory() {
    return this.run(["paper", "history"]);
  }

  paperStatus() {
    return this.run(["paper", "status"]);
  }

  orderBuy(pair: string, volume: string | number, type: "market" | "limit", price?: string | number) {
    const args = ["order", "buy", pair, String(volume), "--type", type];
    if (type === "limit") {
      if (price === undefined) {
        throw new Error("limit orders require a price");
      }
      args.push("--price", String(price));
    }

    return this.run(args, true);
  }

  orderSell(pair: string, volume: string | number, type: "market" | "limit", price?: string | number) {
    const args = ["order", "sell", pair, String(volume), "--type", type];
    if (type === "limit") {
      if (price === undefined) {
        throw new Error("limit orders require a price");
      }
      args.push("--price", String(price));
    }

    return this.run(args, true);
  }

  orderInfo(txid: string) {
    return this.run(["order", "info", "--txid", txid], true);
  }

  orderCancel(txid: string) {
    return this.run(["order", "cancel", "--txid", txid], true);
  }

  mcp(scopes?: string[], allowDangerous = false) {
    const args = ["mcp"];
    if (scopes && scopes.length > 0) {
      args.push("-s", scopes.join(","));
    }
    if (allowDangerous) {
      args.push("--allow-dangerous");
    }

    return this.run(args);
  }
}

export const kraken = new KrakenCLI();
