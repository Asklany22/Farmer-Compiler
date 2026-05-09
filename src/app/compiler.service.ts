import { Injectable } from '@angular/core';

export type TokenType =
  | 'LOOP'
  | 'T3BT'
  | 'SENSOR'
  | 'LIMIT'
  | 'WARENE'
  | 'WHEN'
  | 'ALERT'
  | 'UNIT'
  | 'STATE'
  | 'DEVICE'
  | 'STRING'
  | 'GE'
  | 'LE'
  | 'EQ'
  | 'NE'
  | 'GT'
  | 'LT'
  | 'ASSIGN'
  | 'PLUS'
  | 'MINUS'
  | 'MULTIPLY'
  | 'DIVIDE'
  | 'COLON'
  | 'SEMICOLON'
  | 'LBRACE'
  | 'RBRACE'
  | 'LPAREN'
  | 'RPAREN'
  | 'NUMBER'
  | 'ID'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export type ExprNode =
  | { type: 'NumberLiteral'; value: number }
  | { type: 'StringLiteral'; value: string }
  | { type: 'Identifier'; name: string }
  | { type: 'BinaryExpression'; operator: string; left: ExprNode; right: ExprNode };

export interface ConditionNode {
  type: 'Condition';
  operator: string;
  left: ExprNode;
  right: ExprNode;
}

export type StatementNode =
  | { type: 'SensorDeclaration'; name: string; unit: string; value: ExprNode }
  | { type: 'LimitDeclaration'; name: string; unit: string; value: ExprNode }
  | { type: 'Assignment'; name: string; value: ExprNode }
  | { type: 'WareneStatement'; value: ExprNode }
  | { type: 'AlertStatement'; message: string }
  | { type: 'DeviceCommand'; device: string; state: string }
  | { type: 'WhenStatement'; condition: ConditionNode; body: StatementNode[] }
  | { type: 'LoopStatement'; condition: ConditionNode; body: StatementNode[] };

export interface ProgramNode {
  type: 'Program';
  body: StatementNode[];
}

export interface SymbolEntry {
  name: string;
  kind: 'sensor' | 'limit';
  unit: string;
  dataType: 'number';
  value: number | 'dynamic';
}

export interface CompileResult {
  tokens: Token[];
  ast: ProgramNode;
  astText: string;
  symbols: SymbolEntry[];
  warnings: string[];
  intermediateCode: string[];
  optimizedCode: string[];
  targetCode: string[];
  executionOutput: string[];
}

export class FarmerCompilerError extends Error {
  constructor(
    public readonly stage: string,
    message: string,
    public readonly location: string,
    public readonly explanation: string
  ) {
    super(message);
  }
}

interface TokenRule {
  type: TokenType;
  regex: RegExp;
}

interface ExpressionInfo {
  dataType: 'number' | 'string' | 'unknown';
  unit: string | null;
  constant: boolean;
  value: number | string | null;
}

const TOKEN_RULES: TokenRule[] = [
  // Important: 3eed must be before NUMBER because it starts with a digit.
  { type: 'LOOP', regex: /^3eed\b/ },
  { type: 'T3BT', regex: /^t3bt\b/ },
  { type: 'SENSOR', regex: /^sensor\b/ },
  { type: 'LIMIT', regex: /^limit\b/ },
  { type: 'WARENE', regex: /^warene\b/ },
  { type: 'WHEN', regex: /^when\b/ },
  { type: 'ALERT', regex: /^alert\b/ },
  { type: 'UNIT', regex: /^(C|PERCENT|CM)\b/ },
  { type: 'STATE', regex: /^(ON|OFF)\b/ },
  { type: 'DEVICE', regex: /^(pump|fan|light)\b/ },
  { type: 'STRING', regex: /^"([^"\\]|\\.)*"/ },
  { type: 'GE', regex: /^>=/ },
  { type: 'LE', regex: /^<=/ },
  { type: 'EQ', regex: /^==/ },
  { type: 'NE', regex: /^!=/ },
  { type: 'GT', regex: /^>/ },
  { type: 'LT', regex: /^</ },
  { type: 'ASSIGN', regex: /^=/ },
  { type: 'PLUS', regex: /^\+/ },
  { type: 'MINUS', regex: /^-/ },
  { type: 'MULTIPLY', regex: /^\*/ },
  { type: 'DIVIDE', regex: /^\// },
  { type: 'COLON', regex: /^:/ },
  { type: 'SEMICOLON', regex: /^;/ },
  { type: 'LBRACE', regex: /^\{/ },
  { type: 'RBRACE', regex: /^\}/ },
  { type: 'LPAREN', regex: /^\(/ },
  { type: 'RPAREN', regex: /^\)/ },
  { type: 'NUMBER', regex: /^\d+(\.\d+)?/ },
  { type: 'ID', regex: /^[A-Za-z_][A-Za-z0-9_]*/ }
];

@Injectable({
  providedIn: 'root'
})
export class CompilerService {
  compile(source: string): CompileResult {
    const tokens = this.tokenize(source);
    const parser = new Parser(tokens);
    const ast = parser.parseProgram();
    const semantic = this.analyzeSemantics(ast);
    const intermediateCode = this.generateIntermediateCode(ast);
    const optimizedCode = this.optimizeIntermediateCode(intermediateCode);
    const targetCode = this.generateTargetCode(optimizedCode);
    const executionOutput = this.executeProgram(ast, semantic.symbols);

    return {
      tokens,
      ast,
      astText: this.formatAst(ast),
      symbols: semantic.symbols,
      warnings: semantic.warnings,
      intermediateCode,
      optimizedCode,
      targetCode,
      executionOutput
    };
  }

  private tokenize(source: string): Token[] {
    const tokens: Token[] = [];
    let index = 0;
    let line = 1;
    let column = 1;

    while (index < source.length) {
      const char = source[index];

      if (char === '\n') {
        index++;
        line++;
        column = 1;
        continue;
      }

      if (/\s/.test(char)) {
        index++;
        column++;
        continue;
      }

      const remaining = source.slice(index);
      let matched = false;

      for (const rule of TOKEN_RULES) {
        const match = remaining.match(rule.regex);

        if (match) {
          const value = match[0];
          tokens.push({ type: rule.type, value, line, column });
          index += value.length;
          column += value.length;
          matched = true;
          break;
        }
      }

      if (!matched) {
        throw new FarmerCompilerError(
          'Lexical Analysis',
          `Unknown character "${char}".`,
          `Line ${line}, Column ${column}`,
          'The lexer only accepts Farmer Compiler keywords, identifiers, strings, numbers, operators, braces, and semicolons.'
        );
      }
    }

    tokens.push({ type: 'EOF', value: 'EOF', line, column });
    return tokens;
  }

  private analyzeSemantics(ast: ProgramNode): { symbols: SymbolEntry[]; warnings: string[] } {
    const symbols = new Map<string, SymbolEntry>();
    const warnings: string[] = [];

    const expressionInfo = (expr: ExprNode): ExpressionInfo => {
      switch (expr.type) {
        case 'NumberLiteral':
          return { dataType: 'number', unit: null, constant: true, value: expr.value };

        case 'StringLiteral':
          return { dataType: 'string', unit: null, constant: true, value: expr.value };

        case 'Identifier': {
          const symbol = symbols.get(expr.name);
          if (!symbol) {
            throw new FarmerCompilerError(
              'Semantic Analysis',
              `Variable "${expr.name}" is used before declaration.`,
              'Symbol Table',
              `Declare "${expr.name}" first using sensor or limit.`
            );
          }

          return {
            dataType: symbol.dataType,
            unit: symbol.unit,
            constant: false,
            value: null
          };
        }

        case 'BinaryExpression': {
          const left = expressionInfo(expr.left);
          const right = expressionInfo(expr.right);

          if (left.dataType !== 'number' || right.dataType !== 'number') {
            throw new FarmerCompilerError(
              'Semantic Analysis',
              'Arithmetic operations are allowed only between numeric values.',
              'Expression Check',
              'Do not use +, -, *, or / with strings.'
            );
          }

          if (left.unit && right.unit && left.unit !== right.unit) {
            throw new FarmerCompilerError(
              'Semantic Analysis',
              `Cannot calculate ${left.unit} with ${right.unit}.`,
              'Unit Check',
              'Both sides of an arithmetic operation must have compatible units.'
            );
          }

          const unit = left.unit || right.unit || null;
          const value = this.evaluateConstantExpression(expr);

          return {
            dataType: 'number',
            unit,
            constant: value !== null,
            value
          };
        }
      }
    };

    const validateRange = (name: string, unit: string, info: ExpressionInfo): void => {
      if (!info.constant || info.dataType !== 'number' || typeof info.value !== 'number') {
        return;
      }

      if (unit === 'PERCENT' && (info.value < 0 || info.value > 100)) {
        throw new FarmerCompilerError(
          'Semantic Analysis',
          `${name} has invalid PERCENT value ${info.value}.`,
          'Range Check',
          'PERCENT values must be between 0 and 100.'
        );
      }

      if (unit === 'CM' && info.value < 0) {
        throw new FarmerCompilerError(
          'Semantic Analysis',
          `${name} has invalid CM value ${info.value}.`,
          'Range Check',
          'CM values cannot be negative.'
        );
      }

      if (unit === 'C' && (info.value < -50 || info.value > 80)) {
        warnings.push(`Warning: ${name} has an unusual temperature value: ${info.value} C.`);
      }
    };

    const validateCondition = (condition: ConditionNode): void => {
      const left = expressionInfo(condition.left);
      const right = expressionInfo(condition.right);

      if (left.dataType !== right.dataType) {
        throw new FarmerCompilerError(
          'Semantic Analysis',
          `Cannot compare ${left.dataType} with ${right.dataType}.`,
          'Condition Check',
          'Both sides of a when or 3eed condition must have the same data type.'
        );
      }

      if (left.unit && right.unit && left.unit !== right.unit) {
        throw new FarmerCompilerError(
          'Semantic Analysis',
          `Cannot compare ${left.unit} with ${right.unit}.`,
          'Unit Check',
          'Do not compare different sensor units such as PERCENT and C.'
        );
      }
    };

    const visitStatement = (statement: StatementNode): void => {
      if (statement.type === 'SensorDeclaration' || statement.type === 'LimitDeclaration') {
        if (symbols.has(statement.name)) {
          throw new FarmerCompilerError(
            'Semantic Analysis',
            `Variable "${statement.name}" is already declared.`,
            'Symbol Table',
            'Every sensor or limit must have a unique name.'
          );
        }

        const valueInfo = expressionInfo(statement.value);

        if (valueInfo.dataType !== 'number') {
          throw new FarmerCompilerError(
            'Semantic Analysis',
            `${statement.type === 'SensorDeclaration' ? 'sensor' : 'limit'} values must be numeric.`,
            'Declaration Check',
            'Use numeric values with units like C, PERCENT, or CM.'
          );
        }

        validateRange(statement.name, statement.unit, valueInfo);

        symbols.set(statement.name, {
          name: statement.name,
          kind: statement.type === 'SensorDeclaration' ? 'sensor' : 'limit',
          unit: statement.unit,
          dataType: 'number',
          value: typeof valueInfo.value === 'number' ? valueInfo.value : 'dynamic'
        });

        return;
      }

      if (statement.type === 'Assignment') {
        const symbol = symbols.get(statement.name);

        if (!symbol) {
          throw new FarmerCompilerError(
            'Semantic Analysis',
            `Cannot assign to undeclared variable "${statement.name}".`,
            'Symbol Table',
            `Declare "${statement.name}" first as a sensor.`
          );
        }

        if (symbol.kind === 'limit') {
          throw new FarmerCompilerError(
            'Semantic Analysis',
            `Cannot assign a new value to limit "${statement.name}".`,
            'Assignment Check',
            'limit values are constants. Assign only to sensors.'
          );
        }

        const valueInfo = expressionInfo(statement.value);

        if (valueInfo.dataType !== symbol.dataType) {
          throw new FarmerCompilerError(
            'Semantic Analysis',
            `Assignment type mismatch for "${statement.name}".`,
            'Type Check',
            'The assigned value must match the declared variable type.'
          );
        }

        if (valueInfo.unit && valueInfo.unit !== symbol.unit) {
          throw new FarmerCompilerError(
            'Semantic Analysis',
            `Cannot assign ${valueInfo.unit} value to ${symbol.unit} sensor "${statement.name}".`,
            'Unit Check',
            'Assignment units must match the declared sensor unit.'
          );
        }

        return;
      }

      if (statement.type === 'WareneStatement') {
        expressionInfo(statement.value);
        return;
      }

      if (statement.type === 'WhenStatement' || statement.type === 'LoopStatement') {
        validateCondition(statement.condition);
        statement.body.forEach(visitStatement);
        return;
      }
    };

    ast.body.forEach(visitStatement);

    return {
      symbols: Array.from(symbols.values()),
      warnings
    };
  }

  private generateIntermediateCode(ast: ProgramNode): string[] {
    const code: string[] = [];
    let tempCounter = 1;
    let labelCounter = 1;

    const newTemp = (): string => `t${tempCounter++}`;
    const newLabel = (): string => `L${labelCounter++}`;

    const genExpr = (expr: ExprNode): string => {
      if (expr.type === 'NumberLiteral') return String(expr.value);
      if (expr.type === 'StringLiteral') return expr.value;
      if (expr.type === 'Identifier') return expr.name;

      const folded = this.evaluateConstantExpression(expr);
      if (folded !== null) return String(folded);

      const left = genExpr(expr.left);
      const right = genExpr(expr.right);
      const temp = newTemp();
      code.push(`${temp} = ${left} ${expr.operator} ${right}`);
      return temp;
    };

    const genCondition = (condition: ConditionNode): string => {
      return `${genExpr(condition.left)} ${condition.operator} ${genExpr(condition.right)}`;
    };

    const genStatement = (statement: StatementNode): void => {
      switch (statement.type) {
        case 'SensorDeclaration':
        case 'LimitDeclaration':
          code.push(`${statement.name} = ${genExpr(statement.value)}`);
          break;

        case 'Assignment':
          code.push(`${statement.name} = ${genExpr(statement.value)}`);
          break;

        case 'WareneStatement':
          code.push(`PRINT ${genExpr(statement.value)}`);
          break;

        case 'AlertStatement':
          code.push(`ALERT ${statement.message}`);
          break;

        case 'DeviceCommand':
          code.push(`DEVICE ${statement.device} ${statement.state}`);
          break;

        case 'WhenStatement': {
          const endLabel = newLabel();
          code.push(`IF_FALSE ${genCondition(statement.condition)} GOTO ${endLabel}`);
          statement.body.forEach(genStatement);
          code.push(`LABEL ${endLabel}`);
          break;
        }

        case 'LoopStatement': {
          const startLabel = newLabel();
          const endLabel = newLabel();
          code.push(`LABEL ${startLabel}`);
          code.push(`IF_FALSE ${genCondition(statement.condition)} GOTO ${endLabel}`);
          statement.body.forEach(genStatement);
          code.push(`GOTO ${startLabel}`);
          code.push(`LABEL ${endLabel}`);
          break;
        }
      }
    };

    ast.body.forEach(genStatement);
    return code;
  }

  private optimizeIntermediateCode(code: string[]): string[] {
    const optimized: string[] = [];
    let lastDeviceCommand: string | null = null;

    for (const instruction of code) {
      const uselessAddOrSubtract =
        /^\w+ = \w+ \+ 0$/.test(instruction) ||
        /^\w+ = \w+ - 0$/.test(instruction);

      if (uselessAddOrSubtract) {
        continue;
      }

      if (instruction.startsWith('DEVICE')) {
        if (instruction === lastDeviceCommand) {
          continue;
        }
        lastDeviceCommand = instruction;
      } else if (!instruction.startsWith('LABEL')) {
        lastDeviceCommand = null;
      }

      optimized.push(instruction);
    }

    return optimized;
  }

  private generateTargetCode(code: string[]): string[] {
    const target: string[] = [];

    const comparisonMnemonic = (operator: string): string => {
      const map: Record<string, string> = {
        '>': 'CMP_GT',
        '<': 'CMP_LT',
        '>=': 'CMP_GE',
        '<=': 'CMP_LE',
        '==': 'CMP_EQ',
        '!=': 'CMP_NE'
      };
      return map[operator] ?? 'CMP';
    };

    const loadValue = (value: string): string => {
      return /^-?\d+(\.\d+)?$/.test(value) ? `PUSH ${value}` : `LOAD ${value}`;
    };

    for (const instruction of code) {
      if (instruction.startsWith('LABEL')) {
        target.push(instruction);
        continue;
      }

      if (instruction.startsWith('GOTO')) {
        target.push(instruction.replace('GOTO', 'JUMP'));
        continue;
      }

      if (instruction.startsWith('IF_FALSE')) {
        const match = instruction.match(/^IF_FALSE (.+?) (>=|<=|==|!=|>|<) (.+?) GOTO (L\d+)$/);

        if (match) {
          const [, left, operator, right, label] = match;
          target.push(loadValue(left));
          target.push(loadValue(right));
          target.push(comparisonMnemonic(operator));
          target.push(`JUMP_IF_FALSE ${label}`);
        } else {
          target.push(`EVAL ${instruction}`);
        }

        continue;
      }

      if (instruction.startsWith('PRINT')) {
        target.push(`PRINT ${instruction.replace('PRINT ', '')}`);
        continue;
      }

      if (instruction.startsWith('ALERT')) {
        target.push(instruction);
        continue;
      }

      if (instruction.startsWith('DEVICE')) {
        target.push(instruction.replace('DEVICE', 'SET_DEVICE'));
        continue;
      }

      if (instruction.includes(' = ')) {
        const [left, right] = instruction.split(' = ');
        const binary = right.match(/^(.+?) (\+|-|\*|\/) (.+?)$/);

        if (binary) {
          const [, a, operator, b] = binary;
          target.push(loadValue(a));
          target.push(loadValue(b));
          target.push({ '+': 'ADD', '-': 'SUB', '*': 'MUL', '/': 'DIV' }[operator] ?? 'OP');
          target.push(`STORE ${left}`);
        } else {
          target.push(loadValue(right));
          target.push(`STORE ${left}`);
        }
      }
    }

    target.push('HALT');
    return target;
  }

  private evaluateConstantExpression(expr: ExprNode): number | null {
    if (expr.type === 'NumberLiteral') return expr.value;
    if (expr.type !== 'BinaryExpression') return null;

    const left = this.evaluateConstantExpression(expr.left);
    const right = this.evaluateConstantExpression(expr.right);

    if (left === null || right === null) return null;

    switch (expr.operator) {
      case '+':
        return left + right;
      case '-':
        return left - right;
      case '*':
        return left * right;
      case '/':
        return right === 0 ? null : left / right;
      default:
        return null;
    }
  }

  private exprToString(expr: ExprNode): string {
    switch (expr.type) {
      case 'NumberLiteral':
        return String(expr.value);
      case 'StringLiteral':
        return expr.value;
      case 'Identifier':
        return expr.name;
      case 'BinaryExpression':
        return `${this.exprToString(expr.left)} ${expr.operator} ${this.exprToString(expr.right)}`;
    }
  }

  private executeProgram(ast: ProgramNode, symbols: SymbolEntry[]): string[] {
    const output: string[] = [];
    const symbolValues = new Map<string, number | string>();

    symbols.forEach((sym) => {
      if (typeof sym.value === 'number') {
        symbolValues.set(sym.name, sym.value);
      }
    });

    const evalExpr = (expr: ExprNode): number | string => {
      if (expr.type === 'NumberLiteral') return expr.value;
      if (expr.type === 'StringLiteral') return expr.value;
      if (expr.type === 'Identifier') {
        const val = symbolValues.get(expr.name);
        return val !== undefined ? val : 0;
      }

      if (expr.type === 'BinaryExpression') {
        const left = evalExpr(expr.left);
        const right = evalExpr(expr.right);

        if (typeof left !== 'number' || typeof right !== 'number') return 0;

        switch (expr.operator) {
          case '+':
            return left + right;
          case '-':
            return left - right;
          case '*':
            return left * right;
          case '/':
            return right === 0 ? 0 : left / right;
          default:
            return 0;
        }
      }

      return 0;
    };

    const evalCondition = (condition: ConditionNode): boolean => {
      const left = evalExpr(condition.left);
      const right = evalExpr(condition.right);

      if (typeof left !== 'number' || typeof right !== 'number') return false;

      switch (condition.operator) {
        case '>':
          return left > right;
        case '<':
          return left < right;
        case '>=':
          return left >= right;
        case '<=':
          return left <= right;
        case '==':
          return left === right;
        case '!=':
          return left !== right;
        default:
          return false;
      }
    };

    const execStatement = (statement: StatementNode): void => {
      if (statement.type === 'SensorDeclaration' || statement.type === 'LimitDeclaration') {
        const value = evalExpr(statement.value);
        symbolValues.set(statement.name, value);
        return;
      }

      if (statement.type === 'Assignment') {
        const value = evalExpr(statement.value);
        symbolValues.set(statement.name, value);
        return;
      }

      if (statement.type === 'WareneStatement') {
        const value = evalExpr(statement.value);
        output.push(String(value));
        return;
      }

      if (statement.type === 'AlertStatement') {
        output.push(`ALERT: ${statement.message}`);
        return;
      }

      if (statement.type === 'DeviceCommand') {
        output.push(`DEVICE: ${statement.device} turned ${statement.state}`);
        return;
      }

      if (statement.type === 'WhenStatement') {
        if (evalCondition(statement.condition)) {
          statement.body.forEach(execStatement);
        }
        return;
      }

      if (statement.type === 'LoopStatement') {
        let iterations = 0;
        const maxIterations = 1000;

        while (evalCondition(statement.condition) && iterations < maxIterations) {
          statement.body.forEach(execStatement);
          iterations++;
        }

        if (iterations >= maxIterations) {
          output.push('WARNING: Loop exceeded maximum iterations (1000)');
        }
        return;
      }
    };

    ast.body.forEach(execStatement);
    return output;
  }

  private formatAst(node: ProgramNode | StatementNode[] | StatementNode, indent = 0): string {
    const pad = '  '.repeat(indent);

    if (Array.isArray(node)) {
      return node.map((item) => this.formatAst(item, indent)).join('\n');
    }

    if (node.type === 'Program') {
      return `${pad}Program(\n${this.formatAst(node.body, indent + 1)}\n${pad})`;
    }

    if (node.type === 'SensorDeclaration' || node.type === 'LimitDeclaration') {
      return `${pad}${node.type}(name=${node.name}, unit=${node.unit}, value=${this.exprToString(node.value)})`;
    }

    if (node.type === 'Assignment') {
      return `${pad}Assignment(name=${node.name}, value=${this.exprToString(node.value)})`;
    }

    if (node.type === 'WareneStatement') {
      return `${pad}Warene(value=${this.exprToString(node.value)})`;
    }

    if (node.type === 'AlertStatement') {
      return `${pad}Alert(message=${node.message})`;
    }

    if (node.type === 'DeviceCommand') {
      return `${pad}Device(device=${node.device}, state=${node.state})`;
    }

    if (node.type === 'WhenStatement') {
      return `${pad}When(condition=${this.exprToString(node.condition.left)} ${node.condition.operator} ${this.exprToString(node.condition.right)}, body=[\n${this.formatAst(node.body, indent + 1)}\n${pad}])`;
    }

    return `${pad}3eed(condition=${this.exprToString(node.condition.left)} ${node.condition.operator} ${this.exprToString(node.condition.right)}, body=[\n${this.formatAst(node.body, indent + 1)}\n${pad}])`;
  }
}

class Parser {
  private current = 0;

  constructor(private readonly tokens: Token[]) {}

  parseProgram(): ProgramNode {
    const body: StatementNode[] = [];

    while (this.peek().type !== 'T3BT' && this.peek().type !== 'EOF') {
      body.push(this.parseStatement());
    }

    this.consume('T3BT', 'Program must end with t3bt.', 'Add t3bt at the end of the Farmer Compiler program.');
    this.consume('EOF', 'Unexpected code after t3bt.', 'Nothing should be written after t3bt.');

    return { type: 'Program', body };
  }

  private peek(offset = 0): Token {
    return this.tokens[this.current + offset] ?? this.tokens[this.tokens.length - 1];
  }

  private match(type: TokenType): Token | null {
    if (this.peek().type === type) {
      const token = this.peek();
      this.current++;
      return token;
    }

    return null;
  }

  private consume(type: TokenType, message?: string, explanation?: string): Token {
    const token = this.peek();

    if (token.type === type) {
      this.current++;
      return token;
    }

    throw new FarmerCompilerError(
      'Syntax Analysis',
      message ?? `Expected ${type}, found ${token.type}.`,
      `Line ${token.line}, Column ${token.column}`,
      explanation ?? 'Check the grammar of the current statement.'
    );
  }

  private parseStatement(): StatementNode {
    const token = this.peek();

    switch (token.type) {
      case 'SENSOR':
        return this.parseDeclaration('SensorDeclaration');
      case 'LIMIT':
        return this.parseDeclaration('LimitDeclaration');
      case 'WARENE':
        return this.parseWarene();
      case 'ALERT':
        return this.parseAlert();
      case 'DEVICE':
        return this.parseDeviceCommand();
      case 'WHEN':
        return this.parseWhen();
      case 'LOOP':
        return this.parseLoop();
      case 'ID':
        return this.parseAssignment();
      default:
        throw new FarmerCompilerError(
          'Syntax Analysis',
          `Unexpected token ${token.type}.`,
          `Line ${token.line}, Column ${token.column}`,
          'Start a statement with sensor, limit, warene, alert, when, 3eed, a device command, or an assignment.'
        );
    }
  }

  private parseDeclaration(type: 'SensorDeclaration' | 'LimitDeclaration'): StatementNode {
    this.consume(type === 'SensorDeclaration' ? 'SENSOR' : 'LIMIT');
    const name = this.consume('ID', 'Expected identifier after declaration keyword.');
    this.consume('COLON', 'Expected ":" after identifier.');
    const unit = this.consume('UNIT', 'Expected unit C, PERCENT, or CM.');
    this.consume('ASSIGN', 'Expected "=" after unit.');
    const value = this.parseExpression();
    this.consume('SEMICOLON', 'Missing semicolon after declaration.', 'Every declaration must end with ;');

    return { type, name: name.value, unit: unit.value, value } as StatementNode;
  }

  private parseAssignment(): StatementNode {
    const name = this.consume('ID');
    this.consume('ASSIGN', 'Expected "=" in assignment.');
    const value = this.parseExpression();
    this.consume('SEMICOLON', 'Missing semicolon after assignment.', 'Every assignment must end with ;');

    return { type: 'Assignment', name: name.value, value };
  }

  private parseWarene(): StatementNode {
    this.consume('WARENE');
    const value = this.parseExpression();
    this.consume('SEMICOLON', 'Missing semicolon after warene statement.', 'Write warene value; to display output.');
    return { type: 'WareneStatement', value };
  }

  private parseAlert(): StatementNode {
    this.consume('ALERT');
    const message = this.consume('STRING', 'alert expects a string message.', 'Example: alert "High temperature";');
    this.consume('SEMICOLON', 'Missing semicolon after alert statement.');
    return { type: 'AlertStatement', message: message.value };
  }

  private parseDeviceCommand(): StatementNode {
    const device = this.consume('DEVICE');
    const state = this.consume('STATE', 'Device command expects ON or OFF.', 'Example: pump ON;');
    this.consume('SEMICOLON', 'Missing semicolon after device command.');
    return { type: 'DeviceCommand', device: device.value, state: state.value };
  }

  private parseWhen(): StatementNode {
    this.consume('WHEN');
    const condition = this.parseCondition();
    this.consume('LBRACE', 'Expected "{" after when condition.');
    const body = this.parseBlockBody();
    return { type: 'WhenStatement', condition, body };
  }

  private parseLoop(): StatementNode {
    this.consume('LOOP');
    const condition = this.parseCondition();
    this.consume('LBRACE', 'Expected "{" after 3eed condition.');
    const body = this.parseBlockBody();
    return { type: 'LoopStatement', condition, body };
  }

  private parseBlockBody(): StatementNode[] {
    const body: StatementNode[] = [];

    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      body.push(this.parseStatement());
    }

    this.consume('RBRACE', 'Expected "}" to close block.', 'Every when or 3eed block must be closed with }.');
    return body;
  }

  private parseCondition(): ConditionNode {
    const left = this.parseExpression();
    const operatorToken = this.peek();
    const operators: TokenType[] = ['GT', 'LT', 'GE', 'LE', 'EQ', 'NE'];

    if (!operators.includes(operatorToken.type)) {
      throw new FarmerCompilerError(
        'Syntax Analysis',
        'Expected comparison operator in condition.',
        `Line ${operatorToken.line}, Column ${operatorToken.column}`,
        'Use >, <, >=, <=, ==, or != inside when and 3eed conditions.'
      );
    }

    this.current++;
    const right = this.parseExpression();

    return {
      type: 'Condition',
      operator: operatorToken.value,
      left,
      right
    };
  }

  private parseExpression(): ExprNode {
    let node = this.parseTerm();

    while (this.peek().type === 'PLUS' || this.peek().type === 'MINUS') {
      const operator = this.peek();
      this.current++;
      const right = this.parseTerm();
      node = { type: 'BinaryExpression', operator: operator.value, left: node, right };
    }

    return node;
  }

  private parseTerm(): ExprNode {
    let node = this.parseFactor();

    while (this.peek().type === 'MULTIPLY' || this.peek().type === 'DIVIDE') {
      const operator = this.peek();
      this.current++;
      const right = this.parseFactor();
      node = { type: 'BinaryExpression', operator: operator.value, left: node, right };
    }

    return node;
  }

  private parseFactor(): ExprNode {
    const token = this.peek();

    if (this.match('NUMBER')) {
      return { type: 'NumberLiteral', value: Number(token.value) };
    }

    if (this.match('STRING')) {
      return { type: 'StringLiteral', value: token.value };
    }

    if (this.match('ID')) {
      return { type: 'Identifier', name: token.value };
    }

    if (this.match('LPAREN')) {
      const expression = this.parseExpression();
      this.consume('RPAREN', 'Expected ")" after expression.');
      return expression;
    }

    throw new FarmerCompilerError(
      'Syntax Analysis',
      `Expected expression, found ${token.type}.`,
      `Line ${token.line}, Column ${token.column}`,
      'Expressions can be numbers, strings, identifiers, or parenthesized expressions.'
    );
  }
}