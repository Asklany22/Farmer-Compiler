import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CompileResult, CompilerService, FarmerCompilerError } from './compiler.service';
import { OutputBlockComponent } from './output-block.component';

interface ExampleProgram {
  title: string;
  description: string;
  code: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, OutputBlockComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  readonly sampleCode = `sensor temp : C = 32;
sensor humidity : PERCENT = 30;
sensor waterLevel : CM = 12;

limit maxTemp : C = 28;
limit minHumidity : PERCENT = 50;

warene "System Started";

when temp > maxTemp {
    alert "High temperature detected";
    fan ON;
}

3eed humidity < minHumidity {
    warene humidity;
    pump ON;
    humidity = humidity + 5;
}

pump OFF;
warene "System Finished";

t3bt`;

  readonly sourceCode = signal(this.sampleCode);
  readonly result = signal<CompileResult | null>(null);
  readonly compilerError = signal<FarmerCompilerError | null>(null);
  readonly menuOpen = signal(false);
  readonly showWelcome = signal(true);

  readonly tokenText = computed(() => {
    const output = this.result();
    if (!output) return '';

    return output.tokens
      .filter((token) => token.type !== 'EOF')
      .map((token) => `TOKEN(${token.type}, ${token.value})  [line ${token.line}, col ${token.column}]`)
      .join('\n');
  });

  readonly symbolTableText = computed(() => {
    const output = this.result();
    if (!output) return '';

    const rows = output.symbols.map((symbol) => {
      return `${symbol.name.padEnd(14)} ${symbol.kind.padEnd(10)} ${symbol.unit.padEnd(10)} ${String(symbol.value)}`;
    });

    return [
      'No semantic errors found.',
      '',
      'Name           Kind       Unit       Value',
      '--------------------------------------------',
      ...rows,
      '',
      ...(output.warnings.length ? output.warnings : ['No warnings.'])
    ].join('\n');
  });

  readonly finalOutput = computed(() => {
    const output = this.result();
    if (!output) return '';

    const lines: string[] = [];
    lines.push('=== PROGRAM EXECUTION OUTPUT ===');
    lines.push('');
    
    if (output.executionOutput.length === 0) {
      lines.push('(No output produced)');
    } else {
      output.executionOutput.forEach((line) => {
        lines.push(line);
      });
    }
    
    lines.push('');
    lines.push('=== TARGET CODE ===');
    lines.push('');
    output.targetCode.forEach((line) => {
      lines.push(line);
    });
    
    return lines.join('\n');
  });

  readonly phases = [
    {
      title: '1. Lexical Analysis',
      body: 'Splits source code into tokens such as SENSOR, ID, UNIT, NUMBER, WARENE, LOOP, and T3BT.'
    },
    {
      title: '2. Syntax Analysis',
      body: 'Checks grammar and builds an AST for declarations, conditions, loops, commands, and output statements.'
    },
    {
      title: '3. Semantic Analysis',
      body: 'Validates declared variables, duplicate names, units, assignments, and logical comparisons.'
    },
    {
      title: '4. Intermediate Code',
      body: 'Converts the AST into readable three-address-style code with labels, jumps, device commands, and print commands.'
    },
    {
      title: '5. Optimization',
      body: 'Applies simple optimization such as constant folding and removing repeated device commands.'
    },
    {
      title: '6. Target Code',
      body: 'Generates pseudo Smart-Farm Controller instructions like LOAD, PUSH, CMP_LT, SET_DEVICE, PRINT, ALERT, and HALT.'
    }
  ];

  readonly grammarRows = [
    ['Program', 'StatementList t3bt'],
    ['SensorDeclaration', 'sensor IDENTIFIER : UNIT = Expression ;'],
    ['LimitDeclaration', 'limit IDENTIFIER : UNIT = Expression ;'],
    ['WareneStatement', 'warene Expression ;'],
    ['AlertStatement', 'alert STRING ;'],
    ['DeviceCommand', 'DEVICE STATE ;'],
    ['WhenStatement', 'when Condition { StatementList }'],
    ['LoopStatement', '3eed Condition { StatementList }'],
    ['Assignment', 'IDENTIFIER = Expression ;'],
    ['Condition', 'Expression CompareOp Expression']
  ];

  readonly examples: ExampleProgram[] = [
    {
      title: 'High Temperature Rule',
      description: 'Checks temperature and turns the fan on when the value passes the limit.',
      code: `sensor temp : C = 35;
limit maxTemp : C = 28;

when temp > maxTemp {
    alert "High temperature";
    fan ON;
}

t3bt`
    },
    {
      title: 'Humidity Loop',
      description: 'Uses 3eed to keep watering until humidity reaches the target.',
      code: `sensor humidity : PERCENT = 25;
limit minHumidity : PERCENT = 50;

3eed humidity < minHumidity {
    warene humidity;
    pump ON;
    humidity = humidity + 5;
}

pump OFF;
t3bt`
    },
    {
      title: 'Water Level Monitor',
      description: 'Reads water level in centimeters and alerts when the tank is low.',
      code: `sensor waterLevel : CM = 8;
limit minWater : CM = 10;

when waterLevel < minWater {
    alert "Tank is almost empty";
    pump OFF;
}

warene waterLevel;
t3bt`
    }
  ];

  constructor(private readonly compiler: CompilerService) {
    this.compile();
    // Hide welcome screen after 4.5 seconds
    setTimeout(() => {
      this.showWelcome.set(false);
    }, 4500);
  }

  updateSourceCode(value: string): void {
    this.sourceCode.set(value);
  }

  compile(): void {
    try {
      this.compilerError.set(null);
      this.result.set(this.compiler.compile(this.sourceCode()));
    } catch (error) {
      this.result.set(null);
      this.compilerError.set(error as FarmerCompilerError);
    }
  }

  resetCode(): void {
    this.sourceCode.set(this.sampleCode);
    this.compile();
  }

  loadExample(example: ExampleProgram): void {
    this.sourceCode.set(example.code);
    this.compile();
    document.getElementById('compiler')?.scrollIntoView({ behavior: 'smooth' });
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }
}