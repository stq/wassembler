var wasm = {};

(function(exports) {

  exports.ConstI32 = function(args) {
    return {
      type: "const_i32",
      value: args.value
    };
  };

  exports.ConstF32 = function(args) {
    return {
      type: "const_f32",
      value: args.value
    };
  };

  // Should only be generated by the parser.
  exports.GetName = function(args) {
    return {
      type: "getname",
      name: args.name
    };
  };

  exports.GetFunction = function(args) {
    return {
      type: "getfunction",
      index: args.index
    };
  };

  exports.GetExtern = function(args) {
    return {
      type: "getextern",
      index: args.index
    };
  };

  exports.GetLocal = function(args) {
    return {
      type: "getlocal",
      index: args.index
    };
  };

  exports.BinaryOp = function(args) {
    return {
      type: "binop",
      left: args.left,
      op: args.op, right:
      args.right
    };
  };

  // Should only be generated by the parser.
  exports.Call = function(args) {
    return {
      type: "call",
      expr: args.expr,
      args: args.args
    };
  };

  exports.CallDirect = function(args) {
    return {
      type: "calldirect",
      func: args.func,
      args: args.args
    };
  };

  exports.CallExternal = function(args) {
    return {
      type: "callexternal",
      func: args.func,
      args: args.args
    };
  };

  exports.Return = function(args) {
    return {
      type: "return",
      expr: args.expr
    };
  };

  exports.Param = function(args) {
    return {
      type: "param",
      name: args.name,
      ptype: args.ptype
    };
  };

  exports.Local = function(args) {
    return {
      type: "local",
      name: args.name,
      ltype: args.ltype,
      index: args.index,
    };
  };

  exports.Function = function(args) {
    return {
      type: "function",
      exportFunc: args.exportFunc,
      name: args.name,
      params: args.params,
      returnType: args.returnType,
      locals: [],
      body: args.body
    };
  };

  exports.Extern = function(args) {
    return {
      type: "extern",
      name: args.name,
      args: args.args,
      returnType: args.returnType
    };
  };

  exports.Module = function(args) {
    return {
      type: "module",
      externs: args.externs,
      funcs: args.funcs,
    };
  };


  var SemanticPass = function() {
  };

  SemanticPass.prototype.processExpr = function(expr) {
    switch(expr.type) {
    case "const_i32":
      expr.etype = "i32";
      return expr;
    case "const_f32":
      expr.etype = "f32";
      return expr;
    case "getname":
      var ref = this.localScope[expr.name];
      if (ref !== undefined) {
	var lcl = wasm.GetLocal({index: ref.index});
	lcl.etype = ref.ltype;
	return lcl;
      }

      var ref = this.moduleScope[expr.name];
      if (ref !== undefined) {
	switch(ref.type) {
	case "function":
	  return wasm.GetFunction({index: ref.index});
        case "extern":
	  return wasm.GetExtern({index: ref.index});
	default:
	  throw ref;
	}
      }

      throw expr;
    case "getlocal":
      expr.etype = this.func.locals[expr.index];
      return expr;
    case "binop":
      expr.left = this.processExpr(expr.left);
      expr.right = this.processExpr(expr.right);
      if (expr.left.etype != expr.right.etype) {
	console.log(expr);
	throw expr;
      }
      expr.etype = expr.left.etype;
      return expr;
    case "call":
      expr.expr = this.processExpr(expr.expr);
      switch (expr.expr.type) {
      case "getfunction":
	expr = wasm.CallDirect({
	  func: expr.expr.index,
	  args: expr.args,
	});
	break;
      case "getextern":
	expr = wasm.CallExternal({
	  func: expr.expr.index,
	  args: expr.args,
	});
	break;
      default:
	throw expr.expr;
      }
      return this.processExpr(expr)
    case "calldirect":
      var target = this.module.funcs[expr.func];
      if (expr.args.length != target.params.length) {
	console.log(target);
	throw expr.args.length;
      }
      for (var i = 0; i < expr.args.length; i++) {
	var arg = expr.args[i];
	arg = this.processExpr(arg);
	expr.args[i] = arg;
	if (arg.etype != target.locals[i].ltype) {
	  console.log(i, arg.etype, target.locals[i]);
	  throw expr;
	}
      }
      expr.etype = target.returnType;
      return expr;
    case "callexternal":
      var target = this.module.externs[expr.func];
      if (expr.args.length != target.args.length) {
	console.log(target);
	throw expr.args.length;
      }
      for (var i = 0; i < expr.args.length; i++) {
	var arg = expr.args[i];
	arg = this.processExpr(arg);
	expr.args[i] = arg;
	if (arg.etype != target.args[i]) {
	  console.log(i, arg.etype, target.args[i]);
	  throw expr;
	}
      }
      expr.etype = target.returnType;
      return expr;
    case "return":
      expr.expr = this.processExpr(expr.expr);
      expr.etype = "void";
      return expr;
    default:
      throw expr;
    }
  };

  SemanticPass.prototype.createLocal = function(name, type) {
    var lcl = wasm.Local({
      name: name,
      ltype: type,
      index: this.func.locals.length
    });
    this.func.locals.push(lcl);
    this.localScope[name] = lcl;
    return lcl.index;
  };

  SemanticPass.prototype.processFunction = function(func) {
    this.func = func;
    this.localScope = {};

    for (var i in func.params) {
      var p = func.params[i];
      p.index = this.createLocal(p.name, p.ptype);
    }

    for (var i in func.body) {
      func.body[i] = this.processExpr(func.body[i]);
    }
  };

  SemanticPass.prototype.processModule = function(module) {
    this.module = module;

    // Index
    this.moduleScope = {};
    for (var i in module.externs) {
      var e = module.externs[i];
      e.index = i;
      this.moduleScope[e.name] = e;
    }
    for (var i in module.funcs) {
      var func = module.funcs[i];
      func.index = i;
      this.moduleScope[func.name] = func;
    }

    // Process
    for (var i in module.funcs) {
      this.processFunction(module.funcs[i]);
    }
  };


  var CodeWriter = function() {
    this.margins = [];
    this.margin = "";
    this.output = "";
    this.dirty = false;
  };

  CodeWriter.prototype.out = function(text) {
    if (!this.dirty) {
      this.output += this.margin;
      this.dirty = true;
    }
    this.output += text;
    return this;
  };

  CodeWriter.prototype.eol = function() {
    this.output += "\n";
    this.dirty = false;
    return this;
  };

  CodeWriter.prototype.indent = function() {
    this.margins.push(this.margin);
    this.margin += "  ";
    return this;
  };

  CodeWriter.prototype.dedent = function() {
    this.margin = this.margins.pop();
    return this;
  };

  var JSGenerator = function(m) {
    this.m = m;
    this.writer = new CodeWriter();
  };

  JSGenerator.prototype.beginTypeCoerce = function(etype) {
    switch (etype) {
    case "i32":
      this.writer.out("(");
      break;
    case "f32":
      this.writer.out("Math.fround(");
      break;    
    case "void":
      break;
    default:
      throw etype;
    }
  };

  JSGenerator.prototype.endTypeCoerce = function(etype) {
    switch (etype) {
    case "i32":
      this.writer.out("|0)");
      break;
    case "f32":
      this.writer.out(")");
      break;
    case "void":
      break;
    default:
      throw etype;
    }
  };

  // TODO precedence.
  JSGenerator.prototype.generateExpr = function(expr) {
    switch (expr.type) {
    case "const_i32":
      this.writer.out(expr.value);
      break;
    case "const_f32":
      this.beginTypeCoerce(expr.etype);
      this.writer.out(expr.value);
      this.endTypeCoerce(expr.etype);
      break;
    case "getlocal":
      var lcl = this.func.locals[expr.index];
      this.writer.out(lcl.name);
      break;
    case "binop":
      this.beginTypeCoerce(expr.etype);
      this.writer.out("(");
      this.generateExpr(expr.left);
      this.writer.out(" ").out(expr.op).out(" ");
      this.generateExpr(expr.right);
      this.writer.out(")");
      this.endTypeCoerce(expr.etype);
      break;
    case "callexternal":
      this.beginTypeCoerce(expr.etype);
      this.writer.out(this.m.externs[expr.func].name);
      this.writer.out("(");
      for (var i in expr.args) {
	if (i != 0) {
	  this.writer.out(", ")
	}
	this.generateExpr(expr.args[i]);
      }
      this.writer.out(")");
      this.endTypeCoerce(expr.etype);
      break;
    case "calldirect":
      this.beginTypeCoerce(expr.etype);
      this.writer.out(this.m.funcs[expr.func].name);
      this.writer.out("(");
      for (var i in expr.args) {
	if (i != 0) {
	  this.writer.out(", ")
	}
	this.generateExpr(expr.args[i]);
      }
      this.writer.out(")");
      this.endTypeCoerce(expr.etype);
      break;
    case "return":
      this.writer.out("return ");
      this.generateExpr(expr.expr);
      break;
    default:
      console.log(expr);
      throw expr.type;
    };
  };

  JSGenerator.prototype.generateBlock = function(block) {
    for (var i in block) {
      this.generateExpr(block[i]);
      this.writer.out(";").eol();
    }
  };

  JSGenerator.prototype.generateFunc = function(func) {
    this.func = func;

    this.writer.out("function ").out(func.name).out("(");
    for (var i = 0; i < func.params.length; i++) {
      var lcl = func.locals[func.params[i].index];
      if (i != 0) {
	this.writer.out(", ");
      }
      this.writer.out(lcl.name);
    }
    this.writer.out(") {").eol();
    this.writer.indent();

    // HACK assumes params come first.
    for (var i = 0; i < func.params.length; i++) {
      var lcl = func.locals[i];
      this.writer.out(lcl.name).out(" = ");
      this.beginTypeCoerce(func.locals[i].ltype);
      this.writer.out(lcl.name);
      this.endTypeCoerce(func.locals[i].ltype);
      this.writer.out(";").eol();
    }

    for (var i = func.params.length; i < func.locals.length; i++) {
      this.writer.out("var ").out(lcl.name).out(" = 0;").eol();
      // TODO initialize to the correct type of zero.
    }

    this.generateBlock(func.body);
    this.writer.dedent();
    this.writer.out("}").eol();
  };

  JSGenerator.prototype.generateModule = function(module) {
    this.writer.out("(function(imports) {").eol().indent();
    for (var i in module.externs) {
      var extern = module.externs[i];
      this.writer.out("var ").out(extern.name).out(" = imports.").out(extern.name).out(";").eol();
    };

    for (var i in module.funcs) {
      this.generateFunc(module.funcs[i]);
    };
    this.writer.out("return {").eol().indent();
    for (var i in module.funcs) {
      var func = module.funcs[i];
      if (!func.exportFunc) continue;
      this.writer.out(func.name).out(": ").out(func.name).out(",").eol();
    };
    this.writer.dedent().out("};").eol();
    this.writer.dedent().out("})");
  };

  exports.GenerateJS = function(module) {
    var semantic = new SemanticPass();
    semantic.processModule(module);

    var gen = new JSGenerator(module);
    gen.generateModule(module);
    return gen.writer.output;
  };

})(wasm);
