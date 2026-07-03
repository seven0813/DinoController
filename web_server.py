import argparse
import errno
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class DinoRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        root = Path(__file__).resolve().parent
        super().__init__(*args, directory=str(root), **kwargs)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the DinoController web app.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8000, type=int)
    args = parser.parse_args()

    root = Path(__file__).resolve().parent
    host = "127.0.0.1"
    port = args.port
    for candidate in range(args.port, args.port + 20):
        try:
            server = ThreadingHTTPServer((args.host, candidate), DinoRequestHandler)
            host = args.host
            port = candidate
            break
        except OSError as error:
            if error.errno != errno.EADDRINUSE:
                raise
    else:
        raise SystemExit(f"No free port found from {args.port} to {args.port + 19}")

    print(f"Serving files from: {root}", flush=True)
    print(f"DinoController web app: http://{host}:{port}/web/", flush=True)
    print("Press Ctrl+C to stop.", flush=True)
    server.serve_forever()
