# -*- coding: utf-8 -*-
"""
Country & Academic Compatibility Explorer - Web Server
Zero-dependency Python server that serves static files and runs calculations.
"""

import json
import os
import sys
from http.server import SimpleHTTPRequestHandler, HTTPServer
from db_sqlite import get_locations
from engine import rank_locations
from db_sqlite_academic import get_academic_entities
from engine_academic import rank_entities

PORT = 3000

class CompatibilityHTTPRequestHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        """
        Clean URL routing. Map /life to life.html and /academic to academic.html.
        """
        # Map clean routes to disk files
        if self.path in ('/life', '/life/', '/index.html', '/'):
            self.path = '/life.html'
        elif self.path in ('/academic', '/academic/'):
            self.path = '/academic.html'
            
        return super().do_GET()

    def do_POST(self):
        """
        Handles POST calculations for preferences.
        """
        if self.path == '/api/rank':
            self.handle_rank_life()
        elif self.path == '/api/rank/academic':
            self.handle_rank_academic()
        else:
            self.send_error_response(404, "Endpoint not found")

    def handle_rank_life(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            self.send_error_response(400, "Missing Content-Length header or body empty")
            return

        post_data = self.rfile.read(content_length)
        
        try:
            preferences = json.loads(post_data.decode('utf-8'))
            locations = get_locations()
            rankings = rank_locations(locations, preferences)
            response_json = json.dumps(rankings).encode('utf-8')
            
            self.send_success_response(response_json)
        except json.JSONDecodeError:
            self.send_error_response(400, "Invalid JSON data received")
        except Exception as e:
            self.send_error_response(500, f"Engine processing error: {str(e)}")

    def handle_rank_academic(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            self.send_error_response(400, "Missing Content-Length header or body empty")
            return

        post_data = self.rfile.read(content_length)
        
        try:
            preferences = json.loads(post_data.decode('utf-8'))
            entities = get_academic_entities()
            rankings = rank_entities(entities, preferences)
            response_json = json.dumps(rankings).encode('utf-8')
            
            self.send_success_response(response_json)
        except json.JSONDecodeError:
            self.send_error_response(400, "Invalid JSON data received")
        except Exception as e:
            self.send_error_response(500, f"Academic Engine processing error: {str(e)}")

    def send_success_response(self, response_bytes):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(response_bytes)))
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.end_headers()
        self.wfile.write(response_bytes)

    def send_error_response(self, code, message):
        """
        Helper to return clean text error responses.
        """
        self.send_response(code)
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        response_bytes = message.encode('utf-8')
        self.send_header('Content-Length', str(len(response_bytes)))
        self.end_headers()
        self.wfile.write(response_bytes)

    def log_message(self, format, *args):
        """
        Quiet log outputs for clean console reporting.
        """
        # Uncomment below to enable standard server logs
        # super().log_message(format, *args)
        pass

def run_server():
    server_address = ('', PORT)
    # Ensure current directory is the directory of app.py
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    try:
        httpd = HTTPServer(server_address, CompatibilityHTTPRequestHandler)
        print(f"\n🚀 Server running at http://localhost:{PORT}/\n")
        print("Press Ctrl+C to stop.")
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        sys.exit(0)
    except Exception as e:
        print(f"Error starting server: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    run_server()
