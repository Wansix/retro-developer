const quoted = /"(?:\\[^\r\n]|[^"\\\r\n])*"?|'(?:\\[^\r\n]|[^'\\\r\n])*'?/.source;
const slashComments = /\/\/[^\r\n]*|\/\*[\s\S]*?(?:\*\/|(?![\s\S]))/.source;
const numbers = /(?:0[xX][\da-fA-F]+|0[bB][01]+|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/.source;
const words = /[a-zA-Z_$][\w$]*/.source;

function lexer(comment, strings, keywords, builtins, directive = null) {
  const syntax = [
    ["comment", comment], ["string", strings], ["directive", directive],
    ["number", numbers], ["word", words],
  ];
  return {
    pattern: new RegExp(syntax.filter(([, expression]) => expression)
      .map(([kind, expression]) => "(?<" + kind + ">" + expression + ")").join("|"), "gm"),
    keywords: new Set(keywords.split(" ")),
    builtins: new Set(builtins.split(" ")),
  };
}

const lexers = {
  python: lexer(
    /#[^\r\n]*/.source,
    /"""[\s\S]*?(?:"""|(?![\s\S]))|'''[\s\S]*?(?:'''|(?![\s\S]))/.source + "|" + quoted,
    "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield",
    "abs bool dict enumerate float input int len list max min print range round set sorted str sum tuple zip",
  ),
  javascript: lexer(
    slashComments,
    /`(?:\\[\s\S]|[^`\\])*`?/.source + "|" + quoted,
    "async await break case catch class const continue debugger default delete do else export extends false finally for function if import in instanceof let new null return static super switch this throw true try typeof var void while yield",
    "Array Boolean console Date JSON Math Number Object String undefined NaN",
  ),
  cpp: lexer(
    slashComments,
    quoted,
    "alignas auto bool break case char class const constexpr continue default delete do double else enum explicit false float for if int long namespace new nullptr private protected public return short signed size_t static struct switch template this throw true typedef typename union unsigned using void volatile while",
    "cin cout endl find lower_bound map max min nullopt optional pair set sort std string vector",
    /^[ \t]*#[ \t]*[a-z_]+/i.source,
  ),
};

export function mountCodeHighlight(editor, layer) {
  let language = "python";
  function syncScroll() {
    layer.style.transform = `translate(${-editor.scrollLeft}px, ${-editor.scrollTop}px)`;
  }

  function paint(value = language) {
    language = value;
    const { pattern, keywords, builtins } = lexers[language];
    const source = editor.value;
    const content = document.createDocumentFragment();
    let offset = 0;
    for (const match of source.matchAll(pattern)) {
      const token = match[0];
      const { comment, string, directive, number } = match.groups;
      const kind = comment ? "comment" : string ? "string" : directive ? "directive" :
        number ? "number" : keywords.has(token) ? "keyword" : builtins.has(token) ? "builtin" : null;
      if (!kind) continue;
      if (match.index > offset) content.append(source.slice(offset, match.index));
      const span = document.createElement("span");
      span.className = "code-" + kind;
      span.textContent = token;
      content.append(span);
      offset = match.index + token.length;
    }
    content.append(source.slice(offset));
    layer.replaceChildren(content);
    syncScroll();
  }

  editor.addEventListener("scroll", syncScroll, { passive: true });
  editor.addEventListener("input", () => paint());
  return paint;
}
