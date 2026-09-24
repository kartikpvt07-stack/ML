import os
import signal
import subprocess
import sys
import time

def kill_port(port):
    """Kills any process bound to a specific port on POSIX systems."""
    if sys.platform != "win32":
        try:
            subprocess.run(f"lsof -ti:{port} | xargs kill -9 2>/dev/null", shell=True)
        except Exception:
            pass

def terminate_process_group(proc):
    """Terminates process group for POSIX, or process for Windows."""
    if proc and proc.poll() is None:
        try:
            if sys.platform == "win32":
                proc.terminate()
            else:
                os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        except Exception:
            try:
                proc.terminate()
            except Exception:
                pass

def kill_process_group(proc):
    """Force kills process group for POSIX, or process for Windows."""
    if proc and proc.poll() is None:
        try:
            if sys.platform == "win32":
                proc.kill()
            else:
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass

def main():
    print("=" * 50)
    print("🚀 Starting NY Direction Predictor System...")
    print("=" * 50)

    # Clear old processes running on the ports before startup
    kill_port(8000)
    kill_port(5173)

    popen_kwargs = {}
    if sys.platform != "win32":
        popen_kwargs["start_new_session"] = True

    # 1. Start Backend API
    print("📡 Launching FastAPI Backend (http://localhost:8000)...")
    backend = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app:app", "--reload", "--port", "8000"],
        **popen_kwargs
    )

    time.sleep(2)

    # 2. Start Frontend Dev Server
    print("💻 Launching React Frontend (http://localhost:5173)...")
    frontend = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd="frontend",
        shell=True,
        **popen_kwargs
    )

    print("\n✅ System is running!")
    print(" -> Frontend URL: http://localhost:5173")
    print(" -> Backend API:  http://localhost:8000")
    print("Press Ctrl+C to stop both servers.\n")

    cleaned_up = False

    def cleanup():
        nonlocal cleaned_up
        if cleaned_up:
            return
        cleaned_up = True
        print("\n🛑 Stopping servers...")
        terminate_process_group(backend)
        terminate_process_group(frontend)

        for _ in range(20):
            if (backend.poll() is not None) and (frontend.poll() is not None):
                break
            time.sleep(0.1)

        kill_process_group(backend)
        kill_process_group(frontend)

        kill_port(8000)
        kill_port(5173)

        print("👋 Both servers stopped cleanly.")

    def signal_handler(sig, frame):
        cleanup()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    if hasattr(signal, 'SIGTERM'):
        signal.signal(signal.SIGTERM, signal_handler)

    try:
        while True:
            time.sleep(1)
            if backend.poll() is not None and frontend.poll() is not None:
                print("⚠️ Both processes exited.")
                break
    except KeyboardInterrupt:
        cleanup()

if __name__ == "__main__":
    main()

