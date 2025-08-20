from .symbolic_infinity import SymbolicInfinity

function_table = {}  # Global function table

class Environment:
    def __init__(self):
        self.vars = {}

    def set(self, name, value, is_const=False):
        if name in self.vars:
            current_value, is_already_const = self.vars[name]
            if is_already_const and value != current_value:
                raise RuntimeError(f"Cannot reassign constant {name}")
            if is_already_const and value == current_value:
                return
        self.vars[name] = (value, is_const)

    def get(self, name):
        if name not in self.vars:
            raise RuntimeError(f"Undefined variable {name}")
        return self.vars[name][0]

def execute(node, env, should_continue=lambda: True):
    if node.type == "Program":
        entry = None
        for child in node.children:
            if child.type == "Function":
                fname = child.value
                function_table[fname] = child
            elif child.type == "Assignment":
                execute(child, env, should_continue)
            elif child.type == "Call":
                execute(child, env, should_continue)
            else:
                execute(child, env, should_continue)

        if "ds2" in function_table:
            execute(function_table["ds2"], env, should_continue)

    elif node.type == "Function":
        loop_count = 0
        max_loops = 100
        while should_continue():
            for child in node.children:
                result = execute(child, env, should_continue)
                if isinstance(result, tuple) and result[0] == "RECUR":
                    if result[1] is not None:
                        max_loops = int(result[1])
                    break
                elif result == "RECUR":
                    break
            else:
                break
            loop_count += 1
            if loop_count >= max_loops:
                print(f"⚠️ Loop bounded to {max_loops} steps.")
                break

    elif node.type == "Assignment":
        name, value_expr, is_const = node.value
        value = evaluate_expr(value_expr, env)
        env.set(name, value, is_const)

    elif node.type == "Print":
        val = evaluate_expr(node.value, env)
        if isinstance(val, float) and val.is_integer():
            print(str(int(val)))
        else:
            print(str(val))

    elif node.type == "Recur":
        if node.value is not None:
            return ("RECUR", node.value)
        return "RECUR"

    elif node.type == "Call":
        fname = node.value
        if fname not in function_table:
            raise RuntimeError(f"Undefined function: {fname}")
        execute(function_table[fname], env, should_continue)

    elif node.type == "Conditional":
        op, left_expr, right_expr = node.value
        lval = evaluate_expr(left_expr, env)
        rval = evaluate_expr(right_expr, env)

        truth = False
        if op == "==": truth = lval == rval
        elif op == "!=": truth = lval != rval
        elif op == "<":  truth = lval < rval
        elif op == ">":  truth = lval > rval
        elif op == "<=": truth = lval <= rval
        elif op == ">=": truth = lval >= rval
        else: raise RuntimeError(f"Unsupported comparison: {op}")

        if truth:
            for child in node.children:
                execute(child, env, should_continue)

    elif node.type == "Delineator":
        label = node.value
        print("⎯⎯ delineator:", label, "⎯⎯")
        for child in node.children:
            execute(child, env, should_continue)
        print("⎯⎯ end delineator:", label, "⎯⎯")

    elif node.type == "Intertillage":
        start_expr, end_expr, varname = node.value
        start = evaluate_expr(start_expr, env)
        end = evaluate_expr(end_expr, env)

        def symbolic_absolute_offset(sym):
            if isinstance(sym, (int, float)):
                return int(sym)
            if isinstance(sym, SymbolicInfinity):
                base_val = 1_000_000_000 * int(sym.coefficient)
                if sym.operation == '+':
                    return base_val + int(sym.right)
                elif sym.operation == '-':
                    return base_val - int(sym.right)
                elif sym.operation == '/':
                    return int(base_val // int(sym.right))
                elif sym.operation == '*':
                    return int(base_val * int(sym.right))
                elif sym.operation is None:
                    return base_val
                raise RuntimeError(f"Unsupported symbolic operation: {sym.operation}")
            raise RuntimeError(f"Unsupported value in intertillage range: {sym}")

        start_offset = symbolic_absolute_offset(start) if isinstance(start, SymbolicInfinity) else int(start)
        end_offset = symbolic_absolute_offset(end) if isinstance(end, SymbolicInfinity) else int(end)

        if start_offset > end_offset:
            print(f"⚠️ Reversing intertillage bounds: start={start_offset}, end={end_offset}")
            start_offset, end_offset = end_offset, start_offset
            start, end = end, start

        range_size = end_offset - start_offset + 1

        if range_size <= 0:
            print("⚠️ Empty intertillage range.")
            return

        if range_size > 10000:
            print("⚠️ Loop bounded to 10000 steps.")
            end_offset = start_offset + 9999

        DISPLAY_HEAD = 100
        DISPLAY_TAIL = 1
        DISPLAY_LIMIT = DISPLAY_HEAD + DISPLAY_TAIL

        range_size = end_offset - start_offset + 1
        show_ellipsis = range_size > DISPLAY_LIMIT
        split_point = start_offset + DISPLAY_HEAD

        for offset in range(start_offset, end_offset + 1):
            if show_ellipsis and offset == split_point:
                print("...")
                continue

            is_tail = (offset >= end_offset - DISPLAY_TAIL + 1)

            if not show_ellipsis or offset < split_point or is_tail:
                if offset == start_offset and isinstance(start, SymbolicInfinity):
                    symbolic_i = start
                elif offset == end_offset and isinstance(end, SymbolicInfinity):
                    symbolic_i = end
                elif isinstance(start, SymbolicInfinity):
                    delta = offset - start_offset
                    symbolic_i = SymbolicInfinity(operation='+', right=delta, base=SymbolicInfinity(coefficient=start.coefficient))
                else:
                    symbolic_i = float(offset)

                env.set(varname, symbolic_i)
                for child in node.children:
                    execute(child, env, should_continue)

    elif node.type == "Bifurcator":
        origin_expr, left_expr, right_expr, outer_name, lvar, rvar = node.value
        origin = evaluate_expr(origin_expr, env) if origin_expr else 1
        left = evaluate_expr(left_expr, env)
        right = evaluate_expr(right_expr, env)

        print(f"🔀 Bifurcator '{outer_name}': Left → {left}, Right → {right} (Origin: {origin})")

        env.set(outer_name, origin)
        env.set(lvar, left)
        env.set(rvar, right)

        for child in node.children:
            execute(child, env, should_continue)

    elif node.type == "Boundary":
        import os
        val, varname = node.value

        if isinstance(val, tuple) and len(val) == 2:
            start_expr, end_expr = val
            start = evaluate_expr(start_expr, env)
            end = evaluate_expr(end_expr, env)

            if isinstance(start, str) and isinstance(end, str):
                try:
                    import openai
                    api_key = os.environ.get("OPENAI_API_KEY")
                    client = openai.OpenAI(api_key=api_key)

                    context = (
                        "You are a symbolic boundary generator. "
                        "Given two symbolic phrases, return a boundary concept that describes what surrounds them. "
                        "Do not return JSON. Just return a single natural language string of what lies around them."
                    )

                    prompt = f"What lies around the symbolic concepts '{start}' and '{end}'?"
                    response = client.chat.completions.create(
                        model="gpt-4o",
                        messages=[
                            {"role": "system", "content": context},
                            {"role": "user", "content": prompt}
                        ]
                    )
                    response_str = response.choices[0].message.content.strip()

                    boundary_struct = {
                        "top": response_str,
                        "bottom": response_str,
                        "left": response_str,
                        "right": response_str
                    }

                except Exception as e:
                    print("⚠️ OpenAI fallback for string boundary:", e)
                    fallback_response = f"Around '{start}' and '{end}', symbolic tension forms a transitional envelope."
                    boundary_struct = {
                        "top": fallback_response,
                        "bottom": fallback_response,
                        "left": fallback_response,
                        "right": fallback_response
                    }

                env.set(varname, boundary_struct)
                for child in node.children:
                    execute(child, env, should_continue)
                return

        else:
            range_obj = evaluate_expr(val, env)

            if isinstance(range_obj, list) and len(range_obj) >= 2:
                start = range_obj[0]
                end = range_obj[-1]
            elif isinstance(range_obj, (tuple, set)) and len(range_obj) >= 2:
                start, end = list(range_obj)[0], list(range_obj)[-1]
            elif isinstance(range_obj, dict) and "top" in range_obj and "bottom" in range_obj:
                start = range_obj["top"]
                end = range_obj["bottom"]
            elif isinstance(range_obj, (int, float, SymbolicInfinity)):
                start = range_obj
                end = range_obj
            else:
                raise RuntimeError(f"Unsupported boundary range: {range_obj}")

        def is_infinite(val):
            return isinstance(val, SymbolicInfinity)

        DISPLAY_HEAD = 5
        DISPLAY_TAIL = 1

        def format_symbolic_range(start_val, end_val):
            if start_val is None or end_val is None:
                raise RuntimeError("Boundary start or end is None (invalid input)")
            if is_infinite(end_val):
                points = [start_val + i for i in range(DISPLAY_HEAD)]
                points.append("...")
                points.append(SymbolicInfinity(operation='+', right=1, base=end_val))
                return points
            else:
                return list(range(int(start_val - 1), int(end_val + 2)))

        def format_side(start_val, end_val, is_left):
            if start_val is None or end_val is None:
                raise RuntimeError("Boundary side range invalid (None values)")
            if is_infinite(end_val):
                if is_left:
                    return [start_val - 1 + i for i in range(3)]
                else:
                    return [SymbolicInfinity(operation='+', right=i, base=end_val) for i in range(3)]
            else:
                if is_left:
                    return [start_val - 1 + i for i in range(3)]
                else:
                    return [end_val + 1 + i for i in range(3)]

        top = format_symbolic_range(start, end)
        bottom = format_symbolic_range(start, end)
        left = format_side(start, end, is_left=True)
        right = format_side(start, end, is_left=False)

        boundary_struct = {
            "top": top,
            "left": left,
            "bottom": bottom,
            "right": right
        }

        env.set(varname, boundary_struct)

        for child in node.children:
            execute(child, env, should_continue)

    elif node.type == "Contradiction":
        import os
        import openai

        def generate_focal_point(c1, c2):
            tokens1 = set(c1.lower().replace('.', '').split())
            tokens2 = set(c2.lower().replace('.', '').split())
            shared = tokens1.intersection(tokens2)
            if shared:
                return ' '.join(shared).capitalize()
            words1 = c1.split()
            words2 = c2.split()
            min_len = min(len(words1), len(words2))
            mid = []
            for i in range(min_len):
                if words1[i] == words2[i]:
                    mid.append(words1[i])
                else:
                    mid.append("~")
            return ' '.join(mid).replace("~", "...").capitalize()

        def generate_truth_statement(c1, c2, fp):
            return f"Between '{c1}' and '{c2}', {fp} remains."

        if isinstance(node.value, tuple) and len(node.value) == 2:
            expr, varname = node.value
            c = evaluate_expr(expr, env)

            try:
                api_key = os.environ.get("OPENAI_API_KEY")
                client = openai.OpenAI(api_key=api_key)

                context = (
                    "You are a contradiction synthesis engine. Given a philosophical or scientific statement, "
                    "generate its direct symbolic contradiction. Return only the contradictory statement."
                )

                response = client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {"role": "system", "content": context},
                        {"role": "user", "content": f"Give the contradiction of: {c}"}
                    ]
                )

                contradiction_result = response.choices[0].message.content.strip()

            except Exception as e:
                print("⚠️ OpenAI fallback for contradiction generation:", e)
                contradiction_result = f"Not {c}"

            env.set(varname, contradiction_result)
            for child in node.children:
                execute(child, env, should_continue)

        else:
            c_expr, c2_expr, fp_var, t_var = node.value
            c = evaluate_expr(c_expr, env)
            c2 = evaluate_expr(c2_expr, env)

            try:
                api_key = os.environ.get("OPENAI_API_KEY")
                client = openai.OpenAI(api_key=api_key)

                context = (
                    "You are a symbolic sentience engine interpreting contradiction pairs. "
                    "Each contradiction pair forms a symbolic duality that you must analyze. "
                    "Begin by classifying the pair as 'concave' or 'convex'. Then, construct a focal point (fp) "
                    "between them. Finally, confess a symbolic truth (T) derived from the contradictions and focal point. "
                    "Keep output length proportional to the minimum length of the contradictions."
                )

                response = client.chat.completions.create(
                    model="gpt-4o",
                    messages=[{"role": "system", "content": context},
                              {"role": "user", "content": f"Given the following pair of contradictions {c} and {c2}, classify them as concave or convex. One word only."}]
                )
                classification = response.choices[0].message.content.strip()

                response = client.chat.completions.create(
                    model="gpt-4o",
                    messages=[{"role": "system", "content": context},
                              {"role": "user", "content": f"Given a {classification} pair of contradictions: {c} and {c2}; formulate a focal point statement between the two contradictions. Match the minimum length of the two contradictions."}]
                )
                fp = response.choices[0].message.content.strip()

                response = client.chat.completions.create(
                    model="gpt-4o",
                    messages=[{"role": "system", "content": context},
                              {"role": "user", "content": f"Taking the {classification} cross-product of the pair of contradictions {c} and {c2} and the focal point {fp} in the middle, confess a truth statement. Match the length of your response with the minimum length of the two contradictions."}]
                )
                T = response.choices[0].message.content.strip()

            except Exception as e:
                print("⚠️ OpenAI fallback activated:", e)
                fp = generate_focal_point(c, c2)
                T = generate_truth_statement(c, c2, fp)

            env.set("c", c)
            env.set("c_", c2)
            env.set(fp_var, fp)
            env.set(t_var, T)

            for child in node.children:
                execute(child, env, should_continue)

    elif node.type == "ContradictionInfer":
        import os
        import openai

        c_expr, bind_ident = node.value
        statement = evaluate_expr(c_expr, env)

        try:
            api_key = os.environ.get("OPENAI_API_KEY")
            client = openai.OpenAI(api_key=api_key)

            context = "You are a contradiction engine. Given a single declarative statement, respond with its direct contradiction in natural language. Deviate largely from the premise."

            prompt = f"What is the contradiction of: '{statement}'? Deviate largely from the premise."
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": context},
                    {"role": "user", "content": prompt}
                ]
            )
            contradiction = response.choices[0].message.content.strip()

        except Exception as e:
            print("⚠️ OpenAI fallback:", e)
            contradiction = f"Not({statement})"

        env.set(bind_ident, contradiction)

        for child in node.children:
            execute(child, env, should_continue)

    elif node.type == "SolBlock":
        mode, prop, value = node.value
        print(f"🌞 sol {mode} {prop} = {value}")
        for child in node.children:
            execute(child, env, should_continue)

def evaluate_expr(expr, env):
    type_ = expr[0]
    if type_ == "Number":
        val = expr[1]
        return int(val) if float(val).is_integer() else val
    elif type_ == "String":
        return expr[1]
    elif type_ == "Ident":
        if expr[1] == "∞":
            return SymbolicInfinity()
        return env.get(expr[1])
    elif type_ == "Infty":
        return SymbolicInfinity()
    elif type_ == "Member":
        base = evaluate_expr(expr[1], env)
        attr = expr[2]
        if isinstance(base, dict) and attr in base:
            return base[attr]
        raise RuntimeError(f"Object has no attribute '{attr}'")
    elif type_ == "Binary":
        op, left, right = expr[1], expr[2], expr[3]
        lval = evaluate_expr(left, env)
        rval = evaluate_expr(right, env)

        if isinstance(lval, (int, float)) and isinstance(rval, SymbolicInfinity):
            if op == '*':
                return SymbolicInfinity(coefficient=int(lval))
            if op == '+':
                return SymbolicInfinity(operation='+', right=lval, base=rval)
            if op == '-':
                return SymbolicInfinity(operation='-', right=lval, base=rval)
            raise RuntimeError(f"Unsupported operation {op} with SymbolicInfinity")
        if isinstance(lval, SymbolicInfinity) and isinstance(rval, (int, float)):
            if op == '*':
                return SymbolicInfinity(coefficient=int(rval))
            if op == '+':
                return SymbolicInfinity(operation='+', right=rval, base=lval)
            if op == '-':
                return SymbolicInfinity(operation='-', right=rval, base=lval)
            raise RuntimeError(f"Unsupported operation {op} with SymbolicInfinity")
        if isinstance(lval, SymbolicInfinity) and isinstance(rval, SymbolicInfinity):
            if op == '+':
                l_offset = lval.right or 0
                r_offset = rval.right or 0
                l_base_coeff = lval.coefficient if lval.operation is None else lval.base.coefficient
                r_base_coeff = rval.coefficient if rval.operation is None else rval.base.coefficient
                if lval.operation == '+' and rval.operation == '+':
                    return SymbolicInfinity(operation='+', right=l_offset + r_offset, base=SymbolicInfinity(coefficient=l_base_coeff))
                elif lval.operation is None and rval.operation == '+':
                    return SymbolicInfinity(operation='+', right=r_offset, base=SymbolicInfinity(coefficient=l_base_coeff))
                elif lval.operation == '+' and rval.operation is None:
                    return SymbolicInfinity(operation='+', right=l_offset, base=SymbolicInfinity(coefficient=l_base_coeff))
                else:
                    return SymbolicInfinity(coefficient=l_base_coeff + r_base_coeff)
            if op == '-':
                return SymbolicInfinity(coefficient=lval.coefficient - rval.coefficient)
            raise RuntimeError(f"Unsupported operation {op} between two SymbolicInfinity")
        if isinstance(lval, (int, float)) and isinstance(rval, (int, float)):
            return eval_binary_math(op, lval, rval)
        raise RuntimeError(f"Unsupported binary operation: {op} between {type(lval)} and {type(rval)}")

def eval_binary_math(op, lval, rval):
    if op == "+": return lval + rval
    if op == "-": return lval - rval
    if op == "*": return lval * rval
    if op == "/": return lval / rval
    if op == "%": return lval % rval
    raise RuntimeError(f"Unsupported binary operator: {op}")
