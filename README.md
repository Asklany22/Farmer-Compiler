# AK Compiler - Farmer Compiler

An Angular web application for **AK Compiler**, a custom DSL for smart farming automation with a complete compiler pipeline.

## Features

✅ **Full Compiler Pipeline** - 6 phases from source code to execution
- Lexical Analysis (Tokenization)
- Syntax Analysis (AST)
- Semantic Analysis (Symbol Table)
- Intermediate Code Generation
- Code Optimization
- Target Code Generation
- **Program Execution & Output**

✅ **AK Compiler Language** - Arabizi-style agricultural DSL with keywords:
- `sensor` - declare sensors with units (C, PERCENT, CM)
- `limit` - declare constant limits
- `warene` - print output
- `when` - conditional execution
- `3eed` - loop execution
- `alert` - alert messages
- `pump`, `fan`, `light` - device commands (ON/OFF)
- `t3bt` - end program

✅ **Live IDE** - Write and compile code in real-time with instant feedback

✅ **Educational** - See how code flows through each compiler phase

## Quick Start

### Prerequisites
- Node.js (v18+)
- npm or yarn

### Installation

```bash
npm install
```

### Development Server

```bash
npm start
```

Open [http://localhost:4200](http://localhost:4200) in your browser.

### Build for Production

```bash
npm run build
```

Output will be in `dist/farmer-compiler-angular/browser/`

## Project Structure

```
src/
├── app/
│   ├── compiler.service.ts       # Main compiler implementation
│   ├── app.component.ts          # Main component with IDE logic
│   ├── app.component.html        # UI template
│   ├── app.component.css         # Styling
│   └── output-block.component.ts # Reusable output display
├── main.ts                       # Entry point
├── index.html                    # HTML template
└── styles.css                    # Global styles
```

## Example Program

```
sensor temp : C = 35;
limit maxTemp : C = 28;

when temp > maxTemp {
    alert "High temperature detected";
    fan ON;
}

warene temp;
t3bt
```

## Deployment

### Deploy to Netlify

1. Push to GitHub
2. Connect repository to Netlify
3. Build command: `npm run build`
4. Publish directory: `dist/farmer-compiler-angular/browser`

Or manually:
```bash
npm run build
# Upload dist/farmer-compiler-angular/browser to Netlify
```

### Environment
- Works on all modern browsers
- Built with Angular 19+

## Authors

**Askalany & Karim** - Smart Farming Enthusiasts

## License

MIT License