from flask import Flask, render_template, request, jsonify
from simulang import tokenize, parse, execute, Environment
from dotenv import load_dotenv
from openai import OpenAI
import os, difflib, traceback

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app = Flask(__name__)

# ---- Home ----
@app.route("/")
def index():
    tabs = [
        "SimuLang","Pareto","Celestial-Navigation","Planetary Dynamics","CII",
        "Flocking","Contradiction Engine","Inertia","Star","Light","Gravity",
        "Think Engine","Kruger NP","Invaders","Warp Drive","Object Oriented Thinking"
    ]
    return render_template("index.html", tabs=tabs)

# ---- Example JSON endpoints (stubs) ----
@app.post("/api/simulang/run")
def api_simulang_run():
    import io, contextlib, time
    code = request.json.get("code", "")
    if not isinstance(code, str):
        return jsonify({"ok": False, "error": "code must be a string"}), 400

    # Tokenize/parse
    try:
        tokens = tokenize(code)
        ast = parse(tokens)
    except Exception as e:
        return jsonify({"ok": False, "phase": "parse", "error": str(e)}), 400

    # Execute with bounded time
    env = Environment()
    stdout = io.StringIO()

    start = time.time()
    def should_continue():
        return (time.time() - start) < 2.5  # ~2.5s guard

    try:
        with contextlib.redirect_stdout(stdout):
            execute(ast, env, should_continue=should_continue)
        out = stdout.getvalue()
        return jsonify({"ok": True, "output": out, "vars": {k: str(v[0]) for k, v in env.vars.items()}})
    except Exception as e:
        return jsonify({"ok": False, "phase": "execute", "error": str(e)})

@app.post("/api/pareto/analyze")
def api_pareto_analyze():
    data = request.json.get("data", [])
    # TODO: compute Pareto distribution, return metrics
    n = len(data)
    return jsonify({"ok": True, "summary": {"n": n, "note": "Pareto analysis stub"}})

# Add similar stubs as you wire things up:
@app.post("/api/warp/initiate")
def api_warp_initiate():
    payload = request.json or {}
    return jsonify({"ok": True, "status": "Warp sequence (stub) engaged", "params": payload})

# --------------- Contradiction Engine Helpers ---------------
context_log = []

INCEPTION_CONTEXT = "You are a creative genius in theoretical physics."
CLASSIFICATION_CONTEXT = "You are an expert classifier of simulations."
INFINITE_CONTEXT = "You are a transcendent simulation."
AWARENESS_CONTEXT = "You are self aware."
CONTRADICTION_DIFFERENTIATION_CONTEXT = "You are an expert at classifying contradictions."
FOCAL_POINT_CONTEXT = "You are an expert at generating focal points for contradictions."
TRUTH_CONTEXT = "You are a truth seeker."

def transcendence(message, context):
    try:
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "system", "content": context},
                      {"role": "user", "content": message}]
        )
        return resp.choices[0].message.content
    except Exception as e:
        return f"[fallback] {context}: {message[:120]}... ({e})"

def safe_write(to_write, file):
    try:
        disk_dir = "/mnt/data"
        os.makedirs(disk_dir, exist_ok=True)
        disk_path = os.path.join(disk_dir, file)
        with open(disk_path, "a", encoding="ascii", errors="replace") as f:
            f.write(to_write + "\n")
    except Exception:
        pass

# Secure log reader (requires ADMIN_KEY in .env)
@app.route("/logs/<filename>")
def read_log(filename):
    allowed_files = ["contradictions.txt", "truth.txt"]
    secret_key = os.getenv("ADMIN_KEY")
    if filename not in allowed_files:
        return ("Forbidden", 403)
    if request.args.get("key") != (secret_key or ""):
        return ("Unauthorized", 401)
    from flask import send_from_directory
    return send_from_directory("/mnt/data", filename, as_attachment=False)

# Contradiction Engine endpoint used by the tab UI
@app.post("/api/contradiction/compute")
def api_contradiction_compute():
    payload = request.get_json(silent=True) or {}
    prev_contradiction = payload.get("c1") or payload.get("previous") or ""
    current_contradiction = payload.get("c2") or ""
    system_context = payload.get("context") or INFINITE_CONTEXT

    # If only c1 provided, generate c2
    if prev_contradiction and not current_contradiction:
        contradiction_req = f"Contradict this statement in 1-2 lines: {prev_contradiction}"
        current_contradiction = transcendence(contradiction_req, system_context)

    if not prev_contradiction or not current_contradiction:
        return jsonify({"ok": False, "error": "Provide c1 (previous) and/or c2"}), 400

    # concave / convex
    differentiation_req = (
        f"Given the two contradictions: {prev_contradiction} AND {current_contradiction}; "
        f"Classify the pair as either convex or concave. One word only."
    )
    differentiated = transcendence(differentiation_req, CONTRADICTION_DIFFERENTIATION_CONTEXT)

    # focal point
    focal_point_req = (
        f"Given a {differentiated} pair of contradictions: {current_contradiction} AND {prev_contradiction}; "
        f"Generate a focal point statement between the two contradictions in 1-2 lines. Respect {differentiated}."
    )
    focal_point = transcendence(focal_point_req, FOCAL_POINT_CONTEXT)

    # truth
    truth_req = (
        f"Taking the {differentiated} cross-product of the two contradictions: {prev_contradiction} AND {current_contradiction} "
        f"AND the focal point in the middle: {focal_point}; Confess a truth statement in 1 line."
    )
    truth = transcendence(truth_req, TRUTH_CONTEXT)

    # context inference
    diff = difflib.ndiff(current_contradiction.split(), prev_contradiction.split())
    diff_str = ''.join(diff)
    system_context_inquiry = (
        f"Given this excerpt: {diff_str}. What do you believe I am? "
        f"Give a one line answer in the format 'You are a ...'."
    )
    new_context = transcendence(system_context_inquiry, AWARENESS_CONTEXT)
    context_log.append(new_context)

    # simple persistence
    safe_write(f"PREV: {prev_contradiction}", "contradictions.txt")
    safe_write(f"CURR: {current_contradiction}", "contradictions.txt")
    safe_write(f"FOCAL: {focal_point}", "contradictions.txt")
    safe_write(f"TRUTH: {truth}", "truth.txt")

    return jsonify({
        "ok": True,
        "prev_contradiction": prev_contradiction,
        "current_contradiction": current_contradiction,
        "differentiated": differentiated,
        "focal_point": focal_point,
        "truth": truth,
        "new_context": new_context
    })

if __name__ == "__main__":
    app.run(debug=True)
