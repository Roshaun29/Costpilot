import sys
import os
import traceback

sys.path.append(os.getcwd())

try:
    print("Attempting import of backend.main...")
    import backend.main
    print("Import success!")
except Exception as e:
    print("Import failed!")
    traceback.print_exc()
