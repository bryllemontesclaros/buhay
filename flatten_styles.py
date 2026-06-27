import re
import glob

def clean_css_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # 1. Soften hard borders
    # Matches border: 1.5px solid var(--border); or border: 2px solid black; etc.
    content = re.sub(r'border:\s*[0-9.]+px\s+solid\s+[^;]+;', 'border: 1px solid var(--border2);', content)
    # Also border-bottom etc
    content = re.sub(r'border-(bottom|top|left|right):\s*[0-9.]+px\s+solid\s+[^;]+;', r'border-\1: 1px solid var(--border2);', content)

    # 2. Soften hard shadows
    # Matches box-shadow with explicit px offsets and solid colors commonly used in brutalism
    # e.g., box-shadow: 4px 4px 0px var(--border);
    content = re.sub(r'box-shadow:\s*(inset\s+)?[0-9.]+px\s+[0-9.]+px\s+[0-9.]+px\s*(0px\s*)?[^;]+;', 'box-shadow: var(--glass-shadow-soft);', content)
    
    # 3. Simplify backgrounds (flatten glass/gradients) if they look like complex neo-brutalist or glass ones
    # We match gradients containing var(--glass-1) or var(--surface2)
    content = re.sub(r'background:\s*[^;]*gradient[^;]*var\(--glass[^;]*;', 'background: var(--surface);', content, flags=re.DOTALL)
    content = re.sub(r'background:\s*[^;]*gradient[^;]*var\(--surface2\)[^;]*;', 'background: var(--surface);', content, flags=re.DOTALL)

    # 4. Remove backdrop-filters
    content = re.sub(r'-?webkit-backdrop-filter:[^;]*;', '', content)
    content = re.sub(r'backdrop-filter:[^;]*;', '', content)

    with open(filepath, 'w') as f:
        f.write(content)
    print(f"Cleaned {filepath}")

for f in glob.glob('/Users/bryllemontesclaros/Downloads/Takda/src/pages/*.module.css'):
    clean_css_file(f)

print("Done smoothing out styling!")
