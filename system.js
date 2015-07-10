var system = {};

(function(system) {
  // Memory management
  var top = 0;
  system.setTop = function(ptr) {
    top = ptr;
  };
  system.alloc = function(amt) {
    var temp = top;
    top += amt;
    return temp;
  };

  // Math
  system.sqrtF32 = function(value) {
    return Math.fround(Math.sqrt(value));
  };
  system.sqrtF64 = function(value) {
    return Math.sqrt(value);
  };
  system.sinF32 = function(value) {
    return Math.fround(Math.sin(value));
  };
  system.sinF64 = function(value) {
    return Math.sin(value);
  };
  system.cosF32 = function(value) {
    return Math.fround(Math.cos(value));
  };
  system.cosF64 = function(value) {
    return Math.cos(value);
  };

  // Threading
  system.threadingSupported = function() {
    return threading_supported;
  };

  if (threading_supported) {
    var I32 = new SharedInt32Array(buffer);

    system.atomicLoadI32 = function(addr) {
      return Atomics.load(I32, addr >> 2);
    };

    system.atomicStoreI32 = function(addr, value) {
      Atomics.store(I32, addr >> 2, value);
    };

    system.atomicCompareExchangeI32 = function(addr, expected, value) {
      return Atomics.store(I32, addr >> 2, expected, value);
    };
  }
})(system);