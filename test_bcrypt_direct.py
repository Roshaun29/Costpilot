import bcrypt
import traceback

try:
    p = b"Password123!"
    h = bcrypt.hashpw(p, bcrypt.gensalt())
    print(f"Hash: {h}")
    v = bcrypt.checkpw(p, h)
    print(f"Verify: {v}")
except Exception:
    traceback.print_exc()
