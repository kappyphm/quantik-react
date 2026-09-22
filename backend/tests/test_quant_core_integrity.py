import ast
import hashlib
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


class QuantCoreIntegrityTest(unittest.TestCase):
    def test_backend_never_imports_reference_directory(self):
        for path in (ROOT / 'backend').rglob('*.py'):
            if '.venv' in path.parts:
                continue
            tree = ast.parse(path.read_text(encoding='utf-8'), filename=str(path))
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    names = [item.name for item in node.names]
                elif isinstance(node, ast.ImportFrom):
                    names = [node.module or '']
                else:
                    continue
                self.assertFalse(any('quant-core' in name or name.startswith('quant_core') for name in names),
                                 f'Production import points to reference source: {path}')

    def test_reference_hashes_match_manifest_when_present(self):
        reference = ROOT / 'quant-core'
        if not reference.is_dir():
            self.skipTest('quant-core is intentionally gitignored and absent in this checkout')
        entries = {}
        for line in (ROOT / 'docs' / 'quant-core-baseline.sha256').read_text(encoding='utf-8').splitlines():
            parts = line.strip().split()
            if len(parts) == 2 and len(parts[0]) == 64:
                entries[parts[1]] = parts[0].lower()
        self.assertEqual(set(entries), {'quant.py', 'crawl_data.py', 'quant_visuals.py', 'backtest.py'})
        for name, expected in entries.items():
            actual = hashlib.sha256((reference / name).read_bytes()).hexdigest()
            self.assertEqual(actual, expected, f'quant-core/{name} changed outside baseline process')


if __name__ == '__main__':
    unittest.main()
