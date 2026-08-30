import json


ONE_GEN = 10**18


def cfg(**overrides):
    base = {
        "title": "BIBET direct test round",
        "round_type": "retroactive_public_goods",
        "historical_window": "2026-01-01/2026-12-31",
        "rubric": ["reach", "depth", "durability", "additionality", "public_good_fit"],
        "policy_version": "bibet-direct-v1",
        "max_share_bps": 2500,
        "application_close_after": "2026-08-30T10:00:00Z",
        "review_deadline_at": "2026-08-30T11:00:00Z",
        "challenge_deadline_at": "2026-08-30T11:30:00Z",
        "finalization_deadline_at": "2026-08-30T12:00:00Z",
    }
    base.update(overrides)
    return json.dumps(base)


def claim(**overrides):
    base = {
        "artifact_id": "artifact-alpha",
        "title": "Artifact Alpha",
        "completion_date": "2026-06-15",
        "impact_statement": "Completed public-good artifact with enough evidence for direct-mode testing.",
        "evidence_urls": ["https://evidence.example/alpha.json"],
        "trace_urls": ["https://trace.example/alpha.json"],
        "contributor_name": "Contributor Alpha",
        "requested_tags": ["public-good"],
    }
    base.update(overrides)
    return json.dumps(base)


def verdict(score=80, **overrides):
    base = {
        "eligibility": "ELIGIBLE",
        "evidence_quality": "STRONG",
        "attribution": "CLEAR",
        "duplication_risk": "LOW",
        "confidence_band": "HIGH",
        "reach_band": score,
        "depth_band": score,
        "durability_band": score,
        "additionality_band": score,
        "public_good_band": score,
        "normalized_impact_score": score,
        "short_reason": "Strong direct-mode evidence.",
    }
    base.update(overrides)
    return json.dumps(base)


def weak_verdict():
    return verdict(
        0,
        eligibility="INSUFFICIENT_EVIDENCE",
        evidence_quality="UNAVAILABLE",
        attribution="UNCERTAIN",
        duplication_risk="MEDIUM",
        confidence_band="LOW",
        short_reason="Evidence unavailable.",
    )


def read_json(raw):
    return json.loads(raw or "{}")


def must_revert(message, fn, *args):
    try:
        fn(*args)
    except Exception as exc:
        assert message in str(exc)
    else:
        raise AssertionError(f"Expected revert containing {message}")


def open_review_round(vm, contract, accounts, *, claim_json=None, cfg_json=None):
    creator, contributor = accounts[0], accounts[1]
    vm.sender = creator
    assert contract.create_round(cfg_json or cfg()) == "1"
    vm.value = ONE_GEN
    contract.fund_round("1")
    vm.value = 0
    contract.lock_round("1")
    vm.sender = contributor
    assert contract.submit_trace_claim("1", claim_json or claim()) == "1"
    vm.sender = creator
    contract.close_applications("1")
    return "1"


def test_full_positive_lifecycle_settlement_invariants(direct_vm, bibet, accounts):
    round_id = open_review_round(direct_vm, bibet, accounts)
    direct_vm.mock_web(r"evidence\.example", {"status": 200, "body": "immutable evidence: usage, authorship, public benefit"})
    direct_vm.mock_llm(r".*", verdict(80))

    bibet.request_impact_review(round_id, "1")
    assert direct_vm.run_validator() is True
    bibet.finalize_round(round_id)

    allocation = read_json(bibet.get_allocation(round_id, "1"))
    totals = read_json(bibet.get_round_totals(round_id))
    assert allocation["status"] == "PENDING"
    assert int(allocation["amount"]) == ONE_GEN // 4
    assert int(totals["allocated_amount"]) + int(totals["unallocated_amount"]) == ONE_GEN

    direct_vm.sender = accounts[1]
    bibet.claim_allocation(round_id, "1")
    totals = read_json(bibet.get_round_totals(round_id))
    assert int(totals["claimed_amount"]) == ONE_GEN // 4

    direct_vm.sender = accounts[0]
    bibet.withdraw_unallocated_budget(round_id)
    totals = read_json(bibet.get_round_totals(round_id))
    assert int(totals["claimed_amount"]) + int(totals["unallocated_withdrawn"]) == ONE_GEN


def test_nondeterministic_disagreement_and_tolerance(direct_vm, bibet, accounts):
    round_id = open_review_round(direct_vm, bibet, accounts)
    direct_vm.mock_web(r"evidence\.example", {"status": 200, "body": "good evidence"})
    direct_vm.mock_llm(r".*", verdict(80))
    bibet.request_impact_review(round_id, "1")

    direct_vm.clear_mocks()
    direct_vm.mock_web(r"evidence\.example", {"status": 200, "body": "same evidence"})
    direct_vm.mock_llm(r".*", verdict(84))
    assert direct_vm.run_validator() is True

    direct_vm.clear_mocks()
    direct_vm.mock_web(r"evidence\.example", {"status": 200, "body": "same evidence"})
    direct_vm.mock_llm(r".*", verdict(92))
    assert direct_vm.run_validator() is False


def test_permissions_duplicate_claims_and_historical_window(direct_vm, bibet, accounts):
    creator, contributor, stranger = accounts[0], accounts[1], accounts[2]
    direct_vm.sender = creator
    bibet.create_round(cfg())
    direct_vm.value = ONE_GEN
    bibet.fund_round("1")
    direct_vm.value = 0

    direct_vm.sender = stranger
    must_revert("EXPECTED_CREATOR_ONLY", bibet.lock_round, "1")

    direct_vm.sender = creator
    bibet.lock_round("1")
    direct_vm.sender = contributor
    bibet.submit_trace_claim("1", claim())
    must_revert("EXPECTED_DUPLICATE_ARTIFACT", bibet.submit_trace_claim, "1", claim(title="Duplicate title"))
    must_revert("EXPECTED_COMPLETION_OUTSIDE_WINDOW", bibet.submit_trace_claim, "1", claim(artifact_id="artifact-beta", completion_date="2025-12-31"))
    must_revert("EXPECTED_BAD_COMPLETION_DATE", bibet.submit_trace_claim, "1", claim(artifact_id="artifact-gamma", completion_date="June 2026"))


def test_challenge_adjudication_and_finalization_deadline_race(direct_vm, bibet, accounts):
    round_id = open_review_round(
        direct_vm,
        bibet,
        accounts,
        claim_json=claim(evidence_urls=["https://evidence.example/alpha.json"], trace_urls=["https://trace.example/alpha.json"]),
        cfg_json=cfg(challenge_deadline_at="2026-08-30T13:00:00Z", finalization_deadline_at="2026-08-30T14:00:00Z"),
    )
    direct_vm.mock_web(r"evidence\.example", {"status": 200, "body": "good evidence"})
    direct_vm.mock_llm(r".*", verdict(70))
    bibet.request_impact_review(round_id, "1")

    direct_vm.sender = accounts[2]
    challenge_id = bibet.open_challenge(round_id, "1", "evidence_quality", "The evidence may not prove durable usage.", json.dumps({"evidence_urls": ["https://challenge.example/alpha.json"]}))
    must_revert("EXPECTED_CHALLENGE_REPLAY", bibet.open_challenge, round_id, "1", "evidence_quality", "Replay same field and verdict.", json.dumps({"evidence_urls": ["https://challenge.example/alpha.json"]}))

    direct_vm.sender = accounts[0]
    must_revert("EXPECTED_CHALLENGE_DEADLINE", bibet.finalize_round, round_id)

    direct_vm.sender = accounts[1]
    bibet.respond_to_challenge(round_id, challenge_id, "The source trail is sufficient and public.")

    direct_vm.sender = accounts[2]
    direct_vm.clear_mocks()
    direct_vm.mock_web(r"evidence\.example", {"status": 200, "body": "good evidence"})
    direct_vm.mock_web(r"challenge\.example", {"status": 200, "body": "challenge evidence"})
    direct_vm.mock_llm(r".*", verdict(75))
    bibet.adjudicate_challenge(round_id, challenge_id)
    assert direct_vm.run_validator() is True

    direct_vm.sender = accounts[0]
    must_revert("EXPECTED_CHALLENGE_DEADLINE", bibet.finalize_round, round_id)


def test_permissionless_advance_respects_deadlines(direct_vm, bibet, accounts):
    direct_vm.sender = accounts[0]
    bibet.create_round(
        cfg(
            application_close_after="2026-08-30T10:00:00Z",
            review_deadline_at="2026-08-30T11:00:00Z",
            challenge_deadline_at="2026-08-30T11:30:00Z",
            finalization_deadline_at="2026-08-30T15:00:00Z",
        )
    )
    direct_vm.value = ONE_GEN
    bibet.fund_round("1")
    direct_vm.value = 0
    bibet.lock_round("1")

    direct_vm.sender = accounts[1]
    bibet.submit_trace_claim("1", claim())
    bibet.permissionless_advance("1")
    assert read_json(bibet.get_round("1"))["status"] == "REVIEW"

    direct_vm.mock_web(r"evidence\.example", {"status": 200, "body": "good evidence"})
    direct_vm.mock_llm(r".*", verdict(80))
    bibet.request_impact_review("1", "1")
    must_revert("EXPECTED_FINALIZATION_DEADLINE", bibet.permissionless_advance, "1")

    must_revert("EXPECTED_FINALIZATION_DEADLINE", bibet.permissionless_advance, "1")


def test_insufficient_evidence_zeroes_allocation(direct_vm, bibet, accounts):
    round_id = open_review_round(direct_vm, bibet, accounts)
    direct_vm.mock_web(r"evidence\.example", {"status": 500, "body": ""})
    direct_vm.mock_llm(r".*", weak_verdict())
    bibet.request_impact_review(round_id, "1")
    direct_vm.warp("2026-08-30T11:30:01Z")
    bibet.finalize_round(round_id)
    allocation = read_json(bibet.get_allocation(round_id, "1"))
    assert allocation["status"] == "ZEROED"
    assert allocation["amount"] == "0"
