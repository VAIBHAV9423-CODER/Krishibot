"""Quick validation script for KrishiBot project."""
import re, json, pathlib, sys

errors = []
ok = []

# 1. Python syntax
import ast
with open('app.py', encoding='utf-8') as f:
    src = f.read()
try:
    ast.parse(src)
    ok.append('app.py syntax')
except SyntaxError as e:
    errors.append(f'app.py syntax error: {e}')

# 2. JSON files
for jf in pathlib.Path('knowledge_base').glob('*.json'):
    try:
        data = json.loads(jf.read_text(encoding='utf-8'))
        ok.append(f'{jf.name} JSON')
    except Exception as e:
        errors.append(f'{jf.name} JSON error: {e}')

# 3. Check Flask routes exist for all expected API endpoints
expected_routes = [
    '/api/chat', '/api/weather', '/api/crop-recommendations',
    '/api/market-prices', '/api/schemes', '/api/quick-queries',
    '/api/status', '/api/clear-history', '/'
]
for route in expected_routes:
    route_key = route.replace('/', r'\/').replace('-', r'\-')
    if route in src:
        ok.append(f'route {route}')
    else:
        errors.append(f'Missing route: {route}')

# 4. Check template and static files
for path in ['templates/index.html', 'static/css/style.css', 'static/js/main.js']:
    if pathlib.Path(path).exists():
        ok.append(f'{path} exists')
    else:
        errors.append(f'Missing: {path}')

# 5. Check .env.example
if pathlib.Path('.env.example').exists():
    env_content = pathlib.Path('.env.example').read_text(encoding='utf-8')
    for key in ['IBM_API_KEY', 'IBM_PROJECT_ID', 'IBM_WATSONX_URL', 'FLASK_SECRET_KEY']:
        if key in env_content:
            ok.append(f'.env.example has {key}')
        else:
            errors.append(f'.env.example missing {key}')

# 6. Check AGENT_INSTRUCTIONS and KNOWLEDGE_CONFIG in app.py
for config in ['AGENT_INSTRUCTIONS', 'KNOWLEDGE_CONFIG', 'WATSONX_CONFIG']:
    if config in src:
        ok.append(f'{config} section present')
    else:
        errors.append(f'Missing config: {config}')

# 7. Check watsonx.ai integration code
for cls in ['WatsonxClient', 'KrishiBotRAG', 'build_prompt']:
    if cls in src:
        ok.append(f'Class/function {cls} present')
    else:
        errors.append(f'Missing: {cls}')

print('=' * 60)
print('KrishiBot Validation Report')
print('=' * 60)
print(f'\n[PASSED] {len(ok)} checks:')
for item in ok:
    print(f'  OK  {item}')

if errors:
    print(f'\n[FAILED] {len(errors)} checks:')
    for item in errors:
        print(f'  ERR {item}')
    sys.exit(1)
else:
    print('\n ALL CHECKS PASSED! Project is ready to run.')
    print('\nTo start KrishiBot:')
    print('  1. Copy .env.example to .env and fill in IBM_API_KEY + IBM_PROJECT_ID')
    print('  2. pip install -r requirements.txt')
    print('  3. python app.py')
    print('  4. Open http://localhost:5000')
