import functools
import http.server

# Hardcoded absolute path — avoids os.getcwd(), which the preview sandbox blocks
# (python3 -m http.server's argparse default calls os.getcwd() unconditionally
# at parse-construction time, which fails under that sandbox with PermissionError).
DIR = "/Users/copods/Desktop/Sumaiya Deshpande - Portfolio Files"
PORT = 4173

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=DIR)
httpd = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler)
print(f"Serving {DIR} at http://127.0.0.1:{PORT}")
httpd.serve_forever()
