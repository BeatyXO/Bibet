"""Exercise the contract's actual deterministic partition method without a GenVM runner."""
import ast
import copy
from pathlib import Path


source = Path(__file__).resolve().parents[2] / "contracts" / "bibet.py"
module = ast.parse(source.read_text(encoding="utf-8"))
contract = next(node for node in module.body if isinstance(node, ast.ClassDef) and node.name == "BibetProtocol")
method = next(node for node in contract.body if isinstance(node, ast.FunctionDef) and node.name == "_settle_sponsors")
method.decorator_list = []
isolated = ast.Module(body=[ast.ClassDef(name="Partition", bases=[], keywords=[], body=[method], decorator_list=[])], type_ignores=[])
namespace = {}
exec(compile(ast.fix_missing_locations(isolated), str(source), "exec"), namespace)
partition = namespace["Partition"]()._settle_sponsors


def make_data(contributions):
    return {
        "config": {"funding_model": "community"},
        "budget": str(sum(contributions)),
        "sponsors": [
            {"address": f"0x{index:040x}", "amount": str(amount), "refund": "0", "withdrawn": "0"}
            for index, amount in enumerate(contributions, 1)
        ],
    }


def test_partition_conserves_value_and_dust():
    for contributions in ([3, 2, 5], [1, 1, 1], [1, 999999], [7], [1, 2, 3, 4, 5]):
        for remainder in range(sum(contributions) + 1):
            data = make_data(contributions)
            partition(data, remainder)
            assert sum(int(row["refund"]) for row in data["sponsors"]) == remainder
            assert all(0 <= int(row["refund"]) <= remainder for row in data["sponsors"])
            assert all(row["withdrawn"] == "0" for row in data["sponsors"])


def test_partition_independent_of_ledger_order():
    data = make_data([3, 2, 5])
    reversed_data = copy.deepcopy(data)
    reversed_data["sponsors"].reverse()
    partition(data, 2)
    partition(reversed_data, 2)
    assert {row["address"]: row["refund"] for row in data["sponsors"]} == {
        row["address"]: row["refund"] for row in reversed_data["sponsors"]
    }


def test_tie_breaks_by_address():
    data = make_data([1, 1, 1])
    partition(data, 2)
    assert [int(row["refund"]) for row in data["sponsors"]] == [1, 1, 0]
