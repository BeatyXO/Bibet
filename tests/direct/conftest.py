import os
import sys

import pytest
from gltest.direct import VMContext, create_test_addresses, deploy_contract


@pytest.fixture(autouse=True)
def _windows_direct_mode_unlink_patch(monkeypatch):
    if sys.platform != "win32":
        return

    original_unlink = os.unlink

    def safe_unlink(path, *args, **kwargs):
        try:
            return original_unlink(path, *args, **kwargs)
        except PermissionError:
            return None

    monkeypatch.setattr(os, "unlink", safe_unlink)


@pytest.fixture
def accounts():
    return create_test_addresses(5)


@pytest.fixture
def direct_vm():
    vm = VMContext()
    vm.warp("2026-08-30T12:00:00Z")
    return vm


@pytest.fixture
def bibet(direct_vm, accounts):
    direct_vm.sender = accounts[0]
    with direct_vm.activate():
        yield deploy_contract("contracts/bibet.py", direct_vm)
