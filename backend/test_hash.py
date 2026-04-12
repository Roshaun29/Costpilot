from passlib.context import CryptContext
import sys

try:
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    h = pwd_context.hash("test")
    print(f"Hash success: {h}")
    v = pwd_context.verify("test", h)
    print(f"Verify success: {v}")
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
