import sys
from glob import glob
import os
base_folder = os.getcwd()

args = sys.argv[1:]

if len(args) == 0:
    raise ValueError("No path argument given")

path = args[0]
path = os.path.join(base_folder, path)
print("Searching path:", path)

# Look for lines that start with
# <text fill="#cfcfcf" ...
# and delete up until </text>
d_start = '<text fill="#cfcfcf"'
d_end = '</text>'
for file in glob(os.path.join(path, "**", "*.svg"), recursive=True):
    if file.endswith("-cleaned.svg"):
        continue
    with open(file, "r") as f:
        text = f.read()
            
    while True:
        i = text.find(d_start)
        if i == -1:
            break

        j = text.find(d_end, i)
        if j == -1:
            break

        # Remove the matching text element, including </text>
        j += len(d_end)
        text = text[:i] + text[j:]

    with open(file+"-cleaned.svg","w") as f:
        f.write(text)