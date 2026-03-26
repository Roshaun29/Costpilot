import subprocess

result = subprocess.run(["npx.cmd", "vite", "build"], capture_output=True, text=True)
with open("vite_err.txt", "w", encoding="utf-8") as f:
    f.write(result.stdout)
    f.write(result.stderr)
