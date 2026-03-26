import sys, traceback, importlib
sys.path.append("d:/project/Costpilot")
try:
    importlib.import_module("backend.main")
except Exception as e:
    with open("err3.txt", "w") as f:
        traceback.print_exc(file=f)
