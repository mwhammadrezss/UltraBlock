/**
 * ══════════════════════════════════════════════════════════════
 *   UltraBlock — scriptlet-registry.js  v1.0
 *   Registers all available scriptlets with the ScriptletEngine
 *
 *   Each scriptlet is registered as a string of code that will
 *   be injected into the page context. The code expects an `args`
 *   variable to be defined in scope by the engine wrapper.
 * ══════════════════════════════════════════════════════════════
 */
'use strict';

(function() {
  if (typeof UBScriptletEngine === 'undefined') return;

  // ═══════════════════════════════════════════════════════════════════════
  //  CORE SCRIPTLETS (most commonly used in filter lists)
  // ═══════════════════════════════════════════════════════════════════════

  UBScriptletEngine.registerScriptlet('abort-on-property-read', [
    'var prop = args[0]; if (!prop) return;',
    'var owner = window; var chain = prop.split(".");',
    'for (var i = 0; i < chain.length - 1; i++) {',
    '  if (!owner[chain[i]]) owner[chain[i]] = {};',
    '  owner = owner[chain[i]];',
    '}',
    'var last = chain[chain.length - 1];',
    'Object.defineProperty(owner, last, {',
    '  get: function() { throw new ReferenceError("blocked by UltraBlock"); },',
    '  set: function() {},',
    '  configurable: true',
    '});'
  ].join('\n'), ['aopr']);

  UBScriptletEngine.registerScriptlet('abort-on-property-write', [
    'var prop = args[0]; if (!prop) return;',
    'var owner = window; var chain = prop.split(".");',
    'for (var i = 0; i < chain.length - 1; i++) {',
    '  if (!owner[chain[i]]) owner[chain[i]] = {};',
    '  owner = owner[chain[i]];',
    '}',
    'var last = chain[chain.length - 1];',
    'var val = owner[last];',
    'Object.defineProperty(owner, last, {',
    '  get: function() { return val; },',
    '  set: function() { throw new Error("write blocked by UltraBlock"); },',
    '  configurable: true',
    '});'
  ].join('\n'), ['aopw']);

  UBScriptletEngine.registerScriptlet('set-constant', [
    'var prop = args[0]; var value = args[1];',
    'if (!prop) return;',
    'var realValue;',
    'switch(value) {',
    '  case "true": realValue = true; break;',
    '  case "false": realValue = false; break;',
    '  case "null": realValue = null; break;',
    '  case "undefined": realValue = undefined; break;',
    '  case "noopFunc": realValue = function(){}; break;',
    '  case "trueFunc": realValue = function(){return true;}; break;',
    '  case "falseFunc": realValue = function(){return false;}; break;',
    '  case "emptyObj": realValue = {}; break;',
    '  case "emptyArr": realValue = []; break;',
    '  case "emptyStr": realValue = ""; break;',
    '  case "": realValue = ""; break;',
    '  default:',
    '    if (/^\\d+$/.test(value)) realValue = parseInt(value);',
    '    else if (/^\\d+\\.\\d+$/.test(value)) realValue = parseFloat(value);',
    '    else realValue = value;',
    '}',
    'var owner = window; var chain = prop.split(".");',
    'for (var i = 0; i < chain.length - 1; i++) {',
    '  if (typeof owner[chain[i]] === "undefined") owner[chain[i]] = {};',
    '  owner = owner[chain[i]];',
    '}',
    'var last = chain[chain.length - 1];',
    'try {',
    '  Object.defineProperty(owner, last, {',
    '    get: function() { return realValue; },',
    '    set: function() {},',
    '    configurable: true,',
    '    enumerable: true',
    '  });',
    '} catch(e) { owner[last] = realValue; }'
  ].join('\n'), ['set']);

  UBScriptletEngine.registerScriptlet('json-prune', [
    'var rawPaths = args[0] || ""; var rawNeedle = args[1] || "";',
    'var paths = rawPaths.split(/\\s+/);',
    'var origParse = JSON.parse;',
    'JSON.parse = function() {',
    '  var obj = origParse.apply(JSON, arguments);',
    '  if (!obj || typeof obj !== "object") return obj;',
    '  if (rawNeedle && JSON.stringify(obj).indexOf(rawNeedle) === -1) return obj;',
    '  for (var i = 0; i < paths.length; i++) {',
    '    var keys = paths[i].split(".");',
    '    var target = obj;',
    '    for (var j = 0; j < keys.length - 1; j++) {',
    '      if (!target[keys[j]]) break;',
    '      target = target[keys[j]];',
    '    }',
    '    if (j === keys.length - 1) delete target[keys[keys.length - 1]];',
    '  }',
    '  return obj;',
    '};'
  ].join('\n'));

  UBScriptletEngine.registerScriptlet('prevent-setTimeout', [
    'var match = args[0] || ""; var delay = args[1] || "";',
    'var origST = window.setTimeout;',
    'window.setTimeout = function(fn, d) {',
    '  var s = typeof fn === "function" ? fn.toString() : String(fn);',
    '  var shouldBlock = false;',
    '  if (match && s.indexOf(match) !== -1) shouldBlock = true;',
    '  if (delay && String(d) === delay) shouldBlock = true;',
    '  if (!match && !delay) shouldBlock = true;',
    '  if (shouldBlock) return 0;',
    '  return origST.apply(window, arguments);',
    '};'
  ].join('\n'), ['no-setTimeout-if', 'nostif']);

  UBScriptletEngine.registerScriptlet('prevent-setInterval', [
    'var match = args[0] || ""; var delay = args[1] || "";',
    'var origSI = window.setInterval;',
    'window.setInterval = function(fn, d) {',
    '  var s = typeof fn === "function" ? fn.toString() : String(fn);',
    '  var shouldBlock = false;',
    '  if (match && s.indexOf(match) !== -1) shouldBlock = true;',
    '  if (delay && String(d) === delay) shouldBlock = true;',
    '  if (!match && !delay) shouldBlock = true;',
    '  if (shouldBlock) return 0;',
    '  return origSI.apply(window, arguments);',
    '};'
  ].join('\n'), ['no-setInterval-if', 'nosif']);

  UBScriptletEngine.registerScriptlet('prevent-addEventListener', [
    'var type = args[0] || ""; var pattern = args[1] || "";',
    'var origAEL = EventTarget.prototype.addEventListener;',
    'EventTarget.prototype.addEventListener = function(t, handler, opts) {',
    '  if (type && t !== type) return origAEL.apply(this, arguments);',
    '  if (pattern && handler) {',
    '    var s = typeof handler === "function" ? handler.toString() : "";',
    '    if (s.indexOf(pattern) !== -1) return;',
    '  }',
    '  if (!type && !pattern) return;',
    '  return origAEL.apply(this, arguments);',
    '};'
  ].join('\n'), ['aeld']);

  UBScriptletEngine.registerScriptlet('nowebrtc', [
    'var origRTC = window.RTCPeerConnection || window.webkitRTCPeerConnection;',
    'var FakeRTC = function() {',
    '  this.close = function(){};',
    '  this.createDataChannel = function(){ return {}; };',
    '  this.createOffer = function(){ return Promise.resolve({}); };',
    '  this.setLocalDescription = function(){ return Promise.resolve(); };',
    '  this.setRemoteDescription = function(){ return Promise.resolve(); };',
    '  this.addEventListener = function(){};',
    '  this.removeEventListener = function(){};',
    '};',
    'window.RTCPeerConnection = FakeRTC;',
    'window.webkitRTCPeerConnection = FakeRTC;'
  ].join('\n'));

  UBScriptletEngine.registerScriptlet('remove-attr', [
    'var attrs = args[0] || ""; var selector = args[1] || "*";',
    'if (!attrs) return;',
    'var attrList = attrs.split("|");',
    'var remove = function() {',
    '  var els = document.querySelectorAll(selector);',
    '  for (var i = 0; i < els.length; i++) {',
    '    for (var j = 0; j < attrList.length; j++) {',
    '      els[i].removeAttribute(attrList[j].trim());',
    '    }',
    '  }',
    '};',
    'remove();',
    'new MutationObserver(remove).observe(document.documentElement, {',
    '  attributes: true, childList: true, subtree: true',
    '});'
  ].join('\n'), ['ra']);

  UBScriptletEngine.registerScriptlet('remove-class', [
    'var classes = args[0] || ""; var selector = args[1] || "*";',
    'if (!classes) return;',
    'var classList = classes.split("|");',
    'var remove = function() {',
    '  var els = document.querySelectorAll(selector);',
    '  for (var i = 0; i < els.length; i++) {',
    '    for (var j = 0; j < classList.length; j++) {',
    '      els[i].classList.remove(classList[j].trim());',
    '    }',
    '  }',
    '};',
    'remove();',
    'new MutationObserver(remove).observe(document.documentElement, {',
    '  attributes: true, childList: true, subtree: true',
    '});'
  ].join('\n'), ['rc']);

  UBScriptletEngine.registerScriptlet('nano-setInterval-booster', [
    'var match = args[0] || ""; var delay = args[1] || ""; var boost = parseFloat(args[2]) || 0.05;',
    'var origSI = window.setInterval;',
    'window.setInterval = function(fn, d) {',
    '  var s = typeof fn === "function" ? fn.toString() : String(fn);',
    '  var shouldBoost = false;',
    '  if (match && s.indexOf(match) !== -1) shouldBoost = true;',
    '  if (delay && String(d) === delay) shouldBoost = true;',
    '  if (!match && !delay) shouldBoost = true;',
    '  if (shouldBoost) d = Math.max(1, Math.round(d * boost));',
    '  return origSI.call(window, fn, d);',
    '};'
  ].join('\n'), ['nano-sib']);

  UBScriptletEngine.registerScriptlet('nano-setTimeout-booster', [
    'var match = args[0] || ""; var delay = args[1] || ""; var boost = parseFloat(args[2]) || 0.05;',
    'var origST = window.setTimeout;',
    'window.setTimeout = function(fn, d) {',
    '  var s = typeof fn === "function" ? fn.toString() : String(fn);',
    '  var shouldBoost = false;',
    '  if (match && s.indexOf(match) !== -1) shouldBoost = true;',
    '  if (delay && String(d) === delay) shouldBoost = true;',
    '  if (!match && !delay) shouldBoost = true;',
    '  if (shouldBoost) d = Math.max(1, Math.round(d * boost));',
    '  return origST.call(window, fn, d);',
    '};'
  ].join('\n'), ['nano-stb']);

  UBScriptletEngine.registerScriptlet('prevent-window-open', [
    'var match = args[0] || "";',
    'var origOpen = window.open;',
    'window.open = function(url) {',
    '  url = url || "";',
    '  if (!match || url.indexOf(match) !== -1) {',
    '    return { closed: false, close: function(){}, focus: function(){},',
    '             blur: function(){}, location: {href:url}, document: {write:function(){}} };',
    '  }',
    '  return origOpen.apply(window, arguments);',
    '};'
  ].join('\n'), ['nowoif', 'no-window-open-if']);

  UBScriptletEngine.registerScriptlet('disable-newtab-links', [
    'document.addEventListener("click", function(e) {',
    '  var link = e.target.closest("a[target=_blank]");',
    '  if (link) { link.removeAttribute("target"); }',
    '}, true);'
  ].join('\n'));

  UBScriptletEngine.registerScriptlet('window-close-if', [
    'var match = args[0] || "";',
    'if (!match || location.href.indexOf(match) !== -1) {',
    '  window.close = function() {};',
    '}'
  ].join('\n'));

  UBScriptletEngine.registerScriptlet('prevent-refresh', [
    'var delay = args[0] || "";',
    'var metas = document.querySelectorAll("meta[http-equiv=refresh]");',
    'for (var i = 0; i < metas.length; i++) {',
    '  var content = metas[i].getAttribute("content") || "";',
    '  if (!delay || content.indexOf(delay) !== -1) { metas[i].remove(); }',
    '}',
    '// Also prevent location.reload',
    'if (!delay) {',
    '  var origReload = location.reload;',
    '  Object.defineProperty(location, "reload", { value: function(){} });',
    '}'
  ].join('\n'));

  UBScriptletEngine.registerScriptlet('no-floc', [
    'if (document.interestCohort) document.interestCohort = function(){ return Promise.reject(); };',
    'if (document.browsingTopics) document.browsingTopics = function(){ return Promise.resolve([]); };'
  ].join('\n'), ['no-topics']);

  UBScriptletEngine.registerScriptlet('overlay-buster', [
    'var bust = function() {',
    '  var els = document.querySelectorAll("div,section");',
    '  for (var i = 0; i < els.length; i++) {',
    '    var s = window.getComputedStyle(els[i]);',
    '    if (s.position==="fixed" && parseInt(s.zIndex)>999 && els[i].offsetWidth > window.innerWidth*0.8 && els[i].offsetHeight > window.innerHeight*0.8) {',
    '      els[i].remove();',
    '      document.documentElement.style.overflow = "";',
    '      document.body.style.overflow = "";',
    '    }',
    '  }',
    '};',
    'setTimeout(bust, 1000); setTimeout(bust, 3000);',
    'new MutationObserver(function(){setTimeout(bust,100)}).observe(document.documentElement,{childList:true,subtree:true});'
  ].join('\n'));

  UBScriptletEngine.registerScriptlet('log', [
    'console.log("[UltraBlock Scriptlet Log]", args.join(", "));'
  ].join('\n'));

  console.log('[UltraBlock/ScriptletRegistry] Registered ' + UBScriptletEngine.getRegisteredNames().length + ' scriptlets');

})();
