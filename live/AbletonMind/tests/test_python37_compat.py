import ast
from pathlib import Path
from typing import List, Optional, Tuple
import unittest


PY37_UNSUPPORTED_BUILTIN_GENERICS = {"dict", "list", "set", "tuple"}


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _is_builtin_generic_annotation(node: ast.AST) -> bool:
    return (
        isinstance(node, ast.Subscript)
        and isinstance(node.value, ast.Name)
        and node.value.id in PY37_UNSUPPORTED_BUILTIN_GENERICS
    )


def _inspect_annotation(annotation: Optional[ast.AST]) -> List[Tuple[int, int, str]]:
    if annotation is None:
        return []
    return [
        (child.lineno, child.col_offset, child.value.id)
        for child in ast.walk(annotation)
        if _is_builtin_generic_annotation(child)
    ]


def _function_annotations(node: ast.AST) -> List[Optional[ast.AST]]:
    annotations = [node.returns]
    annotations.extend(arg.annotation for arg in node.args.args)
    annotations.extend(arg.annotation for arg in node.args.kwonlyargs)
    if node.args.vararg is not None:
        annotations.append(node.args.vararg.annotation)
    if node.args.kwarg is not None:
        annotations.append(node.args.kwarg.annotation)
    return annotations


def _annotation_violations(node: ast.AST) -> list:
    violations = []

    for child in ast.walk(node):
        if isinstance(child, ast.AnnAssign):
            violations.extend(_inspect_annotation(child.annotation))
        elif isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for annotation in _function_annotations(child):
                violations.extend(_inspect_annotation(annotation))

    return violations


class TestPython37Compatibility(unittest.TestCase):
    def test_runtime_modules_do_not_use_pep585_builtin_generic_annotations(self):
        root = _repo_root()
        runtime_root = root / "live" / "AbletonMind"
        failures = []

        for path in sorted(runtime_root.rglob("*.py")):
            if "tests" in path.parts:
                continue
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            for line, column, builtin_name in _annotation_violations(tree):
                rel = path.relative_to(root)
                failures.append(f"{rel}:{line}:{column} uses {builtin_name}[...]")

        self.assertEqual(
            failures,
            [],
            "Python 3.7 evaluates annotations at import time; use typing.* or string annotations:\n"
            + "\n".join(failures),
        )
