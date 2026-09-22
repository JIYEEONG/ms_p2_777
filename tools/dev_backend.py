"""Start a fresh backend owned by front/dev.mjs, without reusing an old server."""
import argparse
import errno
import os
from pathlib import Path
import socket
import sys


def bind_socket(port):
    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    # Do not allow another Windows process to share our listening port.
    if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
        listener.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
    try:
        try:
            listener.bind(('127.0.0.1', port))
        except OSError as error:
            if not port or error.errno not in (errno.EADDRINUSE, errno.EACCES, 10048, 10013):
                raise
            listener.bind(('127.0.0.1', 0))
        listener.listen(128)
        return listener
    except BaseException:
        listener.close()
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--app-base', required=True)
    parser.add_argument('--maps-only', action='store_true')
    args = parser.parse_args()
    backend_dir = Path(__file__).resolve().parents[1] / 'backend'
    sys.path.insert(0, str(backend_dir))
    # Dev runs always use the printed local frontend address. Leave .env intact.
    os.environ['APP_BASE_URL'] = args.app_base
    os.environ['GOOGLE_REDIRECT_URI'] = args.app_base + '/api/auth/google/callback'

    import uvicorn

    with bind_socket(args.port) as listener:
        url = 'http://127.0.0.1:' + str(listener.getsockname()[1])
        print('MOOV_BACKEND_URL=' + url, flush=True)
        config = uvicorn.Config(
            'maps_server:app' if args.maps_only else 'main:app',
            host='127.0.0.1', port=listener.getsockname()[1], access_log=False,
        )
        uvicorn.Server(config).run(sockets=[listener])


if __name__ == '__main__':
    main()
