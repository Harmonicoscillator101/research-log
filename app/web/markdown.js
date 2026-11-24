/* 科研日志 —— 轻量 Markdown 渲染 + TeX→MathML（无外部依赖） */
(function () {
  'use strict';

  const escape = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));

  // ------------------------------------------------------------------ TeX 符号

  const SYMBOLS = {
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε',
    zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ',
    lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ',
    tau: 'τ', upsilon: 'υ', phi: 'ϕ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
    Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π',
    Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
    cdot: '⋅', times: '×', div: '÷', pm: '±', mp: '∓', ast: '∗', star: '⋆',
    circ: '∘', bullet: '∙', le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠',
    neq: '≠', approx: '≈', sim: '∼', simeq: '≃', propto: '∝', equiv: '≡',
    ll: '≪', gg: '≫', to: '→', rightarrow: '→', leftarrow: '←',
    leftrightarrow: '↔', Rightarrow: '⇒', Leftarrow: '⇐', mapsto: '↦',
    infty: '∞', partial: '∂', nabla: '∇', hbar: 'ℏ', ell: 'ℓ', Re: 'ℜ', Im: 'ℑ',
    forall: '∀', exists: '∃', neg: '¬', land: '∧', lor: '∨', cdots: '⋯',
    ldots: '…', dots: '…', prime: '′', degree: '°', angle: '∠', perp: '⊥',
    parallel: '∥', in: '∈', notin: '∉', subset: '⊂', supset: '⊃', cup: '∪',
    cap: '∩', emptyset: '∅', sum: '∑', prod: '∏', int: '∫', iint: '∬',
    iiint: '∭', oint: '∮',
  };

  const OP_NAMES = new Set([
    'cdot', 'times', 'div', 'pm', 'mp', 'ast', 'star', 'circ', 'bullet', 'le',
    'leq', 'ge', 'geq', 'ne', 'neq', 'approx', 'sim', 'simeq', 'propto',
    'equiv', 'll', 'gg', 'to', 'rightarrow', 'leftarrow', 'leftrightarrow',
    'Rightarrow', 'Leftarrow', 'mapsto', 'forall', 'exists', 'neg', 'land',
    'lor', 'cdots', 'ldots', 'dots', 'prime', 'degree', 'angle', 'perp',
    'parallel', 'in', 'notin', 'subset', 'supset', 'cup', 'cap', 'emptyset',
  ]);

  const LIMIT_OPS = new Set(['sum', 'prod', 'lim', 'max', 'min', 'sup', 'inf']);
  const INT_OPS = new Set(['int', 'iint', 'iiint', 'oint']);

  const FUNCTIONS = new Set([
    'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log', 'ln', 'lg', 'exp', 'lim',
    'max', 'min', 'sup', 'inf', 'det', 'dim', 'ker', 'deg', 'arg', 'gcd', 'Pr',
  ]);

  const ACCENTS = { hat: '^', bar: '¯', overline: '¯', vec: '→', dot: '˙', ddot: '¨', tilde: '~' };

  // ------------------------------------------------------------------ 词法

  function tokenize(source) {
    const tokens = [];
    let index = 0;
    while (index < source.length) {
      const ch = source[index];
      if (ch === '\\') {
        const match = /^([a-zA-Z]+|.)/.exec(source.slice(index + 1));
        if (!match) { index += 1; continue; }
        tokens.push({ type: 'cmd', value: match[1] });
        index += 1 + match[0].length;
      } else if (ch === '{' || ch === '}' || ch === '^' || ch === '_') {
        tokens.push({ type: ch });
        index += 1;
      } else if (/\s/.test(ch)) {
        tokens.push({ type: 'space' });
        index += 1;
      } else {
        tokens.push({ type: 'char', value: ch });
        index += 1;
      }
    }
    return tokens;
  }

  // ------------------------------------------------------------------ 语法 → MathML

  class TexParser {
    constructor(tokens, display) {
      this.tokens = tokens;
      this.index = 0;
      this.display = display;
    }

    peek() { return this.tokens[this.index]; }

    next() { return this.tokens[this.index++]; }

    skipSpace() {
      while (this.peek() && this.peek().type === 'space') this.index += 1;
    }

    parseRow(stop) {
      let out = '';
      while (this.index < this.tokens.length) {
        const token = this.peek();
        if (!token) break;
        if (stop === '}' && token.type === '}') break;
        if (token.type === 'space') { this.index += 1; continue; }
        if (token.type === '^' || token.type === '_') { this.index += 1; continue; }
        const atom = this.parseAtom();
        if (!atom) break;
        out += this.attach(atom);
      }
      return out;
    }

    parseArg() {
      this.skipSpace();
      const token = this.peek();
      if (!token) return '<mrow></mrow>';
      if (token.type === '{') {
        this.next();
        const inner = this.parseRow('}');
        if (this.peek() && this.peek().type === '}') this.index += 1;
        return `<mrow>${inner}</mrow>`;
      }
      const atom = this.parseAtom();
      return atom ? atom.ml : '<mrow></mrow>';
    }

    attach(atom) {
      let sub = null;
      let sup = null;
      this.skipSpace();
      while (this.peek() && (this.peek().type === '^' || this.peek().type === '_')) {
        const kind = this.next().type;
        this.skipSpace();
        const arg = this.parseArg();
        if (kind === '^') sup = arg; else sub = arg;
        this.skipSpace();
      }
      if (sub === null && sup === null) return atom.ml;
      const base = atom.ml;
      if (atom.limits && this.display) {
        if (sub !== null && sup !== null) return `<munderover>${base}${sub}${sup}</munderover>`;
        if (sub !== null) return `<munder>${base}${sub}</munder>`;
        return `<mover>${base}${sup}</mover>`;
      }
      if (sub !== null && sup !== null) return `<msubsup>${base}${sub}${sup}</msubsup>`;
      if (sub !== null) return `<msub>${base}${sub}</msub>`;
      return `<msup>${base}${sup}</msup>`;
    }

    parseAtom() {
      const token = this.next();
      if (!token) return null;
      if (token.type === '{') {
        const inner = this.parseRow('}');
        if (this.peek() && this.peek().type === '}') this.index += 1;
        return { ml: `<mrow>${inner}</mrow>`, limits: false };
      }
      if (token.type === 'char') return this.parseChar(token.value);
      if (token.type === 'cmd') return this.parseCommand(token.value);
      return null;
    }

    parseChar(ch) {
      if (/[0-9]/.test(ch)) {
        let number = ch;
        while (this.peek() && this.peek().type === 'char' && /[0-9.]/.test(this.peek().value)) {
          number += this.next().value;
        }
        return { ml: `<mn>${escape(number)}</mn>`, limits: false };
      }
      if (/[a-zA-Z]/.test(ch)) return { ml: `<mi>${escape(ch)}</mi>`, limits: false };
      const mapped = { '-': '−', '*': '∗', "'": '′', '~': '∼', '=': '=', '+': '+', '<': '&lt;', '>': '&gt;' }[ch] || ch;
      return { ml: `<mo>${ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : escape(mapped)}</mo>`, limits: false };
    }

    readRawGroup() {
      if (!this.peek() || this.peek().type !== '{') return '';
      this.next();
      let depth = 1;
      let text = '';
      while (this.index < this.tokens.length) {
        const token = this.next();
        if (token.type === '{') depth += 1;
        else if (token.type === '}') {
          depth -= 1;
          if (depth === 0) break;
        }
        if (token.type === 'space') text += ' ';
        else if (token.type === 'char') text += token.value;
        else if (token.type === 'cmd') text += `\\${token.value}`;
      }
      return text;
    }

    readDelimiter() {
      const token = this.next();
      if (!token) return '';
      if (token.type === 'char') return token.value === '.' ? '' : token.value;
      if (token.type === 'cmd') {
        if (token.value === '{') return '{';
        if (token.value === '}') return '}';
        if (token.value === '|') return '‖';
        return SYMBOLS[token.value] || `\\${token.value}`;
      }
      return '';
    }

    parseUntilChar(ch) {
      let out = '';
      while (this.index < this.tokens.length) {
        const token = this.peek();
        if (token.type === 'char' && token.value === ch) { this.next(); break; }
        const atom = this.parseAtom();
        if (!atom) break;
        out += this.attach(atom);
      }
      return out;
    }

    parseEnvironment(env) {
      const rows = [];
      let row = [];
      let cell = '';
      while (this.index < this.tokens.length) {
        this.skipSpace();
        const token = this.peek();
        if (!token) break;
        if (token.type === 'cmd' && token.value === 'end') {
          this.next();
          this.readRawGroup();
          break;
        }
        if (token.type === 'cmd' && token.value === '\\') {
          this.next();
          row.push(cell);
          rows.push(row);
          row = [];
          cell = '';
          continue;
        }
        if (token.type === 'char' && token.value === '&') {
          this.next();
          row.push(cell);
          cell = '';
          continue;
        }
        const atom = this.parseAtom();
        if (!atom) break;
        cell += this.attach(atom);
      }
      if (cell || row.length) {
        row.push(cell);
        rows.push(row);
      }
      const table = `<mtable>${rows.map((cells) => `<mtr>${cells.map((item) => `<mtd>${item}</mtd>`).join('')}</mtr>`).join('')}</mtable>`;
      if (env === 'pmatrix') return `<mrow><mo>(</mo>${table}<mo>)</mo></mrow>`;
      if (env === 'bmatrix') return `<mrow><mo>[</mo>${table}<mo>]</mo></mrow>`;
      if (env === 'vmatrix') return `<mrow><mo>|</mo>${table}<mo>|</mo></mrow>`;
      if (env === 'cases') return `<mrow><mo>{</mo>${table}</mrow>`;
      return table;
    }

    parseCommand(name) {
      if (FUNCTIONS.has(name)) {
        return { ml: `<mi mathvariant="normal">${escape(name)}</mi>`, limits: ['lim', 'max', 'min', 'sup', 'inf'].includes(name) };
      }
      if (LIMIT_OPS.has(name)) {
        return { ml: `<mo largeop="true">${escape(SYMBOLS[name] || name)}</mo>`, limits: true };
      }
      if (INT_OPS.has(name)) {
        return { ml: `<mo largeop="true">${escape(SYMBOLS[name] || name)}</mo>`, limits: false };
      }
      if (OP_NAMES.has(name)) {
        return { ml: `<mo>${escape(SYMBOLS[name] || name)}</mo>`, limits: false };
      }
      if (SYMBOLS[name]) {
        return { ml: `<mi>${escape(SYMBOLS[name])}</mi>`, limits: false };
      }

      switch (name) {
        case 'frac': case 'dfrac': case 'tfrac': {
          const numerator = this.parseArg();
          const denominator = this.parseArg();
          return { ml: `<mfrac>${numerator}${denominator}</mfrac>`, limits: false };
        }
        case 'sqrt': {
          this.skipSpace();
          let index = null;
          if (this.peek() && this.peek().type === 'char' && this.peek().value === '[') {
            this.next();
            index = this.parseUntilChar(']');
          }
          const body = this.parseArg();
          return {
            ml: index === null ? `<msqrt>${body}</msqrt>` : `<mroot>${body}${index}</mroot>`,
            limits: false,
          };
        }
        case 'text': case 'textrm': case 'operatorname': case 'mbox': {
          return { ml: `<mtext>${escape(this.readRawGroup())}</mtext>`, limits: false };
        }
        case 'mathrm': case 'mathbf': case 'mathit': case 'mathcal': case 'mathbb': case 'mathsf': {
          const variant = {
            mathrm: 'normal', mathbf: 'bold', mathit: 'italic',
            mathcal: 'script', mathbb: 'double-struck', mathsf: 'sans-serif',
          }[name];
          const inner = this.parseArg();
          return { ml: `<mstyle mathvariant="${variant}">${inner}</mstyle>`, limits: false };
        }
        case 'overline': case 'bar': case 'hat': case 'vec': case 'dot': case 'ddot': case 'tilde': {
          const body = this.parseArg();
          return { ml: `<mover accent="true">${body}<mo>${escape(ACCENTS[name])}</mo></mover>`, limits: false };
        }
        case 'underline': {
          const body = this.parseArg();
          return { ml: `<munder accentunder="true">${body}<mo>_</mo></munder>`, limits: false };
        }
        case 'left': case 'right': {
          const delimiter = this.readDelimiter();
          if (!delimiter) return { ml: '<mrow></mrow>', limits: false };
          return { ml: `<mo>${escape(delimiter)}</mo>`, limits: false };
        }
        case 'begin': {
          const env = this.readRawGroup();
          return { ml: this.parseEnvironment(env), limits: false };
        }
        case ',': case ';': case ':': case '!': case ' ': {
          const width = { ',': '0.17em', ';': '0.28em', ':': '0.22em', '!': '-0.17em', ' ': '0.25em' }[name];
          return { ml: `<mspace width="${width}"></mspace>`, limits: false };
        }
        case 'quad': return { ml: '<mspace width="1em"></mspace>', limits: false };
        case 'qquad': return { ml: '<mspace width="2em"></mspace>', limits: false };
        case 'enspace': return { ml: '<mspace width="0.5em"></mspace>', limits: false };
        case '%': case '&': case '_': case '#': case '$': case '{': case '}': {
          return { ml: `<mo>${escape(name)}</mo>`, limits: false };
        }
        case 'displaystyle': case 'textstyle': case 'limits': case 'nolimits':
          return { ml: '', limits: false };
        default:
          return { ml: `<mtext class="tex-unknown">\\${escape(name)}</mtext>`, limits: false };
      }
    }
  }

  function texToMathML(source, display) {
    const text = String(source || '').trim();
    if (!text) return '';
    try {
      const parser = new TexParser(tokenize(text), Boolean(display));
      const body = parser.parseRow(null);
      return `<math display="${display ? 'block' : 'inline'}" class="mathml"><mrow>${body}</mrow></math>`;
    } catch (error) {
      return `<code class="math-raw">${escape(text)}</code>`;
    }
  }

  // ------------------------------------------------------------------ 行内

  function formatText(text) {
    let html = escape(text);
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt) => `<span class="md-image">[图] ${alt}</span>`);
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    return html;
  }

  function inline(text) {
    let out = '';
    let index = 0;
    const pattern = /(`+)([\s\S]*?)\1|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      out += formatText(text.slice(index, match.index));
      if (match[1]) {
        out += `<code>${escape(match[2].trim())}</code>`;
      } else if (match[3] !== undefined) {
        out += texToMathML(match[3], false);
      } else {
        out += texToMathML(match[4], false);
      }
      index = pattern.lastIndex;
    }
    out += formatText(text.slice(index));
    return out;
  }

  // ------------------------------------------------------------------ 块级

  function renderTable(lines) {
    const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
    const head = cells(lines[0]);
    const body = lines.slice(2).map(cells);
    const thead = head.map((cell) => `<th>${inline(cell)}</th>`).join('');
    const rows = body.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('');
    return `<table><thead><tr>${thead}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  function render(source) {
    let text = String(source || '').replace(/\r\n?/g, '\n');
    const stash = [];
    const put = (html) => {
      stash.push(html);
      return `\u0000${stash.length - 1}\u0000`;
    };

    text = text.replace(/```([^\n`]*)\n([\s\S]*?)```/g, (match, lang, code) =>
      put(`<pre class="md-code"><code>${escape(code.replace(/\n$/, ''))}</code></pre>`));
    text = text.replace(/\\\[([\s\S]+?)\\\]/g, (match, tex) =>
      put(`<div class="md-math-block">${texToMathML(tex.trim(), true)}</div>`));
    text = text.replace(/\$\$([\s\S]+?)\$\$/g, (match, tex) =>
      put(`<div class="md-math-block">${texToMathML(tex.trim(), true)}</div>`));

    const lines = text.split('\n');
    const out = [];
    let index = 0;
    const blank = (line) => !line.trim();
    const tokenAt = (line) => /^\s*\u0000(\d+)\u0000\s*$/.exec(line);

    while (index < lines.length) {
      const line = lines[index];
      if (blank(line)) { index += 1; continue; }

      const token = tokenAt(line);
      if (token) {
        out.push(stash[Number(token[1])]);
        index += 1;
        continue;
      }

      const heading = /^(#{1,6})\s+(.*)$/.exec(line);
      if (heading) {
        const level = heading[1].length;
        out.push(`<h${level}>${inline(heading[2].trim())}</h${level}>`);
        index += 1;
        continue;
      }

      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
        out.push('<hr>');
        index += 1;
        continue;
      }

      if (/^\s*>\s?/.test(line)) {
        const quote = [];
        while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
          quote.push(lines[index].replace(/^\s*>\s?/, ''));
          index += 1;
        }
        out.push(`<blockquote>${quote.map(inline).join('<br>')}</blockquote>`);
        continue;
      }

      if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
        const ordered = /^\s*\d+[.)]\s+/.test(line);
        const items = [];
        while (index < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[index])) {
          let item = lines[index].replace(/^\s*([-*+]|\d+[.)])\s+/, '');
          let checkbox = '';
          const task = /^\[([ xX])\]\s+(.*)$/.exec(item);
          if (task) {
            checkbox = `<span class="md-check">${task[1].toLowerCase() === 'x' ? '☑' : '☐'}</span> `;
            item = task[2];
          }
          items.push(`<li>${checkbox}${inline(item)}</li>`);
          index += 1;
          while (index < lines.length && /^\s{2,}\S/.test(lines[index]) && !/^\s*([-*+]|\d+[.)])\s+/.test(lines[index])) {
            const extra = inline(lines[index].trim());
            items[items.length - 1] = items[items.length - 1].replace(/<\/li>$/, ` ${extra}</li>`);
            index += 1;
          }
        }
        out.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`);
        continue;
      }

      if (/^\s*\|/.test(line) && index + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[index + 1])) {
        const table = [];
        while (index < lines.length && /^\s*\|/.test(lines[index])) {
          table.push(lines[index]);
          index += 1;
        }
        out.push(renderTable(table));
        continue;
      }

      const paragraph = [line];
      index += 1;
      while (index < lines.length && !blank(lines[index]) &&
             !/^(#{1,6})\s+/.test(lines[index]) &&
             !/^\s*([-*+]|\d+[.)])\s+/.test(lines[index]) &&
             !/^\s*>/.test(lines[index]) &&
             !/^\s*\|/.test(lines[index]) &&
             !tokenAt(lines[index]) &&
             !/^\s*([-*_])(\s*\1){2,}\s*$/.test(lines[index])) {
        paragraph.push(lines[index]);
        index += 1;
      }
      out.push(`<p>${paragraph.map(inline).join('<br>')}</p>`);
    }

    return out.join('\n');
  }

  window.RlogMarkdown = { render, texToMathML };
})();
