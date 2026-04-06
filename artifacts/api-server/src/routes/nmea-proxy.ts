import { IncomingMessage } from "http";
import net from "net";
import { WebSocket, WebSocketServer } from "ws";
import { logger } from "../lib/logger";

export function createNMEAProxyServer(): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const host = url.searchParams.get("host") ?? "192.168.1.1";
    const port = parseInt(url.searchParams.get("port") ?? "10110", 10);

    logger.info({ host, port }, "NMEA proxy: new client, connecting to TCP target");

    let tcpSocket: net.Socket | null = null;
    let buffer = "";
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    function sendStatus(type: string, message: string) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, message }));
      }
    }

    function connectTCP() {
      if (destroyed) return;

      sendStatus("connecting", `Connecting to ${host}:${port}`);

      tcpSocket = new net.Socket();
      tcpSocket.setEncoding("utf8");
      tcpSocket.setTimeout(10000);

      tcpSocket.connect(port, host, () => {
        if (destroyed) { tcpSocket?.destroy(); return; }
        logger.info({ host, port }, "NMEA proxy: TCP connected");
        sendStatus("connected", `Connected to ${host}:${port}`);
      });

      tcpSocket.on("data", (data: string) => {
        if (destroyed) return;
        buffer += data;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "nmea", sentence: trimmed }));
          }
        }
      });

      tcpSocket.on("timeout", () => {
        logger.warn({ host, port }, "NMEA proxy: TCP socket timeout");
        tcpSocket?.destroy();
      });

      tcpSocket.on("error", (err: Error) => {
        logger.warn({ host, port, err: err.message }, "NMEA proxy: TCP error");
        sendStatus("error", `TCP error: ${err.message}`);
        tcpSocket?.destroy();
        tcpSocket = null;
      });

      tcpSocket.on("close", () => {
        if (destroyed) return;
        logger.info({ host, port }, "NMEA proxy: TCP closed, scheduling reconnect");
        sendStatus("disconnected", "TCP connection closed, reconnecting...");
        tcpSocket = null;
        reconnectTimer = setTimeout(connectTCP, 3000);
      });
    }

    connectTCP();

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "send" && typeof msg.sentence === "string") {
          if (tcpSocket && !tcpSocket.destroyed) {
            const line = msg.sentence.endsWith("\r\n") ? msg.sentence : msg.sentence + "\r\n";
            tcpSocket.write(line);
            logger.info({ sentence: msg.sentence }, "NMEA proxy: sent sentence to TCP");
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "sent", sentence: msg.sentence }));
            }
          } else {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "error", message: "TCP not connected, cannot send" }));
            }
          }
        }
      } catch {}
    });

    ws.on("close", () => {
      destroyed = true;
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      if (tcpSocket) { tcpSocket.destroy(); tcpSocket = null; }
      logger.info({ host, port }, "NMEA proxy: client disconnected");
    });

    ws.on("error", (err: Error) => {
      logger.warn({ err: err.message }, "NMEA proxy: WebSocket error");
    });
  });

  return wss;
}
