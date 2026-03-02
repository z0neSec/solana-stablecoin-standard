import re

with open('/Users/mac/Desktop/solana-stablecoin-standard/target/types/sss_core.ts') as f:
    lines = f.readlines()

instr_names = []
for i, line in enumerate(lines):
    stripped = line.rstrip()
    if re.match(r'^      "name":', stripped):
        m = re.search(r'"name":\s*"(\w+)"', stripped)
        if m:
            instr_names.append((i+1, m.group(1)))

sm_lines = [76, 223, 581, 630, 693, 1081, 1175, 1514, 1576, 1671]
mint_lines = [363, 478, 804, 929, 1280, 1402]

def find_instruction(line_no):
    result = None
    for ln, name in instr_names:
        if ln < line_no:
            result = (ln, name)
        else:
            break
    return result

print("=== Instructions using stablecoin.mint (circular) ===")
seen = set()
for l in sm_lines:
    r = find_instruction(l)
    if r:
        print(f"  Line {l} -> {r[1]} (instruction at line {r[0]})")
        seen.add(r[1])

print()
print("=== Instructions using path=mint (can auto-resolve) ===")
seen2 = set()
for l in mint_lines:
    r = find_instruction(l)
    if r:
        print(f"  Line {l} -> {r[1]} (instruction at line {r[0]})")
        seen2.add(r[1])

print()
print("--- Summary ---")
print("Circular (stablecoin.mint):", sorted(seen))
print("Auto-resolve (mint):", sorted(seen2))
