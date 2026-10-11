"""Servidor local: sirve el proyecto y recibe fotogramas JPEG (POST /frame) que
se canalizan a ffmpeg para producir un MP4 H.264. Uso: python rec_server.py PORT DIR"""
import http.server, functools, subprocess, sys, os, urllib.parse

PORT, ROOT = int(sys.argv[1]), sys.argv[2]
OUT = os.path.join(ROOT, 'export')
os.makedirs(OUT, exist_ok=True)
state = {'proc': None, 'n': 0}


def start(name, fps):
    path = os.path.join(OUT, name)
    state['path'] = path
    if os.path.exists(path + '.done'):
        os.remove(path + '.done')
    state['proc'] = subprocess.Popen([
        'ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(fps),
        '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path], stdin=subprocess.PIPE)
    state['n'] = 0


class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *a):
        pass

    def _ok(self, body=b'ok'):
        self.send_response(200)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0))
        data = self.rfile.read(n) if n else b''
        q = self.path.split('?', 1)[1] if '?' in self.path else ''
        args = dict(urllib.parse.parse_qsl(q))
        if not self.path.startswith('/frame'):
            with open(os.path.join(OUT, 'server.log'), 'a', encoding='utf-8') as f:
                f.write(self.path + ' ' + data[:500].decode('utf-8', 'replace') + '\n')
        if self.path.startswith('/log'):
            self._ok()
            return
        if self.path.startswith('/start'):
            start(args.get('name', 'video.mp4'), args.get('fps', '30'))
        elif self.path.startswith('/frame'):
            state['proc'].stdin.write(data)
            state['n'] += 1
        elif self.path.startswith('/end'):
            state['proc'].stdin.close()
            state['proc'].wait()
            with open(state['path'] + '.done', 'w') as f:
                f.write(str(state['n']))
            self._ok(('done %d' % state['n']).encode())
            return
        elif self.path.startswith('/status'):
            pass
        self._ok(str(state['n']).encode())


http.server.ThreadingHTTPServer(('127.0.0.1', PORT),
                                functools.partial(H, directory=ROOT)).serve_forever()
