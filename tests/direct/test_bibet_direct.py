import json
import hashlib
import sys


ONE_GEN = 10**18
DEFAULT_EVIDENCE_BODY = b"good evidence"
DEFAULT_EVIDENCE_DIGEST = hashlib.sha256(DEFAULT_EVIDENCE_BODY).hexdigest()
CHALLENGE_EVIDENCE_BODY = b"challenge evidence"
CHALLENGE_EVIDENCE_DIGEST = hashlib.sha256(CHALLENGE_EVIDENCE_BODY).hexdigest()


def manifest(url="https://evidence.example/alpha.json", digest=DEFAULT_EVIDENCE_DIGEST):
    return [{"url": url, "sha256": digest, "content_type": "application/json", "version": "direct-test"}]


def challenge_payload(url="https://challenge.example/alpha.json", digest=CHALLENGE_EVIDENCE_DIGEST):
    return json.dumps({"evidence_manifest": manifest(url, digest)})


def cfg(**overrides):
    base = {
        "title": "BIBET direct test round",
        "round_type": "retroactive_public_goods",
        "historical_window": "2026-01-01/2026-12-31",
        "rubric": ["reach", "depth", "durability", "additionality", "public_good_fit"],
        "policy_version": "bibet-direct-v1",
        "max_share_bps": 2500,
        "application_close_after": "2026-08-30T10:00:00Z",
        "review_deadline_at": "2026-08-30T13:00:00Z",
        "challenge_deadline_at": "2026-08-30T13:30:00Z",
        "finalization_deadline_at": "2026-08-30T14:00:00Z",
    }
    base.update(overrides)
    return json.dumps(base)


def claim(**overrides):
    base = {
        "artifact_id": "artifact-alpha",
        "title": "Artifact Alpha",
        "completion_date": "2026-06-15",
        "impact_statement": "Completed public-good artifact with enough evidence for direct-mode testing.",
        "evidence_manifest": manifest(),
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


def warp(vm, timestamp):
    vm.warp(timestamp)
    gl_module = sys.modules.get("genlayer.gl")
    if gl_module and getattr(gl_module, "message_raw", None):
        gl_module.message_raw["datetime"] = timestamp


def finalize_after_challenge_deadline(vm, contract, round_id="1"):
    warp(vm, "2026-08-30T13:30:01Z")
    contract.finalize_round(round_id)


def test_full_positive_lifecycle_settlement_invariants(direct_vm, bibet, accounts):
    round_id = open_review_round(direct_vm, bibet, accounts)
    direct_vm.mock_web(r"evidence\.example", {"status": 200, "body": DEFAULT_EVIDENCE_BODY})
    direct_vm.mock_llm(r".*", verdict(80))

    bibet.request_impact_review(round_id, "1")
    assert direct_vm.run_validator() is True
    finalize_after_challenge_deadline(direct_vm, bibet, round_id)

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
    direct_vm.mock_web(r"evidence\.example", {"status": 200, "body": DEFAULT_EVIDENCE_BODY})
    direct_vm.mock_llm(r".*", verdict(80))
    bibet.request_impact_review(round_id, "1")

    direct_vm.clear_mocks()
    direct_vm.mock_web(r"evidence\.example", {"status": 200, "body": DEFAULT_EVIDENCE_BODY})
    direct_vm.mock_llm(r".*", verdict(84))
    assert direct_vm.run_validator() is True

    direct_vm.clear_mocks()
    direct_vm.mock_web(r"evidence\.example", {"status": 200, "body": "same evidence"})
    direct_vm.mock_llm(r".*", verdict(82, evidence_quality="MODERATE", attribution="SHARED", confidence_band="MEDIUM"))
    assert direct_vm.run_validator() is False

    direct_vm.clear_mocks()
    direct_vm.mock_web(r"evidence\.example", {"status": 200, "body": DEFAULT_EVIDENCE_BODY})
    direct_vm.mock_llm(r".*", verdict(80, duplication_risk="HIGH"))
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
        claim_json=claim(trace_urls=["https://trace.example/alpha.json"]),
        cfg_json=cfg(challenge_deadline_at="2026-08-30T13:00:00Z", finalization_deadline_at="2026-08-30T14:00:00Z"),
    )
    direct_vm.mock_web(r"evidence\.example", {"status": 200, "body": DEFAULT_EVIDENCE_BODY})
    direct_vm.mock_llm(r".*", verdict(70))
    bibet.request_impact_review(round_id, "1")

    direct_vm.sender = accounts[2]
    challenge_id = bibet.open_challenge(round_id, "1", "evidence_quality", "The evidence may not prove durable usage.", challenge_payload())
    must_revert("EXPECTED_CHALLENGE_REPLAY", bibet.open_challenge, round_id, "1", "evidence_quality", "Replay same field and verdict.", challenge_payload())

    direct_vm.sender = accounts[0]
    must_revert("EXPECTED_CHALLENGE_DEADLINE", bibet.finalize_round, round_id)

    direct_vm.sender = accounts[1]
    bibet.respond_to_challenge(round_id, challenge_id, "The source trail is sufficient and public.")

    direct_vm.sender = accounts[2]
    direct_vm.clear_mocks()
    direct_vm.mock_web(r"evidence\.example", {"status": 200, "body": DEFAULT_EVIDENCE_BODY})
    direct_vm.mock_web(r"challenge\.example", {"status": 200, "body": CHALLENGE_EVIDENCE_BODY})
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
            review_deadline_at="2026-08-30T13:00:00Z",
            challenge_deadline_at="2026-08-30T13:30:00Z",
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

    direct_vm.mock_web(r"evidence\.example", {"status": 200, "body": DEFAULT_EVIDENCE_BODY})
    direct_vm.mock_llm(r".*", verdict(80))
    bibet.request_impact_review("1", "1")
    must_revert("EXPECTED_FINALIZATION_DEADLINE", bibet.permissionless_advance, "1")

    must_revert("EXPECTED_FINALIZATION_DEADLINE", bibet.permissionless_advance, "1")


def test_insufficient_evidence_zeroes_allocation(direct_vm, bibet, accounts):
    round_id = open_review_round(direct_vm, bibet, accounts)
    direct_vm.mock_web(r"evidence\.example", {"status": 500, "body": ""})
    direct_vm.mock_llm(r".*", weak_verdict())
    bibet.request_impact_review(round_id, "1")
    warp(direct_vm, "2026-08-30T13:30:01Z")
    bibet.finalize_round(round_id)
    allocation = read_json(bibet.get_allocation(round_id, "1"))
    assert allocation["status"] == "ZEROED"
    assert allocation["amount"] == "0"


def test_challenge_after_deadline_fails(direct_vm, bibet, accounts):
    round_id = open_review_round(direct_vm, bibet, accounts, cfg_json=cfg(review_deadline_at="", challenge_deadline_at="2026-08-30T11:00:00Z"))
    direct_vm.mock_web(r"evidence\.example", {"status": 200, "body": DEFAULT_EVIDENCE_BODY})
    direct_vm.mock_llm(r".*", verdict(70))
    bibet.request_impact_review(round_id, "1")
    direct_vm.sender = accounts[2]
    must_revert("EXPECTED_CHALLENGE_DEADLINE", bibet.open_challenge, round_id, "1", "evidence_quality", "Late challenge cannot grief finalization.", challenge_payload("https://challenge.example/a"))


def test_challenge_bound_to_original_verdict_snapshot(direct_vm, bibet, accounts):
    round_id = open_review_round(direct_vm, bibet, accounts, cfg_json=cfg(challenge_deadline_at="2026-08-30T13:00:00Z"))
    direct_vm.mock_web(r"evidence\.example", {"status": 200, "body": DEFAULT_EVIDENCE_BODY})
    direct_vm.mock_llm(r".*", verdict(70))
    bibet.request_impact_review(round_id, "1")
    direct_vm.sender = accounts[2]
    c1 = bibet.open_challenge(round_id, "1", "evidence_quality", "First challenge against version one.", challenge_payload("https://challenge.example/a"))
    c2 = bibet.open_challenge(round_id, "1", "attribution", "Second challenge against the same version.", challenge_payload("https://challenge.example/b"))
    ledger = read_json(bibet.get_afterledger(round_id))
    assert ledger["challenges"][0]["challenged_verdict"]["version"] == 1
    assert ledger["challenges"][1]["challenged_verdict"]["version"] == 1
    direct_vm.clear_mocks()
    direct_vm.mock_web(r".*\.example", {"status": 200, "body": CHALLENGE_EVIDENCE_BODY})
    direct_vm.mock_llm(r".*", verdict(72))
    bibet.adjudicate_challenge(round_id, c2)
    bibet.adjudicate_challenge(round_id, c1)
    ledger = read_json(bibet.get_afterledger(round_id))
    assert [item["status"] for item in ledger["challenges"]] == ["STALE", "ADJUDICATED"]
    assert ledger["verdicts"]["1"]["appeal_challenge_id"] == c2


def test_review_after_deadline_fails_and_expiry_unblocks_finalization(direct_vm, bibet, accounts):
    round_id = open_review_round(direct_vm, bibet, accounts, cfg_json=cfg(review_deadline_at="2026-08-30T11:00:00Z"))
    must_revert("EXPECTED_REVIEW_DEADLINE", bibet.request_impact_review, round_id, "1")
    bibet.expire_unreviewed_claim(round_id, "1")
    ledger = read_json(bibet.get_afterledger(round_id))
    assert ledger["claims"][0]["review_state"] == "EXPIRED"
    assert ledger["verdicts"]["1"]["expired"] is True
    warp(direct_vm, "2026-08-30T13:30:01Z")
    bibet.finalize_round(round_id)


def test_permissionless_expiry_with_reviewed_and_unreviewed_mix(direct_vm, bibet, accounts):
    direct_vm.sender = accounts[0]
    bibet.create_round(cfg(review_deadline_at="2026-08-30T11:00:00Z"))
    direct_vm.value = ONE_GEN
    bibet.fund_round("1")
    direct_vm.value = 0
    bibet.lock_round("1")
    direct_vm.sender = accounts[1]
    bibet.submit_trace_claim("1", claim(artifact_id="artifact-alpha"))
    direct_vm.sender = accounts[2]
    bibet.submit_trace_claim("1", claim(artifact_id="artifact-beta"))
    direct_vm.sender = accounts[0]
    bibet.close_applications("1")
    direct_vm.mock_web(r"evidence\.example", {"status": 200, "body": DEFAULT_EVIDENCE_BODY})
    direct_vm.mock_llm(r".*", verdict(80))
    # This deadline is already passed, so only permissionless deterministic cleanup is allowed.
    must_revert("EXPECTED_REVIEW_DEADLINE", bibet.request_impact_review, "1", "1")
    must_revert("EXPECTED_FINALIZATION_DEADLINE", bibet.permissionless_advance, "1")
    ledger = read_json(bibet.get_afterledger("1"))
    assert sorted(item["review_state"] for item in ledger["claims"]) == ["EXPIRED", "EXPIRED"]


def test_evidence_digest_match_and_mismatch(direct_vm, bibet, accounts):
    body = b"stable public evidence"
    digest = hashlib.sha256(body).hexdigest()
    manifest = [{"url": "https://evidence.example/alpha.txt", "sha256": digest, "content_type": "text/plain", "version": "v1"}]
    round_id = open_review_round(direct_vm, bibet, accounts, claim_json=claim(evidence_manifest=manifest))
    direct_vm.mock_web(r"evidence\.example", {"status": 200, "body": body})
    direct_vm.mock_llm(r".*", verdict(80))
    bibet.request_impact_review(round_id, "1")
    assert read_json(bibet.get_verdict(round_id, "1"))["eligibility"] == "ELIGIBLE"

    direct_vm.sender = accounts[0]
    bibet.create_round(cfg(title="Digest mismatch round"))
    direct_vm.value = ONE_GEN
    bibet.fund_round("2")
    direct_vm.value = 0
    bibet.lock_round("2")
    direct_vm.sender = accounts[1]
    bibet.submit_trace_claim("2", claim(artifact_id="artifact-beta", evidence_manifest=manifest))
    direct_vm.sender = accounts[0]
    bibet.close_applications("2")
    direct_vm.clear_mocks()
    direct_vm.mock_web(r"evidence\.example", {"status": 200, "body": b"changed evidence"})
    direct_vm.mock_llm(r".*", weak_verdict())
    bibet.request_impact_review("2", "1")
    assert read_json(bibet.get_verdict("2", "1"))["normalized_impact_score"] == 0


def test_private_and_duplicate_evidence_rejected(direct_vm, bibet, accounts):
    direct_vm.sender = accounts[0]
    bibet.create_round(cfg())
    direct_vm.value = ONE_GEN
    bibet.fund_round("1")
    direct_vm.value = 0
    bibet.lock_round("1")
    direct_vm.sender = accounts[1]
    must_revert("EXPECTED_UNSUPPORTED_CLAIM_FIELD", bibet.submit_trace_claim, "1", claim(evidence_urls=["http://127.0.0.1/x"]))
    must_revert("EXPECTED_PUBLIC_EVIDENCE_URL", bibet.submit_trace_claim, "1", claim(evidence_manifest=manifest("http://127.0.0.1/x")))
    must_revert("EXPECTED_BAD_EVIDENCE_DIGEST", bibet.submit_trace_claim, "1", claim(evidence_manifest=manifest("https://evidence.example/a", "")))
    must_revert("EXPECTED_DUPLICATE_EVIDENCE_URL", bibet.submit_trace_claim, "1", claim(evidence_manifest=manifest("https://evidence.example/a") + manifest("https://evidence.example/a")))


def test_settlement_double_claim_and_wrong_sender_rejected(direct_vm, bibet, accounts):
    round_id = open_review_round(direct_vm, bibet, accounts)
    direct_vm.mock_web(r"evidence\.example", {"status": 200, "body": DEFAULT_EVIDENCE_BODY})
    direct_vm.mock_llm(r".*", verdict(80))
    bibet.request_impact_review(round_id, "1")
    finalize_after_challenge_deadline(direct_vm, bibet, round_id)
    direct_vm.sender = accounts[2]
    must_revert("EXPECTED_CONTRIBUTOR_ONLY", bibet.claim_allocation, round_id, "1")
    direct_vm.sender = accounts[1]
    bibet.claim_allocation(round_id, "1")
    must_revert("EXPECTED_UNCLAIMED_ALLOCATION", bibet.claim_allocation, round_id, "1")


def test_cancelled_and_open_round_cannot_be_reopened_or_cancelled(direct_vm, bibet, accounts):
    direct_vm.sender = accounts[0]
    bibet.create_round(cfg())
    direct_vm.value = ONE_GEN
    bibet.fund_round("1")
    direct_vm.value = 0
    bibet.cancel_unopened_round("1")
    must_revert("EXPECTED_LOCKABLE_ROUND", bibet.lock_round, "1")
    bibet.create_round(cfg(title="Cannot cancel after open"))
    direct_vm.value = ONE_GEN
    bibet.fund_round("2")
    direct_vm.value = 0
    bibet.lock_round("2")
    must_revert("EXPECTED_CANCELABLE_ROUND", bibet.cancel_unopened_round, "2")


def test_repeated_unallocated_withdrawal_rejected(direct_vm, bibet, accounts):
    round_id = open_review_round(direct_vm, bibet, accounts)
    direct_vm.mock_web(r"evidence\.example", {"status": 500, "body": ""})
    direct_vm.mock_llm(r".*", weak_verdict())
    bibet.request_impact_review(round_id, "1")
    finalize_after_challenge_deadline(direct_vm, bibet, round_id)
    bibet.withdraw_unallocated_budget(round_id)
    must_revert("EXPECTED_NO_UNALLOCATED_BUDGET", bibet.withdraw_unallocated_budget, round_id)


def test_date_boundaries_and_bad_dates(direct_vm, bibet, accounts):
    direct_vm.sender = accounts[0]
    bibet.create_round(cfg(historical_window="2024-02-29/2024-03-31"))
    direct_vm.value = ONE_GEN
    bibet.fund_round("1")
    direct_vm.value = 0
    bibet.lock_round("1")
    direct_vm.sender = accounts[1]
    bibet.submit_trace_claim("1", claim(completion_date="2024-02-29"))
    must_revert("EXPECTED_BAD_COMPLETION_DATE", bibet.submit_trace_claim, "1", claim(artifact_id="bad-feb", completion_date="2023-02-29"))
    must_revert("EXPECTED_BAD_COMPLETION_DATE", bibet.submit_trace_claim, "1", claim(artifact_id="bad-apr", completion_date="2024-04-31"))


def test_zero_funding_and_lock_without_budget_rejected(direct_vm, bibet, accounts):
    direct_vm.sender = accounts[0]
    bibet.create_round(cfg())
    direct_vm.value = 0
    must_revert("EXPECTED_DEPOSIT_REQUIRED", bibet.fund_round, "1")
    must_revert("EXPECTED_BUDGET_REQUIRED", bibet.lock_round, "1")


def test_lock_requires_complete_deadlines_and_funded_round_can_settle(direct_vm, bibet, accounts):
    direct_vm.sender = accounts[0]
    bibet.create_round(cfg(application_close_after=""))
    direct_vm.value = ONE_GEN
    bibet.fund_round("1")
    direct_vm.value = 0
    must_revert("EXPECTED_COMPLETE_DEADLINES", bibet.lock_round, "1")

    bibet.create_round(cfg(title="Complete deadline settlement round"))
    direct_vm.value = ONE_GEN
    bibet.fund_round("2")
    direct_vm.value = 0
    bibet.lock_round("2")
    direct_vm.sender = accounts[1]
    bibet.submit_trace_claim("2", claim())
    direct_vm.sender = accounts[0]
    bibet.close_applications("2")
    direct_vm.mock_web(r"evidence\.example", {"status": 200, "body": DEFAULT_EVIDENCE_BODY})
    direct_vm.mock_llm(r".*", verdict(80))
    bibet.request_impact_review("2", "1")
    assert direct_vm.run_validator() is True
    finalize_after_challenge_deadline(direct_vm, bibet, "2")
    direct_vm.sender = accounts[1]
    bibet.claim_allocation("2", "1")
    totals = read_json(bibet.get_round_totals("2"))
    assert int(totals["claimed_amount"]) > 0


def test_bad_deadline_format_and_order_rejected(direct_vm, bibet, accounts):
    direct_vm.sender = accounts[0]
    must_revert("EXPECTED_BAD_DEADLINE", bibet.create_round, cfg(application_close_after="2026-08-30T10:00Z"))
    must_revert(
        "EXPECTED_BAD_DEADLINE_ORDER",
        bibet.create_round,
        cfg(
            application_close_after="2026-08-30T14:00:00Z",
            review_deadline_at="2026-08-30T13:00:00Z",
        ),
    )
    must_revert("EXPECTED_BAD_WINDOW", bibet.create_round, cfg(historical_window="2026-13-01/2026-12-31"))


def test_challenge_exactly_at_deadline_fails(direct_vm, bibet, accounts):
    round_id = open_review_round(
        direct_vm,
        bibet,
        accounts,
        cfg_json=cfg(review_deadline_at="", challenge_deadline_at="2026-08-30T12:00:00Z"),
    )
    direct_vm.mock_web(r"evidence\.example", {"status": 200, "body": "good evidence"})
    direct_vm.mock_llm(r".*", verdict(70))
    bibet.request_impact_review(round_id, "1")
    direct_vm.sender = accounts[2]
    must_revert(
        "EXPECTED_CHALLENGE_DEADLINE",
        bibet.open_challenge,
        round_id,
        "1",
        "eligibility",
        "A challenge submitted exactly at the deterministic cutoff is late.",
        challenge_payload("https://challenge.example/exact"),
    )


def test_all_zero_scores_multiple_claims_conserve_budget(direct_vm, bibet, accounts):
    direct_vm.sender = accounts[0]
    bibet.create_round(cfg())
    direct_vm.value = ONE_GEN
    bibet.fund_round("1")
    direct_vm.value = 0
    bibet.lock_round("1")
    for idx, contributor in enumerate(accounts[1:4], start=1):
        direct_vm.sender = contributor
        bibet.submit_trace_claim("1", claim(artifact_id=f"zero-{idx}", evidence_manifest=manifest(f"https://evidence.example/zero-{idx}.json")))
    direct_vm.sender = accounts[0]
    bibet.close_applications("1")
    direct_vm.mock_web(r"evidence\.example", {"status": 404, "body": ""})
    direct_vm.mock_llm(r".*", weak_verdict())
    for claim_id in ("1", "2", "3"):
        bibet.request_impact_review("1", claim_id)
    finalize_after_challenge_deadline(direct_vm, bibet, "1")
    totals = read_json(bibet.get_round_totals("1"))
    assert totals["allocated_amount"] == "0"
    assert totals["unallocated_amount"] == str(ONE_GEN)


def test_max_share_cap_many_claimants(direct_vm, bibet, accounts):
    direct_vm.sender = accounts[0]
    bibet.create_round(cfg(max_share_bps=2500))
    direct_vm.value = ONE_GEN
    bibet.fund_round("1")
    direct_vm.value = 0
    bibet.lock_round("1")
    for idx, contributor in enumerate(accounts[1:5], start=1):
        direct_vm.sender = contributor
        bibet.submit_trace_claim("1", claim(artifact_id=f"cap-{idx}", evidence_manifest=manifest(f"https://evidence.example/cap-{idx}.json")))
    direct_vm.sender = accounts[0]
    bibet.close_applications("1")
    direct_vm.mock_web(r"evidence\.example", {"status": 200, "body": DEFAULT_EVIDENCE_BODY})
    direct_vm.mock_llm(r".*", verdict(100))
    for claim_id in ("1", "2", "3", "4"):
        bibet.request_impact_review("1", claim_id)
    finalize_after_challenge_deadline(direct_vm, bibet, "1")
    totals = read_json(bibet.get_round_totals("1"))
    assert totals["allocated_amount"] == str(ONE_GEN)
    for claim_id in ("1", "2", "3", "4"):
        assert read_json(bibet.get_allocation("1", claim_id))["amount"] == str(ONE_GEN // 4)
