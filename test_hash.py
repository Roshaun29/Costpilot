from passlib.context import CryptContext
import traceback

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
try:
    p = "Password123!"
    h = pwd_context.hash(p)
    print(f"Hash: {h}")
    v = pwd_context.verify(p, h)
    print(f"Verify: {v}")
except Exception:
    traceback.print_exc()
