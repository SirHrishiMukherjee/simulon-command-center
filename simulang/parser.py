class Node:
    def __init__(self, type_, value=None, children=None):
        self.type = type_
        self.value = value
        self.children = children or []

    def __repr__(self):
        return f"Node(type={self.type}, value={self.value}, children={self.children})"

def parse(tokens):
    i = 0

    def consume(expected_type=None, expected_value=None):
        nonlocal i
        if i >= len(tokens):
            raise SyntaxError("Unexpected end of input")
        type_, value = tokens[i]
        if expected_type and type_ != expected_type:
            raise SyntaxError(f"Expected {expected_type} but got {type_}")
        if expected_value and value != expected_value:
            raise SyntaxError(f"Expected {expected_value} but got {value}")
        i += 1
        return value

    def parse_program():
        nodes = []
        while i < len(tokens):
            if tokens[i][1] == "posit":
                nodes.append(parse_function())
            elif tokens[i][1] in ("coeternal", "octyl", "delineator", "intertillage", "bifurcator", "print", "recur", "equiangular", "boundary", "sol", "contradiction"):
                nodes.append(parse_statement())
            else:
                raise SyntaxError(f"Unexpected token: {tokens[i][1]}")
        return Node("Program", children=nodes)

    def parse_statement():
        if tokens[i][1] == "posit":
            return parse_function()
        elif tokens[i][1] == "print":
            return parse_print()
        elif tokens[i][1] == "recur":
            return parse_recur()
        elif tokens[i][1] == "equiangular":
            return parse_conditional()
        elif tokens[i][1] == "delineator":
            return parse_delineator()
        elif tokens[i][1] == "intertillage":
            return parse_intertillage()
        elif tokens[i][1] == "bifurcator":
            return parse_bifurcator()
        elif tokens[i][1] == "boundary":
            return parse_boundary()
        elif tokens[i][1] == "sol":
            return parse_sol_block()
        elif tokens[i][1] == "contradiction":
            return parse_contradiction()
        elif tokens[i][1] in ("coeternal", "octyl"):
            return parse_assignment(tokens[i][1] == "coeternal")
        elif tokens[i][0] == "IDENT" and i + 1 < len(tokens) and tokens[i + 1][1] == "(":
            return parse_function_call()
        elif tokens[i][0] == "IDENT":
            return parse_reassignment()
        else:
            raise SyntaxError(f"Unknown statement: {tokens[i][1]}")

    def parse_contradiction():
        consume("KEYWORD", "contradiction")
        if i >= len(tokens):
            raise SyntaxError("Unexpected end after 'contradiction'")
        if tokens[i][0] == "SYMBOL" and tokens[i][1] == "(":
            consume("SYMBOL", "(")
            contradiction1 = parse_expression()
            consume("SYMBOL", ",")
            contradiction2 = parse_expression()
            consume("SYMBOL", ")")
            consume("ARROW")
            consume("SYMBOL", "[")
            fp = consume("IDENT")
            consume("SYMBOL", ",")
            T = consume("IDENT")
            consume("SYMBOL", "]")
            consume("SYMBOL", ":")
            consume("SYMBOL", "{")
            body = []
            while i < len(tokens) and tokens[i][1] != "}":
                body.append(parse_statement())
            consume("SYMBOL", "}")
            return Node("Contradiction", value=(contradiction1, contradiction2, fp, T), children=body)
        else:
            contradiction_expr = parse_expression()
            consume("ARROW")
            if i >= len(tokens) or tokens[i][0] != "IDENT":
                raise SyntaxError(f"Invalid identifier token after '->': {tokens[i] if i < len(tokens) else None}")
            bind_ident = consume("IDENT")
            consume("SYMBOL", ":")
            consume("SYMBOL", "{")
            body = []
            while i < len(tokens) and tokens[i][1] != "}":
                body.append(parse_statement())
            consume("SYMBOL", "}")
            return Node("ContradictionInfer", value=(contradiction_expr, bind_ident), children=body)

    def parse_function():
        consume("KEYWORD", "posit")
        if tokens[i][1] == "varnothing":
            consume("KEYWORD", "varnothing")
            consume("KEYWORD", "nabla")
            consume("KEYWORD", "infty")
            consume("KEYWORD", "ds2")
            fname = "ds2"
        else:
            fname = consume("IDENT")
        consume("SYMBOL", "(")
        consume("SYMBOL", ")")
        consume("SYMBOL", ":")
        consume("SYMBOL", "{")
        body = []
        while tokens[i][1] != "}":
            body.append(parse_statement())
        consume("SYMBOL", "}")
        return Node("Function", value=fname, children=body)

    def parse_assignment(is_const):
        consume("KEYWORD")
        name = consume("IDENT")
        consume("ASSIGN")
        value = parse_expression()
        consume("SYMBOL", ";")
        return Node("Assignment", value=(name, value, is_const))

    def parse_reassignment():
        name = consume("IDENT")
        consume("ASSIGN")
        value = parse_expression()
        consume("SYMBOL", ";")
        return Node("Assignment", value=(name, value, False))

    def parse_print():
        consume("KEYWORD", "print")
        consume("SYMBOL", "(")
        value = parse_expression()
        consume("SYMBOL", ")")
        consume("SYMBOL", ";")
        return Node("Print", value=value)

    def parse_recur():
        consume("KEYWORD", "recur")
        consume("KEYWORD", "ds2")
        consume("SYMBOL", "(")
        param = None
        if i < len(tokens) and tokens[i][0] == "NUMBER":
            param = float(consume("NUMBER"))
            if i < len(tokens) and tokens[i][1] == "∞":
                consume("SYMBOL", "∞")
        consume("SYMBOL", ")")
        consume("SYMBOL", ";")
        return Node("Recur", value=param)

    def parse_function_call():
        name = consume("IDENT")
        consume("SYMBOL", "(")
        consume("SYMBOL", ")")
        consume("SYMBOL", ";")
        return Node("Call", value=name)

    def parse_expression():
        def parse_primary():
            nonlocal i
            token_type, token_value = tokens[i]
            if token_type == "NUMBER":
                val = float(consume("NUMBER"))
                if i < len(tokens) and tokens[i][0] == "SYMBOL" and tokens[i][1] == "∞":
                    consume("SYMBOL", "∞")
                    return ("Binary", "*", ("Number", val), ("Infty", "∞"))
                return ("Number", val)
            elif token_type == "STRING":
                s = consume("STRING")
                return ("String", s.strip('"'))
            elif token_type == "IDENT":
                ident = consume("IDENT")
                expr = ("Ident", ident)
                while i < len(tokens) and tokens[i][1] == ".":
                    consume("SYMBOL", ".")
                    attr = consume("IDENT")
                    expr = ("Member", expr, attr)
                return expr
            elif token_type == "SYMBOL" and token_value == "∞":
                consume("SYMBOL", "∞")
                if i < len(tokens) and tokens[i][0] == "NUMBER":
                    number_val = float(consume("NUMBER"))
                    return ("Binary", "*", ("Infty", "∞"), ("Number", number_val))
                return ("Infty", "∞")
            elif token_type == "KEYWORD" and token_value == "infty":
                raise SyntaxError("Use '∞' (symbol) in expressions, not 'infty'.")
            elif token_type == "SYMBOL" and token_value == "(":
                consume("SYMBOL", "(")
                expr = parse_expression()
                consume("SYMBOL", ")")
                return expr
            else:
                raise SyntaxError(f"Invalid expression near: {token_value}")

        def parse_binary(lhs):
            nonlocal i
            while i < len(tokens) and tokens[i][1] in ("+", "-", "*", "/", "%"):
                op = consume("SYMBOL")
                rhs = parse_primary()
                lhs = ("Binary", op, lhs, rhs)
            return lhs

        lhs = parse_primary()
        return parse_binary(lhs)

    def parse_conditional():
        consume("KEYWORD", "equiangular")
        left = parse_expression()
        op = consume("COMPARE")
        right = parse_expression()
        consume("SYMBOL", ":")
        consume("SYMBOL", "{")
        body = []
        while tokens[i][1] != "}":
            body.append(parse_statement())
        consume("SYMBOL", "}")
        return Node("Conditional", value=(op, left, right), children=body)

    def parse_delineator():
        consume("KEYWORD", "delineator")
        label = consume("STRING")
        consume("SYMBOL", ":")
        consume("SYMBOL", "{")
        body = []
        while tokens[i][1] != "}":
            body.append(parse_statement())
        consume("SYMBOL", "}")
        return Node("Delineator", value=label.strip('"'), children=body)

    def parse_intertillage():
        consume("KEYWORD", "intertillage")
        consume("SYMBOL", "[")
        start_expr = parse_expression()
        consume("RANGE")
        end_expr = parse_expression()
        consume("SYMBOL", "]")
        consume("ARROW")
        varname = consume("IDENT")
        consume("SYMBOL", ":")
        consume("SYMBOL", "{")
        body = []
        while tokens[i][1] != "}":
            body.append(parse_statement())
        consume("SYMBOL", "}")
        return Node("Intertillage", value=(start_expr, end_expr, varname), children=body)

    def parse_bifurcator():
        consume("KEYWORD", "bifurcator")
        origin = None
        if tokens[i][0] in ("SYMBOL", "NUMBER", "IDENT"):
            origin = parse_expression()
        consume("SYMBOL", "[")
        left = parse_expression()
        consume("SYMBOL", ",")
        right = parse_expression()
        consume("SYMBOL", "]")
        consume("ARROW")
        outer = consume("IDENT")
        consume("SYMBOL", "(")
        left_var = consume("IDENT")
        consume("SYMBOL", ",")
        right_var = consume("IDENT")
        consume("SYMBOL", ")")
        consume("SYMBOL", ":")
        consume("SYMBOL", "{")
        body = []
        while tokens[i][1] != "}":
            body.append(parse_statement())
        consume("SYMBOL", "}")
        return Node("Bifurcator", value=(origin, left, right, outer, left_var, right_var), children=body)

    def parse_boundary():
        consume("KEYWORD", "boundary")
        if tokens[i][0] == "SYMBOL" and tokens[i][1] == "[":
            consume("SYMBOL", "[")
            start = parse_expression()
            consume("RANGE")
            end = parse_expression()
            consume("SYMBOL", "]")
            range_expr = (start, end)
        else:
            range_expr = parse_expression()
        consume("ARROW")
        varname = consume("IDENT")
        consume("SYMBOL", ":")
        consume("SYMBOL", "{")
        body = []
        while tokens[i][1] != "}":
            body.append(parse_statement())
        consume("SYMBOL", "}")
        return Node("Boundary", value=(range_expr, varname), children=body)

    def parse_sol_block():
        consume("KEYWORD", "sol")
        mode = consume("IDENT")
        prop = consume("IDENT")
        value = float(consume("NUMBER"))
        consume("SYMBOL", "{")
        body = []
        while tokens[i][1] != "}":
            body.append(parse_statement())
        consume("SYMBOL", "}")
        return Node("SolBlock", value=(mode, prop, value), children=body)

    return parse_program()
