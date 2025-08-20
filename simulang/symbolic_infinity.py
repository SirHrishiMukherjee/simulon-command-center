class SymbolicInfinity:
    def __init__(self, coefficient=1, operation=None, right=None, base=None, is_iterator=False):
        self.coefficient = coefficient
        self.operation = operation
        self.right = right
        self.base = base
        self.is_iterator = is_iterator  # Flag to distinguish i from time

    def __str__(self):
        def fmt(val):
            if isinstance(val, SymbolicInfinity):
                if val.operation is None or val.operation == '*':
                    return f"{val.coefficient if val.coefficient != 1 else ''}∞"
                return f"({val})"
            elif isinstance(val, (int, float)):
                try:
                    if float(val).is_integer():
                        return str(int(val))
                except Exception:
                    pass
                return str(val)
            elif val is None:
                return "∞"
            raise ValueError(f"Cannot format value: {val}")

        if self.operation is None or self.operation == '*':
            return f"{self.coefficient if self.coefficient != 1 else ''}∞"
        if self.base:
            base_str = fmt(self.base)
        else:
            base_str = f"{self.coefficient if self.coefficient != 1 else ''}∞"
        if self.operation in ('+', '-'):
            if self.is_iterator:
                return f"{base_str}{self.operation}{fmt(self.right)}"  # 2∞+n for i
            else:
                return f"{fmt(self.right)}{self.operation}{base_str}"  # n+10∞ for time
        return f"{base_str}{self.operation}{fmt(self.right)}"

    def __repr__(self):
        return self.__str__()

    def with_offset(self, offset):
        if offset == 0:
            return self
        return SymbolicInfinity(operation='+', right=offset, base=self, is_iterator=self.is_iterator)

    def __int__(self):
        BASE_INFINITY = 1_000_000_000
        if self.base:
            base_val = int(self.base)
        else:
            base_val = BASE_INFINITY * int(self.coefficient)

        if self.operation is None:
            return base_val
        if not isinstance(self.right, (int, float)):
            raise ValueError(f"Cannot convert {self} to int: right operand must be numeric")
        if self.operation == '+':
            return base_val + int(self.right)
        elif self.operation == '-':
            return base_val - int(self.right)
        elif self.operation == '/':
            return int(base_val // int(self.right))
        elif self.operation == '*':
            return int(base_val * int(self.right))
        raise RuntimeError(f"Unsupported operation: {self.operation}")

    def __float__(self):
        return float(self.__int__())

    def __add__(self, other):
        if isinstance(other, (int, float)):
            return SymbolicInfinity(operation='+', right=other, base=self, is_iterator=self.is_iterator)
        if isinstance(other, SymbolicInfinity):
            l_offset = self.right or 0
            r_offset = other.right or 0
            l_base_coeff = self.coefficient if self.operation is None else self.base.coefficient
            if self.operation == '+' and other.operation == '+':
                return SymbolicInfinity(operation='+', right=l_offset + r_offset, base=SymbolicInfinity(coefficient=l_base_coeff, is_iterator=False))
            elif self.operation is None and other.operation == '+':
                return SymbolicInfinity(operation='+', right=r_offset, base=SymbolicInfinity(coefficient=l_base_coeff, is_iterator=False))
            elif self.operation == '+' and other.operation is None:
                return SymbolicInfinity(operation='+', right=l_offset, base=SymbolicInfinity(coefficient=l_base_coeff, is_iterator=False))
            else:
                return SymbolicInfinity(coefficient=l_base_coeff + other.coefficient, is_iterator=False)
        raise TypeError(f"Unsupported type for addition with SymbolicInfinity: {type(other)}")

    def __radd__(self, other):
        if isinstance(other, (int, float)):
            return SymbolicInfinity(operation='+', right=other, base=self, is_iterator=self.is_iterator)
        if isinstance(other, SymbolicInfinity):
            return other.__add__(self)
        raise TypeError(f"Unsupported type for addition with SymbolicInfinity: {type(other)}")

    def __sub__(self, other):
        if isinstance(other, (int, float)):
            return SymbolicInfinity(operation='-', right=other, base=self, is_iterator=self.is_iterator)
        if isinstance(other, SymbolicInfinity):
            return SymbolicInfinity(coefficient=self.coefficient - other.coefficient, is_iterator=self.is_iterator)
        raise TypeError(f"Unsupported type for subtraction from SymbolicInfinity: {type(other)}")
