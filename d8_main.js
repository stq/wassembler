if (!this.WASM) {
  throw "You need to patch v8 to support WASM.";
}

// Minimal require.js polyfill for d8.
var cache = {};
var resolving = null;

function resolve(name) {
  if (name in cache) {
    return cache[name];
  }
  cache[name] = {};
  resolving = name;
  load(name + ".js");
  return cache[name];
}

function define(deps, module) {
  var name = resolving;
  var resolved = [];
  for (var i = 0; i < deps.length; i++) {
    resolved.push(resolve(deps[i]));
  }
  var result = module.apply(module, resolved);
  cache[name] = result;
}

load("third_party/peg-0.8.0.js");

// Run the assembler.
var base = resolve("base");
var desugar = resolve("wasm/desugar");
var wasm_backend_v8 = resolve("v8/backend");

var status = new base.Status(function(message) {
  print(message);
});

var grammar = read("wasm.pegjs");
var parser = base.createParser(grammar, status);

var systemWASMSrc = read("d8_system.wasm");
var systemJSSrc = read("system.js");

function compile(filename) {
  var text = read(filename);

  var module = base.frontend(systemWASMSrc, filename, text, parser, status);
  if (status.num_errors > 0) {
    return null;
  }

  module = desugar.process(module);

  var compiled = base.astToCompiledJS(module, systemJSSrc, {}, status);
  if (status.num_errors > 0) {
    return null;
  }

  var instance = compiled({});

  // Generate binary encoding
  var buffer = wasm_backend_v8.generate(module);
  print("bytes:", new Uint8Array(buffer));
  print("num bytes:", buffer.byteLength);
  print();

  print("JS result:", instance.main());
  print("V8 result:", WASM.compileRun(buffer));
}

if (arguments.length != 1) {
  print("Usage: d8 d8_main.js -- file.wasm");
  // TODO exit code.
} else {
  var filename = arguments[0];
  compile(filename);
}
