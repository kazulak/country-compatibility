# -*- coding: utf-8 -*-
"""
Country Compatibility Explorer - Production Static Server
Serves the prod/ directory static files on Port 3001 for local testing.
"""

import os
import sys
from http.server import SimpleHTTPRequestHandler, HTTPServer

PORT = 3001

class ProdHTTPRequestHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        # Map clean routes to static pages
        if self.path in ('/life', '/life/', '/index.html', '/'):
            self.path = '/life.html'
        elif self.path in ('/academic', '/academic/'):
            self.path = '/academic.html'
            
        return super().do_GET()

    def log_message(self, format, *args):
        # Mute standard logging for clean output
        pass

def run_server():
    server_address = ('', PORT)
    # Target the prod directory relative to this script
    root_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(os.path.join(root_dir, "prod"))
    
    try:
        httpd = HTTPServer(server_address, ProdHTTPRequestHandler)
        print(f"\n🚀 Production Static Server running at http://localhost:{PORT}/\n")
        print("Press Ctrl+C to stop.")
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        sys.exit(0)
    except Exception as e:
        print(f"Error starting production server: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    run_server()
