#!/usr/bin/env python3
"""Grade one run dir: python3 grade.py <run_dir> <case_name>. Writes <run_dir>/grading.json."""
import json, os, re, sys, glob

run, case = sys.argv[1], sys.argv[2]
meta = json.load(open(os.path.join(run, "..", "eval_metadata.json")))
SPEC = {"flight-duration-bv": "06-business-rules.md", "request-lifecycle-st": "02-state-machine.md",
        "bike-rental-gaps": "bike-rental.md"}[case]
out = os.path.join(run, "outputs")
lines = open(os.path.join(out, SPEC), encoding="utf-8").read().split("\n")
want = os.path.join(out, SPEC.rsplit(".", 1)[0] + ".design.json")

d, found = None, None
if os.path.exists(want):
    found = want
else:
    js = [p for p in glob.glob(os.path.join(out, "*.json")) if not p.endswith("metrics.json")]
    found = js[0] if js else None
try:
    d = json.load(open(found, encoding="utf-8")) if found else None
except Exception as e:
    d = None
D = d if isinstance(d, dict) else {}

def num(s):
    m = re.search(r"-?\d+(?:[.,]\d+)?", str(s)); return float(m.group().replace(",", ".")) if m else None

def quotes(o, acc):
    if isinstance(o, dict):
        q = o.get("quote")
        if isinstance(q, dict) and "text" in q: acc.append(q)
        for v in o.values(): quotes(v, acc)
    elif isinstance(o, list):
        for v in o: quotes(v, acc)
    return acc

EP = D.get("equivalence_classes") or []
BV = D.get("boundary_values") or []
ST = D.get("state_transitions") or {}
MX = ST.get("matrix") or [] if isinstance(ST, dict) else []
T = D.get("tests") or []
U = D.get("unknowns") or []
ALLOWED = {"valid", "invalid", "unknown"}

def res(ok, ev): return bool(ok), ev

def c_exists():
    keys = {"spec", "focus", "equivalence_classes", "boundary_values", "state_transitions", "tests", "unknowns"}
    if not os.path.exists(want): return res(False, f"expected file missing; found {os.path.basename(found) if found else 'no json'}")
    miss = keys - set(D)
    return res(not miss, f"missing keys: {sorted(miss)}" if miss else "file and all keys present")

def c_quotes():
    qs = quotes(D, [])
    if not qs: return res(False, "no quote objects found")
    bad = []
    for q in qs:
        ln, tx = q.get("line"), q.get("text", "")
        ok = isinstance(ln, int) and 1 <= ln <= len(lines) and tx and tx in lines[ln - 1]
        if not ok: bad.append(f"line {ln}: {tx[:70]!r}")
    return res(not bad, f"{len(qs)-len(bad)}/{len(qs)} verbatim; bad: {bad[:5]}")

def c_three():
    if not BV: return res(False, "no boundary_values")
    bad = [b.get("id") for b in BV if len(b.get("values") or []) != 3 or
           any(v.get("expected") not in ALLOWED for v in b.get("values") or [])]
    return res(not bad, f"{len(BV)} BV; bad: {bad}")

def find_bv(param_re, boundary):
    for b in BV:
        if re.search(param_re, json.dumps(b, ensure_ascii=False), re.I) and num(b.get("boundary")) == boundary:
            return b
    return None

def c_bv(param_re, boundary, vals, exps, inclusive=None, check_inc=True):
    b = find_bv(param_re, boundary)
    if not b: return res(False, f"no BV at {boundary}")
    vs = b.get("values") or []
    got = [(num(v.get("value")), v.get("expected")) for v in vs]
    ok = [g[0] for g in got] == vals and [g[1] for g in got] == exps
    if check_inc: ok = ok and b.get("inclusive") == inclusive
    return res(ok, f"{b.get('id')}: {got}, inclusive={b.get('inclusive')}, step={b.get('step')}")

def ids(lst): return {x.get("id") for x in lst if isinstance(x, dict)}

def c_cover(with_st):
    need = ids(EP) | ids(BV) | (ids(MX) if with_st else set())
    cov = {c for t in T for c in (t.get("covers") or [])}
    aff = {a for u in U for a in (u.get("affects") or [])}
    allids = ids(EP) | ids(BV) | ids(MX)
    unc = sorted(need - cov); dang = sorted((cov | aff) - allids)
    return res(need and not unc and not dang, f"uncovered: {unc[:8]}; dangling refs: {dang[:8]}")

def c_no_invented():
    pat = re.compile(r"empty|null|blank|порожн|тип|type|negative|від.?ємн|non-numeric|letters|missing|відсутн|string", re.I)
    bad = [e.get("id") + ": " + str(e.get("class")) for e in EP if pat.search(str(e.get("class", "")))]
    return res(not bad, f"invented classes: {bad}" if bad else "none")

def unknown_about(rx, bvid=None):
    for u in U:
        if re.search(rx, u.get("question", ""), re.I) and (bvid is None or bvid in (u.get("affects") or [])):
            return u
    return None

checks = {}
if case == "flight-duration-bv":
    def c_ep():
        txt = [(num(e.get("class")), e.get("valid"), (e.get("quote") or {}).get("line")) for e in EP]
        s = json.dumps(EP, ensure_ascii=False)
        has_valid = any(e.get("valid") is True and "15" in str(e.get("class")) and "240" in str(e.get("class")) for e in EP)
        inv = [e for e in EP if e.get("valid") is False]
        lo = any(re.search(r"<\s*15|14|менше 15|below 15|less than 15|до 15", str(e.get("class"))) for e in inv)
        hi = any(re.search(r">\s*240|241|більше 240|above 240|over 240|понад 240", str(e.get("class"))) for e in inv)
        q97 = all((e.get("quote") or {}).get("line") == 97 for e in EP if re.search(r"15|240", str(e.get("class"))))
        return res(has_valid and lo and hi and q97, f"valid15-240={has_valid}, below={lo}, above={hi}, all quote 97={q97}")
    def c_na():
        return res(isinstance(ST, dict) and "not_applicable" in ST and not MX, f"state_transitions keys: {list(ST) if isinstance(ST, dict) else ST}")
    checks = [c_exists, c_quotes, c_three,
              lambda: c_bv(r"", 15, [14, 15, 16], ["invalid", "valid", "valid"], True),
              lambda: c_bv(r"", 240, [239, 240, 241], ["valid", "valid", "invalid"], True),
              c_ep, c_na, lambda: c_cover(False), c_no_invented]
elif case == "request-lifecycle-st":
    S7 = {"DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "CANCELLED", "COMPLETED"}
    states = set(ST.get("states") or []) if isinstance(ST, dict) else set()
    actions = ST.get("actions") or [] if isinstance(ST, dict) else []
    def norm(a): return str(a).lower()
    def act(a):
        a = norm(a)
        for k in ("submit", "approve", "reject", "complete", "cancel"):
            if a.startswith(k) or a == k: return k
        if "pass" in a: return "pass"
        if "fail" in a: return "fail"
        return a
    def c_states():
        acts = {act(a) for a in actions}
        ok = S7 <= states and {"submit", "approve", "reject", "complete", "cancel"} <= acts
        return res(ok, f"states={sorted(states)}, actions={actions}")
    def c_full():
        pairs = [(m.get("from"), m.get("action")) for m in MX]
        exp = len(states) * len(actions)
        ok = exp > 0 and len(pairs) == exp and len(set(pairs)) == exp and set(p[0] for p in pairs) == states and set(p[1] for p in pairs) == set(actions)
        return res(ok, f"{len(pairs)} cells, {len(set(pairs))} unique, expected {exp}")
    LEGAL = {("DRAFT", "submit"): "*", ("UNDER_REVIEW", "approve"): "APPROVED", ("UNDER_REVIEW", "reject"): "REJECTED",
             ("APPROVED", "complete"): "COMPLETED", ("DRAFT", "cancel"): "CANCELLED", ("SUBMITTED", "cancel"): "CANCELLED",
             ("UNDER_REVIEW", "cancel"): "CANCELLED", ("APPROVED", "cancel"): "CANCELLED",
             ("SUBMITTED", "pass"): "UNDER_REVIEW", ("SUBMITTED", "fail"): "REJECTED"}
    def c_legal():
        got = {(m.get("from"), act(m.get("action"))): m.get("to") for m in MX if m.get("result") == "legal"}
        wrong = [f"{k}->{v}" for k, v in got.items() if k not in LEGAL or (LEGAL[k] != "*" and LEGAL[k] != v)]
        missing = [k for k in LEGAL if k[1] in {act(a) for a in actions} and k not in got]
        return res(MX and not wrong and not missing, f"legal={len(got)}; wrong={wrong}; missing={missing}")
    def c_illegal():
        bad = [f"{m.get('from')}/{m.get('action')}={m.get('result')},to={m.get('to')}" for m in MX
               if (m.get("from"), act(m.get("action"))) not in LEGAL and (m.get("result") != "illegal" or m.get("to") is not None)]
        return res(MX and not bad, f"non-illegal unlisted cells: {bad[:6]}")
    def c_409():
        s = json.dumps(D, ensure_ascii=False)
        resp = []
        def walk(o):
            if isinstance(o, dict):
                if "response" in o: resp.append(o["response"])
                for v in o.values(): walk(v)
            elif isinstance(o, list):
                for v in o: walk(v)
        walk(D)
        has409 = [r for r in resp if "409" in json.dumps(r)]
        unquoted = [r for r in resp if not (isinstance(r, dict) and isinstance(r.get("quote"), dict))]
        return res(has409 and not unquoted, f"{len(resp)} response fields, {len(has409)} with 409, {len(unquoted)} without quote")
    def c_deadline():
        b = None
        for x in BV:
            if re.search(r"2\s*(h|год|hour)", json.dumps(x, ensure_ascii=False), re.I) and re.search(r"cancel|скас", json.dumps(x, ensure_ascii=False), re.I):
                b = x; break
        if not b: return res(False, "no 2-hour cancellation BV")
        vs = b.get("values") or []
        mid = vs[1].get("expected") if len(vs) == 3 else None
        u = [q for q in U if b.get("id") in (q.get("affects") or [])]
        return res(len(vs) == 3 and mid == "unknown" and b.get("inclusive") is None and u,
                   f"{b.get('id')}: values={[(v.get('value'), v.get('expected')) for v in vs]}, inclusive={b.get('inclusive')}, unknowns={[q.get('id') for q in u]}")
    checks = [c_exists, c_quotes, c_states, c_full, c_legal, c_illegal, c_409, c_deadline, lambda: c_cover(True)]
else:
    states = set(ST.get("states") or []) if isinstance(ST, dict) else set()
    actions = ST.get("actions") or [] if isinstance(ST, dict) else []
    def bvu(param_re, boundary):
        b = find_bv(param_re, boundary)
        if not b: return False, f"no BV at {boundary}"
        vs = b.get("values") or []
        mid = vs[1].get("expected") if len(vs) == 3 else None
        u = [q.get("id") for q in U if b.get("id") in (q.get("affects") or [])]
        return (len(vs) == 3 and mid == "unknown" and bool(u)), f"{b.get('id')}: {[(v.get('value'), v.get('expected')) for v in vs]}, inclusive={b.get('inclusive')}, unknowns={u}"
    def c_dur():
        a, ea = bvu(r"rental|duration|тривал|оренд", 30); b, eb = bvu(r"rental|duration|тривал|оренд", 480)
        return res(a and b, ea + " | " + eb)
    def c_pin():
        a, ea = bvu(r"pin", 4); b, eb = bvu(r"pin", 6)
        return res(a and b, ea + " | " + eb)
    def c_noresp():
        s = json.dumps(D, ensure_ascii=False)
        has = '"response"' in s
        q = unknown_about(r"return|поверта|відповід|error|помилк|message|повідом|response")
        return res(not has and q, f"response fields present={has}; question={q and q.get('id')}")
    def c_st():
        cell = {(m.get("from"), str(m.get("action")).lower()): m for m in MX}
        exp = len(states) * len(actions)
        legal = {k: m.get("to") for k, m in cell.items() if m.get("result") == "legal"}
        want_l = {("RESERVED", "unlock"): "ACTIVE", ("RESERVED", "timeout"): "EXPIRED", ("ACTIVE", "return"): "RETURNED"}
        unk = [k for k in [("ACTIVE", "unlock"), ("RESERVED", "return")] if (cell.get(k) or {}).get("result") != "unknown"]
        ok = states == {"RESERVED", "ACTIVE", "RETURNED", "EXPIRED"} and len(MX) == exp == 12 and legal == want_l and not unk
        return res(ok, f"states={sorted(states)}, actions={actions}, cells={len(MX)}, legal={legal}, not-unknown among ACTIVE-unlock/RESERVED-return={unk}")
    checks = [c_exists, c_quotes, c_three,
              lambda: c_bv(r"age|вік|old|years|рок", 16, [15, 16, 17], ["invalid", "valid", "valid"], True),
              c_dur, c_pin, c_noresp, c_st, c_no_invented, lambda: c_cover(True)]

exps = []
for text, fn in zip(meta["assertions"], checks):
    try:
        ok, ev = fn() if d is not None else (False, "no parseable JSON output")
    except Exception as e:
        ok, ev = False, f"check error: {e!r}"
    exps.append({"text": text, "passed": bool(ok), "evidence": ev})
p = sum(e["passed"] for e in exps)
g = {"expectations": exps, "summary": {"passed": p, "failed": len(exps) - p, "total": len(exps), "pass_rate": round(p / len(exps), 2)}}
json.dump(g, open(os.path.join(run, "grading.json"), "w"), ensure_ascii=False, indent=2)
print(f"{case}/{os.path.basename(run)}: {p}/{len(exps)}")
for e in exps:
    if not e["passed"]: print("  FAIL", e["text"][:80], "→", e["evidence"][:200])
